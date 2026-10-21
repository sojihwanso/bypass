-- BYPASS: 운영진이 사이트(공사장)에서 회원 구분을 바꾸는 기능
-- 001_reports_applications.sql 을 먼저 실행한 뒤, 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다.
--
-- 규칙
--   - 회원 목록 보기, 회원 구분 바꾸기는 운영진(staff)만 됩니다.
--   - 자기 자신의 구분은 바꿀 수 없습니다. (실수로 운영진 권한을 잃지 않도록)
--   - 바뀐 구분은 그 회원이 다시 로그인하거나, 로그인 정보가 새로 고쳐질 때(최대 1시간) 적용됩니다.

-- ===== 회원 목록 (운영진만) =====
create or replace function public.list_members()
returns table (
  id uuid,
  username text,
  display_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.bypass_role() <> 'staff' then
    raise exception '운영진만 볼 수 있습니다.' using errcode = '42501';
  end if;
  return query
    select u.id,
           coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
           coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
           coalesce(u.raw_app_meta_data ->> 'bypass_role', 'general'),
           u.created_at,
           u.last_sign_in_at
      from auth.users u
     order by u.created_at desc;
end;
$$;

-- ===== 회원 구분 바꾸기 (운영진만) =====
-- p_role: 'general'(일반 회원) | 'member'(부원) | 'staff'(운영진)
create or replace function public.set_member_role(p_user uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.bypass_role() <> 'staff' then
    raise exception '운영진만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if p_role not in ('general', 'member', 'staff') then
    raise exception '알 수 없는 회원 구분입니다: %', p_role using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 자신의 구분은 바꿀 수 없습니다.' using errcode = '42501';
  end if;

  update auth.users
     set raw_app_meta_data = case
           when p_role = 'general' then coalesce(raw_app_meta_data, '{}'::jsonb) - 'bypass_role'
           else coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('bypass_role', p_role)
         end
   where id = p_user;

  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;
  return p_role;
end;
$$;

revoke all on function public.list_members() from public, anon;
revoke all on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.list_members() to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- 합류 신청: 신청자가 로그인한 채로 냈으면 회원 계정과 이어 보이도록 applicant 를 함께 읽는다.
-- (001 에서 이미 운영진 열람 규칙이 있어 따로 바꿀 것은 없음)
