-- Canonical Service category filter compatibility bridge.
-- Keeps proven discovery ranking/filter RPCs intact while translating stable
-- category_code slugs to the legacy display-label slugs they currently accept.
-- Old label-slug URLs remain compatible as fallback input.

create or replace function public.search_marketplace_service_discovery_candidates_v2(
  target_query text default null,
  target_tokens text[] default '{}'::text[],
  target_category text default 'all',
  target_location text default null,
  target_price text default 'any',
  target_rating text default 'any',
  target_provider text default 'any',
  target_available_now boolean default false,
  target_sort text default 'relevance',
  target_offset integer default 0,
  target_limit integer default 24
)
returns table(
  id uuid, provider_type public.provider_type, professional_id uuid, business_id uuid,
  service_name text, description text, service_location text, duration_minutes integer,
  base_price numeric, currency text, category text, provider_name text, service_area text,
  category_code text, category_group text, category_aliases text[], rating numeric,
  review_count bigint, live_work_mode text, business_shop_state text, relevance_score numeric,
  total_count bigint
)
language sql stable security invoker set search_path=''
as $function$
  select *
  from public.search_marketplace_service_discovery_candidates(
    $1, $2,
    case
      when lower(btrim(coalesce($3,'all')))='all' then 'all'
      else coalesce(
        (
          select trim(both '-' from regexp_replace(lower(tx.category_name),'[^a-z0-9]+','-','g'))
          from public.marketplace_search_taxonomy_public tx
          where replace(lower(tx.category_code),'_','-')=replace(lower(btrim($3)),'_','-')
          limit 1
        ),
        lower(btrim($3))
      )
    end,
    $4,$5,$6,$7,$8,$9,$10,$11
  );
$function$;

create or replace function public.search_marketplace_service_nearby_candidates_v2(
  origin_lat double precision,
  origin_long double precision,
  target_query text default null,
  target_tokens text[] default '{}'::text[],
  target_category text default 'all',
  target_location text default null,
  target_price text default 'any',
  target_rating text default 'any',
  target_provider text default 'any',
  target_available_now boolean default false,
  target_sort text default 'relevance',
  target_near_me boolean default false,
  target_offset integer default 0,
  target_limit integer default 24
)
returns table(
  id uuid, provider_type public.provider_type, professional_id uuid, business_id uuid,
  service_name text, description text, service_location text, duration_minutes integer,
  base_price numeric, currency text, category text, provider_name text, service_area text,
  category_code text, category_group text, category_aliases text[], rating numeric,
  review_count bigint, live_work_mode text, business_shop_state text, distance_band text,
  distance_priority integer, nearby_match_mode text, relevance_score numeric, total_count bigint
)
language sql stable security invoker set search_path=''
as $function$
  select *
  from public.search_marketplace_service_nearby_candidates(
    $1,$2,$3,$4,
    case
      when lower(btrim(coalesce($5,'all')))='all' then 'all'
      else coalesce(
        (
          select trim(both '-' from regexp_replace(lower(tx.category_name),'[^a-z0-9]+','-','g'))
          from public.marketplace_search_taxonomy_public tx
          where replace(lower(tx.category_code),'_','-')=replace(lower(btrim($5)),'_','-')
          limit 1
        ),
        lower(btrim($5))
      )
    end,
    $6,$7,$8,$9,$10,$11,$12,$13,$14
  );
$function$;

create or replace function public.get_marketplace_service_discovery_categories_v2()
returns table(category_slug text, category_name text)
language sql stable security invoker set search_path=''
as $function$
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
  order by category_name,category_slug;
$function$;

revoke all on function public.search_marketplace_service_discovery_candidates_v2(text,text[],text,text,text,text,text,boolean,text,integer,integer) from public,authenticated;
grant execute on function public.search_marketplace_service_discovery_candidates_v2(text,text[],text,text,text,text,text,boolean,text,integer,integer) to anon,service_role;
revoke all on function public.search_marketplace_service_nearby_candidates_v2(double precision,double precision,text,text[],text,text,text,text,text,boolean,text,boolean,integer,integer) from public,authenticated;
grant execute on function public.search_marketplace_service_nearby_candidates_v2(double precision,double precision,text,text[],text,text,text,text,text,boolean,text,boolean,integer,integer) to anon,service_role;
revoke all on function public.get_marketplace_service_discovery_categories_v2() from public,authenticated;
grant execute on function public.get_marketplace_service_discovery_categories_v2() to anon,service_role;
