#!/usr/bin/env python3
"""kakao_discovery.json에서 '진짜 클럽'만 추려 clubs.json에 병합.

필터: 카카오 업종 '나이트,클럽'(+성인댄스클럽) − 콜라텍/카바레/성인텍류 − 기존 중복.
좌표 포함 → 지오코딩 불필요. insta 없음 → place_url(카카오맵) 보관.
category=클럽 / confidence=low (카카오 자동분류, 추후 리서치 검증). 멱등.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
DISC = os.path.join(HERE, "..", "data", "kakao_discovery.json")
JUNK = ["콜라텍", "카바레", "캬바레", "성인텍", "스탠드", "스텐드", "텍"]
CITY = {"을지로": "서울", "홍대": "서울", "이태원": "서울", "강남": "서울",
        "건대": "서울", "수원": "경기", "부산서면": "부산", "대구": "대구"}


def norm(s):
    return re.sub(r"[^가-힣a-z0-9]", "", s.lower())


def main():
    d = json.load(open(CLUBS, encoding="utf-8"))
    disc = json.load(open(DISC, encoding="utf-8"))
    existing_names = {norm(c["name"]) for c in d["clubs"]}
    existing_ids = {c["id"] for c in d["clubs"]}

    added = []
    for v in disc["venues"]:
        cat = v["kakao_category"]
        if not ("나이트,클럽" in cat or "성인댄스클럽" in cat):
            continue
        if any(j in v["name"] for j in JUNK):
            continue
        if norm(v["name"]) in existing_names:
            continue
        cid = "k" + str(v["kakao_id"])
        if cid in existing_ids:
            continue
        region = v["region"]
        d["clubs"].append({
            "id": cid,
            "name": v["name"],
            "region": region,
            "city": CITY.get(region, ""),
            "genres": [], "difficulty": None, "price": None,
            "address": v["address"],
            "lat": v["lat"], "lng": v["lng"],
            "insta": "",
            "place_url": v.get("place_url", ""),
            "verified": False,
            "category": "클럽",
            "category_confidence": "low",
            "hours": None,
            "source": "kakao_discovery",
        })
        existing_ids.add(cid); existing_names.add(norm(v["name"]))
        added.append((region, v["name"]))

    json.dump(d, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a", encoding="utf-8").write("\n")
    from collections import Counter
    print(f"클럽 {len(added)}곳 병합 / 총 {len(d['clubs'])}곳")
    print("지역:", dict(Counter(a[0] for a in added)))


if __name__ == "__main__":
    main()
