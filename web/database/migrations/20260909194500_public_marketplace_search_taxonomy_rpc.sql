-- Public-safe marketplace taxonomy vocabulary for search suggestions.
--
-- The underlying SaaS control-plane tables remain protected by their existing RLS.
-- This RPC exposes only active Services leaf category code/name, parent group name,
-- and governed search aliases. Internal category/application IDs and unrelated
-- category metadata are never returned.
--
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery are untouched.
-- Recurrence/recovery and leaked-password protection remain untouched.

create or replace function public.get_marketplace_search_taxonomy()
returns table (
  category_code text,
  category_name text,
  group_name text,
  search_aliases text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    child.code::text as category_code,
    child.name::text as category_name,
    parent.name::text as group_name,
    coalesce(
      array(
        select alias_value
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(child.metadata -> 'search_aliases') = 'array'
              then child.metadata -> 'search_aliases'
            else '[]'::jsonb
          end
        ) with ordinality as alias_row(alias_value, alias_order)
        where btrim(alias_value) <> ''
        order by alias_order
        limit 40
      ),
      array[]::text[]
    ) as search_aliases
  from public.platform_categories as child
  join public.platform_categories as parent
    on parent.id = child.parent_id
   and parent.application_id = child.application_id
   and parent.active = true
  join public.platform_applications as application
    on application.id = child.application_id
   and application.code = 'services'
   and application.status = 'active'
  where child.active = true
    and child.parent_id is not null
    and child.code is not null
    and btrim(child.code) <> ''
    and child.name is not null
    and btrim(child.name) <> ''
  order by parent.sort_order, parent.name, child.sort_order, child.name;
$$;

revoke all on function public.get_marketplace_search_taxonomy()
  from public;
grant execute on function public.get_marketplace_search_taxonomy()
  to anon, authenticated, service_role;

comment on function public.get_marketplace_search_taxonomy() is
  'Public-safe active Services leaf taxonomy vocabulary for marketplace search suggestions; exposes no internal IDs or unrelated metadata.';
