# Nolja Map (놀자맵)

**Live:** https://noljamap.vercel.app · Korean README: [README.ko.md](README.ko.md)

An intent-based nightlife map of Seoul (plus Busan, Daegu, Suwon): clubs, lounges, bars, pochas, late-night food. 1,859 venues as of October 2026, about 3,000 weekly visitors at last count. Built and run by one person, with Claude as pair.

The part of this repo that matters most is not the map. It is the **scheduled agent routine that keeps the map current without me**, and the two times its log showed my rules were wrong. See [`ROUTINE_map_update.en.md`](ROUTINE_map_update.en.md).

## How it is built

| Layer | What |
|---|---|
| Front end | Static HTML/JS, Kakao Map SDK (Naver tiles for the English mode), i18n, GA4 + Amplitude. Deployed on Vercel. |
| Data | `data/clubs.json` is the source of truth for venues (category, region, coordinates, thumbnail, `verified` flag). |
| Backend | **Supabase**: Postgres with row-level security for user submissions and the community board (`scripts/*.sql`), Storage for photos, Edge Functions (`supabase/functions/`): `notify-submission` is called by a database webhook and emails the admin via Resend; `venue-thumb` serves thumbnails. |
| Ops | `.github/workflows/keepalive.yml` pings the REST API daily so the free-tier project never pauses (113 runs, 0 failures as of 2026-10-13). |
| Admin | `admin.html` (Supabase Auth, sign-ups disabled, single admin) to verify or reject new venues. |

## The agent routine

The update procedure is written as a Markdown file and executed by a scheduled Claude Code routine. The agent reads the file, runs `scripts/auto_update_venues.py`, reads the result, and commits only if the guardrails pass. The guardrails live in code, not in the agent's attention:

- idempotent reruns (no duplicates by normalized name or `place_url`)
- at most 10 new venues per region per run
- false-positive check with rollback
- JSON validation before commit, then push → Vercel deploy

**Run record (2026-07-23 → 09-10):** 14 unattended runs, 943 venues added. Of the 1,859 venues live today, 1,013 came through this script.

**Two corrections the log forced:**
1. *2026-09-14.* The routine found 60 candidates and caught one board-game café that passed because my filter matched "pub" anywhere in the Kakao category string, including the café's brand name. My rule said any false positive means roll back everything, so it threw away all 60 and proposed the filter fix. The agent followed the procedure; the procedure was too broad. The rule now drops the bad row, adds the pattern to `EXCLUDE`, and ships the rest.
2. *2026-09-24 → 10-12.* Four runs failed at the clone step because a GitHub token had lapsed. The failure happened before the agent started, so nothing reported it. Three weeks of silence looked exactly like three weeks of "nothing new". The fix is a check that does not depend on the routine reporting on itself.

## Data pipeline (one-off and periodic scripts)

`scripts/discover_*.py` (Kakao Local keyword discovery by area), `geocode.py` / `geocode_missing.py`, `backfill_kakao_search.py`, `crawl_kakao_thumbs.py`, `categorize.py`, and `auto_update_venues.py` (the one the routine runs). All read `KAKAO_REST_KEY` from the environment.

## Security notes

- The Kakao **JS** key, Naver client ID, GA and Amplitude keys are client-side keys protected by domain restriction; they live in `config.js`, which is git-ignored. Copy `config.example.js` to start.
- The Kakao **REST** key and the Supabase service key are never in the repo. Scripts read them from environment variables; the routine gets them as secrets.
- The Supabase publishable (anon) key in `keepalive.yml` is the same public key the browser client uses; RLS is what protects the data.
- Admin policies: sign-ups are disabled, and `scripts/rls_admin_hardening.sql` scopes admin policies to an explicit `admin_users` allowlist rather than any authenticated user.

## Run locally

```bash
cp config.example.js config.js   # add your Kakao JS key
python3 -m http.server 8000      # open http://localhost:8000
```

To run the updater: `KAKAO_REST_KEY=... python3 scripts/auto_update_venues.py`

## Why this exists

I built it because the first 650 venues could not be curated by hand, and a map that is not current is not worth opening. The deployment still runs from a private repository; this public copy is the same code with internal notes and scraped raw data removed.
