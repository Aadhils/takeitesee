create index if not exists services_marketplace_name_trgm_idx on public.services using gin (name extensions.gin_trgm_ops) where active=true and status='active'::public.service_status;
create index if not exists services_marketplace_description_trgm_idx on public.services using gin (description extensions.gin_trgm_ops) where active=true and status='active'::public.service_status and description is not null;
create index if not exists services_marketplace_location_trgm_idx on public.services using gin (location extensions.gin_trgm_ops) where active=true and status='active'::public.service_status and location is not null;
create index if not exists services_marketplace_category_trgm_idx on public.services using gin (category extensions.gin_trgm_ops) where active=true and status='active'::public.service_status and category is not null;
create index if not exists professional_profiles_marketplace_headline_trgm_idx on public.professional_profiles using gin (headline extensions.gin_trgm_ops) where headline is not null;
create index if not exists professional_profiles_marketplace_service_area_trgm_idx on public.professional_profiles using gin (service_area extensions.gin_trgm_ops) where service_area is not null;
create index if not exists reviews_public_service_rating_idx on public.reviews(service_id,rating) where status='published';

create or replace function public.search_marketplace_service_discovery_candidates(
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
  id uuid,
  provider_type public.provider_type,
  professional_id uuid,
  business_id uuid,
  service_name text,
  description text,
  service_location text,
  duration_minutes integer,
  base_price numeric,
  currency text,
  category text,
  provider_name text,
  service_area text,
  category_code text,
  category_group text,
  category_aliases text[],
  rating numeric,
  review_count bigint,
  live_work_mode text,
  business_shop_state text,
  relevance_score numeric,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  query_value text := nullif(lower(regexp_replace(btrim(coalesce(target_query, '')), '\s+', ' ', 'g')), '');
  category_value text := lower(btrim(coalesce(target_category, 'all')));
  location_value text := nullif(lower(regexp_replace(btrim(coalesce(target_location, '')), '\s+', ' ', 'g')), '');
  price_value text := lower(btrim(coalesce(target_price, 'any')));
  rating_value text := lower(btrim(coalesce(target_rating, 'any')));
  provider_value text := lower(btrim(coalesce(target_provider, 'any')));
  sort_value text := lower(btrim(coalesce(target_sort, 'relevance')));
  offset_value integer := greatest(coalesce(target_offset, 0), 0);
  limit_value integer := least(greatest(coalesce(target_limit, 24), 1), 100);
begin
  if price_value not in ('any', 'under-1000', '1000-5000', 'over-5000') then raise exception 'Unsupported service price filter.'; end if;
  if rating_value not in ('any', '4-plus', '4.5-plus') then raise exception 'Unsupported service rating filter.'; end if;
  if provider_value not in ('any', 'professional', 'business') then raise exception 'Unsupported provider filter.'; end if;
  if sort_value not in ('relevance', 'rating', 'price', 'price-desc') then raise exception 'Unsupported service sort mode.'; end if;

  return query
  with review_summary as (
    select r.service_id, avg(r.rating::numeric) as avg_rating, count(*)::bigint as review_count
    from public.reviews r
    group by r.service_id
  ), base as (
    select
      s.id, s.provider_type, s.professional_id, s.business_id,
      s.name as service_name, coalesce(s.description, '') as description,
      coalesce(s.location, '') as service_location,
      s.duration_minutes, s.base_price, s.currency, coalesce(s.category, 'Other') as category,
      case when s.provider_type='business'::public.provider_type then coalesce(b.name, 'Business provider') else coalesce(pp.headline, 'Professional provider') end as provider_name,
      case when s.provider_type='business'::public.provider_type then coalesce(b.location, s.location, '') else coalesce(pp.service_area, s.location, '') end as service_area,
      tx.category_code,
      coalesce(tx.group_name, '') as category_group,
      coalesce(tx.search_aliases, '{}'::text[]) as category_aliases,
      coalesce(rs.avg_rating, 0::numeric) as rating,
      coalesce(rs.review_count, 0::bigint) as review_count,
      case
        when pla.work_mode='available'::public.provider_work_mode and pla.mode_expires_at is not null and pla.mode_expires_at > now() then 'available'
        when pla.work_mode='busy'::public.provider_work_mode and pla.mode_expires_at is not null and pla.mode_expires_at > now() then 'busy'
        when pla.work_mode='paused'::public.provider_work_mode then 'paused'
        else 'offline'
      end as live_work_mode,
      case when s.provider_type='business'::public.provider_type then coalesce(bss.shop_state::text, 'closed') else null end as business_shop_state,
      s.updated_at,
      lower(regexp_replace(btrim(s.name), '\s+', ' ', 'g')) as name_norm,
      lower(regexp_replace(btrim(case when s.provider_type='business'::public.provider_type then coalesce(b.name, '') else coalesce(pp.headline, '') end), '\s+', ' ', 'g')) as provider_norm,
      lower(regexp_replace(btrim(coalesce(s.description, '')), '\s+', ' ', 'g')) as description_norm,
      lower(regexp_replace(btrim(concat_ws(' ', coalesce(s.location, ''), case when s.provider_type='business'::public.provider_type then coalesce(b.location, '') else coalesce(pp.service_area, '') end)), '\s+', ' ', 'g')) as location_norm,
      lower(regexp_replace(btrim(coalesce(s.category, 'Other')), '\s+', ' ', 'g')) as category_norm,
      lower(regexp_replace(btrim(coalesce(tx.group_name, '')), '\s+', ' ', 'g')) as category_group_norm,
      trim(both '-' from regexp_replace(lower(coalesce(s.category, 'other')), '[^a-z0-9]+', '-', 'g')) as category_slug
    from public.services s
    left join public.professional_profiles pp on s.provider_type='professional'::public.provider_type and pp.id=s.professional_id
    left join public.businesses b on s.provider_type='business'::public.provider_type and b.id=s.business_id
    left join public.provider_live_availability pla on pla.provider_type=s.provider_type and ((s.provider_type='professional'::public.provider_type and pla.professional_id=s.professional_id and pla.business_id is null) or (s.provider_type='business'::public.provider_type and pla.business_id=s.business_id and pla.professional_id is null))
    left join public.business_shop_status bss on s.provider_type='business'::public.provider_type and bss.business_id=s.business_id
    left join review_summary rs on rs.service_id=s.id
    left join public.marketplace_search_taxonomy_public tx on lower(regexp_replace(btrim(tx.category_name), '\s+', ' ', 'g'))=lower(regexp_replace(btrim(coalesce(s.category, 'Other')), '\s+', ' ', 'g'))
    where s.active=true and s.status='active'::public.service_status
  ), filtered as (
    select b.*, (
      case when query_value is null then 0 else
        (case when b.name_norm=query_value then 180 when b.name_norm like query_value || '%' then 130 when b.name_norm like '%' || query_value || '%' then 95 else 0 end)
        + (case when b.category_norm=query_value then 90 when b.category_norm like '%' || query_value || '%' then 55 else 0 end)
        + (case when exists(select 1 from unnest(b.category_aliases) a where lower(regexp_replace(btrim(a), '\s+', ' ', 'g'))=query_value) then 88 when exists(select 1 from unnest(b.category_aliases) a where lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) like '%' || query_value || '%') then 52 else 0 end)
        + (case when b.category_group_norm=query_value then 50 when b.category_group_norm like '%' || query_value || '%' then 28 else 0 end)
        + (case when b.provider_norm like '%' || query_value || '%' then 45 else 0 end)
        + (case when b.location_norm like '%' || query_value || '%' then 35 else 0 end)
        + coalesce((select sum(
            (case when b.name_norm like '%' || lower(t) || '%' then 24 else 0 end)
          + (case when b.category_norm like '%' || lower(t) || '%' then 16 else 0 end)
          + (case when exists(select 1 from unnest(b.category_aliases) a where lower(a) like '%' || lower(t) || '%') then 15 else 0 end)
          + (case when b.category_group_norm like '%' || lower(t) || '%' then 6 else 0 end)
          + (case when b.provider_norm like '%' || lower(t) || '%' then 10 else 0 end)
          + (case when b.location_norm like '%' || lower(t) || '%' then 8 else 0 end)
          + (case when b.description_norm like '%' || lower(t) || '%' then 4 else 0 end)
        ) from unnest(coalesce(target_tokens, '{}'::text[])) t where btrim(t)<>''), 0)
      end
      + (case b.live_work_mode when 'available' then 30 when 'busy' then 10 else 0 end)
      + least(b.rating, 5::numeric)*2
      + least(b.review_count, 20::bigint)::numeric*0.25
    )::numeric as relevance_score
    from base b
    where (category_value='all' or b.category_slug=category_value)
      and (location_value is null or b.location_norm like '%' || location_value || '%')
      and (price_value='any'
        or (price_value='under-1000' and b.base_price < 1000)
        or (price_value='1000-5000' and b.base_price >= 1000 and b.base_price <= 5000)
        or (price_value='over-5000' and b.base_price > 5000))
      and (rating_value='any'
        or (rating_value='4-plus' and b.rating >= 4)
        or (rating_value='4.5-plus' and b.rating >= 4.5))
      and (provider_value='any' or b.provider_type::text=provider_value)
      and (not target_available_now or b.live_work_mode='available')
      and (coalesce(cardinality(target_tokens),0)=0 or not exists (
        select 1 from unnest(target_tokens) t
        where btrim(t)<>'' and not (
          b.name_norm like '%' || lower(t) || '%'
          or b.provider_norm like '%' || lower(t) || '%'
          or b.description_norm like '%' || lower(t) || '%'
          or b.location_norm like '%' || lower(t) || '%'
          or b.category_norm like '%' || lower(t) || '%'
          or b.category_group_norm like '%' || lower(t) || '%'
          or exists(select 1 from unnest(b.category_aliases) a where lower(a) like '%' || lower(t) || '%')
        )
      ))
  )
  select
    f.id,f.provider_type,f.professional_id,f.business_id,f.service_name,f.description,f.service_location,
    f.duration_minutes,f.base_price,f.currency,f.category,f.provider_name,f.service_area,f.category_code,
    f.category_group,f.category_aliases,f.rating,f.review_count,f.live_work_mode,f.business_shop_state,
    f.relevance_score,count(*) over()::bigint as total_count
  from filtered f
  order by
    case when sort_value='rating' then f.rating end desc nulls last,
    case when sort_value='price' then f.base_price end asc nulls last,
    case when sort_value='price-desc' then f.base_price end desc nulls last,
    case when sort_value='relevance' then f.relevance_score end desc nulls last,
    case when sort_value='relevance' then f.rating end desc nulls last,
    case when sort_value='relevance' then f.review_count end desc nulls last,
    f.updated_at desc,
    f.id asc
  offset offset_value limit limit_value;
end;
$function$;

revoke all on function public.search_marketplace_service_discovery_candidates(text,text[],text,text,text,text,text,boolean,text,integer,integer) from public, authenticated;
grant execute on function public.search_marketplace_service_discovery_candidates(text,text[],text,text,text,text,text,boolean,text,integer,integer) to anon, service_role;

create or replace function public.get_marketplace_service_discovery_categories()
returns table(category_slug text, category_name text)
language sql
stable
security invoker
set search_path to ''
as $function$
  select distinct
    trim(both '-' from regexp_replace(lower(coalesce(s.category,'other')), '[^a-z0-9]+', '-', 'g')) as category_slug,
    coalesce(s.category,'Other') as category_name
  from public.services s
  where s.active=true and s.status='active'::public.service_status
  order by category_name;
$function$;
revoke all on function public.get_marketplace_service_discovery_categories() from public, authenticated;
grant execute on function public.get_marketplace_service_discovery_categories() to anon, service_role;
