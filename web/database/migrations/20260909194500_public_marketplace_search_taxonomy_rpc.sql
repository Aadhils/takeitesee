-- Public-safe marketplace taxonomy vocabulary for search suggestions.
--
-- Canonical taxonomy remains in platform_applications/platform_categories under the
-- existing control-plane RLS. This migration maintains a tiny read-only projection
-- containing only fields that are intentionally public for marketplace discovery.
-- Internal category/application IDs and unrelated metadata never enter the projection.
--
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery are untouched.
-- Recurrence/recovery and leaked-password protection remain untouched.

-- Remove the short-lived privileged public RPC shape if it exists in an environment
-- that received the runtime hotfix before this final projection design.
drop function if exists public.get_marketplace_search_taxonomy();

create table if not exists public.marketplace_search_taxonomy_public (
  category_code text primary key,
  category_name text not null,
  group_name text not null,
  search_aliases text[] not null default array[]::text[],
  group_sort_order integer not null default 0,
  category_sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint marketplace_search_taxonomy_public_category_code_not_blank
    check (btrim(category_code) <> ''),
  constraint marketplace_search_taxonomy_public_category_name_not_blank
    check (btrim(category_name) <> ''),
  constraint marketplace_search_taxonomy_public_group_name_not_blank
    check (btrim(group_name) <> '')
);

alter table public.marketplace_search_taxonomy_public enable row level security;

drop policy if exists marketplace_search_taxonomy_public_read
  on public.marketplace_search_taxonomy_public;
create policy marketplace_search_taxonomy_public_read
  on public.marketplace_search_taxonomy_public
  for select
  to anon, authenticated
  using (true);

revoke all on table public.marketplace_search_taxonomy_public
  from public, anon, authenticated;
grant select on table public.marketplace_search_taxonomy_public
  to anon, authenticated;
grant select on table public.marketplace_search_taxonomy_public
  to service_role;

create or replace function private.refresh_marketplace_search_taxonomy_public()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.marketplace_search_taxonomy_public;

  insert into public.marketplace_search_taxonomy_public (
    category_code,
    category_name,
    group_name,
    search_aliases,
    group_sort_order,
    category_sort_order,
    updated_at
  )
  select
    child.code::text,
    child.name::text,
    parent.name::text,
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
    ),
    coalesce(parent.sort_order, 0),
    coalesce(child.sort_order, 0),
    now()
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
end;
$$;

create or replace function private.refresh_marketplace_search_taxonomy_public_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_marketplace_search_taxonomy_public();
  return null;
end;
$$;

revoke all on function private.refresh_marketplace_search_taxonomy_public()
  from public, anon, authenticated;
revoke all on function private.refresh_marketplace_search_taxonomy_public_trigger()
  from public, anon, authenticated;

drop trigger if exists refresh_marketplace_search_taxonomy_after_category_change
  on public.platform_categories;
create trigger refresh_marketplace_search_taxonomy_after_category_change
  after insert or update or delete on public.platform_categories
  for each statement
  execute function private.refresh_marketplace_search_taxonomy_public_trigger();

drop trigger if exists refresh_marketplace_search_taxonomy_after_application_change
  on public.platform_applications;
create trigger refresh_marketplace_search_taxonomy_after_application_change
  after insert or update or delete on public.platform_applications
  for each statement
  execute function private.refresh_marketplace_search_taxonomy_public_trigger();

-- Seed the projection from the current canonical taxonomy.
select private.refresh_marketplace_search_taxonomy_public();

comment on table public.marketplace_search_taxonomy_public is
  'Read-only public projection of active Services leaf taxonomy vocabulary for marketplace search suggestions; source of truth remains the protected canonical taxonomy.';
