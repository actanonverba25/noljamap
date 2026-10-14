#!/usr/bin/env python3
"""기타 카테고리(밤 생존·마무리) 전용 발굴 — 심야술집 + 물품보관함.

사용자 정의 '기타' = ① 새벽까지 앉아 간단한 안주에 술 마시기 좋은 심야술집
(포장마차·이자카야·선술집·심야식당·오뎅바) + ② 물품보관함/코인락커.
※ 맥도날드·24h편의점은 제외(사용자 결정: 심야술집·보관함만).

실행:
  export KAKAO_REST_KEY="REST키"
  python3 scripts/discover_etc.py
출력: data/kakao_etc.json (좌표 포함)
"""
import json, os, sys, time, urllib.parse, urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "kakao_etc.json")
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
API = "https://dapi.kakao.com/v2/local/search/keyword.json"

# 나이트라이프 지역 중심 (기존 데이터 커버리지와 동선 일치)
AREAS = {
    "이태원":     (37.5346, 126.9946, 1200),
    "홍대":       (37.5563, 126.9236, 1800),
    "강남":       (37.4979, 127.0276, 2000),
    "압구정":     (37.5270, 127.0286, 1500),
    "건대":       (37.5404, 127.0699, 1300),
    "신촌":       (37.5556, 126.9368, 1300),
    "종로":       (37.5704, 126.9910, 1500),
    "부산서면":   (35.1577, 129.0594, 1800),
    "대구동성로": (35.8693, 128.5947, 1500),
}
REGION_ALIAS = {"압구정": "강남", "대구동성로": "대구", "신촌": "홍대", "종로": "을지로"}

# 검색 키워드 → 서브타입(기타 안에서 구분용)
QUERIES = [
    ("포장마차", "심야술집"),
    ("이자카야", "심야술집"),
    ("선술집", "심야술집"),
    ("심야식당", "심야술집"),
    ("오뎅바", "심야술집"),
    ("물품보관함", "보관함"),
    ("코인락커", "보관함"),
]

# 업종에 이게 들어가면 제외
EXCLUDE = ["노래방", "룸살롱", "단란주점", "안마", "마사지", "PC방", "스크린", "당구", "찜질", "클럽", "헌팅"]
# 이름에 이게 들어가면 제외(자만추로 빠질 헌팅성 업소 — 기타 오염 방지)
NAME_EXCLUDE = ["헌팅", "별밤", "감성주점", "솔로", "소개팅"]
PAGES = 2  # query·area당 최대 30곳


def search(key, query, x, y, radius, page):
    qs = urllib.parse.urlencode({"query": query, "x": x, "y": y, "radius": radius,
                                 "page": page, "size": 15, "sort": "distance"})
    req = urllib.request.Request(API + "?" + qs, headers={"Authorization": f"KakaoAK {key}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def main():
    key = os.environ.get("KAKAO_REST_KEY")
    if not key:
        sys.exit("KAKAO_REST_KEY 필요 (REST키).")

    existing = set()
    if os.path.exists(CLUBS):
        for c in json.load(open(CLUBS, encoding="utf-8"))["clubs"]:
            existing.add(norm(c["name"]))

    seen, venues = set(), []
    for area, (lat, lng, radius) in AREAS.items():
        region = REGION_ALIAS.get(area, area)
        for query, subtype in QUERIES:
            for page in range(1, PAGES + 1):
                try:
                    res = search(key, f"{area} {query}", lng, lat, radius, page)
                except Exception as e:
                    print(f"  ! {area}/{query} p{page} 실패: {e}"); break
                for d in res.get("documents", []):
                    pid = d["id"]
                    if pid in seen:
                        continue
                    cat = d.get("category_name", "")
                    name = d["place_name"]
                    if any(x in cat for x in EXCLUDE):
                        continue
                    if any(x in name for x in NAME_EXCLUDE):
                        continue
                    seen.add(pid)
                    venues.append({
                        "kakao_id": pid, "name": name, "region": region,
                        "address": d.get("road_address_name") or d.get("address_name", ""),
                        "lat": float(d["y"]), "lng": float(d["x"]),
                        "kakao_category": cat, "phone": d.get("phone", ""),
                        "place_url": d.get("place_url", ""),
                        "subtype": subtype, "category": "기타", "confidence": "low",
                        "found_by": f"{area} {query}",
                        "is_new": norm(name) not in existing,
                    })
                if res.get("meta", {}).get("is_end", True):
                    break
                time.sleep(0.2)
        print(f"{area}: 누적 {len(venues)}곳")

    new_count = sum(1 for v in venues if v["is_new"])
    out = {"_meta": {"source": "Kakao Local (심야술집·보관함)", "areas": list(AREAS.keys()),
                     "queries": [q for q, _ in QUERIES], "total": len(venues),
                     "new_vs_clubs": new_count}, "venues": venues}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n총 {len(venues)}곳 (신규 {new_count}) → {OUT}")
    print("지역:", dict(Counter(v["region"] for v in venues)))
    print("서브타입:", dict(Counter(v["subtype"] for v in venues)))
    print("카카오업종 top:", dict(Counter(v["kakao_category"].split(">")[-1].strip() for v in venues).most_common(12)))


if __name__ == "__main__":
    main()
