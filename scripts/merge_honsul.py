#!/usr/bin/env python3
"""혼술바 인스타 계정(account search) → 브랜드+지역 카카오 지오코딩 → clubs.json '라운지·바'.
  KAKAO_REST_KEY=... python3 scripts/merge_honsul.py
"""
import json, os, re, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
KAKAO = "https://dapi.kakao.com/v2/local/search/keyword.json"

# (username, 표시이름, 카카오검색쿼리) — full_name에서 추출. 일반명(혼술집/혼술포차)뿐인 건 제외.
HONSUL = [
 ("miyeol_euljiro", "미열 을지로점", "미열혼술바 을지로"),
 ("jeju.dameun", "제주담은 상봉", "제주담은 상봉 혼술바"),
 ("mullae_hanjan", "문래한잔", "문래한잔 문래"),
 ("jeju_jajac5_yongsan", "제주자작 용산점", "제주 자작 용산 용리단길"),
 ("bar_jebi", "혼술바제비 건대", "혼술바제비 건대"),
 ("onae_jamsil", "오내 혼술집 잠실점", "오내혼술집 잠실점"),
 ("onae_jamsilsaenae", "오내 혼술집 잠실새내점", "오내혼술집 잠실새내점"),
 ("onae_seongsu", "오내 혼술집 성수점", "오내혼술집 성수점"),
 ("onae_yongsan", "오내 혼술집 용산점", "오내혼술집 용산점"),
 ("seoulrim", "서울림 서울대입구점", "서울림 서울대입구역"),
 ("seoulrim_sadang", "서울림 사당점", "서울림 사당역"),
 ("with.yeonnam", "혼술바 위드 연남", "혼술바 위드 연남"),
 ("godo_gunja", "혼술바 고도 군자점", "혼술바 고도 군자"),
 ("nas_seogyo", "나스서교", "나스서교"),
 ("zzkhighball", "정전기하이볼바", "정전기하이볼바"),
 ("sonsudo.official", "손수도 니카이 성수", "손수도 니카이"),
 ("o_kami357", "오오카미 하이볼바", "오오카미 혼술"),
]
BOX = (37.30, 37.75, 126.70, 127.30)
REGION_RULES = [
 (re.compile(r"을지로|종로|중구|충무로"), "을지로"),(re.compile(r"용산|삼각지|용리단|이태원"), "용산"),
 (re.compile(r"잠실|송파|석촌|방이"), "잠실"),(re.compile(r"성수|뚝섬|건대|군자|광진"), "건대"),
 (re.compile(r"연남|서교|홍대|합정|마포"), "홍대"),(re.compile(r"서울대입구|샤로수|관악|봉천"), "관악"),
 (re.compile(r"사당|동작"), "사당"),(re.compile(r"문래|영등포"), "영등포"),(re.compile(r"상봉|중랑|망우|면목"), "중랑"),
 (re.compile(r"강남|역삼|논현"), "강남"),
]


def geo(q, key):
    qs = urllib.parse.urlencode({"query": q, "size": 1})
    req = urllib.request.Request(f"{KAKAO}?{qs}", headers={"Authorization": f"KakaoAK {key}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            docs = json.load(r).get("documents", [])
        if docs:
            return float(docs[0]["y"]), float(docs[0]["x"]), docs[0].get("road_address_name") or docs[0].get("address_name", ""), docs[0]["place_name"]
    except Exception:
        pass
    return None


def region_of(s):
    for rx, lab in REGION_RULES:
        if rx.search(s or ""):
            return lab
    return "서울기타"


def main():
    key = os.environ.get("KAKAO_REST_KEY")
    if not key:
        sys.exit("KAKAO_REST_KEY 필요.")
    club = json.load(open(CLUBS, encoding="utf-8"))
    club["clubs"] = [c for c in club["clubs"] if c.get("source") != "ig_honsul"]
    ids = {c["id"] for c in club["clubs"]}; names = {c["name"] for c in club["clubs"]}
    added = 0; fail = []
    for u, name, q in HONSUL:
        g = geo(q, key)
        if not g or not (BOX[0] <= g[0] <= BOX[1] and BOX[2] <= g[1] <= BOX[3]):
            fail.append(u); continue
        lat, lng, addr, place = g
        vid = f"hs_{u.replace('.', '_')}"
        if vid in ids or name in names:
            continue
        ids.add(vid); names.add(name)
        club["clubs"].append({
            "id": vid, "name": name, "region": region_of(q + " " + addr),
            "city": "서울", "genres": [], "difficulty": None, "price": None,
            "address": addr, "lat": lat, "lng": lng,
            "insta": f"https://instagram.com/{u}", "place_url": "", "verified": False,
            "category": "라운지·바", "category_confidence": "med", "hours": None,
            "etc_type": "혼술바", "source": "ig_honsul",
        })
        added += 1
        print(f"  ✓ {name} → {region_of(q+' '+addr)} | 카카오:{place}")
    json.dump(club, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a").write("\n")
    from collections import Counter
    print(f"\n혼술바 핀 {added} · 지오실패 {fail}")
    print("라운지·바 총:", Counter(c['category'] for c in club['clubs'])['라운지·바'], "곳 / 전체", len(club['clubs']))


if __name__ == "__main__":
    main()
