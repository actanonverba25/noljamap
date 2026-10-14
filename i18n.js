/* 놀자맵 다국어 (KO/EN). 데이터 키(카테고리·지역)는 한글 유지, 표시 라벨만 변환.
   언어: localStorage('lang') 우선 → 없으면 navigator.language(ko면 ko, 아니면 en). */
(function () {
  // 우선순위: URL ?lang=en|ko (링크트리용) > 저장값 > 브라우저 언어
  const urlLang = new URLSearchParams(location.search).get("lang");
  const saved = localStorage.getItem("lang");
  const auto = (navigator.language || "en").toLowerCase().startsWith("ko") ? "ko" : "en";
  let lang;
  if (urlLang === "ko" || urlLang === "en") { lang = urlLang; try { localStorage.setItem("lang", lang); } catch (e) {} }
  else if (saved === "ko" || saved === "en") lang = saved;
  else lang = auto;
  window.LANG = lang;
})();

// 카테고리 표시 라벨 (키=clubs.json category)
const CAT_LABEL = {
  "클럽": { ko: "클럽", en: "Club" },
  "포차": { ko: "포차", en: "Pocha" },
  "소개팅·파티": { ko: "소개팅·파티", en: "Singles · Party" },
  "라운지·바": { ko: "라운지·바", en: "Lounge · Bar" },
  "펍": { ko: "펍", en: "Pub" },
  "첫차지키미": { ko: "첫차지키미", en: "Late-Night Eats" },
  "물품보관함": { ko: "물품보관함", en: "Lockers" },
  "기타": { ko: "기타", en: "Other" },
};
const SUB_LABEL = { "혼술바": { ko: "혼술바", en: "Solo Bar" } };
// 지역 표시 라벨
const REGION_LABEL = {
  "홍대": { ko: "홍대", en: "Hongdae" },
  "이태원": { ko: "이태원", en: "Itaewon" },
  "강남": { ko: "강남", en: "Gangnam" },
  "건대": { ko: "건대", en: "Konkuk Univ." },
  "수원": { ko: "수원", en: "Suwon" },
  "부산서면": { ko: "부산서면", en: "Seomyeon (Busan)" },
  "부산광안리": { ko: "부산광안리", en: "Gwangalli (Busan)" },
  "부산해운대": { ko: "부산해운대", en: "Haeundae (Busan)" },
  "대구": { ko: "대구", en: "Daegu" },
  "을지로": { ko: "을지로", en: "Euljiro" },
  "안산": { ko: "안산", en: "Ansan" },
  "광주": { ko: "광주", en: "Gwangju" },
  "제주": { ko: "제주", en: "Jeju" },
  "강릉": { ko: "강릉", en: "Gangneung" },
};
function catLabel(c) { return (CAT_LABEL[c] && CAT_LABEL[c][LANG]) || c; }
function subLabel(s) { return (SUB_LABEL[s] && SUB_LABEL[s][LANG]) || s; }
function regionLabel(r) { return (REGION_LABEL[r] && REGION_LABEL[r][LANG]) || r; }

const STRINGS = {
  doc_title: { ko: "놀자맵 · 오늘 밤 어디서 놀까", en: "Noljamap · Where to go tonight" },
  subtitle: { ko: "클럽 · 포차 · 라운지 · 펍 — 의도별 큐레이션", en: "Clubs · Bars · Lounges — curated by vibe" },
  search_ph: { ko: "🔍 동네·핫플 검색 (예: 이태원)", en: "🔍 Search area or hotspot" },
  ss_venues: { ko: "내 지도 업장", en: "On the map" },
  ss_places: { ko: "장소", en: "Places" },
  f_all: { ko: "전체", en: "All" },
  f_open: { ko: "🟢 지금 가능", en: "🟢 Open now" },
  f_top5: { ko: "🏆 TOP5", en: "🏆 Top 5" },
  f_event: { ko: "🎉 이벤트", en: "🎉 Events" },
  locate: { ko: "내 위치", en: "My location" },
  bang_open: { ko: "💬 놀자방", en: "💬 Board" },
  tab_map: { ko: "지도", en: "Map" },
  tab_bang: { ko: "놀자방", en: "Board" },
  btn_ranking: { ko: "🏆 랭킹", en: "🏆 Ranking" },
  btn_report: { ko: "➕ 제보", en: "➕ Add" },
  pick_hint: { ko: "📍 지도를 탭해 위치를 선택하세요", en: "📍 Tap the map to pick a spot" },
  cancel: { ko: "취소", en: "Cancel" },
  // 온보딩
  ob_tagline: { ko: "서울 밤을 함께 기록하는 커뮤니티 지도", en: "A community map of Seoul nights" },
  ob_p1: { ko: "클럽·포차·소개팅·심야술집을 한 지도에서", en: "Clubs, bars, parties & late-night eats on one map" },
  ob_p2: { ko: "직접 가본 곳·오늘의 파티를 제보해요", en: "Add places you've been & tonight's parties" },
  ob_p3: { ko: "물 좋은 곳 투표·댓글로 같이 만들어요", en: "Vote & comment to build it together" },
  ob_explore: { ko: "🗺️ 지도 둘러보기", en: "🗺️ Explore the map" },
  ob_report: { ko: "➕ 제보하기", en: "➕ Add a place" },
  ob_dismiss: { ko: "오늘 하루 보지 않기", en: "Don't show today" },
  ob_foot: { ko: "유저 제보 기반 정보 · 방문 전 확인 권장 · 문의 @noljamap", en: "Community-sourced · verify before visiting · DM @noljamap" },
  contact: {
    ko: '📩 모든 문의·제휴 → 인스타 <a href="https://instagram.com/noljamap" target="_blank" rel="noopener" style="color:var(--accent,#D4A656);font-weight:700">@noljamap</a>',
    en: '📩 Questions·partnerships → Instagram <a href="https://instagram.com/noljamap" target="_blank" rel="noopener" style="color:var(--accent,#D4A656);font-weight:700">@noljamap</a>',
  },
  // 랭킹 패널
  rank_title: { ko: "🏆 랭킹", en: "🏆 Ranking" },
  rank_sub: { ko: "종합 소셜 점수", en: "Overall social score" },
  rank_calc: { ko: "집계 중…", en: "Calculating…" },
  rank_empty: { ko: "아직 평가가 안 쌓였어요.<br>👍 물좋음·💬 댓글이 모이면 랭킹이 떠요!", en: "No ratings yet.<br>👍 Votes & 💬 comments build the ranking!" },
  // 제보 모달
  rp_title_new: { ko: "새 장소 제보", en: "Add a new place" },
  rp_sub_new: { ko: '제보하면 바로 지도에 "미검증"으로 떠요. 운영자가 확인해요.', en: 'It appears instantly as "unverified". We review it.' },
  rp_title_event: { ko: "🎉 오늘의 파티·이벤트", en: "🎉 Party · Event" },
  rp_sub_event: { ko: "오늘·이번주 파티/이벤트를 추천해요. 날짜를 넣어주세요.", en: "Recommend tonight/this week's parties. Add a date." },
  rp_title_edit: { ko: "정보 수정·폐업 제보", en: "Report a fix / closure" },
  rp_sub_edit: { ko: '"{name}" 정보가 틀렸거나 폐업했나요?', en: 'Is "{name}" wrong or closed?' },
  rp_type_new: { ko: "📍 새 장소", en: "📍 New place" },
  rp_type_event: { ko: "🎉 오늘의 파티·이벤트", en: "🎉 Party · Event" },
  lbl_category: { ko: "카테고리", en: "Category" },
  lbl_name: { ko: "이름", en: "Name" },
  rp_name_ph: { ko: "업장·이벤트 이름", en: "Venue or event name" },
  lbl_date: { ko: "날짜", en: "Date" },
  rp_opt_event: { ko: "(이벤트)", en: "(event)" },
  lbl_loc: { ko: "위치", en: "Location" },
  rp_loc_opt: { ko: "(지도 선택 또는 주소 입력)", en: "(pick on map or enter address)" },
  rp_pick: { ko: "📍 지도에서 선택", en: "📍 Pick on map" },
  rp_unset: { ko: "미선택", en: "Not set" },
  rp_addr_ph: { ko: "또는 주소·장소명 직접 입력 (예: 강남역 11번출구)", en: "Or enter address/place (e.g., Gangnam Stn Exit 11)" },
  lbl_link: { ko: "인스타·링크", en: "Instagram · Link" },
  rp_opt: { ko: "(선택)", en: "(optional)" },
  lbl_memo: { ko: "메모", en: "Note" },
  rp_memo_ph: { ko: "입장료·요일·특징 등", en: "Cover charge, days, details" },
  rp_submit: { ko: "제보하기", en: "Submit" },
  // 상태
  status_open: { ko: "🟢 영업 중", en: "🟢 Open" },
  status_soon: { ko: "🌙 오늘 영업 예정", en: "🌙 Opens later today" },
  status_off: { ko: "⚫ 오늘 휴무", en: "⚫ Closed today" },
  status_unknown: { ko: "영업시간 미확인", en: "Hours unknown" },
  hours_none: { ko: "정보 없음", en: "No info" },
  est_suffix: { ko: " (추정)", en: " (est.)" },
  days_daily: { ko: "매일", en: "Daily" },
  legend_note: { ko: '점=지금상태 · <span style="color:#4ade80">🟢오픈</span> · <span style="color:#d6a85a">🌙예정</span> · <span style="color:#9a9aa6">⚫휴무</span>', en: 'Dot = status · <span style="color:#4ade80">🟢Open</span> · <span style="color:#d6a85a">🌙Later</span> · <span style="color:#9a9aa6">⚫Closed</span>' },
  legend_label: { ko: "장소분류", en: "Categories" },
  inquiry_title: { ko: "📩 문의하기", en: "📩 Contact us" },
  inquiry_sub: { ko: "제보 말고 문의·제휴·제안은 여기로!", en: "Questions, partnerships & ideas" },
  inquiry_insta: { ko: "📷 인스타 DM · @noljamap", en: "📷 Instagram DM · @noljamap" },
  inquiry_mail: { ko: "✉️ 이메일 · noljamap@gmail.com", en: "✉️ Email · noljamap@gmail.com" },
  inquiry_close: { ko: "닫기", en: "Close" },
  count: { ko: "{n}곳", en: "{n} places" },
  ls_count: { ko: "지도 내 {n}곳", en: "{n} in view" },
  ls_total: { ko: "누적 {n}개", en: "{n} total" },
  ls_empty: { ko: "이 화면에 표시할 곳이 없어요 — 지도를 움직이거나 필터를 켜보세요", en: "Nothing in view — move the map or turn on filters" },
  conf_low: { ko: "분류 확인중", en: "Category TBD" },
  rank_tag: { ko: "{region} {n}위", en: "{region} #{n}" },
  rank_badge: { ko: "{n}위", en: "#{n}" },
  mk_today: { ko: "🎉오늘", en: "🎉Today" },
  mk_event: { ko: "🎉이벤트", en: "🎉Event" },
  mk_report: { ko: "제보", en: "Report" },
  name_none: { ko: "(이름없음)", en: "(no name)" },
  // 입장
  access_ticket: { ko: "🎟️ 사전 예매 (입장권)", en: "🎟️ Ticketed entry" },
  access_walkin: { ko: "🚶 바로 입장", en: "🚶 Walk-in" },
  ticket_cta: { ko: "🎟️ 예매·잔여 문의 → {handle}", en: "🎟️ Tickets · Ask → {handle}" },
  // 상세 액션
  act_fav: { ko: "🔖 찜", en: "🔖 Save" },
  act_fav_on: { ko: "✅ 찜됨", en: "✅ Saved" },
  act_dir: { ko: "🧭 길찾기", en: "🧭 Directions" },
  act_share: { ko: "↗ 공유", en: "↗ Share" },
  dt_date: { ko: "날짜", en: "Date" },
  dt_today: { ko: "오늘!", en: "Today!" },
  dt_access: { ko: "입장", en: "Entry" },
  dt_days: { ko: "영업일", en: "Open days" },
  dt_hours: { ko: "영업시간", en: "Hours" },
  dt_addr: { ko: "주소", en: "Address" },
  addr_tbd: { ko: "확인 필요", en: "TBD" },
  dt_memo: { ko: "메모", en: "Note" },
  dt_link: { ko: "링크", en: "Link" },
  link_insta: { ko: "인스타 보기 ↗", en: "Instagram ↗" },
  link_kakao: { ko: "카카오맵 ↗", en: "KakaoMap ↗" },
  link_none: { ko: "미등록", en: "Not listed" },
  event_today: { ko: "🎉 오늘!", en: "🎉 Today!" },
  event_label: { ko: "🎉 이벤트", en: "🎉 Event" },
  unverified_note: { ko: "🗳️ 유저 제보 · 미검증 — 운영자 확인 전이에요", en: "🗳️ Community report · unverified" },
  unverified_data: { ko: "⚠ 검증 전 데이터 — 영업시간은 카테고리 기반 추정값, 실제와 다를 수 있음", en: "⚠ Unverified — hours are estimates, may differ" },
  edit_report: { ko: "✏️ 정보 수정·폐업 제보", en: "✏️ Report fix / closure" },
  // 사진
  ph_loading: { ko: "사진 불러오는 중…", en: "Loading photos…" },
  ph_empty: { ko: "아직 사진이 없어요 — 첫 사진을 올려봐요 📷", en: "No photos yet — add the first 📷" },
  ph_src_kakao: { ko: "카카오맵", en: "KakaoMap" },
  ph_add: { ko: "📷<br>사진<br>추가", en: "📷<br>Add<br>photo" },
  ph_uploading: { ko: "업로드 중… (잠시만요)", en: "Uploading…" },
  ph_upload_fail: { ko: "업로드 실패: ", en: "Upload failed: " },
  // 투표
  vote_up: { ko: "👍 물 좋음", en: "👍 Good vibe" },
  vote_down: { ko: "👎 별로", en: "👎 Meh" },
  vote_now_label: { ko: "지금 어때?", en: "How's it now?" },
  vote_busy: { ko: "🔥붐빔", en: "🔥Packed" },
  vote_ok: { ko: "😎적당", en: "😎Chill" },
  vote_empty: { ko: "🍃한산", en: "🍃Quiet" },
  vote_recent: { ko: " · 최근 {n}명", en: " · {n} recently" },
  vote_none: { ko: "(최근 제보 없음)", en: "(no recent reports)" },
  // 리뷰
  rv_head: { ko: "💬 한마디", en: "💬 Say something" },
  rv_ph: { ko: "뭐가 존맛? 물 좋음? 음악은? 입장료는?", en: "Vibe? Music? Cover? Worth it?" },
  rv_send: { ko: "등록", en: "Post" },
  rv_fail: { ko: "실패", en: "Failed" },
  rv_empty: { ko: "아직 한마디가 없어요. 첫 댓글 남겨봐요 👀", en: "No comments yet. Be the first 👀" },
  time_now: { ko: "방금", en: "just now" },
  time_min: { ko: "{n}분 전", en: "{n}m ago" },
  time_hr: { ko: "{n}시간 전", en: "{n}h ago" },
  time_day: { ko: "{n}일 전", en: "{n}d ago" },
  // 제보 편집 placeholder
  memo_ph_edit: { ko: "무엇이 틀렸나요? 폐업·위치 이동·카테고리 등 (필수)", en: "What's wrong? Closed, moved, category… (required)" },
  // 제보 메시지
  msg_need_name: { ko: "이름을 입력해주세요", en: "Please enter a name" },
  msg_need_date: { ko: "이벤트 날짜를 선택해주세요", en: "Please pick an event date" },
  msg_need_memo: { ko: "무엇이 틀렸는지 메모에 적어주세요", en: "Please note what's wrong" },
  msg_addr_searching: { ko: "주소 찾는 중…", en: "Finding address…" },
  msg_addr_fail: { ko: "주소를 못 찾았어요 — 지도에서 선택하거나 더 자세히 적어주세요", en: "Couldn't find it — pick on map or be more specific" },
  msg_need_loc: { ko: "지도에서 위치를 선택하거나 주소를 입력해주세요", en: "Pick a location on the map or enter an address" },
  msg_photo_searching: { ko: "사진 찾는 중…", en: "Finding a photo…" },
  msg_submitting: { ko: "제보 중…", en: "Submitting…" },
  msg_done_edit: { ko: "수정 제보 완료! 운영자가 확인해요 🙏", en: "Thanks! We'll review your fix 🙏" },
  msg_done_event: { ko: "이벤트 등록 완료! 지도에 떴어요 🎉", en: "Event added! It's on the map 🎉" },
  msg_done_new: { ko: "제보 완료! 지도에 떴어요 🎉", en: "Added! It's on the map 🎉" },
  msg_fail: { ko: "실패: ", en: "Failed: " },
  pick_coord: { ko: "선택됨 ({lat}, {lng})", en: "Selected ({lat}, {lng})" },
  // 위치/공유
  locate_unavail: { ko: "위치 정보를 사용할 수 없습니다.", en: "Location is unavailable." },
  locate_denied: { ko: "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 허용을 켜주세요.", en: "Location permission denied. Enable it in your browser settings." },
  share_text: { ko: "{name} — 놀자맵에서 봐 🌃", en: "{name} — found on Noljamap 🌃" },
  share_copied: { ko: "링크 복사됨!", en: "Link copied!" },
  // 배너(로드 실패)
  banner_map_fail: { ko: "<h3>지도 로드 실패</h3><p>키가 올바른지, 카카오 콘솔에 현재 도메인이 등록됐는지 확인해주세요.</p>", en: "<h3>Map failed to load</h3><p>Please try again later.</p>" },
  banner_data_fail: { ko: "<h3>데이터 로드 실패</h3><p>잠시 후 다시 시도해주세요.</p>", en: "<h3>Failed to load data</h3><p>Please try again later.</p>" },
};

function t(key, params) {
  const e = STRINGS[key];
  let s = (e && e[LANG]) != null ? e[LANG] : (e && e.ko) || key;
  if (params) for (const k in params) s = s.split("{" + k + "}").join(params[k]);
  return s;
}
// "N곳" / "N places"
function tCount(n) { return t("count", { n }); }

// data-i18n / data-i18n-ph / data-i18n-aria 속성을 가진 정적 DOM 채우기
function applyStaticI18n() {
  document.documentElement.lang = LANG;
  document.title = t("doc_title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
}
// 언어 토글 버튼 셋업 (헤더의 #langToggle)
function setupLangToggle() {
  const btn = document.getElementById("langToggle");
  if (!btn) return;
  btn.textContent = LANG === "ko" ? "EN" : "한국어";
  btn.addEventListener("click", () => {
    const next = LANG === "ko" ? "en" : "ko";
    localStorage.setItem("lang", next);
    try { if (window.gtag) gtag("event", "lang_switch", { to: next }); } catch (e) {}
    location.reload();   // 정적 사이트 — 새로고침이 가장 안전한 전체 재렌더
  });
}
