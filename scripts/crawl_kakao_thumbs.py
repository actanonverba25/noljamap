#!/usr/bin/env python3
"""카카오 place 페이지 og:image → 업장 대표사진(thumb) 콜드스타트 채움.
※ 데모용 임시 기본썸네일. 실제 사진은 유저 업로드(photos 테이블) 우선. ToS 회색지대 — 정식서비스 전 교체 권장.
플레이스홀더(staticmap)는 제외. 멱등(thumb 있으면 스킵).
  python3 scripts/crawl_kakao_thumbs.py
"""
import json, os, re, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "data", "clubs.json")
OG = re.compile(r'og:image"[^>]*content="([^"]+)"')


def fetch_thumb(pid):
    try:
        req = urllib.request.Request(f"https://place.map.kakao.com/{pid}",
                                     headers={"User-Agent": "Mozilla/5.0 (iPhone)"})
        html = urllib.request.urlopen(req, timeout=8).read().decode("utf-8", "ignore")
        m = OG.search(html)
        if not m:
            return None
        img = m.group(1)
        if "fname=" not in img:  # staticmap 플레이스홀더 = 실사진 아님
            return None
        return ("https:" + img) if img.startswith("//") else img
    except Exception:
        return None


def main():
    d = json.load(open(PATH, encoding="utf-8"))
    targets = [c for c in d["clubs"]
               if c.get("place_url") and "place.map.kakao" in c["place_url"] and not c.get("thumb")]
    print(f"대상 {len(targets)}곳 크롤 시작…")
    got = 0
    for i, c in enumerate(targets, 1):
        pid = c["place_url"].rstrip("/").split("/")[-1]
        t = fetch_thumb(pid)
        if t:
            c["thumb"] = t
            c["thumb_src"] = "kakao"
            got += 1
        if i % 50 == 0:
            print(f"  {i}/{len(targets)} · 사진 {got}")
        time.sleep(0.25)
    json.dump(d, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(PATH, "a").write("\n")
    total = sum(1 for c in d["clubs"] if c.get("thumb"))
    print(f"\n신규 사진 {got}곳 · 전체 thumb 보유 {total}곳 → {PATH}")


if __name__ == "__main__":
    main()
