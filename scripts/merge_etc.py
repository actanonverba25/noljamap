#!/usr/bin/env python3
"""kakao_etc.json(808) → 큐레이션 → clubs.json '기타'로 병합.

큐레이션 원칙(사용자 정의 '기타' = 심야술집·보관함):
- 심야 포차류만: 실내포장마차·오뎅바·포장마차·투다리·한사발포차 (일식 이자카야는 '새벽까지' 컨셉과 거리 → 제외)
- 보관함: 무인보관함·물품보관함·코인락커 (보관,저장 업종)
- 지역당 캡: 심야술집 18 / 보관함 8 → 거지맵식 큐레이션(전화번호부 방지). 중심 가까운 순(거리정렬) 우선.
멱등: 재실행해도 동일(기존 id/이름 중복 스킵).
"""
import json, os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ETC = os.path.join(HERE, "..", "data", "kakao_etc.json")
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")

KEEP_POCHA = ["실내포장마차", "오뎅바", "포장마차", "투다리", "한사발포차"]
KEEP_LOCKER = ["보관", "락커", "로커"]
CAP_POCHA, CAP_LOCKER = 18, 8
CITY = {"이태원": "서울", "홍대": "서울", "강남": "서울", "을지로": "서울", "건대": "서울",
        "부산서면": "부산", "대구": "대구"}


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def main():
    etc = json.load(open(ETC, encoding="utf-8"))["venues"]
    d = json.load(open(CLUBS, encoding="utf-8"))
    existing_ids = {c["id"] for c in d["clubs"]}
    existing_names = {norm(c["name"]) for c in d["clubs"]}

    # 큐레이션: 지역×서브타입 캡
    buckets = defaultdict(list)  # (region, kind) -> [venue]
    for v in etc:
        leaf = v["kakao_category"].split(">")[-1].strip()
        if v["subtype"] == "보관함" or any(k in leaf for k in KEEP_LOCKER):
            kind = "보관함"
        elif any(k in leaf for k in KEEP_POCHA):
            kind = "심야술집"
        else:
            continue  # 이자카야/일식/기타 업종 제외
        if norm(v["name"]) in existing_names:
            continue
        buckets[(v["region"], kind)].append(v)

    added, by_region = [], defaultdict(lambda: defaultdict(int))
    for (region, kind), lst in buckets.items():
        cap = CAP_LOCKER if kind == "보관함" else CAP_POCHA
        for v in lst[:cap]:
            vid = "k" + str(v["kakao_id"])
            if vid in existing_ids:
                continue
            existing_ids.add(vid); existing_names.add(norm(v["name"]))
            hours = ({"open": "00:00", "close": "23:59", "days": None, "estimated": True}
                     if kind == "보관함" else None)
            d["clubs"].append({
                "id": vid, "name": v["name"], "region": region,
                "city": CITY.get(region, "서울"), "genres": [], "difficulty": None,
                "price": None, "address": v["address"], "lat": v["lat"], "lng": v["lng"],
                "insta": "", "place_url": v["place_url"], "verified": False,
                "category": "기타", "category_confidence": "low", "hours": hours,
                "etc_type": kind, "source": "kakao_etc",
            })
            added.append((region, kind)); by_region[region][kind] += 1

    json.dump(d, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a").write("\n")
    print(f"기타 신규 {len(added)}곳 추가 → 총 {len(d['clubs'])}곳")
    for r in sorted(by_region):
        print(f"  {r}: 심야술집 {by_region[r]['심야술집']} · 보관함 {by_region[r]['보관함']}")


if __name__ == "__main__":
    main()
