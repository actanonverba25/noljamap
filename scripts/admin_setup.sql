-- 놀자맵 관리자 기능 셋업 (Supabase SQL Editor에서 1회 실행)
-- 1) 제보 검증 플래그
alter table submissions add column if not exists verified boolean not null default false;

-- 2) 로그인한 관리자(authenticated)만 수정/삭제 허용. 익명(anon)은 insert/read만(기존 유지).
drop policy if exists "admin_update_submissions" on submissions;
create policy "admin_update_submissions" on submissions
  for update to authenticated using (true) with check (true);

drop policy if exists "admin_delete_submissions" on submissions;
create policy "admin_delete_submissions" on submissions
  for delete to authenticated using (true);
