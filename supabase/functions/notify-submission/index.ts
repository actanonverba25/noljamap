// 놀자맵 — 새 제보·장소수정 들어오면 noljamap@gmail.com로 이메일 알림 (Resend)
// DB Webhook(submissions INSERT) → 이 함수 → Resend API
// 시크릿: RESEND_API_KEY, HOOK_SECRET (Supabase Edge Functions Secrets)
// 함수 설정: Verify JWT = OFF (웹훅이 JWT 없이 호출, 대신 x-hook-secret 헤더로 검증)

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const HOOK_SECRET = Deno.env.get("HOOK_SECRET")!;
const TO = "noljamap@gmail.com";

Deno.serve(async (req) => {
  // 웹훅 외 무단 호출 차단
  if (req.headers.get("x-hook-secret") !== HOOK_SECRET) {
    return new Response("forbidden", { status: 401 });
  }
  let r: Record<string, unknown> = {};
  try { r = (await req.json()).record || {}; } catch (_) { /* ignore */ }

  const t = r.type as string;
  const typeLabel = t === "edit" ? "✏️ 정보수정·폐업" : t === "event" ? "🎉 이벤트" : "📍 새 장소";
  const subject = `[놀자맵] ${typeLabel} 제보 — ${r.name || "(이름없음)"}`;
  const lines = [
    `유형: ${typeLabel}`,
    `이름: ${r.name || "-"}`,
    `카테고리: ${r.category || "-"}`,
    r.region ? `지역: ${r.region}` : "",
    r.address ? `주소: ${r.address}` : "",
    r.event_date ? `날짜: ${r.event_date}` : "",
    r.memo ? `메모: ${r.memo}` : "",
    r.insta ? `링크: ${r.insta}` : "",
    r.target_id ? `대상 ID: ${r.target_id}` : "",
    "",
    "👉 관리: https://noljamap.vercel.app/admin.html",
  ].filter(Boolean);
  const html = `<h2 style="margin:0 0 10px">${subject}</h2>` +
    `<pre style="font-family:inherit;font-size:14px;line-height:1.6;white-space:pre-wrap">${lines.join("\n")}</pre>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "놀자맵 <onboarding@resend.dev>", to: [TO], subject, html }),
  });
  if (!res.ok) return new Response("email failed: " + (await res.text()), { status: 500 });
  return new Response("ok");
});
