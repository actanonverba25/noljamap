#!/usr/bin/env python3
"""외국인 핫플 발굴 — 이태원·홍대·강남에서 루프탑/후카/수제맥주펍/게이바/외국인클럽 검색.

키워드 = 의도. 결과는 기존 카테고리(라운지·바 / 펍 / 클럽)로 매핑.
주점/바 업종만 채택(카페·노래방 등 제외). 좌표·썸네일 포함.

실행:  KAKAO_REST_KEY=xxxx python3 scripts/discover_foreigner.py
출력:  data/foreigner_discovery.json (리뷰용). 머지는 merge_foreigner.py.
"""
import json, os, sys, time, urllib.parse, urllib.request, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "foreigner_discovery.json")
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
API = "https://dapi.kakao.com/v2/local/search/keyword.json"
OG = re.compile(r'og:image"[^>]*content="([^"]+)"')

AREAS = {
    "이태원": (37.5346, 126.9946, 1500),
    "한남":   (37.5347, 127.0005, 1000),
    "홍대":   (37.5563, 126.9236, 1500),
    "강남":   (37.4979, 127.0276, 1500),
    "압구정": (37.5270, 127.0286, 1500),
}
REGION_ALIAS = {"한남": "이태원", "압구정": "강남"}
CITY = {"이태원": "서울", "홍대": "서울", "강남": "서울"}

# (검색 키워드, 매핑 카테고리)
QUERIES = [
    ("루프탑바", "라운지·바"), ("루프탑", "라운지·바"),
    ("칵테일바", "라운지·바"), ("와인바", "라운지·바"),
    ("후카", "라운지·바"), ("시샤", "라운지·바"), ("물담배", "라운지·바"),
    ("수제맥주", "펍"), ("크래프트비어", "펍"),
    ("아이리시펍", "펍"), ("스포츠펍", "펍"),
    ("게이바", "펍"), ("게이클럽", "클럽"),
    ("외국인클럽", "클럽"), ("힙합클럽", "클럽"),
]
# 주점/바 업종만 채택
WHITELIST = ["바", "펍", "클럽", "주점", "호프", "칵테일", "와인", "라운지", "맥주", "요리주점", "술집"]
EXCLUDE = ["노래방", "룸살롱", "단란주점", "안마", "마사지", "PC방", "스크린",
           "당구", "찜질", "모텔", "호텔", "주차장", "편의점", "약국", "병원", "카페"]


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
        sys.exit("KAKAO_REST_KEY 환경변수 필요 (REST키).")

    existing = set()
    for c in json.load(open(CLUBS, encoding="utf-8"))["clubs"]:
        existing.add(norm(c["name"]))

    seen, venues = set(), []
    for area, (lat, lng, radius) in AREAS.items():
        region = REGION_ALIAS.get(area, area)
        for query, category in QUERIES:
            for page in range(1, 4):
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
                    if not (any(w in cat for w in WHITELIST) or query in nm):
                        continue  # 주점/바 업종 아니고 이름에 키워드도 없으면 제외
                    if norm(nm) in existing:
                        continue
                    seen.add(pid)
                    venues.append({
                        "kakao_id": pid, "name": nm, "region": region,
                        "city": CITY.get(region, ""),
                        "address": d.get("road_address_name") or d.get("address_name", ""),
                        "lat": float(d["y"]), "lng": float(d["x"]),
                        "kakao_category": cat, "phone": d.get("phone", ""),
                        "place_url": d.get("place_url", ""),
                        "category": category, "found_by": f"{area} {query}",
                    })
                if res.get("meta", {}).get("is_end", True):
                    break
                time.sleep(0.18)
        print(f"{area}: 누적 {len(venues)}곳")

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
            "source": "Kakao Local — 외국인 핫플 발굴",
            "areas": list(AREAS.keys()),
            "queries": [q for q, _ in QUERIES],
            "total": len(venues), "with_thumb": got,
            "note": "키워드→카테고리 매핑. confidence low. 루프탑/후카/게이바/외국인클럽 등 외국인 친화 업장.",
        },
        "venues": venues,
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n총 {len(venues)}곳 (사진 {got}) → {OUT}")
    print("지역:", dict(Counter(v["region"] for v in venues)))
    print("카테고리:", dict(Counter(v["category"] for v in venues)))


if __name__ == "__main__":
    main()
