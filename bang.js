/* 놀자방 — 나이트라이프 실시간 커뮤니티 게시판 (익명 기반). */

const CATS = [
  { key: "전체", color: "#8A8A99" },
  { key: "🔥지금어때", color: "#E5337E" },
  { key: "후기", color: "#8B5CF6" },
  { key: "같이가요", color: "#2EC4B6" },
  { key: "질문", color: "#3B82F6" },
  { key: "꿀팁", color: "#5DAA2E" },
  { key: "자유", color: "#9C6B43" },
];
const POST_CATS = CATS.filter((c) => c.key !== "전체");   // 글쓰기용
const REGIONS = ["홍대", "이태원", "강남", "건대", "을지로", "부산서면", "대구"];
const catColor = (k) => (CATS.find((c) => c.key === k) || {}).color || "#8A8A99";

const NICK_ADJ = ["바삭한", "새벽감성", "물반고기반", "춤추는", "취한", "흥많은", "조용한", "불금", "심야", "반짝이는", "수줍은", "텐션높은", "느긋한", "화려한", "달리는"];
const NICK_NOUN = ["붕어빵", "디스코볼", "네온", "칵테일", "스피커", "하이볼", "셔플", "단골손님", "첫차", "포차요정", "루프탑", "물병", "관광객", "토끼", "여우"];
function randomNick() {
  const a = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
  const n = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  return a + n + Math.floor(Math.random() * 900 + 100);
}

const bstate = { cat: "전체", region: null, pendingImages: [] };

/* ---------- 유틸 ---------- */
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// 리치텍스트 본문 새니타이즈 (XSS 방지 — 화이트리스트 태그만)
const RTE_OK = { B:1, STRONG:1, I:1, EM:1, S:1, STRIKE:1, U:1, UL:1, OL:1, LI:1, BR:1, P:1, DIV:1, A:1, IMG:1, SPAN:1 };
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  (function walk(node) {
    [...node.childNodes].forEach((c) => {
      if (c.nodeType === 1) {
        if (!RTE_OK[c.tagName]) { const kids = [...c.childNodes]; c.replaceWith(...kids); kids.forEach(walk); return; }
        [...c.attributes].forEach((a) => {
          const n = a.name.toLowerCase();
          if (c.tagName === "A" && n === "href" && /^(https?:|mailto:|\/)/i.test(a.value)) return;
          if (c.tagName === "IMG" && n === "src" && /^https?:/i.test(a.value)) return;
          c.removeAttribute(a.name);
        });
        if (c.tagName === "A") { c.setAttribute("target", "_blank"); c.setAttribute("rel", "noopener"); }
        walk(c);
      } else if (c.nodeType !== 3) c.remove();
    });
  })(doc.body);
  return doc.body.innerHTML;
}
function stripHtml(html) {
  const d = new DOMParser().parseFromString(html || "", "text/html");
  return (d.body.textContent || "").replace(/\s+/g, " ").trim();
}
function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "방금";
  if (d < 3600) return Math.floor(d / 60) + "분 전";
  if (d < 86400) return Math.floor(d / 3600) + "시간 전";
  return Math.floor(d / 86400) + "일 전";
}
function showBanner(html) {
  const el = document.getElementById("banner");
  el.innerHTML = html; el.classList.remove("hidden");
}

/* ---------- 탭/필터 ---------- */
function buildTabs() {
  const el = document.getElementById("catTabs");
  el.innerHTML = "";
  CATS.forEach((c) => {
    const b = document.createElement("button");
    b.className = "btab" + (c.key === bstate.cat ? " active" : "");
    b.textContent = c.key;
    if (c.key === bstate.cat && c.key !== "전체") b.style.background = c.color, b.style.color = "#fff";
    b.onclick = () => { bstate.cat = c.key; buildTabs(); loadFeed(); };
    el.appendChild(b);
  });
  const reg = document.getElementById("regChips");
  reg.innerHTML = "";
  const all = document.createElement("button");
  all.className = "bchip" + (bstate.region ? "" : " active");
  all.textContent = "전체지역";
  all.onclick = () => { bstate.region = null; buildTabs(); loadFeed(); };
  reg.appendChild(all);
  REGIONS.forEach((r) => {
    const b = document.createElement("button");
    b.className = "bchip" + (bstate.region === r ? " active" : "");
    b.textContent = r;
    b.onclick = () => { bstate.region = bstate.region === r ? null : r; buildTabs(); loadFeed(); };
    reg.appendChild(b);
  });
}

/* ---------- 피드 (무한스크롤) ---------- */
const PAGE = 20;
function postCardHtml(p) {
  const img = (p.images && p.images[0]) ? `<img class="pc-thumb" loading="lazy" src="${p.images[0]}" alt="" />` : "";
  const snip = stripHtml(p.content);
  const snippet = snip ? `<p class="pc-snippet">${escapeHtml(snip)}</p>` : "";
  const reg = p.region ? `<span style="color:#c8c8d0">· ${escapeHtml(p.region)}</span>` : "";
  return `<div class="post-card" data-id="${p.id}">
    <div class="pc-body">
      <div class="pc-meta1"><span class="pc-cat" style="background:${catColor(p.category)}">${escapeHtml(p.category)}</span>${reg}</div>
      <h3 class="pc-title">${escapeHtml(p.title)}</h3>
      ${snippet}
      <div class="pc-meta2">
        <span class="pc-nick">${escapeHtml(p.nick)}</span>
        <span>💬 ${bstate.cmtC[p.id] || 0}</span>
        <span>❤️ ${bstate.likeC[p.id] || 0}</span>
        <span>${timeAgo(p.created_at)}</span>
      </div>
    </div>${img}
  </div>`;
}
async function loadFeed() {
  const feed = document.getElementById("feed");
  feed.innerHTML = `<div class="feed-empty">불러오는 중…</div>`;
  bstate.page = 0; bstate.feedDone = false; bstate.feedLoading = false;
  [bstate.likeC, bstate.cmtC] = await Promise.all([fetchPostLikeCounts(), fetchPostCommentCounts()]);
  feed.innerHTML = "";
  await loadMore();
  if (!feed.querySelector(".post-card")) {
    feed.innerHTML = `<div class="feed-empty">아직 글이 없어요.<br>첫 글을 남겨봐요 ✏️<br><br>"오늘 이태원 물 좋음?" 같은 거 편하게!</div>`;
  }
}
async function loadMore() {
  if (bstate.feedDone || bstate.feedLoading) return;
  bstate.feedLoading = true;
  const posts = await fetchPosts({ category: bstate.cat, region: bstate.region, limit: PAGE, offset: bstate.page * PAGE });
  bstate.page++;
  if (posts.length < PAGE) bstate.feedDone = true;
  const feed = document.getElementById("feed");
  feed.insertAdjacentHTML("beforeend", posts.map(postCardHtml).join(""));
  feed.querySelectorAll(".post-card:not([data-wired])").forEach((el) => {
    el.setAttribute("data-wired", "1");
    el.addEventListener("click", () => openDetail(el.dataset.id));
  });
  bstate.feedLoading = false;
}
// 바닥 근처 스크롤 시 다음 페이지 자동 로드
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 500) loadMore();
});

/* ---------- 글쓰기 ---------- */
function setupWrite() {
  const cat = document.getElementById("wCat");
  cat.innerHTML = POST_CATS.map((c) => `<option value="${c.key}">${c.key}</option>`).join("");
  const reg = document.getElementById("wReg");
  reg.innerHTML = `<option value="">선택 안함</option>` + REGIONS.map((r) => `<option value="${r}">${r}</option>`).join("");
  document.getElementById("wNick").value = randomNick();
  document.getElementById("wDice").onclick = () => (document.getElementById("wNick").value = randomNick());
  document.getElementById("writeFab").onclick = openWrite;
  document.getElementById("writeClose").onclick = () => document.getElementById("writeModal").classList.add("hidden");
  document.getElementById("wSubmit").onclick = submitPost;
  document.getElementById("wFile").addEventListener("change", onPickImages);
  // 리치텍스트 툴바
  const editor = document.getElementById("wEditor");
  document.querySelectorAll(".rte-tools [data-cmd]").forEach((b) => b.onmousedown = (e) => {
    e.preventDefault();
    if (b.dataset.cmd === "createLink") {
      const url = prompt("링크 주소 (https://...)");
      if (url) document.execCommand("createLink", false, url);
    } else document.execCommand(b.dataset.cmd, false, null);
    editor.focus();
  });
  // 에디터 인라인 이미지
  document.getElementById("rteImg").onclick = () => {
    const f = document.createElement("input"); f.type = "file"; f.accept = "image/*";
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      const msg = document.getElementById("wMsg"); msg.textContent = "사진 올리는 중…"; msg.className = "form-msg";
      try { const url = await uploadPostImage(file); editor.focus(); document.execCommand("insertHTML", false, `<img src="${url}">`); msg.textContent = ""; }
      catch (e) { msg.textContent = "사진 업로드 실패"; msg.className = "form-msg err"; }
    };
    f.click();
  };
}
function openWrite(presetCat) {
  bstate.pendingImages = [];
  renderImgRow();
  document.getElementById("wTitle").value = "";
  document.getElementById("wEditor").innerHTML = "";
  document.getElementById("wMsg").textContent = "";
  if (!document.getElementById("wNick").value) document.getElementById("wNick").value = randomNick();
  if (typeof presetCat === "string") document.getElementById("wCat").value = presetCat;
  if (bstate.region) document.getElementById("wReg").value = bstate.region;
  document.getElementById("writeModal").classList.remove("hidden");
}
async function onPickImages(e) {
  const files = [...e.target.files].slice(0, 5 - bstate.pendingImages.length);
  e.target.value = "";
  const msg = document.getElementById("wMsg");
  for (const f of files) {
    msg.textContent = "사진 올리는 중…"; msg.className = "form-msg";
    try { const url = await uploadPostImage(f); bstate.pendingImages.push(url); renderImgRow(); }
    catch (err) { msg.textContent = "사진 업로드 실패"; msg.className = "form-msg err"; }
  }
  msg.textContent = "";
}
function renderImgRow() {
  const row = document.getElementById("imgRow");
  const add = (bstate.pendingImages.length < 5)
    ? `<label class="img-add" for="wFile">📷<br>추가</label><input id="wFile" type="file" accept="image/*" multiple hidden />` : "";
  row.innerHTML = bstate.pendingImages.map((u, i) =>
    `<div class="img-thumb"><img src="${u}" alt="" /><button class="rm" data-i="${i}" type="button">✕</button></div>`).join("") + add;
  row.querySelectorAll(".rm").forEach((b) => b.onclick = () => { bstate.pendingImages.splice(+b.dataset.i, 1); renderImgRow(); });
  const file = document.getElementById("wFile");
  if (file) file.addEventListener("change", onPickImages);
}
async function submitPost() {
  const title = document.getElementById("wTitle").value.trim();
  const nick = document.getElementById("wNick").value.trim() || randomNick();
  const msg = document.getElementById("wMsg");
  if (!title) { msg.textContent = "제목을 입력해주세요"; msg.className = "form-msg err"; return; }
  const btn = document.getElementById("wSubmit"); btn.disabled = true;
  msg.textContent = "등록 중…"; msg.className = "form-msg";
  try {
    await createPost({
      nick, pw: document.getElementById("wPw").value || null,
      category: document.getElementById("wCat").value,
      region: document.getElementById("wReg").value || null,
      title, content: sanitizeHtml(document.getElementById("wEditor").innerHTML) || null,
      images: bstate.pendingImages,
    });
    track("post_submit", { category: document.getElementById("wCat").value, region: document.getElementById("wReg").value || "" });
    msg.textContent = "등록 완료! 🎉"; msg.className = "form-msg ok";
    setTimeout(() => {
      document.getElementById("writeModal").classList.add("hidden");
      document.getElementById("wPw").value = "";
      loadFeed();
    }, 700);
  } catch (e) { msg.textContent = "실패: " + e.message; msg.className = "form-msg err"; }
  finally { btn.disabled = false; }
}

/* ---------- 상세 ---------- */
async function openDetail(id) {
  const modal = document.getElementById("detailModal");
  const body = document.getElementById("detailBody");
  body.innerHTML = `<div class="feed-empty">불러오는 중…</div>`;
  modal.classList.remove("hidden");
  const p = await fetchPost(id);
  if (!p) { body.innerHTML = `<div class="feed-empty">삭제됐거나 없는 글이에요.</div>`; return; }
  track("post_view", { category: p.category, region: p.region || "" });
  const imgs = (p.images || []).map((u) => `<img loading="lazy" src="${u}" alt="" />`).join("");
  const reg = p.region ? ` · ${escapeHtml(p.region)}` : "";
  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <span class="pc-cat" style="background:${catColor(p.category)}">${escapeHtml(p.category)}</span>
      <div class="dmenu-wrap">
        <button class="dmenu-btn" id="dmenuBtn" type="button">⋯</button>
        <div class="dmenu hidden" id="dmenu"><button id="delPost" type="button">🗑 삭제</button></div>
      </div>
    </div>
    <div class="detail-title">${escapeHtml(p.title)}</div>
    <div class="detail-meta">
      <span class="pc-nick">${escapeHtml(p.nick)}</span><span>${timeAgo(p.created_at)}${reg}</span>
    </div>
    ${p.content ? `<div class="detail-content">${sanitizeHtml(p.content)}</div>` : ""}
    ${imgs ? `<div class="detail-imgs">${imgs}</div>` : ""}
    <div class="like-bar">
      <button class="like-btn" id="likeBtn" type="button">👏 좋아요 <b id="likeN">0</b></button>
    </div>
    <div class="cmts" id="cmts"></div>`;
  const dmenu = document.getElementById("dmenu");
  document.getElementById("dmenuBtn").onclick = (e) => { e.stopPropagation(); dmenu.classList.toggle("hidden"); };
  document.getElementById("delPost").onclick = () => removePost(p);
  wireLike(p.id);
  renderComments(p.id);
}
async function wireLike(postId) {
  const counts = await fetchPostLikeCounts();
  const btn = document.getElementById("likeBtn");
  const n = document.getElementById("likeN");
  n.textContent = counts[postId] || 0;
  const lk = "plike_" + postId;
  if (localStorage.getItem(lk)) btn.classList.add("on");
  btn.onclick = async () => {
    if (localStorage.getItem(lk)) return;
    localStorage.setItem(lk, "1"); btn.classList.add("on");
    n.textContent = (+n.textContent) + 1;
    track("post_like", { post: postId });
    await likePost(postId);
  };
}
async function removePost(p) {
  const pw = prompt("비밀번호를 입력하세요 (작성 시 설정한 비번)");
  if (pw == null) return;
  const ok = await deletePost(p.id, pw);
  if (ok) { document.getElementById("detailModal").classList.add("hidden"); loadFeed(); }
  else alert("비밀번호가 일치하지 않아요.");
}

/* ---------- 댓글 ---------- */
async function renderComments(postId) {
  const box = document.getElementById("cmts");
  box.innerHTML = `<div style="font-size:14px;font-weight:700;margin-bottom:8px">💬 댓글 <span class="cmt-cnt"></span></div>
    <div id="cList" class="cmt-empty">불러오는 중…</div>
    <div class="cmt-write">
      <div class="cmt-id">
        <div class="nick-row" style="flex:1">
          <input id="cNick" type="text" maxlength="16" placeholder="닉네임" />
          <button class="nick-dice" id="cDice" type="button">🔀</button>
        </div>
        <input id="cPw" type="password" maxlength="20" placeholder="비번(삭제용)" style="width:110px" />
      </div>
      <div class="cmt-input">
        <input id="cText" type="text" maxlength="200" placeholder="댓글 달기 (예: 거기 지금 헬이야 / 물 좋음)" />
        <button id="cSend" type="button">등록</button>
      </div>
    </div>`;
  document.getElementById("cNick").value = randomNick();
  document.getElementById("cDice").onclick = () => (document.getElementById("cNick").value = randomNick());
  const el = document.getElementById("cList");
  function commentHtml(c, isReply) {
    return `<div class="cmt${isReply ? " reply" : ""}">
      <div class="cmt-top"><span class="cmt-nick">${isReply ? "↳ " : ""}${escapeHtml(c.nick)}</span><span>${timeAgo(c.created_at)}</span></div>
      <div class="cmt-text">${escapeHtml(c.text)}</div>
      ${isReply ? "" : `<button class="reply-btn" data-cid="${c.id}" type="button">답글</button><div class="reply-box hidden" data-for="${c.id}"></div>`}
    </div>`;
  }
  async function load() {
    const all = await fetchPostComments(postId);
    box.querySelector(".cmt-cnt").textContent = all.length ? `(${all.length})` : "";
    const tops = all.filter((c) => !c.parent_id);
    const byParent = {};
    all.forEach((c) => { if (c.parent_id) (byParent[c.parent_id] = byParent[c.parent_id] || []).push(c); });
    el.className = tops.length ? "" : "cmt-empty";
    el.innerHTML = tops.length ? tops.map((c) =>
      commentHtml(c, false) + (byParent[c.id] || []).map((r) => commentHtml(r, true)).join("")
    ).join("") : "아직 댓글이 없어요. 첫 댓글 남겨봐요 👀";
    // 답글 버튼 → 인라인 답글 폼 토글
    el.querySelectorAll(".reply-btn").forEach((b) => b.onclick = () => {
      const rb = el.querySelector(`.reply-box[data-for="${b.dataset.cid}"]`);
      if (!rb) return;
      if (!rb.classList.contains("hidden")) { rb.classList.add("hidden"); rb.innerHTML = ""; return; }
      rb.classList.remove("hidden");
      rb.innerHTML = `<div class="cmt-input reply-input">
        <input class="rNick" type="text" maxlength="16" value="${escapeHtml(randomNick())}" />
        <input class="rText" type="text" maxlength="200" placeholder="답글 달기" />
        <button class="rSend" type="button">등록</button></div>`;
      const rText = rb.querySelector(".rText"); rText.focus();
      const sendReply = async () => {
        const t = rText.value.trim(); if (!t) return;
        try {
          await addPostComment(postId, rb.querySelector(".rNick").value.trim() || randomNick(), t, null, b.dataset.cid);
          track("comment_submit", { post: postId, reply: true });
          await load();
        } catch (e) {}
      };
      rb.querySelector(".rSend").onclick = sendReply;
      rText.addEventListener("keydown", (e) => { if (e.key === "Enter") sendReply(); });
    });
  }
  const send = document.getElementById("cSend");
  const input = document.getElementById("cText");
  async function post() {
    const text = input.value.trim();
    if (!text) return;
    const nick = document.getElementById("cNick").value.trim() || randomNick();
    const pw = document.getElementById("cPw").value || null;
    send.disabled = true;
    try { await addPostComment(postId, nick, text, pw); track("comment_submit", { post: postId }); input.value = ""; await load(); }
    catch (e) { send.textContent = "실패"; setTimeout(() => (send.textContent = "등록"), 1200); }
    finally { send.disabled = false; }
  }
  send.onclick = post;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") post(); });
  load();
}

/* ---------- 부트 ---------- */
document.getElementById("detailClose").onclick = () => document.getElementById("detailModal").classList.add("hidden");
[document.getElementById("writeModal"), document.getElementById("detailModal")].forEach((m) =>
  m.addEventListener("click", (e) => { if (e.target === m) m.classList.add("hidden"); }));
// ··· 메뉴 바깥 클릭 시 닫기
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dmenu-wrap")) document.querySelectorAll(".dmenu").forEach((d) => d.classList.add("hidden"));
});
buildTabs();
setupWrite();
loadFeed();
