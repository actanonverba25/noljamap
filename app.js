/* 놀자맵 — 카카오맵 기반 나이트라이프 커뮤니티 지도
 * 거지맵/야장맵 프레임: 위치기반 + 카테고리(유저 의도) 컬러 라벨 + 영업시간 명암
 * 데이터: holycow·beatbuddy 인스타 크롤 100곳 (카테고리는 전수 웹리서치 분류)
 */

const REGION_CENTERS = {
  "홍대":      { lat: 37.5563, lng: 126.9236 },
  "이태원":    { lat: 37.5346, lng: 126.9946 },
  "강남":      { lat: 37.5172, lng: 127.0286 },
  "건대":      { lat: 37.5404, lng: 127.0699 },
  "수원":      { lat: 37.2664, lng: 127.0001 },
  "부산서면":   { lat: 35.1577, lng: 129.0594 },
  "부산광안리": { lat: 35.1532, lng: 129.1186 },
  "부산해운대": { lat: 35.1631, lng: 129.1635 },
  "대구":      { lat: 35.8693, lng: 128.5947 },
  "을지로":    { lat: 37.5660, lng: 126.9910 },
  "안산":      { lat: 37.3219, lng: 126.8309 },
  "광주":      { lat: 35.2186, lng: 126.8505 },
  "제주":      { lat: 33.5141, lng: 126.5270 },
  "강릉":      { lat: 37.7950, lng: 128.9090 },
};

const state = {
  map: null,
  meta: null,
  entries: [],          // { club, overlay, el, dot, position }
  rankIndex: {},        // club.id -> 등수(1~5, 지역 내)
  newSet: new Set(),    // NEW 표시 club.id
  visibleEntries: [],   // 필터 통과한 현재 표시 대상
  clusterOverlays: [],  // 줌아웃 시 묶음 버블
  photoThumbs: {},      // venue_id -> 유저 업로드 대표사진 url (마커/상세 우선)
  filters: { categories: new Set(), regions: new Set(), openOnly: false, rankedOnly: false },
};

// 4단 표시 (카카오 level: 작을수록 확대). 거지맵/야장맵 실측 — 도시 전체에서만 숫자.
const PHOTO_MAX_LEVEL = 4;    // level≤4(가까이 확대): 사진 카드 마커 (야장맵 사진핀) — 사진 있는 곳만
const LABEL_MAX_LEVEL = 5;    // level 5: 업장 이름 라벨 (작게 = 이름만)
const CLUSTER_MIN_LEVEL = 9;  // level≥9(4km~, 서울 전체뷰): 숫자 묶음
// 그 사이(level 6~8, 500m~2km): 카테고리 색 점 — 이름 떡짐 방지

/* GA4 + Amplitude는 analytics.js에서 초기화. track(event, params)는 전역. */

/* ---------- 부트스트랩 ---------- */
function showBanner(html) {
  const el = document.getElementById("banner");
  el.innerHTML = html;
  el.classList.remove("hidden");
}

async function boot() {
  applyStaticI18n();
  setupLangToggle();
  // 고객 문의 팝업 (제보와 별개 — 인스타/이메일 바로 연결)
  const inqModal = document.getElementById("inquiryModal");
  document.getElementById("inquiryBtn").onclick = () => { track("inquiry_open"); inqModal.classList.remove("hidden"); };
  document.getElementById("inqClose").onclick = () => inqModal.classList.add("hidden");
  inqModal.onclick = (e) => { if (e.target === inqModal) inqModal.classList.add("hidden"); };
  // EN=네이버 시도 → 타일 안 뜨면(키 전파 전·인증 실패 등) 카카오로 자동 폴백
  let ok = await startMap();
  if (!ok && MAP.engine === "naver") {
    console.warn("네이버 지도 미동작 → 카카오 타일로 폴백 (영어 UI 유지)");
    window.MAP = window.makeKakaoEngine();
    ok = await startMap(true);
  }
  if (!ok) showBanner(t("banner_map_fail"));
}

// 지도 SDK 로드 → 초기화 → (네이버면) 타일 렌더 확인 → 데이터/UI 구성. 성공 true.
async function startMap(isFallback) {
  try {
    await MAP.load();
  } catch (e) {
    return false;
  }
  initMap();
  // 네이버는 비동기 인증 후 타일을 그림 — 잠깐 뒤 컨테이너가 비어있으면 실패로 간주
  if (MAP.engine === "naver" && !isFallback) {
    await new Promise((r) => setTimeout(r, 1800));
    if (document.getElementById("map").childElementCount === 0) {
      document.getElementById("map").innerHTML = "";
      state.entries = [];
      state.clusterOverlays = [];
      state.map = null;
      return false;
    }
  }
  await loadData();
  await loadSubmissions();
  await loadPhotoThumbs();
  buildFilters();
  buildLegend();
  setupReport();
  setupSearch();
  setupRanking();
  setupListSheet();
  setupOnboarding();
  renderAll();
  return true;
}

/* ---------- 온보딩 ---------- */
function setupOnboarding() {
  const ob = document.getElementById("onboarding");
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("ob_dismiss") === today) return; // 오늘 안 보기
  ob.classList.remove("hidden");
  const close = () => ob.classList.add("hidden");
  document.getElementById("obExplore").addEventListener("click", close);
  document.getElementById("obReport").addEventListener("click", () => { close(); openReport("new"); });
  document.getElementById("obDismiss").addEventListener("click", () => {
    localStorage.setItem("ob_dismiss", today); close();
  });
}

/* ---------- 지도 ---------- */
function initMap() {
  state.map = MAP.createMap(document.getElementById("map"), REGION_CENTERS["홍대"], 6);
  // onclick = 멱등 (네이버 실패→카카오 폴백 시 initMap 두 번 호출돼도 중복 X)
  document.getElementById("locateBtn").onclick = locateMe;
  document.getElementById("detailClose").onclick = () =>
    document.getElementById("detail").classList.add("hidden");
  // 줌 바뀌면 개별↔묶음 전환
  MAP.onZoom(applyClustering);
  // 지도 멈추면(이동/줌) 지도 내 리스트 갱신
  MAP.onIdle(renderList);
}

/* ---------- 데이터 ---------- */
async function loadData() {
  let json;
  try {
    json = await (await fetch("data/clubs.json")).json();
  } catch (e) {
    showBanner(t("banner_data_fail"));
    throw e;
  }
  state.meta = json._meta;
  await loadRankings();
  await Promise.all(json.clubs.map(resolveAndCreate));
}

// 지역별 1~5위 수동 큐레이션 + NEW (data/rankings.json). 없으면 조용히 무시.
async function loadRankings() {
  try {
    const r = await (await fetch("data/rankings.json")).json();
    Object.values(r.ranks || {}).forEach((ids) =>
      ids.slice(0, 5).forEach((id, i) => { state.rankIndex[id] = i + 1; }));
    state.newSet = new Set(r.new || []);
  } catch (e) {
    console.warn("rankings.json 로드 실패 — 랭킹/NEW 배지 생략", e);
  }
}

function categoryColor(cat) {
  return (state.meta.categories && state.meta.categories[cat]) || "#8A8A99";
}
// 같은 카테고리 안의 하위 톤(예: 라운지·바 안 혼술바 = 형광 라벤더). 마커/라벨/상세에만 적용, 칩·범례는 카테고리색 유지.
const SUBCOLORS = { "혼술바": "#C77DFF" };
function clubColor(club) {
  return (club.etc_type && SUBCOLORS[club.etc_type]) || categoryColor(club.category);
}
function regionColor(region) {
  return (state.meta.regions && state.meta.regions[region]) || "#999999";
}

/* ---------- 영업시간 ---------- */
// 개별 실측(club.hours)이 있으면 우선, 없으면 카테고리 추정시간 fallback.
function venueHours(club) {
  if (club.hours) return club.hours;
  const defs = state.meta.category_default_hours || {};
  return defs[club.category] || null;
}
function parseHM(s) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
// 현재 영업 여부: true(영업중) / false(영업종료) / null(시간 정보없음)
function isOpenNow(hours, now) {
  if (!hours || !hours.open || !hours.close) return null;
  const open = parseHM(hours.open), close = parseHM(hours.close);
  const cur = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();              // 0=일 .. 6=토
  const days = hours.days;               // null=매일, 아니면 [0..6]
  const dayOk = (d) => !days || days.includes(d);
  if (open <= close) {                   // 같은 날 안에서 영업
    return dayOk(dow) && cur >= open && cur < close;
  }
  // 자정 넘김: 저녁(open~24h)은 당일 세션, 새벽(0~close)은 전날 세션
  if (cur >= open) return dayOk(dow);
  if (cur < close) return dayOk((dow + 6) % 7);
  return false;
}
// 오늘(또는 오늘 밤) 영업하는 요일인가 — 휴무 판별용
function operatesToday(hours, dow) {
  const days = hours.days;
  if (!days) return true;
  return days.includes(dow);
}
// 통합 상태: open / soon(오늘 영업 예정) / off(오늘 휴무) / unknown
// ※ 붐빔(혼잡도)은 실측 데이터가 없으므로 표현하지 않음 — P2 크라우드소싱("지금 어때요?")에서 도입.
function venueStatus(club, now) {
  const h = venueHours(club);
  if (!h || !h.open || !h.close) return "unknown";
  if (isOpenNow(h, now) === true) return "open";
  return operatesToday(h, now.getDay()) ? "soon" : "off";
}
const STATUS_META = {
  open:    { dot: "#4ade80", text: t("status_open"), cls: "open" },
  soon:    { dot: "#d6a85a", text: t("status_soon"), cls: "unknown" },
  off:     { dot: "#6a6a76", text: t("status_off"), cls: "closed" },
  unknown: { dot: "#6a6a76", text: t("status_unknown"), cls: "unknown" },
};
function fmtHours(hours) {
  if (!hours) return t("hours_none");
  const est = hours.estimated ? t("est_suffix") : "";
  return `${hours.open}–${hours.close}${est}`;
}
const DOW = LANG === "ko"
  ? ["일", "월", "화", "수", "목", "금", "토"]
  : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function fmtDays(hours) {
  if (!hours || !hours.days) return t("days_daily");
  return [...hours.days].sort((a, b) => a - b).map((d) => DOW[d]).join("·");
}

/* ---------- 입장 방식 ---------- */
// walk-in(바로 입장) / ticket(사전 예매). 소개팅·파티는 기본 ticket, 나머지 walk-in.
function venueAccess(club) {
  if (club.access) return club.access;
  return club.category === "소개팅·파티" ? "ticket" : "walk-in";
}
// 예매·문의용 개최자 링크 (없으면 인스타로 폴백)
function venueOrganizer(club) {
  return club.organizer || club.insta || "";
}
function organizerHandle(url) {
  return "@" + (url || "").replace(/\/+$/, "").split("/").pop();
}

async function resolveAndCreate(club) {
  const onCoord = (lat, lng) => {
    const position = MAP.latLng(lat, lng);
    const { overlay, el, dot, wrap } = makeOverlay(club, position);
    state.entries.push({ club, overlay, el, dot, wrap, position });
  };
  // 좌표는 대부분 데이터에 박혀있음(prebake). 없으면 엔진 지오코딩 → 지역중심 폴백.
  if (typeof club.lat === "number" && typeof club.lng === "number") return onCoord(club.lat, club.lng);
  const center = REGION_CENTERS[club.region] || REGION_CENTERS["홍대"];
  let g = club.address ? await MAP.geocode(club.address) : null;
  if (!g) g = await MAP.geocode(`${club.name} ${club.region}`);
  onCoord(g ? g.lat : center.lat, g ? g.lng : center.lng);
}

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
function makeOverlay(club, position) {
  const wrap = document.createElement("div");
  wrap.className = "club-marker";

  // 순위 배지(거지맵 '지역 1위') 또는 NEW
  const rank = state.rankIndex[club.id];
  if (rank) {
    const b = document.createElement("div");
    b.className = `rank-badge rank-${rank}`;
    b.textContent = `${MEDAL[rank] || ""}${t("rank_badge", { n: rank })}`;
    wrap.appendChild(b);
  } else if (state.newSet.has(club.id)) {
    const b = document.createElement("div");
    b.className = "new-badge";
    b.textContent = "NEW";
    wrap.appendChild(b);
  }
  if (club._unverified) {
    const rb = document.createElement("div");
    const isEvent = club._subType === "event";
    rb.className = "report-badge" + (isEvent ? " event" : "");
    rb.textContent = isEvent ? (isToday(club.event_date) ? t("mk_today") : t("mk_event")) : t("mk_report");
    wrap.appendChild(rb);
  }

  const el = document.createElement("div");
  el.className = "club-label" + (club._unverified ? " unverified" : "");
  el.style.background = clubColor(club);
  el.style.color = "#fff";
  const dot = document.createElement("span");
  dot.className = "status-dot";
  el.appendChild(dot);
  el.appendChild(document.createTextNode(club.name));
  wrap.appendChild(el);

  wrap.addEventListener("click", () => openDetail(club));
  const overlay = MAP.overlay(position, wrap, { yAnchor: 1, clickable: true });
  return { overlay, el, dot, wrap };
}

// 마커/상세 대표사진: 유저 업로드 우선 → 카카오 콜드스타트 썸네일 → 없음
function clubPhoto(club) {
  return (state.photoThumbs && state.photoThumbs[club.id]) || club.thumb || null;
}
async function loadPhotoThumbs() {
  try { state.photoThumbs = await fetchPhotoThumbs(); }
  catch (e) { state.photoThumbs = {}; }
}
// 라벨 ↔ 사진카드 전환 (사진 있는 곳만 사진모드, 나머지는 항상 라벨)
function setMarkerMode(entry, photoMode) {
  const url = clubPhoto(entry.club);
  if (photoMode && url) {
    if (!entry.photoEl) {
      const pc = document.createElement("div");
      pc.className = "club-photo";
      pc.style.borderColor = clubColor(entry.club);
      pc.innerHTML = `<img loading="lazy" alt="" src="${url}" /><span class="cp-name">${escapeHtml(entry.club.name)}</span>`;
      pc.addEventListener("click", () => openDetail(entry.club));
      entry.wrap.insertBefore(pc, entry.el);
      entry.photoEl = pc;
    } else {
      entry.photoEl.querySelector("img").src = url; // 업로드 후 갱신
    }
    entry.photoEl.style.display = "";
    entry.el.style.display = "none";
  } else {
    if (entry.photoEl) entry.photoEl.style.display = "none";
    entry.el.style.display = "";
  }
}

/* ---------- 필터 UI ---------- */
function chip(label, dotColor, onToggle, startActive = true) {
  const c = document.createElement("button");
  c.className = "chip" + (startActive ? " active" : "");
  c.type = "button";
  if (dotColor) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = dotColor;
    c.appendChild(dot);
  }
  c.appendChild(document.createTextNode(label));
  c.addEventListener("click", () => {
    c.classList.toggle("active");
    onToggle(c.classList.contains("active"));
    renderAll();
  });
  return c;
}

function buildFilters() {
  const categories = Object.keys(state.meta.categories);
  categories.forEach((c) => state.filters.categories.add(c));

  const cEl = document.getElementById("categoryFilters");
  const cChips = {};
  const cDots = {};

  // ON=카테고리 색 채움 + 흰 점 / OFF=비움(점은 색, CSS가 회색처리)
  function paintCat(cat) {
    const on = state.filters.categories.has(cat);
    const color = categoryColor(cat);
    cChips[cat].style.background = on ? color : "";
    cDots[cat].style.background = on ? "#fff" : color;
  }

  // 선택 집합 반영(칩 활성화 + 전체칩 + 렌더). 빈 집합이면 전체로 간주.
  function applyCategorySet(set) {
    if (set.size === 0) set = new Set(categories);
    state.filters.categories = set;
    const allOn = set.size === categories.length;
    categories.forEach((c) => { cChips[c].classList.toggle("active", set.has(c)); paintCat(c); });
    document.getElementById("allToggle").classList.toggle("active", allOn);
    renderAll();
  }
  // 클릭 로직: 전체 상태→이것만 isolate / 부분 상태→토글(추가·제거) / 마지막 하나 해제→전체
  function onCategoryClick(cat) {
    track("category_filter", { category: cat });
    const f = new Set(state.filters.categories);
    if (f.size === categories.length) { applyCategorySet(new Set([cat])); return; }
    if (f.has(cat)) {
      if (f.size === 1) { applyCategorySet(new Set(categories)); return; }
      f.delete(cat);
    } else {
      f.add(cat);
    }
    applyCategorySet(f);
  }

  categories.forEach((cat) => {
    const ch = document.createElement("button");
    ch.className = "chip active";
    ch.type = "button";
    const dot = document.createElement("span");
    dot.className = "dot";
    ch.appendChild(dot);
    ch.appendChild(document.createTextNode(catLabel(cat)));
    ch.addEventListener("click", () => onCategoryClick(cat));
    cChips[cat] = ch;
    cDots[cat] = dot;
    cEl.appendChild(ch);
  });
  categories.forEach(paintCat);   // 초기 도색 (전체 ON)

  // 영업중 토글
  const openBtn = document.getElementById("openNowToggle");
  openBtn.addEventListener("click", () => {
    state.filters.openOnly = !state.filters.openOnly;
    openBtn.classList.toggle("active", state.filters.openOnly);
    renderAll();
  });

  // TOP5 토글 — 지역 랭킹에 든 곳만
  const rankBtn = document.getElementById("rankToggle");
  rankBtn.addEventListener("click", () => {
    state.filters.rankedOnly = !state.filters.rankedOnly;
    rankBtn.classList.toggle("active", state.filters.rankedOnly);
    renderAll();
  });

  // 전체: 카테고리·지역 모두 켜고 토글 해제
  const allBtn = document.getElementById("allToggle");
  allBtn.addEventListener("click", () => {
    state.filters.categories = new Set(categories);
    state.filters.openOnly = false;
    state.filters.rankedOnly = false;
    state.filters.eventsOnly = false;
    categories.forEach((c) => { cChips[c].classList.add("active"); paintCat(c); });
    openBtn.classList.remove("active");
    rankBtn.classList.remove("active");
    document.getElementById("eventToggle").classList.remove("active");
    allBtn.classList.add("active");
    renderAll();
  });
}

function buildLegend() {
  const el = document.getElementById("legend");
  const open = localStorage.getItem("legend_open") === "1";   // 기본 접힘
  el.className = "legend" + (open ? "" : " collapsed");
  const cats = Object.entries(state.meta.categories);
  const mini = cats.slice(0, 5).map(([, c]) => `<span class="lg-mini" style="background:${c}"></span>`).join("");
  const rows = cats.map(([cat, color]) =>
    `<div class="row"><span class="dot" style="background:${color}"></span>${catLabel(cat)}</div>`).join("");
  el.innerHTML = `
    <button class="legend-toggle" id="legendToggle" type="button">
      <span class="lg-mini-row">${mini}</span>
      <span class="lg-label">${t("legend_label")}</span>
      <span class="lg-arrow">▾</span>
    </button>
    <div class="legend-body">
      ${rows}
      <div class="legend-note">${t("legend_note")}</div>
      <div class="legend-note">${t("contact")}</div>
    </div>`;
  document.getElementById("legendToggle").onclick = () => {
    el.classList.toggle("collapsed");
    localStorage.setItem("legend_open", el.classList.contains("collapsed") ? "0" : "1");
  };
}

/* ---------- 렌더 / 필터 적용 ---------- */
function passesFilter(club) {
  // 검색은 지도 이동(장소검색)으로 처리 — 필터는 카테고리·이벤트만
  if (state.filters.eventsOnly && club._subType !== "event") return false;
  return state.filters.categories.has(club.category);
}
// 검색 = 장소 검색(지도 이동). 드롭다운: 내 업장(상호명) + 카카오/네이버 장소.
function setupSearch() {
  const input = document.getElementById("searchInput");
  const sug = document.getElementById("searchSuggest");
  const closeSug = () => { sug.classList.add("hidden"); sug.innerHTML = ""; };

  function renderSuggest(venues, places, q) {
    let html = "";
    if (venues.length) {
      html += `<div class="ss-section">${t("ss_venues")}</div>`;
      html += venues.map((e) => `<div class="ss-item" data-vid="${e.club.id}">
        <span class="ss-ic" style="background:${clubColor(e.club)}">📍</span>
        <div class="ss-body"><div class="ss-name">${escapeHtml(e.club.name)}</div>
        <div class="ss-addr">${catLabel(e.club.category)} · ${regionLabel(e.club.region || "")}</div></div></div>`).join("");
    }
    if (places.length) {
      html += `<div class="ss-section">${t("ss_places")}</div>`;
      html += places.map((p, i) => `<div class="ss-item" data-pi="${i}">
        <span class="ss-ic">🗺️</span>
        <div class="ss-body"><div class="ss-name">${escapeHtml(p.name)}</div>
        <div class="ss-addr">${escapeHtml(p.address)}</div></div></div>`).join("");
    }
    if (!html) return closeSug();
    sug.innerHTML = html;
    sug.classList.remove("hidden");
    sug.querySelectorAll("[data-vid]").forEach((el) => el.onclick = () => {
      const entry = state.entries.find((x) => x.club.id === el.dataset.vid);
      input.value = ""; closeSug();
      if (entry) { MAP.setCenter(entry.position); if (MAP.getLevel() > 5) MAP.setLevel(4, entry.position); openDetail(entry.club); }
    });
    sug.querySelectorAll("[data-pi]").forEach((el) => el.onclick = () => {
      const p = places[+el.dataset.pi];
      input.value = ""; closeSug();
      track("search_place", { term: q, place: p.name });
      const ll = MAP.latLng(p.lat, p.lng);
      MAP.setLevel(2, ll);             // 핀 없이 그 장소로 바짝 줌인
      MAP.setCenter(ll);
      setTimeout(renderList, 400);     // 이동 후 리스트 갱신 보강
    });
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(state._sugT);
    if (q.length < 1) return closeSug();
    state._sugT = setTimeout(async () => {
      const ql = q.toLowerCase();
      const venues = state.entries.filter((e) => e.club.name.toLowerCase().includes(ql)).slice(0, 5);
      let places = [];
      try { places = await MAP.searchPlaces(q); } catch (e) {}
      if (input.value.trim() === q) renderSuggest(venues, places, q);
    }, 280);
  });
  input.addEventListener("focus", () => { if (input.value.trim() && sug.innerHTML) sug.classList.remove("hidden"); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".searchbar")) closeSug();
  });
}

function renderAll() {
  const now = new Date();
  const vis = [];
  state.entries.forEach((e) => {
    if (!passesFilter(e.club)) return;
    const status = venueStatus(e.club, now);
    if (state.filters.openOnly && status !== "open") return;
    if (state.filters.rankedOnly && !state.rankIndex[e.club.id]) return;
    // 명암으로 깎지 않음 — 오늘 휴무만 조용히 음소거(muted)
    e.el.classList.toggle("muted", status === "off");
    e.dot.style.background = STATUS_META[status].dot;
    vis.push(e);
  });
  state.visibleEntries = vis;
  document.getElementById("countPill").textContent = tCount(vis.length);
  applyClustering();
  renderList();
}

/* ---------- 지도 내 업장 리스트 (하단 시트) ---------- */
function distMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function fmtDist(m) { return m < 1000 ? Math.round(m) + "m" : (m / 1000).toFixed(1) + "km"; }
function renderList() {
  const body = document.getElementById("lsBody");
  if (!body || !state.map) return;
  const c = MAP.center();
  const inView = state.visibleEntries
    .filter((e) => MAP.inBounds(e.position.getLat(), e.position.getLng()))
    .map((e) => ({ e, d: distMeters(c.lat, c.lng, e.position.getLat(), e.position.getLng()) }))
    .sort((a, b) => a.d - b.d);
  document.getElementById("lsCount").textContent = t("ls_count", { n: inView.length });
  document.getElementById("lsTotal").textContent = t("ls_total", { n: state.entries.length });
  if (!inView.length) { body.innerHTML = `<div class="ls-empty">${t("ls_empty")}</div>`; return; }
  body.innerHTML = inView.slice(0, 80).map(({ e, d }) => {
    const club = e.club, thumb = clubPhoto(club);
    return `<div class="lsi" data-id="${club.id}">
      ${thumb ? `<img class="lsi-thumb" loading="lazy" alt="" src="${thumb}">` : `<div class="lsi-thumb ph">🌃</div>`}
      <div class="lsi-body">
        <div class="lsi-name">${escapeHtml(club.name)}</div>
        <div class="lsi-meta">
          <span class="lsi-cat"><span class="d" style="background:${clubColor(club)}"></span>${catLabel(club.category)}</span>
          <span>·</span><span>${fmtDist(d)}</span>
          ${club.region ? `<span>·</span><span>${regionLabel(club.region)}</span>` : ""}
        </div>
      </div>
      <span class="lsi-arrow">›</span>
    </div>`;
  }).join("");
  body.querySelectorAll(".lsi").forEach((el) => el.addEventListener("click", () => {
    const entry = state.entries.find((x) => x.club.id === el.dataset.id);
    if (!entry) return;
    document.getElementById("listSheet").classList.remove("expanded");
    MAP.setCenter(entry.position);
    if (MAP.getLevel() > 5) MAP.setLevel(4, entry.position);
    openDetail(entry.club);
  }));
}
function setupListSheet() {
  const sheet = document.getElementById("listSheet");
  document.getElementById("lsHandle").onclick = () => sheet.classList.toggle("expanded");
}

/* ---------- 줌 기반 클러스터링 ---------- */
function clearClusters() {
  state.clusterOverlays.forEach((o) => o.setMap(null));
  state.clusterOverlays = [];
}
// 레벨별 격자 크기(deg) — 줌아웃할수록 크게 묶음
function cellSize(level) {
  return 0.003 * Math.pow(2, level - CLUSTER_MIN_LEVEL);
}
function applyClustering() {
  clearClusters();
  const vis = state.visibleEntries;
  const lvl = MAP.getLevel();
  // 1) 근접: 사진 카드(가까이) / 이름 라벨(조금 멀리). 보이는 것만 켬.
  if (lvl <= LABEL_MAX_LEVEL) {
    const photoMode = lvl <= PHOTO_MAX_LEVEL;
    state.entries.forEach((e) => e.overlay.setMap(null));
    vis.forEach((e) => { setMarkerMode(e, photoMode); e.overlay.setMap(state.map); });
    return;
  }
  state.entries.forEach((e) => e.overlay.setMap(null));
  // 2) 중간: 카테고리 색 점 (이름 숨김 — 떡짐 방지)
  if (lvl < CLUSTER_MIN_LEVEL) {
    vis.forEach((e) => state.clusterOverlays.push(makeDot(e.position, e.club)));
    return;
  }
  // 3) 도시 전체: 격자 묶음 = 숫자 뱃지 (단독은 점)
  const size = cellSize(lvl);
  const cells = new Map();
  vis.forEach((e) => {
    const key = Math.floor(e.position.getLat() / size) + "_" + Math.floor(e.position.getLng() / size);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(e);
  });
  cells.forEach((group) => {
    if (group.length === 1) { state.clusterOverlays.push(makeDot(group[0].position, group[0].club)); return; }
    let la = 0, ln = 0;
    group.forEach((e) => { la += e.position.getLat(); ln += e.position.getLng(); });
    const pos = MAP.latLng(la / group.length, ln / group.length);
    state.clusterOverlays.push(makeCluster(pos, group.length));
  });
}
function makeDot(position, club) {
  const el = document.createElement("div");
  el.className = "map-dot";
  el.style.background = clubColor(club);
  el.title = club.name;
  el.addEventListener("click", () => openDetail(club));
  const ov = MAP.overlay(position, el, { yAnchor: 0.5, xAnchor: 0.5, clickable: true, zIndex: 40 });
  ov.setMap(state.map);
  return ov;
}
function makeCluster(position, count) {
  const el = document.createElement("div");
  el.className = "cluster";
  el.textContent = count;
  el.addEventListener("click", () =>
    MAP.setLevel(Math.max(1, MAP.getLevel() - 2), position));
  const ov = MAP.overlay(position, el, { yAnchor: 0.5, xAnchor: 0.5, clickable: true, zIndex: 50 });
  ov.setMap(state.map);
  return ov;
}

/* ---------- 상세 카드 ---------- */
function openDetail(club) {
  const link = club.insta
    ? `<a class="insta-link" href="${club.insta}" target="_blank" rel="noopener">${t("link_insta")}</a>`
    : (club.place_url
      ? `<a class="insta-link" href="${club.place_url}" target="_blank" rel="noopener">${t("link_kakao")}</a>`
      : `<span style="color:#a0a0ac">${t("link_none")}</span>`);
  const hours = venueHours(club);
  const st = STATUS_META[venueStatus(club, new Date())];
  const lowConf = club.category_confidence === "low"
    ? ` <span class="conf-low">${t("conf_low")}</span>` : "";
  const rank = state.rankIndex[club.id];
  const rankTag = rank
    ? `<span class="tag rank-tag rank-${rank}">${MEDAL[rank] || ""}${t("rank_tag", { region: regionLabel(club.region), n: rank })}</span>`
    : (state.newSet.has(club.id) ? `<span class="tag new-tag">NEW</span>` : "");
  const access = venueAccess(club);
  const accessLine = access === "ticket" ? t("access_ticket") : t("access_walkin");
  const org = venueOrganizer(club);
  const ticketCta = (access === "ticket" && org)
    ? `<a class="ticket-cta" href="${org}" target="_blank" rel="noopener">${t("ticket_cta", { handle: organizerHandle(org) })}</a>`
    : "";
  const subTag = club.etc_type === "혼술바" ? " · " + subLabel("혼술바") : "";
  document.getElementById("detailBody").innerHTML = `
    <h2>${escapeHtml(club.name)}</h2>
    <div class="tags">
      ${rankTag}
      <span class="tag" style="background:${clubColor(club)};color:#fff">${catLabel(club.category)}${subTag}</span>
      <span class="tag region-tag" style="background:${regionColor(club.region)};color:#fff">${regionLabel(club.region)}</span>
      ${club._subType === "event" ? `<span class="tag event-tag">${isToday(club.event_date) ? t("event_today") : t("event_label")}</span>` : ""}
      <span class="status-badge ${st.cls}">${st.text}</span>${lowConf}
    </div>
    <div class="detail-actions">
      <button class="da-btn" data-act="fav" type="button">${t("act_fav")}</button>
      <button class="da-btn" data-act="dir" type="button">${t("act_dir")}</button>
      <button class="da-btn" data-act="share" type="button">${t("act_share")}</button>
    </div>
    <dl>
      ${club.event_date ? `<dt>${t("dt_date")}</dt><dd>${club.event_date}${isToday(club.event_date) ? ` · <b style="color:#FFD400">${t("dt_today")}</b>` : ""}</dd>` : ""}
      <dt>${t("dt_access")}</dt><dd>${accessLine}</dd>
      <dt>${t("dt_days")}</dt><dd>${fmtDays(hours)}</dd>
      <dt>${t("dt_hours")}</dt><dd>${fmtHours(hours)}</dd>
      <dt>${t("dt_addr")}</dt><dd>${club.address ? escapeHtml(club.address) : t("addr_tbd")}</dd>
      ${club.memo ? `<dt>${t("dt_memo")}</dt><dd>${escapeHtml(club.memo)}</dd>` : ""}
      <dt>${t("dt_link")}</dt><dd>${link}</dd>
    </dl>
    ${ticketCta}
    ${club._unverified
      ? `<div class="unverified-note">${t("unverified_note")}</div>`
      : (club.verified ? "" : `<div class="unverified">${t("unverified_data")}</div>`)}
    <div class="photos-section" id="photoBox"></div>
    <div class="votes" id="voteBox"></div>
    <button class="edit-report-btn" id="editReportBtn" type="button">${t("edit_report")}</button>
    <div class="reviews" id="reviewBox"></div>`;
  document.getElementById("detail").classList.remove("hidden");
  track("venue_detail_view", { venue: club.name, category: club.category, region: club.region || "", unverified: !!club._unverified });
  wireDetailActions(club);
  renderPhotos(club);
  renderVotes(club.id);
  document.getElementById("editReportBtn").addEventListener("click", () => openReport("edit", club));
  renderReviews(club.id);
}

// 상세 액션: 찜(localStorage) · 길찾기(카카오맵) · 공유(Web Share)
function wireDetailActions(club) {
  const entry = state.entries.find((e) => e.club.id === club.id);
  const lat = typeof club.lat === "number" ? club.lat : entry && entry.position.getLat();
  const lng = typeof club.lng === "number" ? club.lng : entry && entry.position.getLng();
  const favKey = "fav_" + club.id;
  const favBtn = document.querySelector(".detail-actions [data-act=fav]");
  const isFav = () => localStorage.getItem(favKey) === "1";
  const paint = () => { favBtn.textContent = isFav() ? t("act_fav_on") : t("act_fav"); favBtn.classList.toggle("on", isFav()); };
  paint();
  favBtn.onclick = () => { localStorage.setItem(favKey, isFav() ? "0" : "1"); paint(); };
  document.querySelector(".detail-actions [data-act=dir]").onclick = () => {
    if (lat && lng) window.open(`https://map.kakao.com/link/to/${encodeURIComponent(club.name)},${lat},${lng}`, "_blank");
  };
  document.querySelector(".detail-actions [data-act=share]").onclick = async () => {
    const data = { title: "놀자맵", text: t("share_text", { name: club.name }), url: location.origin + "/" };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); alert(t("share_copied")); }
    } catch (e) {}
  };
}

/* ---------- 사진 (유저 업로드 + 카카오 콜드스타트 썸네일) ---------- */
async function renderPhotos(club) {
  const box = document.getElementById("photoBox");
  if (!box) return;
  const venueId = club.id;
  box.innerHTML = `<div class="ph-strip"><div class="ph-loading">${t("ph_loading")}</div></div>`;
  let photos = [];
  try { photos = await fetchPhotos(venueId); } catch (e) {}
  const userUrls = photos.map((p) => p.url);
  const hasUser = userUrls.length > 0;
  // 유저 사진 있으면 그것만, 없고 카카오 썸네일 있으면 기본 1장(출처 표시)
  const isDefault = !hasUser && !!club.thumb;
  const urls = hasUser ? userUrls : (club.thumb ? [club.thumb] : []);
  box.innerHTML = `
    <div class="ph-strip">
      ${urls.map((u, i) =>
        `<div class="ph-cell${isDefault ? " default" : ""}"><img loading="lazy" alt="${escapeHtml(club.name)}" src="${u}" />${isDefault && i === 0 ? `<span class="ph-src">${t("ph_src_kakao")}</span>` : ""}</div>`
      ).join("")}
      <label class="ph-add" for="phFile"><span>${t("ph_add")}</span></label>
      <input id="phFile" type="file" accept="image/*" hidden />
    </div>
    ${urls.length ? "" : `<div class="ph-empty">${t("ph_empty")}</div>`}
    <div class="ph-msg" id="phMsg"></div>`;
  const file = box.querySelector("#phFile");
  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    const msg = box.querySelector("#phMsg");
    msg.textContent = t("ph_uploading");
    try {
      const row = await uploadPhoto(f, venueId);
      track("photo_upload", { venue: club.name, category: club.category });
      state.photoThumbs[venueId] = row.url;          // 마커도 이 사진으로
      const entry = state.entries.find((e) => e.club.id === venueId);
      if (entry && entry.photoEl) entry.photoEl.querySelector("img").src = row.url;
      await renderPhotos(club);                       // 상세 사진 새로고침
    } catch (e) { msg.textContent = t("ph_upload_fail") + e.message; }
  });
}

/* ---------- 투표 (물좋음·붐빔) ---------- */
async function renderVotes(venueId) {
  const box = document.getElementById("voteBox");
  if (!box) return;
  box.innerHTML = `
    <div class="vote-row">
      <button data-kind="up" class="vote-btn">${t("vote_up")} <b>0</b></button>
      <button data-kind="down" class="vote-btn">${t("vote_down")} <b>0</b></button>
    </div>
    <div class="vote-now">
      <span class="vn-label">${t("vote_now_label")}</span>
      <button data-kind="busy" class="vote-btn now">${t("vote_busy")}</button>
      <button data-kind="ok" class="vote-btn now">${t("vote_ok")}</button>
      <button data-kind="empty" class="vote-btn now">${t("vote_empty")}</button>
      <span class="vn-result" id="vnResult"></span>
    </div>`;
  const rows = await fetchVotes(venueId);
  const cnt = (k) => rows.filter((r) => r.kind === k).length;
  box.querySelector('[data-kind=up] b').textContent = cnt("up");
  box.querySelector('[data-kind=down] b').textContent = cnt("down");
  // 붐빔: 최근 3시간 가중
  const cutoff = Date.now() - 3 * 3600 * 1000;
  const recent = rows.filter((r) => ["busy", "ok", "empty"].includes(r.kind) && new Date(r.created_at).getTime() > cutoff);
  const res = document.getElementById("vnResult");
  if (recent.length) {
    const tally = { busy: 0, ok: 0, empty: 0 };
    recent.forEach((r) => tally[r.kind]++);
    const dom = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    res.textContent = { busy: t("vote_busy"), ok: t("vote_ok"), empty: t("vote_empty") }[dom] + t("vote_recent", { n: recent.length });
  } else { res.textContent = t("vote_none"); }
  // 투표 처리 (localStorage 중복방지)
  box.querySelectorAll(".vote-btn").forEach((b) => {
    const kind = b.dataset.kind;
    const group = ["up", "down"].includes(kind) ? "q" : "n";
    const lsKey = `v_${group}_${venueId}`;
    if (group === "q" && localStorage.getItem(lsKey)) {
      if (localStorage.getItem(lsKey) === kind) b.classList.add("voted");
    }
    b.addEventListener("click", async () => {
      if (group === "q" && localStorage.getItem(lsKey)) return; // 물좋음은 1회
      const last = group === "n" ? +(localStorage.getItem(lsKey) || 0) : 0;
      if (group === "n" && Date.now() - last < 3600 * 1000) return; // 붐빔은 1시간 1회
      await submitVote(venueId, kind);
      track("vote", { kind });
      localStorage.setItem(lsKey, group === "q" ? kind : String(Date.now()));
      renderVotes(venueId);
    });
  });
}

/* ---------- 업장 리뷰·댓글 ---------- */
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return t("time_now");
  if (d < 3600) return t("time_min", { n: Math.floor(d / 60) });
  if (d < 86400) return t("time_hr", { n: Math.floor(d / 3600) });
  return t("time_day", { n: Math.floor(d / 86400) });
}
async function renderReviews(venueId) {
  const box = document.getElementById("reviewBox");
  if (!box) return;
  box.innerHTML = `
    <div class="rv-head">${t("rv_head")} <span class="rv-cnt"></span></div>
    <div class="rv-list">${t("ph_loading")}</div>
    <div class="rv-input">
      <input id="rvText" type="text" maxlength="140" placeholder="${t("rv_ph")}" autocomplete="off" />
      <button id="rvSend" type="button">${t("rv_send")}</button>
    </div>`;
  const list = box.querySelector(".rv-list");
  const input = box.querySelector("#rvText");
  const send = box.querySelector("#rvSend");
  async function load() {
    const reviews = await fetchReviews(venueId);
    box.querySelector(".rv-cnt").textContent = reviews.length ? `(${reviews.length})` : "";
    list.innerHTML = reviews.length
      ? reviews.map((r) =>
          `<div class="rv-item"><span class="rv-text">${escapeHtml(r.text)}</span><span class="rv-time">${timeAgo(r.created_at)}</span></div>`
        ).join("")
      : `<div class="rv-empty">${t("rv_empty")}</div>`;
  }
  async function post() {
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    try { await submitReview(venueId, text); track("review_submit", { venue: venueId }); input.value = ""; await load(); }
    catch (e) { send.textContent = t("rv_fail"); setTimeout(() => (send.textContent = t("rv_send")), 1200); }
    finally { send.disabled = false; }
  }
  send.addEventListener("click", post);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") post(); });
  load();
}

/* ---------- 랭킹 (종합 소셜 점수) ---------- */
async function computeRanking() {
  const [voteAgg, reviewCounts] = await Promise.all([fetchVoteCounts(), fetchReviewCounts()]);
  return state.entries.map((e) => {
    const v = voteAgg[e.club.id] || {};
    const r = reviewCounts[e.club.id] || 0;
    const score = ((v.up || 0) - (v.down || 0)) * 3 + r * 2 + (v.busy || 0) * 1;
    return { club: e.club, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}
async function openRanking() {
  track("ranking_open");
  const panel = document.getElementById("rankingPanel");
  const list = document.getElementById("rankingList");
  list.innerHTML = `<div class="ranking-empty">${t("rank_calc")}</div>`;
  panel.classList.remove("hidden");
  const scored = await computeRanking();
  if (!scored.length) {
    list.innerHTML = `<div class="ranking-empty">${t("rank_empty")}</div>`;
    return;
  }
  const medal = { 0: "🥇", 1: "🥈", 2: "🥉" };
  list.innerHTML = scored.slice(0, 30).map((x, i) =>
    `<div class="ranking-item" data-id="${x.club.id}">
      <span class="rk-num">${medal[i] || "#" + (i + 1)}</span>
      <span class="rk-dot" style="background:${clubColor(x.club)}"></span>
      <span class="rk-body"><span class="rk-name">${escapeHtml(x.club.name)}</span><span class="rk-meta">${catLabel(x.club.category)} · ${regionLabel(x.club.region || "")}</span></span>
      <span class="rk-score">+${x.score}</span>
    </div>`).join("");
  list.querySelectorAll(".ranking-item").forEach((el) => {
    el.addEventListener("click", () => {
      const entry = state.entries.find((e) => e.club.id === el.dataset.id);
      if (!entry) return;
      panel.classList.add("hidden");
      MAP.setLevel(4, entry.position);
      MAP.setCenter(entry.position);
      openDetail(entry.club);
    });
  });
}
function setupRanking() {
  document.getElementById("rankingBtn").addEventListener("click", openRanking);
  document.getElementById("rankingClose").addEventListener("click", () =>
    document.getElementById("rankingPanel").classList.add("hidden"));
}

/* ---------- 제보 (Supabase) ---------- */
function submissionToClub(s) {
  return {
    id: "sub_" + s.id, name: s.name || t("name_none"), region: s.region || "",
    category: s.category || "기타", lat: s.lat, lng: s.lng,
    address: s.address || "", insta: s.insta || "", memo: s.memo || "",
    event_date: s.event_date || "", thumb: s.thumb || "",
    _unverified: !s.verified, verified: !!s.verified,
    _subType: s.type, source: "submission",
  };
}
function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}
function addEntryForClub(club) {
  if (typeof club.lat !== "number" || typeof club.lng !== "number") return;
  const position = MAP.latLng(club.lat, club.lng);
  const { overlay, el, dot, wrap } = makeOverlay(club, position);
  state.entries.push({ club, overlay, el, dot, wrap, position });
}
async function loadSubmissions() {
  try {
    const subs = await fetchSubmissions();
    subs.filter((s) => s.type === "new" || s.type === "event")
        .forEach((s) => addEntryForClub(submissionToClub(s)));
  } catch (e) { console.warn("제보 로드 실패", e); }
}
function nearestRegionName(lat, lng) {
  let best = "", bd = Infinity;
  for (const [r, c] of Object.entries(REGION_CENTERS)) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
// 주소/장소명 텍스트 → 좌표 (엔진 지오코딩)
function geocodeText(q) {
  return MAP.geocode(q);
}

function setupReport() {
  const sel = document.getElementById("rpCategory");
  sel.innerHTML = Object.keys(state.meta.categories)
    .map((c) => `<option value="${c}">${catLabel(c)}</option>`).join("");
  const modal = document.getElementById("reportModal");
  document.getElementById("reportBtn").addEventListener("click", () => openReport("new"));
  document.getElementById("reportClose").addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("rpPick").addEventListener("click", startPick);
  document.getElementById("pickCancel").addEventListener("click", () => { endPick(); modal.classList.remove("hidden"); });
  document.getElementById("rpSubmit").addEventListener("click", doSubmit);
  document.querySelectorAll("#rpTypeToggle .rp-type-btn").forEach((b) =>
    b.addEventListener("click", () => setReportType(b.dataset.type)));
  // 🎉 이벤트 필터 토글
  const evBtn = document.getElementById("eventToggle");
  evBtn.addEventListener("click", () => {
    state.filters.eventsOnly = !state.filters.eventsOnly;
    evBtn.classList.toggle("active", state.filters.eventsOnly);
    renderAll();
  });
}
function validCategory(cat) {
  return [...document.getElementById("rpCategory").options].some((o) => o.value === cat);
}
// 유형 전환(새장소 ↔ 이벤트) — 토글 버튼·openReport 둘 다 사용
function setReportType(type) {
  state.reportMode = type;
  document.querySelectorAll("#rpTypeToggle .rp-type-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.type === type));
  document.getElementById("rpDateWrap").classList.toggle("hidden", type !== "event");
  const title = document.getElementById("rpTitle");
  const sub = document.querySelector("#reportModal .rp-sub");
  if (type === "event") {
    title.textContent = t("rp_title_event");
    sub.textContent = t("rp_sub_event");
    if (validCategory("소개팅·파티")) document.getElementById("rpCategory").value = "소개팅·파티";
  } else {
    title.textContent = t("rp_title_new");
    sub.textContent = t("rp_sub_new");
  }
}
function openReport(mode, club) {
  state.reportTarget = club || null;
  resetReportForm();
  const toggle = document.getElementById("rpTypeToggle");
  const memo = document.getElementById("rpMemo");
  if (mode === "edit" && club) {
    state.reportMode = "edit";
    toggle.classList.add("hidden");
    document.getElementById("rpDateWrap").classList.add("hidden");
    document.getElementById("rpTitle").textContent = t("rp_title_edit");
    document.querySelector("#reportModal .rp-sub").textContent = t("rp_sub_edit", { name: club.name });
    document.getElementById("rpName").value = club.name;
    if (validCategory(club.category)) document.getElementById("rpCategory").value = club.category;
    memo.placeholder = t("memo_ph_edit");
  } else {
    toggle.classList.remove("hidden");
    memo.placeholder = t("rp_memo_ph");
    setReportType(mode === "event" ? "event" : "new");
  }
  document.getElementById("reportModal").classList.remove("hidden");
}
function resetReportForm() {
  state.pickedCoord = null;
  if (state._pickMarker) { state._pickMarker.setMap(false); state._pickMarker = null; }
  ["rpName", "rpInsta", "rpMemo", "rpAddr"].forEach((id) => (document.getElementById(id).value = ""));
  const coord = document.getElementById("rpCoord");
  coord.textContent = t("rp_unset"); coord.classList.remove("set");
  document.getElementById("rpPick").classList.remove("set");
  document.getElementById("rpMsg").textContent = "";
}
function startPick() {
  document.getElementById("reportModal").classList.add("hidden");
  document.getElementById("pickHint").classList.remove("hidden");
  MAP.onMapClick((ll) => {
    state.pickedCoord = { lat: ll.getLat(), lng: ll.getLng() };
    if (state._pickMarker) state._pickMarker.setMap(false);
    state._pickMarker = MAP.pinMarker(ll);
    state._pickMarker.setMap(true);
    endPick();
    const coord = document.getElementById("rpCoord");
    coord.textContent = t("pick_coord", { lat: state.pickedCoord.lat.toFixed(4), lng: state.pickedCoord.lng.toFixed(4) });
    coord.classList.add("set");
    document.getElementById("rpPick").classList.add("set");
    document.getElementById("reportModal").classList.remove("hidden");
  });
}
function endPick() {
  document.getElementById("pickHint").classList.add("hidden");
  MAP.offMapClick();
}
function rpMsg(text, cls) {
  const m = document.getElementById("rpMsg");
  m.textContent = text; m.className = "rp-msg " + (cls || "");
}
async function doSubmit() {
  const mode = state.reportMode || "new";
  const name = document.getElementById("rpName").value.trim();
  const category = document.getElementById("rpCategory").value;
  const memoVal = document.getElementById("rpMemo").value.trim();
  const addrText = document.getElementById("rpAddr").value.trim();
  const eventDate = document.getElementById("rpDate").value;
  if (!name) return rpMsg(t("msg_need_name"), "err");
  if (mode === "event" && !eventDate) return rpMsg(t("msg_need_date"), "err");
  if (mode === "edit" && !memoVal) return rpMsg(t("msg_need_memo"), "err");

  // 위치: 지도 선택 우선, 없으면 주소 텍스트를 지오코딩
  let coord = state.pickedCoord;
  let resolvedAddr = addrText || null;
  if (!coord && addrText) {
    rpMsg(t("msg_addr_searching"), "");
    const g = await geocodeText(addrText);
    if (g) { coord = { lat: g.lat, lng: g.lng }; resolvedAddr = g.address || addrText; }
    else if (mode !== "edit") return rpMsg(t("msg_addr_fail"), "err");
  }
  if ((mode === "new" || mode === "event") && !coord)
    return rpMsg(t("msg_need_loc"), "err");

  const payload = {
    type: mode, name, category,
    insta: document.getElementById("rpInsta").value.trim() || null,
    memo: memoVal || null,
  };
  if (resolvedAddr) payload.address = resolvedAddr;
  if (coord) {
    payload.lat = coord.lat; payload.lng = coord.lng;
    payload.region = nearestRegionName(coord.lat, coord.lng);
  }
  if (mode === "event") payload.event_date = eventDate;
  if (mode === "edit" && state.reportTarget) payload.target_id = state.reportTarget.id;
  // 새 장소/이벤트: 카카오에서 대표사진 자동 검색 → 있으면 썸네일 포함
  if ((mode === "new" || mode === "event") && payload.region) {
    rpMsg(t("msg_photo_searching"), "");
    const vt = await fetchVenueThumb(name, payload.region);
    if (vt && vt.thumb) payload.thumb = vt.thumb;
  }
  const btn = document.getElementById("rpSubmit"); btn.disabled = true;
  rpMsg(t("msg_submitting"), "");
  try {
    const row = await submitReport(payload);
    if (state._pickMarker) { state._pickMarker.setMap(false); state._pickMarker = null; }
    if (mode === "new" || mode === "event") { addEntryForClub(submissionToClub(row)); renderAll(); }
    track("report_submit", { report_type: mode, category });
    rpMsg(mode === "edit" ? t("msg_done_edit")
        : mode === "event" ? t("msg_done_event") : t("msg_done_new"), "ok");
    setTimeout(() => document.getElementById("reportModal").classList.add("hidden"), 1300);
  } catch (e) {
    rpMsg(t("msg_fail") + e.message, "err");
  } finally { btn.disabled = false; }
}

/* ---------- 내 위치 ---------- */
function locateMe() {
  if (!navigator.geolocation) return alert(t("locate_unavail"));
  const btn = document.getElementById("locateBtn");
  btn.classList.add("locating");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.classList.remove("locating");
      track("locate_me");
      const here = MAP.latLng(pos.coords.latitude, pos.coords.longitude);
      MAP.setLevel(4);          // 사진핀 보이는 줌으로
      MAP.setCenter(here);
      if (state._meMarker) state._meMarker.setMap(false);   // 중복 방지 — 1개만
      const meEl = document.createElement("div");
      meEl.className = "me-dot";
      meEl.innerHTML = '<span class="me-pulse"></span>';
      state._meMarker = MAP.overlay(here, meEl, { yAnchor: 0.5, xAnchor: 0.5, zIndex: 60 });
      state._meMarker.setMap(true);
    },
    () => { btn.classList.remove("locating"); alert(t("locate_denied")); },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

boot();
