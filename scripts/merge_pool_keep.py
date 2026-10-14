#!/usr/bin/env python3
"""에이전트가 KEEP한 풀 베뉴를 clubs.json에 병합 (안전 검증).

- kakao_id로 _pool.json 조회 → 이름 대조. 불일치 시 (이름,지역)으로 재조회. 둘 다 실패 시 skip.
- 권위 데이터(이름·주소·좌표)는 _pool.json 원본 사용 (에이전트 전사 오류 차단).
- 기존 clubs.json과 지역 내 이름 포함관계로 중복 제거(오리엔탈라운지 등).
멱등.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
POOL = os.path.join(HERE, "..", "data", "_pool.json")
CITY = {"을지로": "서울", "홍대": "서울", "이태원": "서울", "강남": "서울",
        "건대": "서울", "수원": "경기", "부산서면": "부산", "대구": "대구"}

# (kakao_id, 기대이름, region, category, confidence) — 에이전트 KEEP 60곳
KEEP = [
    ("783970127", "라이즈호텔 사이드노트클럽", "홍대", "라운지·바", "high"),
    ("1600511760", "클럽nb2", "홍대", "클럽", "high"),
    ("1200972140", "서울소사이어티클럽", "홍대", "라운지·바", "low"),
    ("18769234", "썰스데이파티", "홍대", "헌팅", "high"),
    ("77741425", "오리엔탈라운지", "홍대", "소개팅·파티", "high"),
    ("1867251021", "마카로니펑키클럽", "홍대", "클럽", "med"),
    ("1884230504", "솔로지옥 홍대점", "홍대", "헌팅", "high"),
    ("817854079", "포차플러팅", "홍대", "헌팅", "high"),
    ("1028126348", "신호등포차 홍대점", "홍대", "헌팅", "high"),
    ("1553725088", "인피니티클럽", "홍대", "클럽", "high"),
    ("743477680", "당나발포차 신촌점", "홍대", "헌팅", "high"),
    ("8086719", "청담동포장마차", "홍대", "헌팅", "high"),
    ("627811414", "아무술집 신촌점", "홍대", "헌팅", "high"),
    ("15657181", "보스포차", "홍대", "헌팅", "high"),
    ("140213425", "역전포장마차 신촌점", "홍대", "헌팅", "high"),
    ("27341445", "꼼보포차 신촌2호점", "홍대", "헌팅", "high"),
    ("1561696341", "광대포차", "홍대", "헌팅", "high"),
    ("1047145823", "일상포차 신촌점", "홍대", "헌팅", "high"),
    ("1415451617", "철길부산집 신촌점", "홍대", "헌팅", "med"),
    ("1989621703", "현명식탁B1", "홍대", "헌팅", "med"),
    ("586628595", "한사발포차 신촌점", "홍대", "헌팅", "high"),
    ("1971072507", "포차비", "홍대", "헌팅", "med"),
    ("1783741131", "일미우래포차", "홍대", "헌팅", "med"),
    ("788592288", "갑돌이포차 신촌2호점", "홍대", "헌팅", "high"),
    ("1828979437", "카바나소셜클럽", "이태원", "클럽", "med"),
    ("16681282", "베드럼", "이태원", "라운지·바", "med"),
    ("20373260", "글램라운지", "이태원", "라운지·바", "med"),
    ("835704622", "트랩라운지", "이태원", "라운지·바", "med"),
    ("839705211", "테타라운지바 이태원점", "이태원", "라운지·바", "med"),
    ("839892336", "릿라운지", "이태원", "라운지·바", "high"),
    ("1396602493", "하이프 루프탑 후카라운지", "이태원", "라운지·바", "med"),
    ("1136118574", "이태원 실비디스코", "이태원", "라운지·바", "med"),
    ("633251522", "오리엔탈라운지 강남", "강남", "헌팅", "high"),
    ("1252102693", "썰스데이파티", "강남", "헌팅", "high"),
    ("2091989901", "라우더 Louder", "강남", "라운지·바", "med"),
    ("1967363203", "나는솔로포차 강남점", "강남", "헌팅", "high"),
    ("1841171496", "EXXIT", "강남", "라운지·바", "high"),
    ("313011590", "소호라운지 서울", "강남", "라운지·바", "med"),
    ("1804213353", "버드맨 서울", "강남", "라운지·바", "med"),
    ("1194508434", "WAP왑라운지", "강남", "라운지·바", "med"),
    ("1280781041", "브이라운지", "강남", "라운지·바", "high"),
    ("741208970", "로코컴플렉스", "강남", "라운지·바", "med"),
    ("1801816998", "디브릿지", "강남", "라운지·바", "med"),
    ("1776910233", "풍 라운지", "강남", "라운지·바", "high"),
    ("21656397", "샷업", "강남", "헌팅", "med"),
    ("342338812", "하잎 서울", "강남", "라운지·바", "high"),
    ("875384340", "디엠 라운지", "강남", "라운지·바", "high"),
    ("699616032", "컬러압구", "강남", "라운지·바", "high"),
    ("516398071", "COC", "강남", "라운지·바", "high"),
    ("1232499194", "코드라운지 압구정", "강남", "라운지·바", "high"),
    ("708608275", "인트로라운지", "강남", "라운지·바", "high"),
    ("798649831", "게릿 Get Lit", "강남", "라운지·바", "med"),
    ("2099707812", "폴스타", "강남", "라운지·바", "med"),
    ("749409190", "노퍼블릭", "강남", "라운지·바", "med"),
    ("469117947", "808클럽", "수원", "클럽", "high"),
    ("13138146", "세남자의감성주점", "수원", "헌팅", "high"),
    ("1726472149", "클럽나수브", "부산서면", "클럽", "med"),
    ("16241272", "썰스데이파티", "부산서면", "헌팅", "high"),
    ("15673664", "썰스데이파티", "대구", "헌팅", "med"),
    ("354322", "고고펍", "대구", "라운지·바", "med"),
]


def norm(s):
    return re.sub(r"[^가-힣a-z0-9]", "", s.lower())


def main():
    d = json.load(open(CLUBS, encoding="utf-8"))
    pool = json.load(open(POOL, encoding="utf-8"))
    by_id = {str(v["kakao_id"]): v for v in pool}
    by_namereg = {}
    for v in pool:
        by_namereg.setdefault((norm(v["name"]), v["region"]), v)

    # 기존: 지역 -> [norm name]
    exist_ids = {c["id"] for c in d["clubs"]}
    exist_by_region = {}
    for c in d["clubs"]:
        exist_by_region.setdefault(c["region"], []).append(norm(c["name"]))

    added, skipped, dup = [], [], []
    for kid, name, region, cat, conf in KEEP:
        rec = by_id.get(kid)
        if not rec or norm(rec["name"]) != norm(name):
            rec = by_namereg.get((norm(name), region))  # id 불일치 → 이름으로
        if not rec:
            skipped.append((kid, name)); continue
        nn = norm(rec["name"])
        # 기존 중복(포함관계) 제거
        if any(nn == e or nn in e or e in nn for e in exist_by_region.get(region, [])):
            dup.append(rec["name"]); continue
        cid = "k" + str(rec["kakao_id"])
        if cid in exist_ids:
            dup.append(rec["name"]); continue
        d["clubs"].append({
            "id": cid, "name": rec["name"], "region": region, "city": CITY.get(region, ""),
            "genres": [], "difficulty": None, "price": None,
            "address": rec["address"], "lat": rec["lat"], "lng": rec["lng"],
            "insta": "", "place_url": rec.get("place_url", ""),
            "verified": False, "category": cat, "category_confidence": conf,
            "hours": None, "source": "kakao_research",
        })
        exist_ids.add(cid); exist_by_region.setdefault(region, []).append(nn)
        added.append((region, cat, rec["name"]))

    json.dump(d, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a", encoding="utf-8").write("\n")
    from collections import Counter
    print(f"병합 {len(added)} / 중복제외 {len(dup)} / id매칭실패 {len(skipped)} / 총 {len(d['clubs'])}곳")
    print("카테고리(추가분):", dict(Counter(a[1] for a in added)))
    print("지역(추가분):", dict(Counter(a[0] for a in added)))
    if dup: print("중복제외:", dup)
    if skipped: print("매칭실패:", skipped)


if __name__ == "__main__":
    main()
