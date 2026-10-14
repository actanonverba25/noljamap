/* Supabase 제보·투표 백엔드 (PostgREST 직접 호출, 라이브러리 불필요).
   publishable 키는 클라이언트 노출 안전 — RLS가 보호(익명 insert + live만 read). */
const SB_URL = "https://lxgcocblgulxjqfjvwfg.supabase.co";
const SB_KEY = "sb_publishable_ztkKhhHjrANrspaKy2UK8A_SYVhJURB";
const SB_HEADERS = {
  apikey: SB_KEY,
  Authorization: "Bearer " + SB_KEY,
  "Content-Type": "application/json",
};

// live 제보 전체 (최신순)
async function fetchSubmissions() {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/submissions?select=*&status=eq.live&order=created_at.desc`,
      { headers: SB_HEADERS }
    );
    if (!r.ok) { console.warn("submissions load", r.status); return []; }
    return await r.json();
  } catch (e) { console.warn("submissions load err", e); return []; }
}

// 제보 등록 → 등록된 row 반환
async function submitReport(payload) {
  const r = await fetch(`${SB_URL}/rest/v1/submissions`, {
    method: "POST",
    headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ status: "live", ...payload }),
  });
  if (!r.ok) throw new Error("제보 실패 " + r.status + ": " + (await r.text()));
  return (await r.json())[0];
}

// 투표 (물좋음 up/down · 붐빔 busy/ok/empty)
async function submitVote(venue_id, kind) {
  try {
    await fetch(`${SB_URL}/rest/v1/votes`, {
      method: "POST", headers: SB_HEADERS,
      body: JSON.stringify({ venue_id, kind }),
    });
  } catch (e) { console.warn("vote err", e); }
}

// 업장별 댓글 수 {venue_id: count}
async function fetchReviewCounts() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/reviews?select=venue_id`, { headers: SB_HEADERS });
    if (!r.ok) return {};
    const rows = await r.json();
    const c = {};
    rows.forEach((x) => (c[x.venue_id] = (c[x.venue_id] || 0) + 1));
    return c;
  } catch (e) { return {}; }
}

// 업장별 투표 raw (kind + created_at) — 물좋음 all-time, 붐빔 최근가중 집계용
async function fetchVotes(venue_id) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/votes?select=kind,created_at&venue_id=eq.${encodeURIComponent(venue_id)}`,
      { headers: SB_HEADERS });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}

// 이름+지역으로 카카오 대표사진 찾기 (제보 자동 썸네일). 실패해도 조용히 null.
async function fetchVenueThumb(name, region) {
  try {
    const r = await fetch(`${SB_URL}/functions/v1/venue-thumb`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ name, region }),
    });
    if (!r.ok) return null;
    return await r.json();   // { thumb, place_url, match }
  } catch (e) { return null; }
}

// 사진 업로드 (Storage) → photos 테이블 기록 → 공개 URL 반환
async function uploadPhoto(file, venueId) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safe = venueId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${safe}/${Date.now()}.${ext || "jpg"}`;
  const up = await fetch(`${SB_URL}/storage/v1/object/photos/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!up.ok) throw new Error("업로드 실패 " + up.status);
  const url = `${SB_URL}/storage/v1/object/public/photos/${path}`;
  const ins = await fetch(`${SB_URL}/rest/v1/photos`, {
    method: "POST", headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ venue_id: venueId, url }),
  });
  if (!ins.ok) throw new Error("사진 기록 실패 " + ins.status);
  return (await ins.json())[0];
}
async function fetchPhotos(venueId) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/photos?select=url,created_at&venue_id=eq.${encodeURIComponent(venueId)}&order=created_at.desc`,
      { headers: SB_HEADERS });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}
// 여러 업장의 대표 사진 1장씩 {venue_id: url} (마커용)
async function fetchPhotoThumbs() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/photos?select=venue_id,url&order=created_at.desc`, { headers: SB_HEADERS });
    if (!r.ok) return {};
    const rows = await r.json();
    const m = {};
    for (const x of rows) if (!m[x.venue_id]) m[x.venue_id] = x.url; // 최신 1장
    return m;
  } catch (e) { return {}; }
}

// 업장별 리뷰·댓글 (최신순)
async function fetchReviews(venue_id) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/reviews?select=*&venue_id=eq.${encodeURIComponent(venue_id)}&order=created_at.desc`,
      { headers: SB_HEADERS }
    );
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}
async function submitReview(venue_id, text) {
  const r = await fetch(`${SB_URL}/rest/v1/reviews`, {
    method: "POST",
    headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ venue_id, text }),
  });
  if (!r.ok) throw new Error("댓글 등록 실패 " + r.status);
  return (await r.json())[0];
}

// 업장별 투표 집계 {venue_id: {up,down,busy,ok,empty}}
async function fetchVoteCounts() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/votes?select=venue_id,kind`, { headers: SB_HEADERS });
    if (!r.ok) return {};
    const rows = await r.json();
    const agg = {};
    for (const v of rows) {
      (agg[v.venue_id] ||= {});
      agg[v.venue_id][v.kind] = (agg[v.venue_id][v.kind] || 0) + 1;
    }
    return agg;
  } catch (e) { return {}; }
}

/* ===================== 놀자방 (커뮤니티 게시판) ===================== */
// 글 목록 (카테고리·지역 필터, 최신순)
async function fetchPosts({ category, region, limit = 60, offset = 0 } = {}) {
  try {
    let q = `${SB_URL}/rest/v1/posts?select=*&status=eq.live&order=created_at.desc&limit=${limit}`;
    if (offset) q += `&offset=${offset}`;
    if (category && category !== "전체" && category !== "베스트")
      q += `&category=eq.${encodeURIComponent(category)}`;
    if (region) q += `&region=eq.${encodeURIComponent(region)}`;
    const r = await fetch(q, { headers: SB_HEADERS });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}
// 단일 글
async function fetchPost(id) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/posts?select=*&id=eq.${id}`, { headers: SB_HEADERS });
    if (!r.ok) return null;
    return (await r.json())[0] || null;
  } catch (e) { return null; }
}
// 글 등록 → row 반환
async function createPost(payload) {
  const r = await fetch(`${SB_URL}/rest/v1/posts`, {
    method: "POST", headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ status: "live", ...payload }),
  });
  if (!r.ok) throw new Error("글 등록 실패 " + r.status + ": " + (await r.text()));
  return (await r.json())[0];
}
// 비번 삭제 (RPC)
async function deletePost(id, pw) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/delete_post`, {
    method: "POST", headers: SB_HEADERS,
    body: JSON.stringify({ p_id: id, p_pw: pw }),
  });
  if (!r.ok) return false;
  return await r.json();   // boolean
}
// 댓글
async function fetchPostComments(postId) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/post_comments?select=*&post_id=eq.${postId}&order=created_at.asc`, { headers: SB_HEADERS });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}
async function addPostComment(postId, nick, text, pw, parentId) {
  const r = await fetch(`${SB_URL}/rest/v1/post_comments`, {
    method: "POST", headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ post_id: postId, nick, text, pw: pw || null, parent_id: parentId || null }),
  });
  if (!r.ok) throw new Error("댓글 실패 " + r.status);
  return (await r.json())[0];
}
async function deletePostComment(id, pw) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/delete_post_comment`, {
    method: "POST", headers: SB_HEADERS,
    body: JSON.stringify({ c_id: id, c_pw: pw }),
  });
  if (!r.ok) return false;
  return await r.json();
}
// 좋아요 (row 적재)
async function likePost(postId) {
  try {
    await fetch(`${SB_URL}/rest/v1/post_likes`, {
      method: "POST", headers: SB_HEADERS, body: JSON.stringify({ post_id: postId }),
    });
  } catch (e) {}
}
// 피드용 집계 {post_id: count}
async function fetchPostCounts(table) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=post_id`, { headers: SB_HEADERS });
    if (!r.ok) return {};
    const rows = await r.json();
    const c = {};
    rows.forEach((x) => (c[x.post_id] = (c[x.post_id] || 0) + 1));
    return c;
  } catch (e) { return {}; }
}
const fetchPostLikeCounts = () => fetchPostCounts("post_likes");
const fetchPostCommentCounts = () => fetchPostCounts("post_comments");
// 게시판 이미지 업로드 (photos 버킷의 posts/ 폴더 재사용)
async function uploadPostImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `posts/${Date.now()}_${Math.floor(performance.now())}.${ext || "jpg"}`;
  const up = await fetch(`${SB_URL}/storage/v1/object/photos/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!up.ok) throw new Error("이미지 업로드 실패 " + up.status);
  return `${SB_URL}/storage/v1/object/public/photos/${path}`;
}
