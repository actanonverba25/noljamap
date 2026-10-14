-- 놀자방 (커뮤니티 게시판) 스키마. Supabase SQL Editor에서 실행.
-- 익명 기반: 닉네임 + 비번(삭제용). 기존 놀자맵 익명 패턴과 동일.

-- 게시글
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  nick text not null,
  pw text,                         -- 삭제용 (간단 평문 — 민감정보 아님)
  category text not null default '자유',
  region text,                     -- 선택 지역 태그 (홍대·이태원 등)
  title text not null,
  content text,
  images text[] default '{}',
  status text default 'live',
  created_at timestamptz default now()
);
create index if not exists posts_created_idx on posts (created_at desc);
create index if not exists posts_category_idx on posts (category);

-- 댓글
create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  nick text not null,
  pw text,
  text text not null,
  created_at timestamptz default now()
);
create index if not exists post_comments_post_idx on post_comments (post_id);

-- 좋아요 (votes 패턴 — row 적재 후 카운트)
create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists post_likes_post_idx on post_likes (post_id);

-- RLS: 익명 insert + live read
alter table posts enable row level security;
alter table post_comments enable row level security;
alter table post_likes enable row level security;

create policy "posts_read" on posts for select using (status = 'live');
create policy "posts_insert" on posts for insert with check (true);
create policy "pc_read" on post_comments for select using (true);
create policy "pc_insert" on post_comments for insert with check (true);
create policy "pl_read" on post_likes for select using (true);
create policy "pl_insert" on post_likes for insert with check (true);
-- 관리자(authenticated) 전체 읽기·삭제 (admin 페이지용)
create policy "posts_admin" on posts for all to authenticated using (true) with check (true);
create policy "pc_admin" on post_comments for all to authenticated using (true) with check (true);

-- 비번 기반 삭제 (SECURITY DEFINER — RLS 우회해 본인 글만 삭제)
create or replace function delete_post(p_id uuid, p_pw text)
returns boolean language plpgsql security definer as $$
begin
  delete from posts where id = p_id and pw is not null and pw = p_pw;
  return found;
end; $$;

create or replace function delete_post_comment(c_id uuid, c_pw text)
returns boolean language plpgsql security definer as $$
begin
  delete from post_comments where id = c_id and pw is not null and pw = c_pw;
  return found;
end; $$;

grant execute on function delete_post(uuid, text) to anon, authenticated;
grant execute on function delete_post_comment(uuid, text) to anon, authenticated;
