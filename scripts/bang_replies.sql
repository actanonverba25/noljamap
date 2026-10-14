-- 놀자방 대댓글(답글) 지원 — post_comments에 parent_id 자기참조 추가.
alter table post_comments add column if not exists parent_id uuid references post_comments(id) on delete cascade;
create index if not exists post_comments_parent_idx on post_comments (parent_id);
