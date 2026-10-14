# 서울+전국 클럽맵 — 런칭 런북 (거지맵/야장맵처럼 배포하기)

목표: 프로토타입 → 인터넷에 뜬 진짜 서비스. 코드는 다 됐고, 아래는 **너가 브라우저/계정으로** 하는 단계.

> 키 종류 2개 헷갈리지 말 것
> - **JS키** = 브라우저용. 클라이언트에 노출돼도 됨(도메인 제한으로 보호). 지도 표시용.
> - **REST키** = 서버용. **절대 깃 커밋 금지.** 사전 지오코딩(좌표 박기)에만 로컬에서 사용.

---

## STEP 0. 카카오 키 발급 (5분)
1. https://developers.kakao.com → 로그인 → **내 애플리케이션 → 애플리케이션 추가**
2. **앱 키** 탭에서 두 개 복사: **JavaScript 키**, **REST API 키**
3. **플랫폼 → Web → 사이트 도메인 등록**:
   - 로컬 테스트용: `http://localhost:8000`
   - 배포 후: `https://<프로젝트>.vercel.app` (STEP 3에서 나오는 주소)
   - 카카오맵은 등록 안 된 도메인에서 안 뜸 → 배포 주소 나오면 꼭 추가

---

## STEP 1. 로컬에서 확인 (지도 뜨는지)
```bash
cd club-map
echo 'window.KAKAO_JS_KEY = "여기_JS키";' > config.js   # 또는 cp config.example.js config.js 후 수정
python3 -m http.server 8000
```
→ 브라우저 `http://localhost:8000` → 100곳 핀 뜨면 성공.

---

## STEP 2. (권장) 좌표 사전 박기 — 빠르고 안정적으로
지금은 앱이 열릴 때마다 주소를 좌표로 변환(런타임). 미리 박아두면 훨씬 빠르고 안정적.
```bash
export KAKAO_REST_KEY="여기_REST키"      # JS키 아님!
python3 scripts/geocode.py               # data/clubs.json에 lat/lng 기록
```
- 실패한 곳은 콘솔에 뜸 → `data/clubs.json`에서 주소 고치고 재실행
- 끝나면 `git add data/clubs.json && git commit && git push` (좌표는 커밋해도 안전)

---

## STEP 3. Vercel 배포 (무료, 1분, 자동 HTTPS)
1. https://vercel.com → GitHub로 로그인 → **Add New → Project** → 이 repo(`pm-jobhunt`) 선택
2. 설정:
   - **Root Directory**: `club-map`  ← 꼭 지정 (repo 루트 아님)
   - **Framework Preset**: `Other`
   - **Build/Output**: 비워두면 정적 그대로 서빙
3. **키 넣는 법 (둘 중 하나)**
   - **(A) 간단** — config.js를 커밋해서 함께 배포 (JS키는 도메인 제한하니 안전):
     ```bash
     git add -f club-map/config.js && git commit -m "deploy config" && git push
     ```
   - **(B) 안전** — 키를 깃에 안 두고 빌드 때 주입:
     - Vercel 프로젝트 **Settings → Environment Variables**: `KAKAO_JS_KEY` = JS키
     - **Build Command**: `node gen-config.mjs`
4. **Deploy** 클릭 → `https://<프로젝트>.vercel.app` 주소 나옴
5. ⚠️ 그 주소를 **STEP 0의 카카오 콘솔 사이트 도메인**에 추가 → 지도 뜸

> push할 때마다 자동 재배포됨.

---

## STEP 4. (선택) 도메인 연결
- 가비아·후이즈·Cloudflare 등에서 도메인 구매 (`xxx.com`)
- Vercel 프로젝트 **Settings → Domains**에 추가 → 안내대로 DNS 설정
- 새 도메인도 **카카오 콘솔 사이트 도메인에 추가** 잊지 말 것

---

## 자주 막히는 곳
| 증상 | 원인/해결 |
|---|---|
| 지도가 회색/안 뜸 | 카카오 콘솔에 **현재 도메인 미등록** → 사이트 도메인 추가 |
| "키 설정 필요" 배너 | config.js 없음/키 placeholder → STEP 1 |
| 핀이 엉뚱한 위치 | 주소 지오코딩 오류 → `data/clubs.json` 주소 수정 후 STEP 2 재실행 |
| 로컬에서 데이터 안 뜸 | file://로 연 것 → 반드시 `python3 -m http.server` |

---

## 역할 분담 요약
- **코드/데이터/스크립트/이 문서** = Claude (완료)
- **키 발급 · 로컬 확인 · 배포 클릭 · 도메인** = 너 (위 STEP 0~4)
