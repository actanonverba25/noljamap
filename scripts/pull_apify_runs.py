#!/usr/bin/env python3
"""이미 UI로 돌린 apidojo/instagram-hashtag-scraper 실행들의 *진짜* 결과를 API로 읽어옴.
(API run-sync는 demo만 주지만, 완료된 run의 dataset 읽기는 진짜 데이터)
  APIFY_TOKEN="$(pbpaste)" python3 scripts/pull_apify_runs.py
출력: data/apify_soiree_raw.json
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "apify_soiree_raw.json")
ACTOR = "apidojo~instagram-hashtag-scraper"


def api(path, token):
    req = urllib.request.Request(f"https://api.apify.com/v2/{path}",
                                 headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    token = os.environ.get("APIFY_TOKEN")
    if not token or not token.startswith("apify_api_"):
        sys.exit("APIFY_TOKEN 필요.")

    runs = api(f"acts/{ACTOR}/runs?desc=true&limit=15", token)["data"]["items"]
    print(f"최근 실행 {len(runs)}건")
    all_items, seen = [], set()
    for run in runs:
        if run["status"] != "SUCCEEDED":
            continue
        ds = run.get("defaultDatasetId")
        if not ds:
            continue
        items = api(f"datasets/{ds}/items?clean=true", token)
        real = [it for it in items if not it.get("demo")]
        for it in real:
            pid = it.get("id") or it.get("code") or it.get("url")
            if pid and pid not in seen:
                seen.add(pid)
                all_items.append(it)
        print(f"  run {run['id'][:8]} ({run['startedAt'][:16]}): {len(items)}개 중 진짜 {len(real)}")

    json.dump(all_items, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n고유 진짜 게시물 {len(all_items)}개 → {OUT}")
    if all_items:
        print("최상위 키:", list(all_items[0].keys()))


if __name__ == "__main__":
    main()
