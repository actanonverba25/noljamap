#!/usr/bin/env python3
"""첫차지키미 발굴 — 클럽거리/역세권 반경에서 새벽(4~6시) 영업 카페·해장·밥집 검색.

기준(category_criteria.첫차지키미):
  (1) 새벽 4~6시 영업  (2) 클럽거리 내부 또는 역세권
검색을 클럽거리 중심 좌표 + 반경 1.2km로 제한 → (2) 충족.
채택은 이름·업종에 새벽 영업 시그널(24시/심야/해장/국밥 등) 있는 것만 → (1) 근사.

실행:
  KAKAO_REST_KEY=xxxx python3 scripts/discover_firstcha.py
출력: data/firstcha_discovery.json (리뷰용). 머지는 merge_firstcha.py 로 별도.
"""
import json, os, sys, time, urllib.parse, urllib.request, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "firstcha_discovery.json")
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
API = "https://dapi.kakao.com/v2/local/search/keyword.json"
OG = re.compile(r'og:image"[^>]*content="([^"]+)"')

# 클럽거리/역 중심 (lat, lng, 반경m). 반경 = 첫차까지 걸어갈 동선.
AREAS = {
    "홍대":     (37.5563, 126.9236, 1300),
    "신촌":     (37.5556, 126.9368, 1000),
    "강남":     (37.4979, 127.0276, 1500),
    "이태원":   (37.5346, 126.9946, 1200),
    "건대":     (37.5404, 127.0699, 1200),
    "을지로":   (37.5660, 126.9910, 1200),
    "부산서면": (35.1577, 129.0594, 1300),
    "대구":     (35.8693, 128.5947, 1200),
}
REGION_ALIAS = {"신촌": "홍대"}
CITY = {"홍대": "서울", "강남": "서울", "이태원": "서울", "건대": "서울",
        "을지로": "서울", "부산서면": "부산", "대구": "대구"}

# 검색 키워드. 해장류는 통념상 새벽 영업 → 기본 채택. 카페류는 시그널 토큰 있을 때만.
QUERIES = ["24시 카페", "24시간 카페", "심야카페", "해장국", "콩나물국밥",
           "감자탕", "순대국", "북엇국", "24시 식당", "심야식당", "라멘", "24시 해장"]

# 이름/업종에 이게 있으면 '새벽 영업'으로 간주(4~6시 근사)
SIGNAL = ["24시", "24시간", "24h", "심야", "해장", "국밥", "감자탕",
          "콩나물", "순대", "북어", "북엇", "라멘", "곰탕", "설렁탕", "뼈해장"]
EXCLUDE = ["노래방", "룸살롱", "단란주점", "안마", "마사지", "PC방", "스크린",
           "당구", "찜질", "모텔", "호텔", "주차장", "편의점", "약국", "병원"]


def search(key, query, x, y, radius, page):
    qs = urllib.parse.urlencode({"query": query, "x": x, "y": y, "radius": radius,
                                 "page": page, "size": 15, "sort": "distance"})
    req = urllib.request.Request(API + "?" + qs, headers={"Authorization": f"KakaoAK {key}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


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


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def main():
    key = os.environ.get("KAKAO_REST_KEY")
    if not key:
        sys.exit("KAKAO_REST_KEY 환경변수 필요 (REST키 — JS키 아님).")

    existing = set()
    for c in json.load(open(CLUBS, encoding="utf-8"))["clubs"]:
        existing.add(norm(c["name"]))

    seen, venues = set(), []
    for area, (lat, lng, radius) in AREAS.items():
        region = REGION_ALIAS.get(area, area)
        for query in QUERIES:
            for page in range(1, 4):  # 상위 45곳/키워드면 충분
                try:
                    res = search(key, query, lng, lat, radius, page)
                except Exception as e:
                    print(f"  ! {area}/{query} p{page}: {e}"); break
                for d in res.get("documents", []):
                    pid = d["id"]
                    if pid in seen:
                        continue
                    cat = d.get("category_name", "")
                    nm = d["place_name"]
                    if any(x in cat or x in nm for x in EXCLUDE):
                        continue
                    blob = nm + " " + cat
                    if not any(t in blob for t in SIGNAL):
                        continue  # 새벽 영업 시그널 없으면 스킵
                    if norm(nm) in existing:
                        continue  # 이미 등록된 곳
                    seen.add(pid)
                    venues.append({
                        "kakao_id": pid, "name": nm, "region": region,
                        "city": CITY.get(region, ""),
                        "address": d.get("road_address_name") or d.get("address_name", ""),
                        "lat": float(d["y"]), "lng": float(d["x"]),
                        "kakao_category": cat, "phone": d.get("phone", ""),
                        "place_url": d.get("place_url", ""),
                        "found_by": f"{area} {query}",
                    })
                if res.get("meta", {}).get("is_end", True):
                    break
                time.sleep(0.18)
        print(f"{area}: 누적 {len(venues)}곳")

    # og:image 썸네일 보강
    print(f"\n썸네일 크롤 {len(venues)}곳…")
    got = 0
    for i, v in enumerate(venues, 1):
        img = og_image(v["kakao_id"])
        if img:
            v["thumb"] = img
            got += 1
        if i % 30 == 0:
            print(f"  {i}/{len(venues)} · 사진 {got}")
        time.sleep(0.2)

    out = {
        "_meta": {
            "source": "Kakao Local — 첫차지키미 발굴",
            "criteria": "클럽거리/역 반경 + 새벽영업 시그널(24시/심야/해장/국밥)",
            "areas": list(AREAS.keys()), "queries": QUERIES,
            "total": len(venues), "with_thumb": got,
            "note": "category=첫차지키미 후보. confidence low — 4~6시 실영업은 제보/실사 보강 필요.",
        },
        "venues": venues,
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n총 {len(venues)}곳 (사진 {got}) → {OUT}")
    print("지역:", dict(Counter(v["region"] for v in venues)))


if __name__ == "__main__":
    main()
