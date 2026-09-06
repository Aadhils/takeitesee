-- Read-only verification for public identity handle foundation.

select
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon','public.identity_handles','SELECT') as anon_select,
  has_table_privilege('anon','public.identity_handles','INSERT') as anon_insert,
  has_table_privilege('authenticated','public.identity_handles','INSERT') as authenticated_insert
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='identity_handles';

select indexname,indexdef
from pg_indexes
where schemaname='public'
  and tablename='identity_handles'
order by indexname;

select
  has_function_privilege('anon','public.set_my_identity_handle(text,text)','EXECUTE') as anon_can_claim,
  has_function_privilege('authenticated','public.set_my_identity_handle(text,text)','EXECUTE') as authenticated_can_claim,
  has_function_privilege('anon','public.resolve_public_identity_handle(text)','EXECUTE') as anon_can_resolve,
  has_function_privilege('authenticated','public.resolve_public_identity_handle(text)','EXECUTE') as authenticated_can_resolve;

select
  public.normalize_identity_handle('@ABC Supermarket') as normalized_business,
  public.normalize_identity_handle('  @Shakthi__Pro  ') as normalized_professional,
  public.is_reserved_identity_handle('admin') as admin_reserved,
  public.is_reserved_identity_handle('aadhil') as aadhil_reserved;

select handle,identity_type,identity_id,is_current,retired_at
from public.identity_handles
order by created_at desc
limit 20;
