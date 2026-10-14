// 놀자맵 — 이름+지역으로 카카오 장소 사진(대표 og:image) 찾아주기
// 제보 제출 시 브라우저에서 호출 → 제보 insert payload에 thumb 포함
// 시크릿: KAKAO_REST_KEY
// 함수 설정: Verify JWT = OFF (브라우저 익명 호출, CORS 허용)
// ※ 데모용 콜드스타트 썸네일. 유저 업로드 사진 우선. ToS 회색지대.

const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY")!;
const OG = /og:image"[^>]*content="([^"]+)"/;

const REGION: Record<string, [number, number]> = {
  "홍대": [37.5563, 126.9236], "이태원": [37.5346, 126.9946], "강남": [37.5172, 127.0286],
  "건대": [37.5404, 127.0699], "수원": [37.2664, 127.0001], "부산서면": [35.1577, 129.0594],
  "부산광안리": [35.1532, 129.1186], "부산해운대": [35.1631, 129.1635], "대구": [35.8693, 128.5947],
  "을지로": [37.5660, 126.9910], "안산": [37.3219, 126.8309], "광주": [35.2186, 126.8505],
  "제주": [33.5141, 126.5270], "강릉": [37.7950, 128.9090],
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

async function search(name: string, region: string) {
  const params = new URLSearchParams({ query: `${name} ${region}`.trim(), size: "1" });
  if (REGION[region]) {
    const [lat, lng] = REGION[region];
    params.set("x", String(lng)); params.set("y", String(lat)); params.set("radius", "3000");
  }
  const r = await fetch("https://dapi.kakao.com/v2/local/search/keyword.json?" + params, {
    headers: { Authorization: "KakaoAK " + KAKAO_REST_KEY },
  });
  if (!r.ok) return null;
  const docs = (await r.json()).documents || [];
  return docs[0] || null;
}

async function ogImage(pid: string) {
  try {
    const r = await fetch(`https://place.map.kakao.com/${pid}`, { headers: { "User-Agent": "Mozilla/5.0 (iPhone)" } });
    const html = await r.text();
    const m = html.match(OG);
    if (!m || !m[1].includes("fname=")) return null;
    return m[1].startsWith("//") ? "https:" + m[1] : m[1];
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const { name, region } = await req.json();
    if (!name) return json({ thumb: null, error: "name required" }, 400);
    const doc = await search(name, region || "");
    if (!doc) return json({ thumb: null });
    const thumb = await ogImage(doc.id);
    return json({ thumb, place_url: doc.place_url || "", match: doc.place_name || "" });
  } catch (e) {
    return json({ thumb: null, error: String(e) }, 500);
  }
});
