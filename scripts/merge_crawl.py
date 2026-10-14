#!/usr/bin/env python3
"""holycow_crawl_50.json 신규 베뉴를 clubs.json에 병합.

- category: 이름/핸들/캡션 근거 1차 분류(verified:false). 불확실은 confidence low.
- region: region_guess 사용. 신규 지역(안산·광주·제주·강릉) 색·중심좌표 등록.
- hours: null (영업 명암은 카테고리 추정). 좌표는 런타임 카카오 지오코딩(주소 있음).
멱등: 이미 있는 handle/id는 건너뜀.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
CRAWL = os.path.join(HERE, "..", "data", "holycow_crawl_50.json")

# handle -> (category, confidence) — 1차 분류
CAT = {
    "itaewon__danco":        ("라운지·바", "low"),
    "stable_club_party":     ("소개팅·파티", "low"),
    "clubraceseoul_official":("클럽", "med"),
    "adultonlybar":          ("라운지·바", "med"),
    "jack_livin_seoul":      ("클럽", "low"),
    "clubsound_official":    ("클럽", "high"),
    "viewsic_garosugil":     ("라운지·바", "low"),
    "citybeer_official":     ("펍", "high"),
    "partyplay_official":    ("소개팅·파티", "med"),
    "vanana_kd":             ("헌팅", "med"),
    "hustlers_antiwork":     ("소개팅·파티", "med"),
    "hyo1bong":              ("헌팅", "high"),
    "thehenzclub":           ("클럽", "med"),
    "tr_blinddate":          ("소개팅·파티", "high"),
    "official_noche":        ("라운지·바", "low"),
    "newtro2010_ansan":      ("헌팅", "med"),
    "lululala_8090":         ("헌팅", "med"),
    "holla_lounge":          ("라운지·바", "med"),
    "pocha_nanjangpan":      ("헌팅", "high"),
    "club_assemble":         ("클럽", "high"),
}

CITY = {"이태원": "서울", "강남": "서울", "건대": "서울", "홍대": "서울",
        "수원": "경기", "안산": "경기", "광주": "광주", "제주": "제주", "강릉": "강원"}

# 신규 지역 색(region 필터/범례용) + 중심좌표(런타임 지오코딩 실패 시 fallback)
NEW_REGIONS = {
    "안산": {"color": "#7A8B2E", "lat": 37.3219, "lng": 126.8309},
    "광주": {"color": "#A0506B", "lat": 35.2186, "lng": 126.8505},
    "제주": {"color": "#1AAE8C", "lat": 33.5141, "lng": 126.5270},
    "강릉": {"color": "#5B7FA6", "lat": 37.7950, "lng": 128.9090},
}


def main():
    d = json.load(open(CLUBS, encoding="utf-8"))
    crawl = json.load(open(CRAWL, encoding="utf-8"))
    existing_ids = {c["id"] for c in d["clubs"]}

    # 신규 지역 색 등록
    for r, info in NEW_REGIONS.items():
        d["_meta"].setdefault("regions", {})[r] = info["color"]

    added, skipped = [], []
    for v in crawl["new_venues"]:
        handle = v["handle"]
        cid = handle
        if cid in existing_ids:
            skipped.append(cid); continue
        cat, conf = CAT.get(handle, ("기타", "low"))
        region = v["region_guess"]
        club = {
            "id": cid,
            "name": v["name"],
            "region": region,
            "city": CITY.get(region, ""),
            "genres": [],
            "difficulty": None,
            "price": None,
            "address": v["addr"],
            "insta": f"https://instagram.com/{handle}",
            "verified": False,
            "category": cat,
            "category_confidence": conf,
            "hours": None,
            "source": "holycow_crawl_50",
        }
        d["clubs"].append(club)
        existing_ids.add(cid)
        added.append((cid, region, cat, conf))

    json.dump(d, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a", encoding="utf-8").write("\n")

    print(f"추가 {len(added)}곳 / 스킵 {len(skipped)}곳 / 총 {len(d['clubs'])}곳")
    from collections import Counter
    print("지역 분포(추가분):", dict(Counter(a[1] for a in added)))
    print("카테고리 분포(추가분):", dict(Counter(a[2] for a in added)))
    print("신규 지역 중심좌표는 app.js REGION_CENTERS에 별도 추가 필요:",
          {r: (i["lat"], i["lng"]) for r, i in NEW_REGIONS.items()})


if __name__ == "__main__":
    main()
