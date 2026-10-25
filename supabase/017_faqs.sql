-- BYPASS HQ 4단계: 자주 묻는 질문(faqs)
-- 016 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- - 메인 '자주 묻는 질문'을 HQ › 자주 묻는 질문에서 고칩니다. 숨긴 질문은 운영진에게만 보입니다.
-- - 지금 메인에 있는 4개를 표를 처음 만들 때 한 번만 옮겨 넣습니다.
-- - 답의 줄바꿈은 그대로 메인에 줄바꿈으로 보입니다.

do $$ begin
  if to_regclass('public.faqs') is null then create temp table bypass_seed_faqs (x int); end if;
end $$;

create table if not exists public.faqs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  question    text not null check (char_length(question) between 1 and 200),
  answer      text not null check (char_length(answer) between 1 and 1000),
  hidden      boolean not null default false,
  sort        int not null default 0
);
create index if not exists faqs_sort_idx on public.faqs (sort);

drop trigger if exists faqs_touch on public.faqs;
create trigger faqs_touch before update on public.faqs
  for each row execute function public.bypass_touch_updated_at();

alter table public.faqs enable row level security;
revoke all on public.faqs from anon, authenticated;
grant select on public.faqs to anon, authenticated;
grant insert (question, answer, hidden, sort), update (question, answer, hidden, sort), delete on public.faqs to authenticated;

drop policy if exists "질문: 누구나 읽기" on public.faqs;
create policy "질문: 누구나 읽기" on public.faqs for select to anon, authenticated
  using (not hidden or (select public.bypass_role()) = 'staff');
drop policy if exists "질문: 운영진 추가" on public.faqs;
create policy "질문: 운영진 추가" on public.faqs for insert to authenticated with check ((select public.bypass_role()) = 'staff');
drop policy if exists "질문: 운영진 고치기" on public.faqs;
create policy "질문: 운영진 고치기" on public.faqs for update to authenticated
  using ((select public.bypass_role()) = 'staff') with check ((select public.bypass_role()) = 'staff');
drop policy if exists "질문: 운영진 지우기" on public.faqs;
create policy "질문: 운영진 지우기" on public.faqs for delete to authenticated using ((select public.bypass_role()) = 'staff');

insert into public.faqs (question, answer, sort)
select v.q, v.a, v.s from (values
  ('코딩을 전혀 몰라도 됩니까?', '됩니다. AI와 함께 만드는 방법은 활동하며 함께 익힙니다.', 10),
  ('공식 행정기관입니까?', E'아닙니다. 행정기관도, 정식 동아리도 아닌 그냥 크루입니다.\n진지한 것은 말투뿐입니다.', 20),
  ('어떤 불편을 제보할 수 있습니까?', E'학교생활에서 손으로 반복하는 일이라면 무엇이든 가능합니다.\n단, 제5조에 해당하는 안건은 제외합니다.', 30),
  ('제보하면 반드시 처리됩니까?', E'모든 안건은 심의하나, 모두 처리하지는 않습니다.\n결과는 처리 현황에 공개합니다.', 40)
) as v(q, a, s)
where to_regclass('pg_temp.bypass_seed_faqs') is not null and not exists (select 1 from public.faqs);
drop table if exists pg_temp.bypass_seed_faqs;

select sort as "순서", question as "질문", hidden as "숨김" from public.faqs order by sort, id;
