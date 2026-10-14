#!/usr/bin/env python3
"""
사전 지오코딩: clubs.json의 주소 → 위경도(lat/lng)를 미리 박아둔다.
런타임 지오코딩보다 빠르고 안정적. 로컬에서 1회 실행하면 됨.

사용법:
    export KAKAO_REST_KEY="카카오_REST_API_키"     # JS키 아님! REST키
    python3 scripts/geocode.py

- 카카오 콘솔 → 내 애플리케이션 → 앱 키 → "REST API 키"
- REST키는 서버용이라 절대 깃에 커밋하지 말 것 (환경변수로만)
- 이미 lat/lng 있는 항목은 건너뜀. --force 주면 전부 다시.
"""
import json, os, sys, time, urllib.request, urllib.parse

KEY = os.environ.get("KAKAO_REST_KEY")
if not KEY:
    sys.exit("❌ KAKAO_REST_KEY 환경변수가 필요합니다. (카카오 REST API 키)")

FORCE = "--force" in sys.argv
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(HERE, "data", "clubs.json")

def kakao(endpoint, query):
    url = f"https://dapi.kakao.com/v2/local/search/{endpoint}.json?query=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {KEY}"})
    with urllib.request.urlopen(req, timeout=10) as f:
        return json.load(f).get("documents", [])

def geocode(club):
    # 1) 주소 검색
    if club.get("address"):
        docs = kakao("address", club["address"])
        if docs:
            return float(docs[0]["y"]), float(docs[0]["x"]), "address"
    # 2) 키워드 폴백 (가게명 + 지역)
    docs = kakao("keyword", f"{club['name']} {club.get('region','')}")
    if docs:
        return float(docs[0]["y"]), float(docs[0]["x"]), "keyword"
    return None, None, "fail"

def main():
    data = json.load(open(PATH, encoding="utf-8"))
    clubs = data["clubs"]
    done = fail = skip = 0
    for c in clubs:
        if not FORCE and isinstance(c.get("lat"), (int, float)):
            skip += 1; continue
        try:
            lat, lng, method = geocode(c)
        except Exception as e:
            print(f"  ⚠ {c['name']}: {e}"); fail += 1; continue
        if lat is None:
            print(f"  ✗ 좌표 못 찾음: {c['name']} / {c.get('address')}"); fail += 1
        else:
            c["lat"], c["lng"], c["geo_method"] = lat, lng, method
            done += 1
        time.sleep(0.05)  # rate limit 여유
    json.dump(data, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n✅ 지오코딩 완료 — 성공 {done} · 실패 {fail} · 스킵(기존) {skip} / 총 {len(clubs)}곳")
    if fail:
        print("   실패 건은 data/clubs.json에서 주소 수정 후 재실행하세요.")

if __name__ == "__main__":
    main()
