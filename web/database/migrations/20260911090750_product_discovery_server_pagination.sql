-- Product Discovery Server Pagination
--
-- Move Business Product customer discovery filtering/pagination to bounded server-side
-- candidate search while preserving anonymous RLS as the final public visibility authority.
-- No Product state is mutated. Finance/Cashfree/payment/refund/payout/settlement/
-- reconciliation/recovery remain untouched and recurrence/recovery stay frozen.

create extension if not exists pg_trgm with schema extensions;

create index if not exists business_products_marketplace_name_trgm_idx
  on public.business_products using gin (name extensions.gin_trgm_ops)
  where status = 'active'::public.business_product_status;

create index if not exists business_products_marketplace_description_trgm_idx
  on public.business_products using gin (description extensions.gin_trgm_ops)
  where status = 'active'::public.business_product_status and description is not null;

create index if not exists businesses_marketplace_name_trgm_idx
  on public.businesses using gin (name extensions.gin_trgm_ops);

create index if not exists businesses_marketplace_location_trgm_idx
  on public.businesses using gin (location extensions.gin_trgm_ops)
  where location is not null;

create or replace function public.search_business_product_discovery_candidates(
  target_query text default null,
  target_stock text default 'any',
  target_shop text default 'any',
  target_sort text default 'relevance',
  target_offset integer default 0,
  target_limit integer default 24
)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  price numeric,
  currency text,
  unit_label text,
  stock_mode public.business_product_stock_mode,
  business_shop_state public.business_shop_state
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  query_value text := nullif(btrim(coalesce(target_query, '')), '');
  stock_value text := lower(btrim(coalesce(target_stock, 'any')));
  shop_value text := lower(btrim(coalesce(target_shop, 'any')));
  sort_value text := lower(btrim(coalesce(target_sort, 'relevance')));
  offset_value integer := greatest(coalesce(target_offset, 0), 0);
  limit_value integer := least(greatest(coalesce(target_limit, 24), 1), 100);
begin
  if stock_value not in ('any', 'orderable', 'in_stock', 'made_to_order') then
    raise exception 'Unsupported product stock filter.';
  end if;
  if shop_value not in ('any', 'open') then
    raise exception 'Unsupported Business Shop filter.';
  end if;
  if sort_value not in ('relevance', 'price', 'price-desc', 'name') then
    raise exception 'Unsupported product sort mode.';
  end if;

  return query
  select
    p.id,
    p.business_id,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.unit_label,
    p.stock_mode,
    coalesce(s.shop_state, 'closed'::public.business_shop_state) as business_shop_state
  from public.business_products p
  join public.businesses b on b.id = p.business_id
  left join public.business_shop_status s on s.business_id = p.business_id
  where p.status = 'active'::public.business_product_status
    and private.business_product_current_revision_is_approved(p.id, p.business_id, p.review_revision)
    and private.provider_owner_is_verified('business', null, p.business_id)
    and private.provider_profile_is_complete('business', null, p.business_id)
    and private.provider_marketplace_disclosure_is_complete('business', null, p.business_id)
    and private.provider_trust_allows_marketplace('business', null, p.business_id)
    and (
      stock_value = 'any'
      or (stock_value = 'orderable' and p.stock_mode <> 'out_of_stock'::public.business_product_stock_mode)
      or (stock_value = 'in_stock' and p.stock_mode = 'in_stock'::public.business_product_stock_mode)
      or (stock_value = 'made_to_order' and p.stock_mode = 'made_to_order'::public.business_product_stock_mode)
    )
    and (
      shop_value = 'any'
      or (shop_value = 'open' and coalesce(s.shop_state, 'closed'::public.business_shop_state) = 'open'::public.business_shop_state)
    )
    and (
      query_value is null
      or p.name ilike ('%' || query_value || '%')
      or coalesce(p.description, '') ilike ('%' || query_value || '%')
      or coalesce(b.name, '') ilike ('%' || query_value || '%')
      or coalesce(b.location, '') ilike ('%' || query_value || '%')
    )
  order by
    case when sort_value = 'relevance' then case when coalesce(s.shop_state, 'closed'::public.business_shop_state) = 'open'::public.business_shop_state then 0 else 1 end end asc nulls last,
    case when sort_value = 'relevance' then case when p.stock_mode = 'out_of_stock'::public.business_product_stock_mode then 1 else 0 end end asc nulls last,
    case when sort_value = 'price' then p.price end asc nulls last,
    case when sort_value = 'price-desc' then p.price end desc nulls last,
    lower(p.name) asc,
    p.id asc
  offset offset_value
  limit limit_value;
end;
$$;

comment on function public.search_business_product_discovery_candidates(text,text,text,text,integer,integer) is
  'Service-role-only bounded Product discovery candidate search. Mirrors public product visibility gates; application code still verifies candidate ids through the anonymous RLS path before returning them to customers.';

revoke all on function public.search_business_product_discovery_candidates(text,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.search_business_product_discovery_candidates(text,text,text,text,integer,integer) to service_role;
