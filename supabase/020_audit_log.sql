-- BYPASS HQ 4단계 마무리: 변경 기록(audit_log)
-- 019 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- - 아래 표가 추가·수정·삭제될 때마다 '누가 · 언제 · 무엇을 · 전/후 값'을 한 줄씩 저절로 남깁니다(트리거).
--     지름길(routes) · 분류(route_lines) · 처리 현황(dockets) · 자주 묻는 질문(faqs) · 공지(notices) · 사이트 설정(site_settings)
-- - 순서만 바꾼 것(sort)과 updated_at 만 바뀐 것은 남기지 않습니다.
-- - 기록은 1개월(31일) 동안 보관하고, 그보다 오래된 것은 새 기록이 쌓일 때 저절로 지웁니다.
-- - 기록은 운영진만 봅니다. 기록을 직접 쓰거나 고치는 길은 없습니다(트리거만 씀).
-- - 제보·합류 신청은 연락처 같은 개인 정보가 있어 기록하지 않습니다.

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_name  text,
  tbl         text not null,
  row_key     text not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  old_row     jsonb,
  new_row     jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_row_idx on public.audit_log (tbl, row_key);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists "변경 기록: 운영진 보기" on public.audit_log;
create policy "변경 기록: 운영진 보기" on public.audit_log for select to authenticated
  using ((select public.bypass_role()) = 'staff');

create or replace function public.bypass_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  k text := coalesce(r ->> 'id', r ->> 'key');
  who uuid := auth.uid();
  nm text;
begin
  -- 순서·고친 시각만 바뀐 것은 남기지 않는다
  if tg_op = 'UPDATE' and (o - 'sort' - 'updated_at') = (n - 'sort' - 'updated_at') then
    return null;
  end if;
  if who is not null then
    select coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))
      into nm from auth.users u where u.id = who;
  end if;
  insert into public.audit_log (actor, actor_name, tbl, row_key, action, old_row, new_row)
  values (who, coalesce(nm, case when who is null then 'SQL·시스템' else '알 수 없음' end), tg_table_name, k, lower(tg_op), o, n);
  -- 1개월 지난 기록 정리 (가끔만)
  if random() < 0.05 then
    delete from public.audit_log where at < now() - interval '31 days';
  end if;
  return null;
end;
$$;
revoke all on function public.bypass_audit() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['routes', 'route_lines', 'dockets', 'faqs', 'notices', 'site_settings'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists bypass_audit on public.%I', t);
      execute format('create trigger bypass_audit after insert or update or delete on public.%I for each row execute function public.bypass_audit()', t);
    end if;
  end loop;
end $$;

select tgrelid::regclass as "기록하는 표" from pg_trigger where tgname = 'bypass_audit' order by 1;
