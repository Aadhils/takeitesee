select
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'referral_attribution_events';

select
  has_table_privilege('anon','public.referral_attribution_events','SELECT') as anon_can_select,
  has_table_privilege('anon','public.referral_attribution_events','INSERT') as anon_can_insert,
  has_table_privilege('authenticated','public.referral_attribution_events','SELECT') as authenticated_can_select,
  has_table_privilege('authenticated','public.referral_attribution_events','INSERT') as authenticated_can_insert;

select
  has_function_privilege('anon','public.record_public_referral_attribution(text,text,uuid,text)','EXECUTE') as anon_can_record,
  has_function_privilege('authenticated','public.record_public_referral_attribution(text,text,uuid,text)','EXECUTE') as authenticated_can_record;

select column_name
from information_schema.columns
where table_schema='public' and table_name='referral_attribution_events'
order by ordinal_position;

select count(*) as current_attribution_rows
from public.referral_attribution_events;
