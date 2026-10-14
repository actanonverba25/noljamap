#!/usr/bin/env python3
"""혼술바 카카오 발굴 → clubs.json '라운지·바' 병합 (고정 업장이라 카카오가 정석).
지역×키워드 검색 → 지역당 캡 → dedup(인스타분 포함) → 라운지·바.
  KAKAO_REST_KEY=... python3 scripts/discover_honsul_kakao.py
"""
import json, os, sys, time, urllib.parse, urllib.request
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
API = "https://dapi.kakao.com/v2/local/search/keyword.json"

AREAS = {
    "홍대": (37.5563, 126.9236, 1800), "이태원": (37.5346, 126.9946, 1200),
    "강남": (37.4979, 127.0276, 2000), "을지로": (37.5660, 126.9910, 1500),
    "건대": (37.5404, 127.0699, 1400), "성수": (37.5446, 127.0559, 1300),
    "용산": (37.5326, 126.9905, 1500), "잠실": (37.5133, 127.1000, 1600),
    "서울대입구": (37.4812, 126.9527, 1400), "종로": (37.5704, 126.9910, 1500),
    "문래": (37.5176, 126.8954, 1200), "신촌": (37.5556, 126.9368, 1300),
    "압구정": (37.5270, 127.0286, 1500), "부산서면": (35.1577, 129.0594, 1800),
    "대구동성로": (35.8693, 128.5947, 1500),
}
REGION_ALIAS = {"압구정": "강남", "대구동성로": "대구", "신촌": "홍대", "서울대입구": "관악",
                "성수": "건대", "문래": "영등포", "을지로": "을지로"}
QUERIES = ["혼술바", "혼술집", "하이볼바"]
EXCLUDE = ["노래방", "룸살롱", "단란주점", "안마", "마사지", "클럽", "헌팅", "PC방"]
CAP = 14  # 지역당


def search(key, q, x, y, r, page):
    qs = urllib.parse.urlencode({"query": q, "x": x, "y": y, "radius": r, "page": page, "size": 15, "sort": "distance"})
    req = urllib.request.Request(API + "?" + qs, headers={"Authorization": f"KakaoAK {key}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.load(resp)


def norm(s):
    return "".join(c for c in s.lower() if c.isalnum())


def main():
    key = os.environ.get("KAKAO_REST_KEY")
    if not key:
        sys.exit("KAKAO_REST_KEY 필요.")
    club = json.load(open(CLUBS, encoding="utf-8"))
    club["clubs"] = [c for c in club["clubs"] if c.get("source") != "kakao_honsul"]
    ids = {c["id"] for c in club["clubs"]}
    names = {norm(c["name"]) for c in club["clubs"]}

    found = defaultdict(list)  # region -> venues
    seen = set()
    for area, (lat, lng, rad) in AREAS.items():
        region = REGION_ALIAS.get(area, area)
        for q in QUERIES:
            for page in range(1, 4):
                try:
                    res = search(key, f"{area} {q}", lng, lat, rad, page)
                except Exception as e:
                    print(f"  ! {area}/{q} p{page}: {e}"); break
                for d in res.get("documents", []):
                    pid = d["id"]
                    cat = d.get("category_name", "")
                    if pid in seen or any(x in cat for x in EXCLUDE):
                        continue
                    if "혼술" not in d["place_name"] and "혼술" not in cat and "하이볼" not in d["place_name"]:
                        # 키워드 매칭으로 들어왔어도 이름/업종에 혼술·하이볼 흔적 없으면 약하게 — 그래도 bar류면 허용
                        if not any(w in cat for w in ["바", "주점", "술집", "포차"]):
                            continue
                    seen.add(pid)
                    found[region].append(d)
                if res.get("meta", {}).get("is_end", True):
                    break
                time.sleep(0.15)

    added = 0; by_region = Counter()
    for region, lst in found.items():
        for d in lst[:CAP]:
            nm = d["place_name"]
            if norm(nm) in names:
                continue
            vid = "k" + str(d["id"])
            if vid in ids:
                continue
            ids.add(vid); names.add(norm(nm))
            club["clubs"].append({
                "id": vid, "name": nm, "region": region, "city": "서울" if region not in ("부산", "대구") else region,
                "genres": [], "difficulty": None, "price": None,
                "address": d.get("road_address_name") or d.get("address_name", ""),
                "lat": float(d["y"]), "lng": float(d["x"]),
                "insta": "", "place_url": d.get("place_url", ""), "verified": False,
                "category": "라운지·바", "category_confidence": "low", "hours": None,
                "etc_type": "혼술바", "source": "kakao_honsul",
            })
            added += 1; by_region[region] += 1

    json.dump(club, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a").write("\n")
    print(f"카카오 혼술바 신규 {added}곳 → 라운지·바 총 {Counter(c['category'] for c in club['clubs'])['라운지·바']}곳 / 전체 {len(club['clubs'])}")
    print("지역분포:", dict(by_region))


if __name__ == "__main__":
    main()
