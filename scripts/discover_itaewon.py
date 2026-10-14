#!/usr/bin/env python3
"""이태원 일대 밀도 보강 — 이태원역·한남·녹사평·경리단·해방촌 5개 서브중심 × 다키워드.
모두 region=이태원 으로 머지. 좌표·썸네일 포함, 기존 중복 제외.

  KAKAO_REST_KEY=xxxx python3 scripts/discover_itaewon.py
출력: data/itaewon_discovery.json
"""
import json, os, sys, time, urllib.parse, urllib.request, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itaewon_discovery.json")
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
API = "https://dapi.kakao.com/v2/local/search/keyword.json"
OG = re.compile(r'og:image"[^>]*content="([^"]+)"')

# 이태원 일대 서브중심 (lat,lng,radius m)
SUBS = [
    ("이태원역", 37.5346, 126.9946, 800),
    ("한남동",   37.5347, 127.0005, 800),
    ("녹사평",   37.5345, 126.9886, 700),
    ("경리단길", 37.5385, 126.9880, 700),
    ("해방촌",   37.5430, 126.9850, 700),
]
# (키워드, 카테고리)
QUERIES = [
    ("클럽", "클럽"), ("게이클럽", "클럽"), ("힙합클럽", "클럽"),
    ("바", "라운지·바"), ("칵테일바", "라운지·바"), ("와인바", "라운지·바"),
    ("위스키바", "라운지·바"), ("루프탑바", "라운지·바"), ("루프탑", "라운지·바"),
    ("라운지", "라운지·바"), ("후카", "라운지·바"), ("시샤", "라운지·바"),
    ("다이닝바", "라운지·바"), ("게이바", "펍"), ("이자카야", "라운지·바"),
    ("펍", "펍"), ("수제맥주", "펍"), ("아이리시펍", "펍"), ("헌팅포차", "포차"),
]
WHITELIST = ["바", "펍", "클럽", "주점", "호프", "칵테일", "와인", "라운지", "맥주", "요리주점", "술집", "이자카야"]
EXCLUDE = ["노래방", "룸살롱", "단란주점", "안마", "마사지", "PC방", "스크린", "당구",
           "찜질", "모텔", "호텔", "주차장", "편의점", "약국", "병원", "카페", "헬스"]


def search(key, q, x, y, r, page):
    qs = urllib.parse.urlencode({"query": q, "x": x, "y": y, "radius": r, "page": page, "size": 15, "sort": "distance"})
    req = urllib.request.Request(API + "?" + qs, headers={"Authorization": f"KakaoAK {key}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.load(resp)


def og_image(pid):
    try:
        req = urllib.request.Request(f"https://place.map.kakao.com/{pid}", headers={"User-Agent": "Mozilla/5.0 (iPhone)"})
        html = urllib.request.urlopen(req, timeout=8).read().decode("utf-8", "ignore")
        m = OG.search(html)
        if not m or "fname=" not in m.group(1): return None
        img = m.group(1)
        return ("https:" + img) if img.startswith("//") else img
    except Exception:
        return None


def norm(s): return "".join(ch for ch in s.lower() if ch.isalnum())


def main():
    key = os.environ.get("KAKAO_REST_KEY") or sys.exit("KAKAO_REST_KEY 필요")
    existing = set(norm(c["name"]) for c in json.load(open(CLUBS, encoding="utf-8"))["clubs"])

    seen, venues = set(), []
    for area, lat, lng, rad in SUBS:
        for q, cat in QUERIES:
            for page in range(1, 4):
                try:
                    res = search(key, q, lng, lat, rad, page)
                except Exception as e:
                    print(f"  ! {area}/{q} p{page}: {e}"); break
                for d in res.get("documents", []):
                    pid = d["id"]
                    if pid in seen: continue
                    c = d.get("category_name", ""); nm = d["place_name"]
                    if any(x in c or x in nm for x in EXCLUDE): continue
                    if not (any(w in c for w in WHITELIST) or q in nm): continue
                    if norm(nm) in existing: continue
                    seen.add(pid)
                    venues.append({
                        "kakao_id": pid, "name": nm, "region": "이태원", "city": "서울",
                        "address": d.get("road_address_name") or d.get("address_name", ""),
                        "lat": float(d["y"]), "lng": float(d["x"]),
                        "kakao_category": c, "place_url": d.get("place_url", ""),
                        "category": cat, "found_by": f"{area} {q}",
                    })
                if res.get("meta", {}).get("is_end", True): break
                time.sleep(0.16)
        print(f"{area}: 누적 {len(venues)}")

    print(f"\n썸네일 {len(venues)}곳…")
    got = 0
    for i, v in enumerate(venues, 1):
        img = og_image(v["kakao_id"])
        if img: v["thumb"] = img; got += 1
        if i % 40 == 0: print(f"  {i}/{len(venues)} · 사진 {got}")
        time.sleep(0.18)

    json.dump({"_meta": {"source": "이태원 밀도보강", "total": len(venues), "with_thumb": got}, "venues": venues},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n총 {len(venues)} (사진 {got}) → {OUT}")
    print("카테고리:", dict(Counter(v["category"] for v in venues)))


if __name__ == "__main__":
    main()
