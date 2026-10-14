# Nolja Map — venue auto-update routine (Claude Code routine spec, English)

> This is the instruction file a scheduled Claude Code routine follows. The Korean original is `ROUTINE_map_update.md`. The agent reads this file, runs the script, judges the result, and commits only when the guardrails pass.

## Purpose · cadence
- Re-scan Kakao Map (Local API) around club streets and stations, and add only venues the map does not already have.
- Runs on a schedule (currently twice a week). No human in the loop unless the run reports a problem.

## Environment
- Working directory: repository root.
- `KAKAO_REST_KEY` is injected as a secret. Never hard-coded, never committed.
- `python3`, `git` available. Pushing to `main` triggers a Vercel deploy.

## Procedure (every run)
1. Run `KAKAO_REST_KEY="$KAKAO_REST_KEY" python3 scripts/auto_update_venues.py`. The last line is a JSON summary: `{"added": N, "total": ..., "new_this_run_regions": {...}, "auto_total": ...}`.
2. If `added == 0`: nothing new. Exit without a commit. Report "0 new venues".
3. If `added > 0`:
   1. **Quality check.** Look at the 10–15 most recent `source == "kakao_auto"` rows (name + Kakao category). If a non-nightlife false positive slipped in (dance studio, study café, kids' café, gym, golf...), remove that row or roll back the whole file, and report which keyword should be added to `EXCLUDE`.
   2. **Validate JSON**: `python3 -c "import json;json.load(open('data/clubs.json',encoding='utf-8'))"`.
   3. **Commit** `data/clubs.json` with message `Auto-add N venues (kakao_auto)`.
   4. **Push** to `main`. Vercel deploys in 1–2 minutes.
4. **Report**: count added, distribution by region, whether a deploy happened.

## Guardrails (built into the script; the agent can rely on them)
- **Idempotent**: an existing venue (normalized name or `place_url`) is never re-added. Reruns produce zero duplicates.
- **Cap of 10 new venues per region per run** (`MAX_PER_REGION`) so one district can't flood the map.
- New rows are `verified: false` / `category_confidence: low` and show as "unverified" until reviewed in `admin.html`.
- **Append-only**: existing rows are never modified or deleted.
- Coordinates and thumbnails come from the Kakao search result and `og:image`.

## Rollback
- Before commit: `git checkout data/clubs.json`
- After commit: `git revert <hash>` and push.

## Tuning points (`scripts/auto_update_venues.py`)
`MAX_PER_REGION` · `AREAS` / `REGION_ALIAS` · `QUERIES` (keyword → category) · `WHITELIST` (Kakao category must contain one of these) · `EXCLUDE` (false-positive blocklist)

## What the log taught me (kept here on purpose)
- **2026-09-14**: 60 candidates found; a board-game café passed because the filter matched "pub" anywhere in the category string, including the venue's brand name. The rule "any false positive → roll back everything" discarded all 60. The agent was right; the rule was too blunt. Current rule: drop the bad row, add the pattern to `EXCLUDE`, ship the rest.
- **2026-09-24 → 10-12**: four runs failed at the clone step because a GitHub token had lapsed. The failure happened before the agent started, so nothing reported it; three weeks of silence looked like three weeks of "nothing new". Fix: a check that does not depend on the routine reporting on itself.
