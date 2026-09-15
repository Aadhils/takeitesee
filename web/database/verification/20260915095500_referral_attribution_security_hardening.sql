select
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'record_public_referral_attribution';

select
  has_table_privilege('anon','public.referral_attribution_events','SELECT') as anon_can_select,
  has_table_privilege('anon','public.referral_attribution_events','INSERT') as anon_can_insert,
  has_table_privilege('authenticated','public.referral_attribution_events','SELECT') as authenticated_can_select,
  has_table_privilege('authenticated','public.referral_attribution_events','INSERT') as authenticated_can_insert,
  has_table_privilege('service_role','public.referral_attribution_events','INSERT') as service_role_can_insert;

select count(*) as referral_policies
from pg_policies
where schemaname = 'public'
  and tablename = 'referral_attribution_events';

select count(*) as current_attribution_rows
from public.referral_attribution_events;
