-- Scalable precise-nearby Service discovery without exposing raw coordinates.
--
-- Public search remains anonymous-RLS governed. Precise geo storage stays private.
-- A non-exposed internal SECURITY DEFINER resolver returns only service id + derived
-- distance inputs to the public SECURITY INVOKER search function. The public RPC
-- returns coarse distance bands/priorities only and remains unavailable to the
-- authenticated role directly.

create schema if not exists marketplace_internal;
revoke all on schema marketplace_internal from public, authenticated;
grant usage on schema marketplace_internal to anon, service_role;

create index if not exists service_fulfillment_modes_mode_active_service_idx
  on public.service_fulfillment_modes(mode,active,service_id);

create or replace function marketplace_internal.resolve_service_geo_distances(
  origin_lat double precision,
  origin_long double precision
)
returns table(
  service_id uuid,
  distance_meters double precision,
  match_mode public.marketplace_service_fulfillment_mode
)
language sql
stable
security definer
set search_path=''
as $$
  with origin as (
    select extensions.st_point(origin_long, origin_lat)::extensions.geography as point
    where origin_lat between -90 and 90 and origin_long between -180 and 180
  ),
  valid_live as (
    select pl.provider_type, pl.professional_id, pl.business_id, pl.point
    from public.provider_live_locations pl
    where pl.matching_enabled=true and pl.expires_at is not null and pl.expires_at>now()
  ),
  candidates as (
    select m.service_id, extensions.st_distance(g.point,o.point) as distance_meters,
           m.mode as match_mode, 1 as source_priority, m.max_travel_distance_meters
    from public.service_fulfillment_modes m
    join public.service_geo_locations g on g.service_id=m.service_id and g.role='service_site'::public.service_geo_location_role and g.active=true
    cross join origin o
    where m.active=true and m.mode='at_provider'::public.marketplace_service_fulfillment_mode

    union all

    select m.service_id, extensions.st_distance(pl.point,o.point), m.mode, 0, m.max_travel_distance_meters
    from public.service_fulfillment_modes m
    join public.services s on s.id=m.service_id
    join valid_live pl on pl.provider_type=s.provider_type and (
      (s.provider_type='professional'::public.provider_type and pl.professional_id=s.professional_id and pl.business_id is null)
      or (s.provider_type='business'::public.provider_type and pl.business_id=s.business_id and pl.professional_id is null)
    )
    cross join origin o
    where m.active=true and m.mode='at_customer'::public.marketplace_service_fulfillment_mode

    union all

    select m.service_id, extensions.st_distance(g.point,o.point), m.mode, 2, m.max_travel_distance_meters
    from public.service_fulfillment_modes m
    join public.services s on s.id=m.service_id
    join public.service_geo_locations g on g.service_id=m.service_id and g.role='mobile_base'::public.service_geo_location_role and g.active=true
    cross join origin o
    where m.active=true and m.mode='at_customer'::public.marketplace_service_fulfillment_mode
      and not exists (
        select 1 from valid_live pl
        where pl.provider_type=s.provider_type and (
          (s.provider_type='professional'::public.provider_type and pl.professional_id=s.professional_id and pl.business_id is null)
          or (s.provider_type='business'::public.provider_type and pl.business_id=s.business_id and pl.professional_id is null)
        )
      )
  ), eligible as (
    select * from candidates c
    where c.max_travel_distance_meters is null
       or c.match_mode<>'at_customer'::public.marketplace_service_fulfillment_mode
       or c.distance_meters<=c.max_travel_distance_meters
  )
  select distinct on (e.service_id) e.service_id,e.distance_meters,e.match_mode
  from eligible e
  order by e.service_id,e.distance_meters asc,e.source_priority asc;
$$;
revoke all on function marketplace_internal.resolve_service_geo_distances(double precision,double precision) from public, authenticated;
grant execute on function marketplace_internal.resolve_service_geo_distances(double precision,double precision) to anon, service_role;

create or replace function public.search_marketplace_service_nearby_candidates(
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
  distance_band text,
  distance_priority integer,
  nearby_match_mode text,
  relevance_score numeric,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  query_value text := nullif(lower(regexp_replace(btrim(coalesce(target_query,'')),'\s+',' ','g')),'');
  category_value text := lower(btrim(coalesce(target_category,'all')));
  location_value text := nullif(lower(regexp_replace(btrim(coalesce(target_location,'')),'\s+',' ','g')),'');
  price_value text := lower(btrim(coalesce(target_price,'any')));
  rating_value text := lower(btrim(coalesce(target_rating,'any')));
  provider_value text := lower(btrim(coalesce(target_provider,'any')));
  sort_value text := lower(btrim(coalesce(target_sort,'relevance')));
  offset_value integer := greatest(coalesce(target_offset,0),0);
  limit_value integer := least(greatest(coalesce(target_limit,24),1),100);
begin
  if origin_lat not between -90 and 90 or origin_long not between -180 and 180 then raise exception 'Invalid marketplace origin.'; end if;
  if price_value not in ('any','under-1000','1000-5000','over-5000') then raise exception 'Unsupported service price filter.'; end if;
  if rating_value not in ('any','4-plus','4.5-plus') then raise exception 'Unsupported service rating filter.'; end if;
  if provider_value not in ('any','professional','business') then raise exception 'Unsupported provider filter.'; end if;
  if sort_value not in ('relevance','nearest','rating','price','price-desc') then raise exception 'Unsupported service sort mode.'; end if;

  return query
  with review_summary as (
    select r.service_id,avg(r.rating::numeric) as avg_rating,count(*)::bigint as review_count
    from public.reviews r group by r.service_id
  ), geo as (
    select g.service_id,g.distance_meters,g.match_mode,
      case when g.distance_meters<=1000 then 'under_1km' when g.distance_meters<=3000 then '1_3km' when g.distance_meters<=7000 then '3_7km' when g.distance_meters<=15000 then '7_15km' when g.distance_meters<=30000 then '15_30km' when g.distance_meters<=60000 then '30_60km' else 'over_60km' end as distance_band,
      case when g.distance_meters<=1000 then 24 when g.distance_meters<=3000 then 20 when g.distance_meters<=7000 then 16 when g.distance_meters<=15000 then 12 when g.distance_meters<=30000 then 8 when g.distance_meters<=60000 then 4 else 1 end as distance_priority
    from marketplace_internal.resolve_service_geo_distances(origin_lat,origin_long) g
  ), base as (
    select s.id,s.provider_type,s.professional_id,s.business_id,s.name as service_name,coalesce(s.description,'') as description,
      coalesce(s.location,'') as service_location,s.duration_minutes,s.base_price,s.currency,coalesce(s.category,'Other') as category,
      case when s.provider_type='business'::public.provider_type then coalesce(b.name,'Business provider') else coalesce(pp.headline,'Professional provider') end as provider_name,
      case when s.provider_type='business'::public.provider_type then coalesce(b.location,s.location,'') else coalesce(pp.service_area,s.location,'') end as service_area,
      tx.category_code,coalesce(tx.group_name,'') as category_group,coalesce(tx.search_aliases,'{}'::text[]) as category_aliases,
      coalesce(rs.avg_rating,0::numeric) as rating,coalesce(rs.review_count,0::bigint) as review_count,
      case when pla.work_mode='available'::public.provider_work_mode and pla.mode_expires_at is not null and pla.mode_expires_at>now() then 'available'
           when pla.work_mode='busy'::public.provider_work_mode and pla.mode_expires_at is not null and pla.mode_expires_at>now() then 'busy'
           when pla.work_mode='paused'::public.provider_work_mode then 'paused' else 'offline' end as live_work_mode,
      case when s.provider_type='business'::public.provider_type then coalesce(bss.shop_state::text,'closed') else null end as business_shop_state,
      g.distance_band,g.distance_priority,g.match_mode::text as nearby_match_mode,s.updated_at,
      lower(regexp_replace(btrim(s.name),'\s+',' ','g')) as name_norm,
      lower(regexp_replace(btrim(case when s.provider_type='business'::public.provider_type then coalesce(b.name,'') else coalesce(pp.headline,'') end),'\s+',' ','g')) as provider_norm,
      lower(regexp_replace(btrim(coalesce(s.description,'')),'\s+',' ','g')) as description_norm,
      lower(regexp_replace(btrim(concat_ws(' ',coalesce(s.location,''),case when s.provider_type='business'::public.provider_type then coalesce(b.location,'') else coalesce(pp.service_area,'') end)),'\s+',' ','g')) as location_norm,
      lower(regexp_replace(btrim(coalesce(s.category,'Other')),'\s+',' ','g')) as category_norm,
      lower(regexp_replace(btrim(coalesce(tx.group_name,'')),'\s+',' ','g')) as category_group_norm,
      trim(both '-' from regexp_replace(lower(coalesce(s.category,'other')),'[^a-z0-9]+','-','g')) as category_slug
    from public.services s
    left join public.professional_profiles pp on s.provider_type='professional'::public.provider_type and pp.id=s.professional_id
    left join public.businesses b on s.provider_type='business'::public.provider_type and b.id=s.business_id
    left join public.provider_live_availability pla on pla.provider_type=s.provider_type and ((s.provider_type='professional'::public.provider_type and pla.professional_id=s.professional_id and pla.business_id is null) or (s.provider_type='business'::public.provider_type and pla.business_id=s.business_id and pla.professional_id is null))
    left join public.business_shop_status bss on s.provider_type='business'::public.provider_type and bss.business_id=s.business_id
    left join review_summary rs on rs.service_id=s.id
    left join public.marketplace_search_taxonomy_public tx on lower(regexp_replace(btrim(tx.category_name),'\s+',' ','g'))=lower(regexp_replace(btrim(coalesce(s.category,'Other')),'\s+',' ','g'))
    left join geo g on g.service_id=s.id
    where s.active=true and s.status='active'::public.service_status
  ), filtered as (
    select b.*, (
      case when query_value is null then 0 else
        (case when b.name_norm=query_value then 180 when b.name_norm like query_value||'%' then 130 when b.name_norm like '%'||query_value||'%' then 95 else 0 end)
        +(case when b.category_norm=query_value then 90 when b.category_norm like '%'||query_value||'%' then 55 else 0 end)
        +(case when exists(select 1 from unnest(b.category_aliases) a where lower(regexp_replace(btrim(a),'\s+',' ','g'))=query_value) then 88 when exists(select 1 from unnest(b.category_aliases) a where lower(regexp_replace(btrim(a),'\s+',' ','g')) like '%'||query_value||'%') then 52 else 0 end)
        +(case when b.category_group_norm=query_value then 50 when b.category_group_norm like '%'||query_value||'%' then 28 else 0 end)
        +(case when b.provider_norm like '%'||query_value||'%' then 45 else 0 end)
        +(case when b.location_norm like '%'||query_value||'%' then 35 else 0 end)
        +coalesce((select sum((case when b.name_norm like '%'||lower(t)||'%' then 24 else 0 end)+(case when b.category_norm like '%'||lower(t)||'%' then 16 else 0 end)+(case when exists(select 1 from unnest(b.category_aliases) a where lower(a) like '%'||lower(t)||'%') then 15 else 0 end)+(case when b.category_group_norm like '%'||lower(t)||'%' then 6 else 0 end)+(case when b.provider_norm like '%'||lower(t)||'%' then 10 else 0 end)+(case when b.location_norm like '%'||lower(t)||'%' then 8 else 0 end)+(case when b.description_norm like '%'||lower(t)||'%' then 4 else 0 end)) from unnest(coalesce(target_tokens,'{}'::text[])) t where btrim(t)<>''),0)
      end
      +(case b.live_work_mode when 'available' then 30 when 'busy' then 10 else 0 end)
      +(case when b.distance_priority is null then 0 when target_near_me then least(30,round(b.distance_priority*1.25)::integer) else b.distance_priority end)
      +least(b.rating,5::numeric)*2+least(b.review_count,20::bigint)::numeric*0.25
    )::numeric as relevance_score
    from base b
    where (category_value='all' or b.category_slug=category_value)
      and (location_value is null or b.location_norm like '%'||location_value||'%')
      and (price_value='any' or (price_value='under-1000' and b.base_price<1000) or (price_value='1000-5000' and b.base_price>=1000 and b.base_price<=5000) or (price_value='over-5000' and b.base_price>5000))
      and (rating_value='any' or (rating_value='4-plus' and b.rating>=4) or (rating_value='4.5-plus' and b.rating>=4.5))
      and (provider_value='any' or b.provider_type::text=provider_value)
      and (not target_available_now or b.live_work_mode='available')
      and (coalesce(cardinality(target_tokens),0)=0 or not exists (select 1 from unnest(target_tokens) t where btrim(t)<>'' and not (b.name_norm like '%'||lower(t)||'%' or b.provider_norm like '%'||lower(t)||'%' or b.description_norm like '%'||lower(t)||'%' or b.location_norm like '%'||lower(t)||'%' or b.category_norm like '%'||lower(t)||'%' or b.category_group_norm like '%'||lower(t)||'%' or exists(select 1 from unnest(b.category_aliases) a where lower(a) like '%'||lower(t)||'%'))))
  )
  select f.id,f.provider_type,f.professional_id,f.business_id,f.service_name,f.description,f.service_location,f.duration_minutes,f.base_price,f.currency,f.category,f.provider_name,f.service_area,f.category_code,f.category_group,f.category_aliases,f.rating,f.review_count,f.live_work_mode,f.business_shop_state,f.distance_band,coalesce(f.distance_priority,0),f.nearby_match_mode,f.relevance_score,count(*) over()::bigint
  from filtered f
  order by
    case when sort_value='nearest' then coalesce(f.distance_priority,0) end desc,
    case when sort_value='nearest' then case f.live_work_mode when 'available' then 3 when 'busy' then 1 else 0 end end desc,
    case when sort_value='nearest' then f.relevance_score end desc,
    case when sort_value='nearest' then f.rating end desc,
    case when sort_value='nearest' then f.review_count end desc,
    case when sort_value='rating' then f.rating end desc nulls last,
    case when sort_value='price' then f.base_price end asc nulls last,
    case when sort_value='price-desc' then f.base_price end desc nulls last,
    case when sort_value='relevance' then f.relevance_score end desc nulls last,
    case when sort_value='relevance' then f.rating end desc nulls last,
    case when sort_value='relevance' then f.review_count end desc nulls last,
    f.updated_at desc,f.id asc
  offset offset_value limit limit_value;
end;
$$;
revoke all on function public.search_marketplace_service_nearby_candidates(double precision,double precision,text,text[],text,text,text,text,text,boolean,text,boolean,integer,integer) from public, authenticated;
grant execute on function public.search_marketplace_service_nearby_candidates(double precision,double precision,text,text[],text,text,text,text,text,boolean,text,boolean,integer,integer) to anon, service_role;
