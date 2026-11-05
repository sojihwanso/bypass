-- 해기사 기출 풀이(/apps/cbttest/) 학습 기록 서버 백업 — 로그인 없이 '복구 코드'로 저장·불러오기
-- 023 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- - 기록(오답노트·응시 기록)은 복구 코드(XXXX-XXXX-XXXX, 32^12 경우의 수) 하나에 묶어 저장합니다.
-- - 표에는 코드 원문 대신 SHA-256 해시만 남깁니다.
-- - 표는 누구도 직접 읽거나 쓸 수 없고(RLS on, 정책 없음), 아래 세 함수로만 다룹니다.
--   코드를 아는 사람만 그 기록을 읽고·쓰고·지울 수 있습니다.
-- - 한 코드당 기록 크기는 1.5MB 까지입니다.

create table if not exists public.cbt_sync (
  code_hash  text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cbt_sync enable row level security;
revoke all on public.cbt_sync from anon, authenticated;

-- 코드 형식 검사 + 해시 (내부용)
create or replace function public.cbt_sync_hash(p_code text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare c text := upper(coalesce(p_code, ''));
begin
  if c !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  return encode(sha256(convert_to(c, 'UTF8')), 'hex');
end $$;
revoke all on function public.cbt_sync_hash(text) from public, anon, authenticated;

-- 불러오기: 없으면 null
create or replace function public.cbt_sync_get(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('data', s.data, 'updated_at', s.updated_at)
    from public.cbt_sync s
   where s.code_hash = public.cbt_sync_hash(p_code);
$$;

-- 저장(덮어쓰기): 저장 시각을 돌려줌
create or replace function public.cbt_sync_put(p_code text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare h text := public.cbt_sync_hash(p_code); t timestamptz := now();
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid data' using errcode = '22023';
  end if;
  if octet_length(p_data::text) > 1500000 then
    raise exception 'data too large' using errcode = '54000';
  end if;
  insert into public.cbt_sync as s (code_hash, data, updated_at)
       values (h, p_data, t)
  on conflict (code_hash) do update set data = excluded.data, updated_at = t;
  return t;
end $$;

-- 서버 기록 삭제
create or replace function public.cbt_sync_delete(p_code text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with d as (delete from public.cbt_sync s where s.code_hash = public.cbt_sync_hash(p_code) returning 1)
  select exists(select 1 from d);
$$;

revoke all on function public.cbt_sync_get(text), public.cbt_sync_put(text, jsonb), public.cbt_sync_delete(text) from public;
grant execute on function public.cbt_sync_get(text), public.cbt_sync_put(text, jsonb), public.cbt_sync_delete(text) to anon, authenticated;
