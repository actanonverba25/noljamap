#!/usr/bin/env python3
"""place_url 없는 업장 → 카카오 장소검색(이름+지역 좌표 편향)으로 place_url 찾고 og:image 채움.
※ 데모용 콜드스타트. 유저 업로드 사진 우선. ToS 회색지대 — 정식서비스 전 교체 권장.
  KAKAO_REST_KEY=xxxx python3 scripts/backfill_kakao_search.py
"""
import json, os, re, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "data", "clubs.json")
KEY = os.environ["KAKAO_REST_KEY"]
OG = re.compile(r'og:image"[^>]*content="([^"]+)"')

REGION = {
    "홍대": (37.5563, 126.9236), "이태원": (37.5346, 126.9946), "강남": (37.5172, 127.0286),
    "건대": (37.5404, 127.0699), "수원": (37.2664, 127.0001), "부산서면": (35.1577, 129.0594),
    "부산광안리": (35.1532, 129.1186), "부산해운대": (35.1631, 129.1635), "대구": (35.8693, 128.5947),
    "을지로": (37.5660, 126.9910), "안산": (37.3219, 126.8309), "광주": (35.2186, 126.8505),
    "제주": (33.5141, 126.5270), "강릉": (37.7950, 128.9090),
}


def search(name, region):
    q = f"{name} {region}".strip()
    params = {"query": q, "size": 1}
    if region in REGION:
        lat, lng = REGION[region]
        params.update({"x": lng, "y": lat, "radius": 3000})
    url = "https://dapi.kakao.com/v2/local/search/keyword.json?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers={"Authorization": "KakaoAK " + KEY})
        docs = json.loads(urllib.request.urlopen(req, timeout=8).read()).get("documents", [])
        return docs[0] if docs else None
    except Exception:
        return None


def og_image(pid):
    try:
        req = urllib.request.Request(f"https://place.map.kakao.com/{pid}",
                                     headers={"User-Agent": "Mozilla/5.0 (iPhone)"})
        html = urllib.request.urlopen(req, timeout=8).read().decode("utf-8", "ignore")
        m = OG.search(html)
        if not m or "fname=" not in m.group(1):
            return None
        img = m.group(1)
        return ("https:" + img) if img.startswith("//") else img
    except Exception:
        return None


def main():
    d = json.load(open(PATH, encoding="utf-8"))
    targets = [c for c in d["clubs"] if not c.get("thumb") and not c.get("place_url")]
    print(f"대상(place_url 없는 곳) {len(targets)}곳 검색+크롤 시작…")
    got = 0
    for i, c in enumerate(targets, 1):
        doc = search(c.get("name", ""), c.get("region", ""))
        if doc:
            img = og_image(doc["id"])
            # 매칭된 place_url은 항상 저장(나중 재활용), 사진은 있을 때만
            c["place_url"] = doc.get("place_url", "")
            c["kakao_match"] = doc.get("place_name", "")
            if img:
                c["thumb"] = img
                c["thumb_src"] = "kakao"
                got += 1
        if i % 25 == 0:
            print(f"  {i}/{len(targets)} · 사진 {got}")
        time.sleep(0.22)
    json.dump(d, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(PATH, "a").write("\n")
    total = sum(1 for c in d["clubs"] if c.get("thumb"))
    print(f"\n신규 사진 {got}곳 · 전체 thumb {total}곳 → {PATH}")


if __name__ == "__main__":
    main()
