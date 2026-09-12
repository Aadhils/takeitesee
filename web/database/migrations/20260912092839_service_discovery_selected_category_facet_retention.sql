-- Retain a selected approved Service category in discovery facets even when it
-- currently has no live supply. Unfiltered discovery remains live-category-only,
-- and unknown category input is never synthesized into the public facet list.

create or replace function public.get_marketplace_service_discovery_categories_v3(
  target_category text default 'all'
)
returns table(category_slug text, category_name text)
language sql stable security invoker set search_path=''
as $function$
  with active_categories as (
    select distinct
      coalesce(
        nullif(trim(both '-' from regexp_replace(lower(coalesce(tx.category_code,s.category_code,'')),'[^a-z0-9]+','-','g')),''),
        nullif(trim(both '-' from regexp_replace(lower(coalesce(s.category,'other')),'[^a-z0-9]+','-','g')),''),
        'other'
      ) as category_slug,
      coalesce(tx.category_name,s.category,'Other') as category_name
    from public.services s
    left join public.marketplace_search_taxonomy_public tx
      on (s.category_code is not null and lower(tx.category_code)=lower(s.category_code))
      or (s.category_code is null and lower(regexp_replace(btrim(tx.category_name),'\s+',' ','g'))=lower(regexp_replace(btrim(coalesce(s.category,'Other')),'\s+',' ','g')))
    where s.active=true and s.status='active'::public.service_status
  ),
  selected_category as (
    select
      trim(both '-' from regexp_replace(lower(tx.category_code),'[^a-z0-9]+','-','g')) as category_slug,
      tx.category_name as category_name
    from public.marketplace_search_taxonomy_public tx
    where lower(btrim(coalesce($1,'all'))) <> 'all'
      and replace(lower(tx.category_code),'_','-')=replace(lower(btrim($1)),'_','-')
    limit 1
  )
  select categories.category_slug, categories.category_name
  from (
    select * from active_categories
    union
    select * from selected_category
  ) categories
  order by categories.category_name, categories.category_slug;
$function$;

revoke all on function public.get_marketplace_service_discovery_categories_v3(text) from public,authenticated;
grant execute on function public.get_marketplace_service_discovery_categories_v3(text) to anon,service_role;
