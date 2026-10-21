-- BYPASS: 운영진이 공사장에서 임시 비밀번호를 발급하는 기능
-- 아이디가 실제 메일 주소가 아니라서(아이디@bypass.invalid) 메일로 비밀번호를 찾을 수 없습니다.
-- 그래서 비밀번호를 잊은 회원에게 운영진이 임시 비밀번호를 만들어 전달합니다.
-- 002_member_admin.sql 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 규칙
--   - 운영진만 발급할 수 있습니다.
--   - 자기 자신, 다른 운영진에게는 발급할 수 없습니다. (운영진 계정을 남이 가로채지 못하도록)
--     운영진이 비밀번호를 잊으면 지금처럼 Supabase 대시보드에서 처리합니다.
--   - 발급받은 회원은 로그인하면 공사장에서 비밀번호를 바꾸라는 안내를 봅니다.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.reset_member_password(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 헷갈리기 쉬운 글자(0 O 1 l I)는 뺀 문자들
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  temp text := '';
  target_role text;
  i int;
begin
  if public.bypass_role() <> 'staff' then
    raise exception '운영진만 발급할 수 있습니다.' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 비밀번호는 공사장 A구역에서 바꾸세요.' using errcode = '42501';
  end if;

  select coalesce(raw_app_meta_data ->> 'bypass_role', 'general') into target_role
    from auth.users where id = p_user;
  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;
  if target_role = 'staff' then
    raise exception '운영진의 비밀번호는 여기서 바꿀 수 없습니다.' using errcode = '42501';
  end if;

  -- 4자-4자 형태의 임시 비밀번호 (예: k7mp-3xra)
  for i in 1..8 loop
    temp := temp || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)), 1);
    if i = 4 then temp := temp || '-'; end if;
  end loop;

  update auth.users
     set encrypted_password = extensions.crypt(temp, extensions.gen_salt('bf')),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb,
         updated_at = now()
   where id = p_user;

  return temp;
end;
$$;

revoke all on function public.reset_member_password(uuid) from public, anon;
grant execute on function public.reset_member_password(uuid) to authenticated;
