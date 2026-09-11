-- Product discovery must run in production with only the public Supabase anon key.
-- Keep the candidate search SECURITY INVOKER so existing public RLS remains the
-- authority for Product, Business, and Shop visibility.

DROP POLICY IF EXISTS business_shop_status_public_read ON public.business_shop_status;
CREATE POLICY business_shop_status_public_read
ON public.business_shop_status
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = business_shop_status.business_id
  )
);

CREATE OR REPLACE FUNCTION public.search_business_product_discovery_candidates(
  target_query text DEFAULT NULL::text,
  target_stock text DEFAULT 'any'::text,
  target_shop text DEFAULT 'any'::text,
  target_sort text DEFAULT 'relevance'::text,
  target_offset integer DEFAULT 0,
  target_limit integer DEFAULT 24
)
RETURNS TABLE(
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
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  query_value text := nullif(btrim(coalesce(target_query, '')), '');
  query_pattern text;
  stock_value text := lower(btrim(coalesce(target_stock, 'any')));
  shop_value text := lower(btrim(coalesce(target_shop, 'any')));
  sort_value text := lower(btrim(coalesce(target_sort, 'relevance')));
  offset_value integer := greatest(coalesce(target_offset, 0), 0);
  limit_value integer := least(greatest(coalesce(target_limit, 24), 1), 100);
BEGIN
  IF query_value IS NOT NULL THEN
    query_pattern := '%' || replace(replace(replace(query_value, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  END IF;

  IF stock_value NOT IN ('any', 'orderable', 'in_stock', 'made_to_order') THEN
    RAISE EXCEPTION 'Unsupported product stock filter.';
  END IF;
  IF shop_value NOT IN ('any', 'open') THEN
    RAISE EXCEPTION 'Unsupported Business Shop filter.';
  END IF;
  IF sort_value NOT IN ('relevance', 'price', 'price-desc', 'name') THEN
    RAISE EXCEPTION 'Unsupported product sort mode.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.business_id,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.unit_label,
    p.stock_mode,
    coalesce(s.shop_state, 'closed'::public.business_shop_state) AS business_shop_state
  FROM public.business_products p
  JOIN public.businesses b ON b.id = p.business_id
  LEFT JOIN public.business_shop_status s ON s.business_id = p.business_id
  WHERE (
      stock_value = 'any'
      OR (stock_value = 'orderable' AND p.stock_mode <> 'out_of_stock'::public.business_product_stock_mode)
      OR (stock_value = 'in_stock' AND p.stock_mode = 'in_stock'::public.business_product_stock_mode)
      OR (stock_value = 'made_to_order' AND p.stock_mode = 'made_to_order'::public.business_product_stock_mode)
    )
    AND (
      shop_value = 'any'
      OR (shop_value = 'open' AND coalesce(s.shop_state, 'closed'::public.business_shop_state) = 'open'::public.business_shop_state)
    )
    AND (
      query_pattern IS NULL
      OR p.name ILIKE query_pattern ESCAPE E'\\'
      OR coalesce(p.description, '') ILIKE query_pattern ESCAPE E'\\'
      OR coalesce(b.name, '') ILIKE query_pattern ESCAPE E'\\'
      OR coalesce(b.location, '') ILIKE query_pattern ESCAPE E'\\'
    )
  ORDER BY
    CASE WHEN sort_value = 'relevance' THEN CASE WHEN coalesce(s.shop_state, 'closed'::public.business_shop_state) = 'open'::public.business_shop_state THEN 0 ELSE 1 END END ASC NULLS LAST,
    CASE WHEN sort_value = 'relevance' THEN CASE WHEN p.stock_mode = 'out_of_stock'::public.business_product_stock_mode THEN 1 ELSE 0 END END ASC NULLS LAST,
    CASE WHEN sort_value = 'price' THEN p.price END ASC NULLS LAST,
    CASE WHEN sort_value = 'price-desc' THEN p.price END DESC NULLS LAST,
    lower(p.name) ASC,
    p.id ASC
  OFFSET offset_value
  LIMIT limit_value;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_business_product_discovery_candidates(text, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_business_product_discovery_candidates(text, text, text, text, integer, integer) TO anon, authenticated, service_role;
