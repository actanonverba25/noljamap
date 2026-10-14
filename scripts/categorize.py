#!/usr/bin/env python3
"""clubs.json에 베뉴 카테고리(유저 의도 기준)·영업시간 필드 부여.

- category: 100곳 전수 웹리서치(인스타·후기) 기반 분류. 4종(클럽/헌팅/라운지·바/펍)+기타.
  "유저 의도" 기준 — 클럽(춤·DJ) / 헌팅(부킹·합석·만남) / 라운지·바(칵테일·분위기) / 펍(캐주얼 술).
  이름·핸들에 club/lounge가 들어가도 실제 성격으로 분류 (예: 오리엔탈라운지→헌팅, 아울라운지→클럽).
- category_confidence: high/med/low (리서치 확신도). low는 추후 실사 확인 권장.
- hours: 개별 실측 없음 → null. 마커 명암은 _meta.category_default_hours(추정)로 계산.
- 신규 베뉴(리서치에 없는 id)는 이름 키워드 휴리스틱 fallback.
멱등(idempotent): 재실행해도 동일.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "data", "clubs.json")

# 색 — 다크 테마 위 라벨용. 의도별로 충분히 분리된 톤.
CATEGORIES = {
    "클럽":        "#E5337E",  # 마젠타 — 춤·DJ·EDM/힙합/테크노
    "포차":      "#F5A623",  # 앰버 — 합석·부킹·만남 (옛 '헌팅'. 헌팅포차/감성주점)
    "소개팅·파티": "#FF5A5F",  # 코랄 — 로테이션 소개팅·솔로파티 (구조화된 만남 이벤트)
    "라운지·바":   "#8B5CF6",  # 퍼플 — 칵테일·분위기·대화
    "펍":          "#2EC4B6",  # 틸 — 캐주얼 맥주·술집
    "첫차술집":        "#9C6B43",  # 브라운 — 심야 포차·간단한 안주에 술 (앉아 마시기 좋은)
    "물품보관함":  "#5B7C99",  # 슬레이트 — 코인락커·짐보관 (유틸)
}

# 카테고리별 추정 영업시간+운영요일 (실측 아님 — UI에서 "추정" 명시). close<open이면 익일.
# days: null=매일, 아니면 요일 배열(0=일,1=월,2=화,3=수,4=목,5=금,6=토). 휴무·지금가능 판별용.
# ※ 클럽은 보통 월·화 휴무(수~일 운영), 소개팅·파티는 주말 이벤트(목~일) 추정. 개별 override 가능.
CATEGORY_DEFAULT_HOURS = {
    "클럽":        {"open": "22:00", "close": "06:00", "days": [3, 4, 5, 6, 0], "estimated": True},
    "포차":      {"open": "19:00", "close": "05:00", "days": None, "estimated": True},
    "소개팅·파티": {"open": "19:00", "close": "03:00", "days": [4, 5, 6, 0], "estimated": True},
    "라운지·바":   {"open": "19:00", "close": "03:00", "days": None, "estimated": True},
    "펍":          {"open": "18:00", "close": "02:00", "days": None, "estimated": True},
    "첫차술집":        {"open": "18:00", "close": "06:00", "days": None, "estimated": True},  # 심야 포차
    "물품보관함":  {"open": "00:00", "close": "23:59", "days": None, "estimated": True},  # 24h성
}

# 전수 웹리서치 결과: id -> (category, confidence)
RESEARCH = {
    # --- 수원 ---
    "club_911suwon": ("포차", "med"),
    "bodcarblue": ("첫차술집", "high"),
    "club.arirang.bb8090": ("포차", "high"),
    "seexplay": ("포차", "high"),
    "clubarirang_suwon": ("클럽", "high"),
    "pub_wonderwall_suwon": ("펍", "low"),
    "clubenter_official": ("포차", "med"),
    "peachlounge": ("클럽", "med"),
    # --- 대구 ---
    "clubau_official": ("클럽", "high"),
    "bar.af.daegu": ("라운지·바", "high"),
    "gogopub": ("펍", "high"),
    "gyodong__hof": ("펍", "high"),
    "newbirth_daegu": ("클럽", "med"),
    "dhell_official": ("클럽", "high"),
    "roots.daegu": ("포차", "high"),
    "club_loopy": ("클럽", "high"),
    "breed_official": ("클럽", "med"),
    "lounge_beebee": ("포차", "med"),
    "clubair_": ("클럽", "high"),
    "oops.daegu": ("포차", "med"),
    "jack_gepa": ("포차", "high"),
    "9_jeju11": ("라운지·바", "high"),
    "totoga_dg": ("포차", "high"),
    "houngwook": ("펍", "low"),
    # --- 부산 서면 ---
    "groovenspot": ("클럽", "high"),
    "groovebusan": ("클럽", "high"),
    "clubnasub": ("클럽", "med"),
    "dibs_busan": ("펍", "med"),
    "villain.pub": ("펍", "med"),
    "billiejean.sm": ("클럽", "med"),
    "thursdayparty_seomyeon1": ("포차", "high"),
    "clubazit__official": ("클럽", "high"),
    "young_kkeul": ("포차", "high"),
    "jeje_busan": ("클럽", "high"),
    "creambasement": ("클럽", "high"),
    "busan_famers": ("포차", "low"),
    "hitthebeach2020": ("라운지·바", "med"),
    # --- 부산 광안리 ---
    "gwangalli_starbam": ("포차", "high"),
    "nasubnasubnasub": ("클럽", "high"),
    "basementbusan": ("라운지·바", "high"),
    "thursdayparty.official": ("포차", "med"),
    "fishermanbusan_official": ("포차", "med"),
    # --- 부산 해운대 ---
    "melt_busan": ("클럽", "high"),
    "bellagio_haeundae_official": ("포차", "med"),
    "billiejean_haeundae": ("라운지·바", "med"),
    "haeundae_starbam": ("포차", "high"),
    # --- 강남 ---
    "lazy.seoul": ("포차", "low"),
    "mond_cheongdam": ("포차", "low"),
    "sohoseoul_": ("클럽", "med"),
    "spinn.official": ("클럽", "med"),
    "orgasmvalley": ("클럽", "med"),
    "introseoul_official": ("포차", "med"),
    "color_apgu": ("포차", "high"),
    "code_seoul": ("포차", "med"),
    "timesapgu": ("클럽", "high"),
    "gaepanpocha.official": ("포차", "high"),
    "owlmtcabin_official": ("첫차술집", "med"),
    "gn_iamsolo_": ("포차", "high"),
    "seasun_gangnam": ("펍", "med"),
    "orientallounge.gangnam": ("포차", "high"),
    # --- 건대 ---
    "judabang__kondae": ("포차", "high"),
    # --- 홍대 ---
    "thisisclub25": ("클럽", "high"),
    "jamseoul": ("클럽", "high"),
    "gangnam77_hd": ("포차", "high"),
    "gaepan.hongdae": ("포차", "med"),
    "club_dokkaebi_official": ("클럽", "high"),
    "dokkaebi_partyhouse_pub": ("펍", "high"),
    "doze_seoul": ("클럽", "high"),
    "rollie_seoul": ("클럽", "med"),
    "bermuda_hongdae": ("클럽", "med"),
    "b1_hongdae": ("클럽", "high"),
    "club_kbat_official": ("클럽", "high"),
    "club_sabotage": ("클럽", "high"),
    "seoul.pub": ("펍", "high"),
    "circus_seoul": ("클럽", "med"),
    "sinkhole_official_": ("클럽", "high"),
    "orientallounge_hongdae": ("포차", "high"),
    "follow_hongdae": ("포차", "high"),
    "club_horn_official": ("클럽", "med"),
    # --- 이태원 ---
    "dawn_itaewon": ("라운지·바", "med"),
    "prostseoul": ("펍", "high"),
    "itaewon_nanjangpan": ("포차", "high"),
    "hiveitaewon": ("클럽", "high"),
    "themansion_itaewon": ("클럽", "high"),
    "poselounge_itaewon": ("클럽", "med"),
    "itwsavage": ("클럽", "high"),
    "sole_itaewon": ("클럽", "med"),
    "mad_itaewon": ("클럽", "high"),
    "gathering_itaewon": ("클럽", "high"),
    "daynight_itaewon": ("클럽", "high"),
    "deeper_itaewon": ("클럽", "high"),
    "waikiki_retro_itaewon": ("포차", "med"),
    "loft.seoul": ("첫차술집", "low"),
    "shape.seoul": ("첫차술집", "low"),
    "agave.seoul": ("라운지·바", "high"),
    "owllounge": ("클럽", "high"),
    "waikiki_itaewon": ("포차", "med"),
    "welcomepizza_official": ("첫차술집", "high"),
    "waikiki_utopia": ("클럽", "med"),
    "casacorona_seoul": ("라운지·바", "high"),
}

# 신규 베뉴 fallback용 이름/핸들 키워드 (리서치에 없을 때만)
FALLBACK_RULES = [
    ("포차", ["포차", "별밤", "starbam", "헌팅", "소주", "주다방", "솔로", "iamsolo", "합석"]),
    ("펍",   ["펍", "pub", "호프", "hof"]),
    ("라운지·바", ["라운지", "lounge", "칵테일", "bar.", ".bar"]),
    ("첫차술집", ["피자", "pizza", "포차", "포장마차", "오뎅", "이자카야"]),
]


def fallback(name: str, handle: str) -> str:
    blob = f"{name} {handle}".lower()
    for cat, kws in FALLBACK_RULES:
        if any(kw.lower() in blob for kw in kws):
            return cat
    return "클럽"


def main():
    with open(PATH, encoding="utf-8") as f:
        d = json.load(f)

    counts, conf_counts, missing = {}, {}, []
    for c in d["clubs"]:
        handle = (c.get("insta") or "").rstrip("/").split("/")[-1]
        if c["id"] in RESEARCH:
            cat, conf = RESEARCH[c["id"]]
        elif c.get("category"):
            # 이미 카테고리가 박힌 베뉴(공개소스 추가분 등)는 보존 — 휴리스틱으로 덮지 않음
            cat, conf = c["category"], c.get("category_confidence", "low")
        else:
            cat, conf = fallback(c.get("name", ""), handle), "low"
            missing.append(c["id"])
        c["category"] = cat
        c["category_confidence"] = conf
        c.setdefault("hours", None)  # 실측 보존, 없으면 null
        counts[cat] = counts.get(cat, 0) + 1
        conf_counts[conf] = conf_counts.get(conf, 0) + 1

    meta = d.setdefault("_meta", {})
    meta["categories"] = CATEGORIES
    meta["category_default_hours"] = CATEGORY_DEFAULT_HOURS
    meta["category_note"] = (
        "카테고리는 100곳 전수 웹리서치(유저 의도 기준: 클럽/헌팅/라운지·바/펍) 분류. "
        "category_confidence low는 실사 확인 권장. "
        "영업시간 hours는 미수집 → 마커 명암은 category_default_hours(추정)로 계산."
    )
    meta["updated"] = "2026-06-03"

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("category 분포:", json.dumps(counts, ensure_ascii=False))
    print("confidence 분포:", json.dumps(conf_counts, ensure_ascii=False))
    if missing:
        print("리서치 누락(fallback 적용):", missing)
    print("총", len(d["clubs"]), "곳 →", PATH)


if __name__ == "__main__":
    main()
