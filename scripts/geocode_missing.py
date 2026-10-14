#!/usr/bin/env python3
"""좌표(lat/lng) 없는 업장을 카카오 REST로 지오코딩해 clubs.json에 박음.
주소검색 우선 → 실패 시 이름+지역 키워드검색. (지도 엔진 무관하게 좌표만 읽도록)
  KAKAO_REST_KEY=xxxx python3 scripts/geocode_missing.py
"""
import json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CLUBS = os.path.join(HERE, "..", "data", "clubs.json")
KEY = os.environ.get("KAKAO_REST_KEY") or sys.exit("KAKAO_REST_KEY 필요")
ADDR = "https://dapi.kakao.com/v2/local/search/address.json"
KW = "https://dapi.kakao.com/v2/local/search/keyword.json"

REGION = {
    "홍대": (37.5563, 126.9236), "이태원": (37.5346, 126.9946), "강남": (37.5172, 127.0286),
    "건대": (37.5404, 127.0699), "수원": (37.2664, 127.0001), "부산서면": (35.1577, 129.0594),
    "부산광안리": (35.1532, 129.1186), "부산해운대": (35.1631, 129.1635), "대구": (35.8693, 128.5947),
    "을지로": (37.5660, 126.9910), "안산": (37.3219, 126.8309), "광주": (35.2186, 126.8505),
    "제주": (33.5141, 126.5270), "강릉": (37.7950, 128.9090),
}


def get(url, params):
    q = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(q, headers={"Authorization": "KakaoAK " + KEY})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=8).read()).get("documents", [])
    except Exception:
        return []


def resolve(c):
    addr = c.get("address", "")
    if addr:
        docs = get(ADDR, {"query": addr, "size": 1})
        if docs:
            return float(docs[0]["y"]), float(docs[0]["x"])
    # 키워드 폴백 (이름+지역, 지역중심 편향)
    p = {"query": f"{c.get('name','')} {c.get('region','')}".strip(), "size": 1}
    ctr = REGION.get(c.get("region"))
    if ctr:
        p.update({"x": ctr[1], "y": ctr[0], "radius": 5000})
    docs = get(KW, p)
    if docs:
        return float(docs[0]["y"]), float(docs[0]["x"])
    return None


def main():
    d = json.load(open(CLUBS, encoding="utf-8"))
    todo = [c for c in d["clubs"]
            if not (isinstance(c.get("lat"), (int, float)) and isinstance(c.get("lng"), (int, float)))]
    print(f"좌표 없는 {len(todo)}곳 지오코딩…")
    ok = 0
    for i, c in enumerate(todo, 1):
        r = resolve(c)
        if r:
            c["lat"], c["lng"] = r
            ok += 1
        if i % 25 == 0:
            print(f"  {i}/{len(todo)} · 성공 {ok}")
        time.sleep(0.2)
    json.dump(d, open(CLUBS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(CLUBS, "a").write("\n")
    miss = sum(1 for c in d["clubs"]
               if not (isinstance(c.get("lat"), (int, float)) and isinstance(c.get("lng"), (int, float))))
    print(f"\n좌표 박음 {ok}곳 · 남은 미해결 {miss}곳 · 전체 {len(d['clubs'])}곳")


if __name__ == "__main__":
    main()
