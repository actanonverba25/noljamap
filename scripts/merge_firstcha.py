#!/usr/bin/env python3
"""firstcha_discovery.json → clubs.json 머지 (category=첫차지키미).

지역별 중심점 거리순 정렬 후 상한(CAP)만큼만 채택 → 클럽거리에 가까운 곳 우선.
  CAP=30 python3 scripts/merge_firstcha.py        # 지역별 최대 30곳
  CAP=0  python3 scripts/merge_firstcha.py        # 전체 머지(상한 없음)
"""
import json, os, math, re

HERE = os.path.dirname(os.path.abspath(__file__))
DISC = os.path.join(HERE, "..", "data", "firstcha_discovery.json")
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
CAP = int(os.environ.get("CAP", "30"))

CENTER = {  # discover_firstcha AREAS 와 동일 중심 (region 기준)
    "홍대": (37.5563, 126.9236), "강남": (37.4979, 127.0276),
    "이태원": (37.5346, 126.9946), "건대": (37.5404, 127.0699),
    "을지로": (37.5660, 126.9910), "부산서면": (35.1577, 129.0594),
    "대구": (35.8693, 128.5947),
}


def dist(lat, lng, c):
    return math.hypot(lat - c[0], lng - c[1])


def norm(s):
    # 한글 보존(isalnum은 한글 True). 라틴은 소문자.
    return "".join(ch for ch in s.lower() if ch.isalnum())


def slugify(name, pid):
    base = re.sub(r"[^a-z0-9]+", "", name.lower()) or "fc"
    return f"fc_{base[:18]}_{pid[-5:]}"


def main():
    disc = json.load(open(DISC, encoding="utf-8"))["venues"]
    d = json.load(open(CLUBS, encoding="utf-8"))
    existing_ids = {c["id"] for c in d["clubs"]}
    existing_names = {norm(c["name"]) for c in d["clubs"]}

    # 지역별 거리순 정렬 + 상한
    by_region = {}
    for v in disc:
        by_region.setdefault(v["region"], []).append(v)
    picked = []
    for region, lst in by_region.items():
        c = CENTER.get(region)
        if c:
            lst.sort(key=lambda v: dist(v["lat"], v["lng"], c))
        picked += lst[:CAP] if CAP > 0 else lst

    added = 0
    for v in picked:
        nm_key = norm(v["name"])
        if nm_key in existing_names:
            continue
        cid = slugify(v["name"], v["kakao_id"])
        if cid in existing_ids:
            cid += "x"
        existing_ids.add(cid); existing_names.add(nm_key)
        club = {
            "id": cid, "name": v["name"], "region": v["region"], "city": v.get("city", ""),
            "genres": [], "difficulty": None, "price": None,
            "address": v.get("address", ""), "insta": "",
            "verified": False, "category": "첫차지키미", "hours": None,
            "category_confidence": "low",
            "place_url": v.get("place_url", ""),
            "kakao_match": v["name"],
            "lat": v["lat"], "lng": v["lng"],
            "source": "kakao_firstcha",
        }
        if v.get("thumb"):
            club["thumb"] = v["thumb"]; club["thumb_src"] = "kakao"
        d["clubs"].append(club)
        added += 1

    json.dump(d, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a").write("\n")
    fc = sum(1 for c in d["clubs"] if c["category"] == "첫차지키미")
    print(f"머지 {added}곳 (CAP={CAP or '무제한'}) · 첫차지키미 총 {fc}곳 · 전체 {len(d['clubs'])}곳")


if __name__ == "__main__":
    main()
