#!/usr/bin/env python3
"""놀자맵 지도 신규 업체 자동 업데이트 (3일 1회 루틴용).

카카오 Local 키워드 검색으로 클럽거리/역세권을 재스캔 →
기존 clubs.json에 없는 '신규' 업장만 좌표·썸네일과 함께 추가.
멱등: 이미 있는 곳(이름/place_url 매칭)은 절대 재추가 안 함.
기존 항목은 건드리지 않음. 신규는 verified:false / confidence:low (어드민 검수 대상).

실행:  KAKAO_REST_KEY=xxxx python3 scripts/auto_update_venues.py
출력:  data/clubs.json 갱신 + 마지막 줄에 JSON 요약(추가수/지역·카테고리 분포).
       추가 0이면 파일 변경 없음(커밋 불필요).
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
API = "https://dapi.kakao.com/v2/local/search/keyword.json"
OG = re.compile(r'og:image"[^>]*content="([^"]+)"')
KEY = os.environ.get("KAKAO_REST_KEY")

MAX_PER_REGION = 10           # 지역별 신규 상한(한 지역 쏠림 방지)
PAGES = 3                     # 키워드당 최대 페이지(45곳)

# 지역 중심 (lat, lng, 반경m). REGION_ALIAS로 표시지역 통합.
AREAS = {
    "홍대": (37.5563, 126.9236, 1600), "신촌": (37.5556, 126.9368, 1100),
    "이태원": (37.5346, 126.9946, 1400), "한남": (37.5347, 127.0005, 900),
    "강남": (37.4979, 127.0276, 1800), "압구정": (37.5270, 127.0286, 1500),
    "건대": (37.5404, 127.0699, 1400), "을지로": (37.5660, 126.9910, 1300),
    "부산서면": (35.1577, 129.0594, 1600), "대구": (35.8693, 128.5947, 1500),
}
REGION_ALIAS = {"신촌": "홍대", "한남": "이태원", "압구정": "강남"}
CITY = {"홍대": "서울", "이태원": "서울", "강남": "서울", "건대": "서울",
        "을지로": "서울", "부산서면": "부산", "대구": "대구"}

# (키워드, 카테고리) — 우리 카테고리 키에 매핑
QUERIES = [
    ("클럽", "클럽"), ("게이클럽", "클럽"), ("힙합클럽", "클럽"),
    ("라운지바", "라운지·바"), ("칵테일바", "라운지·바"), ("와인바", "라운지·바"),
    ("루프탑바", "라운지·바"), ("위스키바", "라운지·바"), ("후카", "라운지·바"), ("시샤", "라운지·바"),
    ("펍", "펍"), ("수제맥주", "펍"), ("아이리시펍", "펍"), ("게이바", "펍"),
    ("헌팅포차", "포차"), ("포차", "포차"), ("감성주점", "소개팅·파티"),
    ("해장국", "첫차지키미"), ("국밥", "첫차지키미"), ("24시 카페", "첫차지키미"), ("심야식당", "첫차지키미"),
]
# 카카오 '업종(category_name)'에 이 단어가 있어야 채택 (이름 매칭은 오탐 많아 미사용)
WHITELIST = ["유흥", "클럽", "나이트", "주점", "호프", "칵테일바", "와인바", "라운지",
             "펍", "바(BAR)", "이자카야", "요리주점", "술집", "맥주",
             "국밥", "해장", "감자탕", "순대", "곰탕"]
# 나이트라이프 아닌 '클럽/바' 오탐 차단 (살사·스터디·독서·스포츠 등)
EXCLUDE = ["살사", "라틴", "댄스", "무용", "스터디", "독서", "볼링", "골프", "요가",
           "필라테스", "헬스", "스포츠", "키즈", "교육", "학원", "아카데미", "강습", "교습",
           "노래방", "룸살롱", "단란주점", "안마", "마사지", "PC방", "스크린", "당구",
           "찜질", "모텔", "호텔", "주차장", "편의점", "약국", "병원", "코인", "네일", "미용"]


def search(q, x, y, r, page):
    qs = urllib.parse.urlencode({"query": q, "x": x, "y": y, "radius": r,
                                 "page": page, "size": 15, "sort": "distance"})
    req = urllib.request.Request(API + "?" + qs, headers={"Authorization": f"KakaoAK {KEY}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.load(resp)


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
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def pid_of(url):
    m = re.search(r"/(\d+)(?:$|[?#])", url or "")
    return m.group(1) if m else None


def slug(name, pid):
    base = re.sub(r"[^a-z0-9]+", "", (name or "").lower()) or "auto"
    return f"kauto_{base[:16]}_{pid[-5:]}"


def main():
    if not KEY:
        print(json.dumps({"error": "KAKAO_REST_KEY 환경변수 필요"}, ensure_ascii=False)); sys.exit(1)
    d = json.load(open(CLUBS, encoding="utf-8"))
    clubs = d["clubs"]
    seen_names = set(norm(c["name"]) for c in clubs)
    seen_pids = set(p for p in (pid_of(c.get("place_url")) for c in clubs) if p)
    existing_ids = set(c["id"] for c in clubs)

    found, kseen = [], set()
    for area, (lat, lng, rad) in AREAS.items():
        region = REGION_ALIAS.get(area, area)
        for q, cat in QUERIES:
            for page in range(1, PAGES + 1):
                try:
                    res = search(q, lng, lat, rad, page)
                except Exception:
                    break
                for doc in res.get("documents", []):
                    pid = doc["id"]
                    if pid in kseen or pid in seen_pids:
                        continue
                    catname, nm = doc.get("category_name", ""), doc["place_name"]
                    if any(x in catname or x in nm for x in EXCLUDE):
                        continue
                    if not any(w in catname for w in WHITELIST):   # 업종 매칭만(이름 폴백 X)
                        continue
                    if norm(nm) in seen_names:
                        continue
                    kseen.add(pid)
                    found.append({
                        "kakao_id": pid, "name": nm, "region": region, "city": CITY.get(region, ""),
                        "address": doc.get("road_address_name") or doc.get("address_name", ""),
                        "lat": float(doc["y"]), "lng": float(doc["x"]),
                        "place_url": doc.get("place_url", ""), "category": cat,
                    })
                if res.get("meta", {}).get("is_end", True):
                    break
                time.sleep(0.15)

    added = 0
    per_region = Counter()
    added_regions = Counter()
    for v in found:
        if per_region[v["region"]] >= MAX_PER_REGION:
            continue
        if norm(v["name"]) in seen_names:
            continue
        per_region[v["region"]] += 1
        cid = slug(v["name"], v["kakao_id"])
        while cid in existing_ids:
            cid += "x"
        existing_ids.add(cid); seen_names.add(norm(v["name"]))
        club = {
            "id": cid, "name": v["name"], "region": v["region"], "city": v["city"],
            "genres": [], "difficulty": None, "price": None, "address": v["address"], "insta": "",
            "verified": False, "category": v["category"], "hours": None,
            "category_confidence": "low", "place_url": v["place_url"], "kakao_match": v["name"],
            "lat": v["lat"], "lng": v["lng"], "source": "kakao_auto",
        }
        img = og_image(v["kakao_id"])
        if img:
            club["thumb"] = img; club["thumb_src"] = "kakao"
        clubs.append(club)
        added += 1
        added_regions[v["region"]] += 1
        time.sleep(0.15)

    if added:
        json.dump(d, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(CLUBS, "a").write("\n")

    print(json.dumps({
        "added": added, "total": len(clubs),
        "new_this_run_regions": dict(added_regions),
        "auto_total": sum(1 for c in clubs if c.get("source") == "kakao_auto"),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
