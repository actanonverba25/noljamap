#!/usr/bin/env python3
"""카카오 로컬 키워드 검색으로 나이트라이프 베뉴 대량 발굴.

IG 계정 1개씩 크롤하는 것보다 확장성 압도 — 등록된 모든 업소가 풀.
지역×키워드로 검색(위치 편향) → 이름·주소·좌표·업종 수집 → dedup → 의도 1차 추정.

실행:
  export KAKAO_REST_KEY="여기_REST키"     # JS키 아님! (DEPLOY.md STEP 0)
  python3 scripts/discover_kakao.py

출력: data/kakao_discovery.json (좌표 포함 — 런타임 지오코딩 불필요)
※ 의도(클럽/헌팅/트젠 등)는 검색 키워드 기반 1차 추정(confidence low) → 별도 리서치 패스로 확정.
"""
import json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "kakao_discovery.json")
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
API = "https://dapi.kakao.com/v2/local/search/keyword.json"

# 지역 → 검색 중심 좌표 + 반경(m). 을지로 포함.
AREAS = {
    "을지로":     (37.5660, 126.9910, 1500),
    "홍대":       (37.5563, 126.9236, 2000),
    "이태원":     (37.5346, 126.9946, 1500),
    "강남":       (37.4979, 127.0276, 2500),
    "압구정":     (37.5270, 127.0286, 1800),
    "건대":       (37.5404, 127.0699, 1500),
    "신촌":       (37.5556, 126.9368, 1500),
    "수원":       (37.2664, 127.0001, 2500),
    "부산서면":   (35.1577, 129.0594, 2000),
    "대구동성로": (35.8693, 128.5947, 1800),
}
# 강남/압구정·대구동성로는 region 통합
REGION_ALIAS = {"압구정": "강남", "대구동성로": "대구", "신촌": "홍대"}

# 검색 키워드 → 의도 1차 추정
QUERIES = [
    ("클럽", "클럽"),
    ("헌팅포차", "헌팅"),
    ("헌팅술집", "헌팅"),
    ("감성주점", "헌팅"),
    ("라운지바", "라운지·바"),
    ("칵테일바", "라운지·바"),
    ("포차", "헌팅"),
    ("펍", "펍"),
    ("트랜스젠더클럽", "클럽"),
]

# 업종에 이게 들어가면 제외 (노래방·룸살롱·마사지 등 비대상)
EXCLUDE = ["노래방", "룸살롱", "단란주점", "안마", "마사지", "PC방", "스크린", "당구", "찜질"]


def search(key, query, x, y, radius, page):
    qs = urllib.parse.urlencode({
        "query": query, "x": x, "y": y, "radius": radius,
        "page": page, "size": 15, "sort": "distance",
    })
    req = urllib.request.Request(API + "?" + qs, headers={"Authorization": f"KakaoAK {key}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def main():
    key = os.environ.get("KAKAO_REST_KEY")
    if not key:
        sys.exit("KAKAO_REST_KEY 환경변수 필요 (REST키 — JS키 아님). DEPLOY.md STEP 0 참고.")

    # 기존 베뉴 이름(중복 표시용)
    existing = set()
    if os.path.exists(CLUBS):
        for c in json.load(open(CLUBS, encoding="utf-8"))["clubs"]:
            existing.add(norm(c["name"]))

    seen, venues = set(), []
    for area, (lat, lng, radius) in AREAS.items():
        region = REGION_ALIAS.get(area, area)
        for query, intent in QUERIES:
            for page in range(1, 46):
                try:
                    res = search(key, f"{area} {query}", lng, lat, radius, page)
                except Exception as e:
                    print(f"  ! {area}/{query} p{page} 실패: {e}"); break
                for d in res.get("documents", []):
                    pid = d["id"]
                    if pid in seen:
                        continue
                    cat = d.get("category_name", "")
                    if any(x in cat for x in EXCLUDE):
                        continue
                    seen.add(pid)
                    name = d["place_name"]
                    venues.append({
                        "kakao_id": pid,
                        "name": name,
                        "region": region,
                        "address": d.get("road_address_name") or d.get("address_name", ""),
                        "lat": float(d["y"]), "lng": float(d["x"]),
                        "kakao_category": cat,
                        "phone": d.get("phone", ""),
                        "place_url": d.get("place_url", ""),
                        "intent_guess": intent,
                        "confidence": "low",
                        "found_by": f"{area} {query}",
                        "is_new": norm(name) not in existing,
                    })
                if res.get("meta", {}).get("is_end", True):
                    break
                time.sleep(0.2)
        print(f"{area}: 누적 {len(venues)}곳")

    new_count = sum(1 for v in venues if v["is_new"])
    out = {
        "_meta": {
            "source": "Kakao Local keyword search",
            "areas": list(AREAS.keys()),
            "queries": [q for q, _ in QUERIES],
            "total": len(venues), "new_vs_clubs": new_count,
            "note": "intent_guess는 검색 키워드 기반 1차 추정(confidence low). 좌표 포함. 의도 확정·트젠 태깅은 리서치 패스 필요.",
        },
        "venues": venues,
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    from collections import Counter
    print(f"\n총 {len(venues)}곳 (신규 {new_count}) → {OUT}")
    print("지역:", dict(Counter(v["region"] for v in venues)))
    print("의도추정:", dict(Counter(v["intent_guess"] for v in venues)))


if __name__ == "__main__":
    main()
