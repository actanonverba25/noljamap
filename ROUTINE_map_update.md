# 놀자맵 지도 신규 업체 자동 업데이트 루틴 (Claude Code Routine)

> 이 파일을 새 Claude Code 루틴의 지시서(CLAUDE.md)로 그대로 사용하세요.
> 카카오맵 Local API로 클럽거리·역세권을 재스캔해, 우리 지도(`clubs.json`)에 아직 없는 신규 업장만 자동으로 추가·배포합니다.

## 목적 · 주기
- **목적**: 새로 생긴/누락된 클럽·라운지·바·펍·포차·해장집을 카카오맵에서 찾아 놀자맵 지도에 반영.
- **주기**: **3일에 1회** (예: `0 4 */3 * *` UTC = 한국 오후 1시경).

## 실행 환경 (필수)
- **작업 디렉터리**: 리포지토리 루트 (이 repo)
- **환경변수**: `KAKAO_REST_KEY` — 카카오 **REST 키**(JS키 아님). 도메인 제한이 없어 민감하므로 **파일/깃에 하드코딩 금지**, 루틴 시크릿/환경변수로만 주입.
- `python3`, `git`, (`gh`) 사용 가능.
- 깃 원격: `origin` = 배포용 리포지토리, 배포 브랜치 `main` (Vercel 자동 배포).

## 매 실행 절차 (그대로 수행)
1. 작업 디렉터리로 이동.
2. 스크립트 실행:
   ```bash
   KAKAO_REST_KEY="$KAKAO_REST_KEY" python3 scripts/auto_update_venues.py
   ```
   → 마지막 줄에 JSON 요약이 출력됨: `{"added": N, "total": ..., "new_this_run_regions": {...}, "auto_total": ...}`
3. **`added == 0`** 이면 → 신규 없음. 커밋·배포 없이 종료. 보고: "신규 0곳(변경 없음)".
4. **`added > 0`** 이면:
   1. **품질 점검**: 이번에 추가된 `source == "kakao_auto"` 항목 중 최근 것 10~15개의 이름·카테고리를 확인.
      - 나이트라이프가 아닌 **오탐**(살사/댄스/스터디/독서/키즈/헬스/골프 등)이 섞였으면:
        해당 항목만 제거하거나 `git checkout data/clubs.json` 로 **통째 롤백** 후, `scripts/auto_update_venues.py`의 `EXCLUDE`에 해당 키워드 추가가 필요하다고 보고.
   2. **JSON 유효성**: `python3 -c "import json;json.load(open('data/clubs.json',encoding='utf-8'))"` 통과 확인.
   3. **커밋** (⚠️ Vercel 통과용 author 이메일 **필수**):
      ```bash
      git add data/clubs.json
      git commit -m "지도 신규 업체 N곳 자동 추가 (kakao_auto)"
      ```
   4. **푸시**: `git push origin HEAD:main` → Vercel 자동 배포(1~2분).
5. **보고**: 추가 수 + `new_this_run_regions` 분포 + 배포 여부.

## 가드레일 (스크립트에 내장 — 신뢰해도 됨)
- **멱등**: 이미 있는 곳(정규화 이름/`place_url`)은 절대 재추가 안 함 → 반복 실행해도 중복 0.
- **지역별 상한 10** (`MAX_PER_REGION`) — 한 지역 쏠림 방지. 초기 몇 회는 카카오 커버리지 백필로 ~70/회, 이후엔 진짜 신규만 소수.
- **신규는 `verified:false` / `category_confidence:low`** → 지도에 "검증 전" 표시. 어드민(`admin.html`)에서 검수 가능.
- **기존 항목은 절대 수정/삭제 안 함** (append only).
- **좌표·썸네일 포함** (카카오 검색 좌표 + og:image).

## 롤백
- 커밋 전: `git checkout data/clubs.json`
- 커밋 후: `git revert <커밋해시>` 후 push.

## 조정 포인트 (`scripts/auto_update_venues.py`)
- 지역별 추가 상한: `MAX_PER_REGION`
- 대상 지역/반경: `AREAS` (+ `REGION_ALIAS`)
- 검색 키워드↔카테고리: `QUERIES`
- 채택 업종: `WHITELIST` (카카오 category_name에 이 단어 있어야 채택)
- 오탐 차단: `EXCLUDE`

## 네이버맵 확장 (선택 · 지금은 불필요)
- 현재는 **카카오 Local 키워드검색** 기반(검증됨). 네이버는 지역/장소 검색 API(네이버 개발자센터 Search API — Maps와 별개, 별도 키)가 필요.
- 붙이려면 `QUERIES` 처리 루프에 네이버 소스 브랜치를 추가하고 결과를 동일 dedup에 태우면 됨. 카카오만으로도 커버리지 충분.

## 참고 파일
- `scripts/auto_update_venues.py` — 실행 스크립트(수집·필터·병합)
- `data/clubs.json` — 지도 데이터(카테고리·지역·좌표·썸네일)
- `admin.html` — verified 토글로 신규 항목 검수

---
### 대안: Claude 없이 완전 자동(참고)
Claude 루틴 대신 **GitHub Actions**로도 가능 (토큰 비용 0). `.github/workflows/`에 3일 크론으로 위 스크립트 실행 + 자동 커밋/푸시하는 잡을 두면 됨. 단, 오탐 품질 점검(4-1)은 사람/Claude가 가끔 봐주는 게 안전.
