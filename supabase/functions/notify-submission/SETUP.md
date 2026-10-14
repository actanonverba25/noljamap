# notify-submission 셋업 (Resend 이메일 알림)

## 시크릿 (Supabase → Edge Functions → Manage secrets)
- RESEND_API_KEY = <Resend 대시보드에서 발급한 re_... 키>
- HOOK_SECRET = 34c52f216654bf1db367eeed49b28d2645a00cfcf919890b

## 함수 설정
- verify_jwt = false  (웹훅이 JWT 없이 호출, 대신 x-hook-secret 헤더로 검증)

## DB Webhook (Database → Webhooks → Create a new hook)
- Name: notify_submission
- Table: submissions
- Events: Insert
- Type: Supabase Edge Functions → notify-submission
- HTTP Headers 추가: x-hook-secret = 34c52f216654bf1db367eeed49b28d2645a00cfcf919890b

## 함수 URL
https://lxgcocblgulxjqfjvwfg.supabase.co/functions/v1/notify-submission

## 발신/수신
- From: 놀자맵 <onboarding@resend.dev>  (도메인 미인증 시 Resend 기본 발신)
- To: noljamap@gmail.com  (Resend 무료는 가입계정 이메일로만 수신 가능 → noljamap으로 가입 필수)
