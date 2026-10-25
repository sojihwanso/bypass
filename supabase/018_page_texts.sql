-- BYPASS HQ 4단계: 페이지 문구(설치 규정·업무 범위·문의 창구·최종 개정일)
-- 017 다음에 이 파일 전체를 SQL Editor 에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 문구는 010 에서 만든 사이트 설정(site_settings) 표의 'texts' 한 줄에 담깁니다. 새 표는 없습니다.
-- 조문이 길어질 수 있어 설정 한 줄의 크기 제한만 넉넉하게(8KB → 32KB) 늘립니다.

alter table public.site_settings drop constraint if exists site_settings_value_check;
alter table public.site_settings add constraint site_settings_value_check
  check (jsonb_typeof(value) = 'object' and pg_column_size(value) <= 32000);

alter table public.site_settings drop constraint if exists site_settings_texts_shape;
alter table public.site_settings add constraint site_settings_texts_shape check (
  key <> 'texts' or coalesce(
        jsonb_typeof(value -> 'statute') = 'object'
    and jsonb_typeof(value -> 'statute' -> 'articles') = 'array'
    and jsonb_typeof(value -> 'scope') = 'object'
    and jsonb_typeof(value -> 'contact') = 'object'
    and (value -> 'contact' ->> 'url' is null or value -> 'contact' ->> 'url' = '' or value -> 'contact' ->> 'url' ~* '^https://[^\s"<>]+$'),
    false)
);

select conname as "규칙" from pg_constraint where conrelid = 'public.site_settings'::regclass order by 1;
