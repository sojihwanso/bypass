-- BYPASS: 닉네임(보이는 이름) 바꾸기
-- 031 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 규칙
--   - 회원은 커뮤니티 › 내 정보에서 직접 바꿉니다. 한 번 바꾸면 30일 뒤에 다시 바꿀 수 있습니다.
--   - 운영진은 HQ › 회원에서 누구의 이름이든 바로 바꿀 수 있습니다. (기다리는 날 없음, 회원의 30일도 쓰지 않음)
--   - 2~20자, 한글·영문·숫자·띄어쓰기·. _ - 만 됩니다.
--   - 다른 회원의 이름이나 아이디와 같으면 안 됩니다. (띄어쓰기·대소문자·. _ - 는 무시하고 비교)
--   - 운영진·관리자·BYPASS 같은 이름은 운영진만 정할 수 있습니다. (사칭 막기)
--   - 바꾸면 지금까지 쓴 글·댓글·공지·안건·자료·올린 페이지의 이름도 함께 바뀝니다.
--   - 예전 이름은 최근 10개까지 남아 운영진이 HQ 에서 볼 수 있습니다.
--   - 브라우저 콘솔 등으로 이름을 몰래 바꾸는 길(updateUser)은 막습니다. 이 함수로만 바뀝니다.

-- ===== 1) 비교용으로 이름 다듬기 =====
create or replace function public.bypass_name_norm(t text)
returns text language sql immutable set search_path = ''
as $$ select lower(regexp_replace(coalesce(t, ''), '[[:space:]._-]', '', 'g')) $$;

-- ===== 2) 실제로 바꾸는 곳 (직접 부르지 못함) =====
create or replace function public.bypass_apply_name(p_user uuid, p_name text, p_staff boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  k text := public.bypass_name_norm(n);
  cur text;
  app jsonb;
  last_at timestamptz;
  hist jsonb;
  w text;
begin
  select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
         coalesce(u.raw_app_meta_data, '{}'::jsonb)
    into cur, app
    from auth.users u where u.id = p_user;
  if not found then raise exception 'no user' using errcode = 'P0002'; end if;

  if char_length(n) not between 2 and 20 then raise exception 'name length' using errcode = '22023'; end if;
  if n !~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ._-]+$' or n !~ '[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]' then
    raise exception 'name chars' using errcode = '22023';
  end if;
  if n = cur then raise exception 'name same' using errcode = '22023'; end if;
  if not p_staff then
    foreach w in array array['운영진', '운영자', '관리자', '바이패스', 'bypass', 'admin', 'staff', '시스템'] loop
      if position(w in k) > 0 then raise exception 'name reserved' using errcode = '22023'; end if;
    end loop;
    last_at := nullif(app ->> 'name_changed_at', '')::timestamptz;
    if last_at is not null and last_at > now() - interval '30 days' then
      raise exception 'name wait %', to_char((last_at + interval '30 days') at time zone 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') using errcode = '22023';
    end if;
  end if;
  if exists (
    select 1 from auth.users u
     where u.id <> p_user
       and (public.bypass_name_norm(u.raw_user_meta_data ->> 'display_name') = k
         or public.bypass_name_norm(coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))) = k)
  ) then
    raise exception 'name taken' using errcode = '23505';
  end if;

  hist := jsonb_build_array(jsonb_build_object('name', cur, 'until', now(), 'by', case when p_staff then 'staff' else 'self' end))
          || coalesce(app -> 'name_history', '[]'::jsonb);
  hist := (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(hist) with ordinality as t(e, i) where i <= 10);

  perform set_config('bypass.name_ok', '1', true);
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', n),
         raw_app_meta_data = app || jsonb_build_object('name_history', hist)
                                 || case when p_staff then '{}'::jsonb else jsonb_build_object('name_changed_at', now()) end
   where id = p_user;
  perform set_config('bypass.name_ok', '', true);

  -- 이미 쓴 것들의 이름도 함께 (내용은 그대로라 '고침' 표시는 붙지 않음)
  update public.posts         set author_name = n where author = p_user and author_name is distinct from n;
  update public.post_comments set author_name = n where author = p_user and author_name is distinct from n;
  update public.notices       set author_name = n where author = p_user and author_name is distinct from n;
  update public.agenda_items  set author_name = n where author = p_user and author_name is distinct from n;
  update public.resources     set author_name = n where author = p_user and author_name is distinct from n;
  if to_regclass('public.user_pages') is not null then
    update public.user_pages set owner_name = n where owner = p_user and owner_name is distinct from n;
  end if;
  return n;
end;
$$;
revoke all on function public.bypass_apply_name(uuid, text, boolean) from public, anon, authenticated;

-- ===== 3) 회원: 내 이름 바꾸기 =====
create or replace function public.change_my_name(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '42501'; end if;
  return public.bypass_apply_name(auth.uid(), p_name, (select public.bypass_role()) = 'staff');
end;
$$;

-- ===== 4) 운영진: 회원 이름 바꾸기 · 예전 이름 보기 =====
create or replace function public.set_member_name(p_user uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  return public.bypass_apply_name(p_user, p_name, true);
end;
$$;

create or replace function public.member_name_history(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select public.bypass_role()) is distinct from 'staff' then raise exception 'staff only' using errcode = '42501'; end if;
  return (select coalesce(u.raw_app_meta_data -> 'name_history', '[]'::jsonb) from auth.users u where u.id = p_user);
end;
$$;

revoke all on function public.change_my_name(text), public.set_member_name(uuid, text), public.member_name_history(uuid) from public, anon;
grant execute on function public.change_my_name(text), public.set_member_name(uuid, text), public.member_name_history(uuid) to authenticated;

-- ===== 5) 몰래 바꾸기 막기 =====
-- 회원은 로그인한 채로 updateUser({ data: { display_name } }) 를 부르면 이름을 바꿀 수 있었다.
-- 이제 위 함수를 거치지 않은 이름·아이디 변경은 원래대로 되돌린다. (가입할 때 정하는 것은 그대로 됨)
-- 문제가 생겨도 로그인이 막히지 않도록, 오류가 나면 아무것도 하지 않고 넘긴다.
create or replace function public.bypass_lock_names()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('bypass.name_ok', true), '') = '1' then return new; end if;
  begin
    if (new.raw_user_meta_data ->> 'display_name') is distinct from (old.raw_user_meta_data ->> 'display_name') then
      new.raw_user_meta_data := case when coalesce(old.raw_user_meta_data ? 'display_name', false)
        then coalesce(new.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', old.raw_user_meta_data -> 'display_name')
        else coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'display_name' end;
    end if;
    if (new.raw_user_meta_data ->> 'username') is distinct from (old.raw_user_meta_data ->> 'username') then
      new.raw_user_meta_data := case when coalesce(old.raw_user_meta_data ? 'username', false)
        then coalesce(new.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', old.raw_user_meta_data -> 'username')
        else coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'username' end;
    end if;
  exception when others then
    return new;
  end;
  return new;
end;
$$;
revoke all on function public.bypass_lock_names() from public, anon, authenticated;

drop trigger if exists bypass_lock_names on auth.users;
create trigger bypass_lock_names before update of raw_user_meta_data on auth.users
  for each row execute function public.bypass_lock_names();

-- 확인: 아래 세 줄이 나오면 끝
select p.proname as "만든 함수" from pg_proc p join pg_namespace s on s.oid = p.pronamespace
 where s.nspname = 'public' and p.proname in ('change_my_name', 'set_member_name', 'member_name_history')
 order by 1;
