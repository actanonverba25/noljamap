// config.js 생성기 — 환경변수 KAKAO_JS_KEY로부터 config.js를 만든다.
// 키를 깃에 커밋하기 싫을 때 사용 (로컬/배포 빌드 단계 공용).
//
// 로컬:   KAKAO_JS_KEY=발급받은_JS키 node gen-config.mjs
// Vercel: Build Command 에 `node gen-config.mjs`, 환경변수 KAKAO_JS_KEY 등록
import { writeFileSync } from "node:fs";

const key = process.env.KAKAO_JS_KEY;
if (!key) {
  console.error("⚠ KAKAO_JS_KEY 환경변수가 없습니다. config.js를 만들지 않습니다.");
  process.exit(1);
}
writeFileSync("config.js", `window.KAKAO_JS_KEY = ${JSON.stringify(key)};\n`);
console.log("✅ config.js 생성 완료");
