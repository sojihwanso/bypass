-- BYPASS 커뮤니티: 대댓글 · 프로필 사진
-- 032 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 대댓글
--   - 댓글에 '답글'을 달 수 있습니다. 한 단계까지만 들여 씁니다.
--     답글에 다시 답글을 달면 같은 원댓글 아래에 붙고, 화면에서 앞에 @이름 이 들어갑니다.
--   - 답글이 달린 댓글을 지우면 내용과 이름만 지우고 '삭제된 댓글입니다'로 남깁니다. 답글은 그대로.
--     그 아래 답글이 모두 지워지면 '삭제된 댓글입니다' 자리도 저절로 치웁니다.
--     지우기는 delete_comment() 로만 합니다. (답글 달린 댓글을 바로 지워 남의 답글까지 날리는 길은 막음)
--   - 다른 글의 댓글에 답글을 다는 것은 막습니다.
--   - 누구에게 단 답글인지(reply_to)를 저절로 적어 둡니다. 커뮤니티 홈 '내 소식'에 '내 댓글에 달린 답글'로 뜹니다.
-- 프로필 사진
--   - 회원은 커뮤니티 › 내 정보에서 사진을 올리거나 지웁니다. 화면에서 256×256 으로 줄여서 올립니다.
--   - 저장소 avatars/<내 회원번호>/a.webp (512KB 이하 WebP·JPG·PNG). 누구나 볼 수 있고, 본인만 올리고 바꿉니다.
--   - 운영진은 HQ › 회원에서 부적절한 사진을 지울 수 있습니다. (staff_remove_avatar, 변경 기록에 남음)
--   - member_avatars 에는 '언제 바꿨는지'만 둡니다. 화면은 이 시각을 ?v= 로 붙여 바뀐 사진을 바로 보여 줍니다.

-- ===== 1) 대댓글 =====
alter table public.post_comments
  add column if not exists parent_id bigint references public.post_comments (id) on delete cascade;
alter table public.post_comments
  add column if not exists reply_to uuid references auth.users (id) on delete set null;
alter table public.post_comments
  add column if not exists deleted boolean not null default false;
create index if not exists post_comments_parent_idx on public.post_comments (parent_id);
create index if not exists post_comments_reply_to_idx on public.post_comments (reply_to, created_at desc);

-- parent_id 는 '답글 버튼을 누른 댓글'을 보낸다. 아래에서 원댓글로 옮기고, 그 댓글 쓴 사람을 reply_to 에 적는다
grant insert (post_id, body, parent_id) on public.post_comments to authenticated;

create or replace function public.post_comments_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p_post bigint;
  p_parent bigint;
  p_author uuid;
  p_gone boolean;
begin
  new.reply_to := null;
  new.deleted := false;
  if new.parent_id is null then return new; end if;
  select c.post_id, c.parent_id, c.author, c.deleted into p_post, p_parent, p_author, p_gone
    from public.post_comments c where c.id = new.parent_id;
  if not found or p_post <> new.post_id or p_gone then
    raise exception 'bad parent' using errcode = '22023';
  end if;
  new.reply_to := p_author;
  -- 답글의 답글은 원댓글 아래로 (한 단계만)
  if p_parent is not null then new.parent_id := p_parent; end if;
  return new;
end;
$$;
revoke all on function public.post_comments_reply() from public, anon, authenticated;

drop trigger if exists post_comments_reply on public.post_comments;
create trigger post_comments_reply before insert on public.post_comments
  for each row execute function public.post_comments_reply();

-- 지우기: 답글이 달려 있으면 '삭제된 댓글입니다'로, 없으면 진짜로 지운다
create or replace function public.delete_comment(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  select x.id, x.author, x.parent_id, x.deleted into c from public.post_comments x where x.id = p_id;
  if not found then return 'gone'; end if;
  if c.author is distinct from auth.uid() and (select public.bypass_role()) is distinct from 'staff' then
    raise exception 'not yours' using errcode = '42501';
  end if;
  if exists (select 1 from public.post_comments k where k.parent_id = p_id) then
    update public.post_comments
       set deleted = true, body = '삭제된 댓글입니다', author = null, author_name = null
     where id = p_id;
    return 'soft';
  end if;
  delete from public.post_comments where id = p_id;
  -- 지운 것이 답글이고, 원댓글이 이미 '삭제된 댓글'인데 남은 답글이 없으면 그 자리도 치운다
  if c.parent_id is not null then
    delete from public.post_comments p
     where p.id = c.parent_id and p.deleted
       and not exists (select 1 from public.post_comments k where k.parent_id = p.id);
  end if;
  return 'deleted';
end;
$$;
revoke all on function public.delete_comment(bigint) from public, anon;
grant execute on function public.delete_comment(bigint) to authenticated;

-- 바로 지우기(REST)는 답글이 없는 댓글만. 운영진은 그대로
drop policy if exists "댓글 지우기" on public.post_comments;
create policy "댓글 지우기" on public.post_comments for delete to authenticated
  using ((select public.bypass_role()) = 'staff'
      or (author = (select auth.uid())
          and not exists (select 1 from public.post_comments k where k.parent_id = post_comments.id)));

-- 목록의 댓글 수: '삭제된 댓글'은 세지 않는다 (027 의 post_feed 와 같은 칸, 같은 순서)
create or replace view public.post_feed
with (security_invoker = true) as
select p.id, p.created_at, p.updated_at, p.kind, p.category, p.title, p.body, p.url, p.author, p.author_name, p.hidden,
       (select count(*) from public.post_likes l where l.post_id = p.id) as likes,
       (select count(*) from public.post_comments c where c.post_id = p.id and not c.deleted) as comments,
       exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())) as liked,
       p.thumb_url,
       p.pin_rank
  from public.posts p;
revoke all on public.post_feed from anon, authenticated;
grant select on public.post_feed to authenticated;

-- 내 소식: 남이 내 댓글에 단 답글 (부르는 사람의 권한으로 읽음)
create or replace function public.my_reply_news(p_since timestamptz)
returns table (id bigint, created_at timestamptz, body text, author uuid, author_name text, post_id bigint, title text)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.created_at, c.body, c.author, c.author_name, c.post_id, p.title
    from public.post_comments c
    join public.posts p on p.id = c.post_id
   where c.reply_to = (select auth.uid())
     and c.author <> (select auth.uid())
     and not c.deleted
     and c.created_at >= p_since
   order by c.created_at desc
   limit 10
$$;
revoke all on function public.my_reply_news(timestamptz) from public, anon;
grant execute on function public.my_reply_news(timestamptz) to authenticated;

-- ===== 2) 프로필 사진: 저장소 =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "프로필 사진: 본인·운영진 보기" on storage.objects;
create policy "프로필 사진: 본인·운영진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.bypass_role()) = 'staff'));
drop policy if exists "프로필 사진: 본인 올리기" on storage.objects;
create policy "프로필 사진: 본인 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "프로필 사진: 본인 바꾸기" on storage.objects;
create policy "프로필 사진: 본인 바꾸기" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "프로필 사진: 본인·운영진 지우기" on storage.objects;
create policy "프로필 사진: 본인·운영진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.bypass_role()) = 'staff'));

-- ===== 3) 프로필 사진: 누가 사진이 있는지 =====
create table if not exists public.member_avatars (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  updated_at  timestamptz not null default now()
);

create or replace function public.member_avatars_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.member_avatars_stamp() from public, anon, authenticated;
drop trigger if exists member_avatars_stamp on public.member_avatars;
create trigger member_avatars_stamp before insert or update on public.member_avatars
  for each row execute function public.member_avatars_stamp();

alter table public.member_avatars enable row level security;
revoke all on public.member_avatars from anon, authenticated;
grant select, delete on public.member_avatars to authenticated;
grant insert (user_id, updated_at), update (user_id, updated_at) on public.member_avatars to authenticated;

drop policy if exists "프로필 사진 읽기" on public.member_avatars;
create policy "프로필 사진 읽기" on public.member_avatars for select to authenticated using (true);
drop policy if exists "프로필 사진 올리기" on public.member_avatars;
create policy "프로필 사진 올리기" on public.member_avatars for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "프로필 사진 바꾸기" on public.member_avatars;
create policy "프로필 사진 바꾸기" on public.member_avatars for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "프로필 사진 지우기" on public.member_avatars;
create policy "프로필 사진 지우기" on public.member_avatars for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.bypass_role()) = 'staff');

-- ===== 4) 운영진: 부적절한 프로필 사진 지우기 =====
-- 저장소 파일은 HQ 화면이 먼저 지우고(운영진 지우기 권한), 이 함수가 줄을 지우며 변경 기록을 남긴다
create or replace function public.staff_remove_avatar(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  nm text;
  me text;
  was timestamptz;
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  delete from public.member_avatars where user_id = p_user returning updated_at into was;
  if not found then return false; end if;
  select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))
    into nm from auth.users u where u.id = p_user;
  select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))
    into me from auth.users u where u.id = auth.uid();
  if to_regclass('public.audit_log') is not null then
    insert into public.audit_log (actor, actor_name, tbl, row_key, action, old_row, new_row)
    values (auth.uid(), coalesce(me, '운영진'), 'member_avatars', p_user::text, 'delete',
            jsonb_build_object('user_id', p_user, 'name', nm, 'updated_at', was), null);
  end if;
  return true;
end;
$$;
revoke all on function public.staff_remove_avatar(uuid) from public, anon;
grant execute on function public.staff_remove_avatar(uuid) to authenticated;

-- 확인: 아래 일곱 줄이 나오면 끝
select 'post_comments.' || column_name as "만든 것" from information_schema.columns
 where table_schema = 'public' and table_name = 'post_comments' and column_name in ('parent_id', 'reply_to', 'deleted')
union all
select 'member_avatars' from information_schema.tables where table_schema = 'public' and table_name = 'member_avatars'
union all
select p.proname || '()' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('delete_comment', 'my_reply_news', 'staff_remove_avatar');
