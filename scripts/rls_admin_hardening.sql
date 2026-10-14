-- RLS hardening: scope "admin" policies to an explicit allowlist instead of any authenticated user.
-- Context: Supabase Auth sign-ups are disabled for this project and there is one admin account,
-- so `to authenticated using (true)` was effectively safe. This makes the intent explicit in the policy itself.
-- Apply in the Supabase SQL editor AFTER admin_setup.sql / bang_setup.sql.

create table if not exists public.admin_users (
  email text primary key
);
-- insert into public.admin_users (email) values ('<admin email>');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;

-- submissions (admin_setup.sql)
drop policy if exists "admin_update_submissions" on public.submissions;
create policy "admin_update_submissions" on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin_delete_submissions" on public.submissions;
create policy "admin_delete_submissions" on public.submissions
  for delete to authenticated using (public.is_admin());

-- community posts (bang_setup.sql)
drop policy if exists "posts_admin" on public.posts;
create policy "posts_admin" on public.posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "pc_admin" on public.post_comments;
create policy "pc_admin" on public.post_comments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
