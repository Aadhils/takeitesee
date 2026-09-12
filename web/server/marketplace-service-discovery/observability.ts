import type {
  MarketplaceServiceNearbySortMode,
  MarketplaceServiceNormalSortMode,
  MarketplaceServicePriceFilter,
  MarketplaceServiceProviderFilter,
  MarketplaceServiceRatingFilter,
} from './requestParsing';

type MarketplaceServiceSearchMode = 'normal' | 'nearby';
type MarketplaceServiceGeoStatus = 'not_requested' | 'ready' | 'unavailable';
type MarketplaceServiceSortMode = MarketplaceServiceNormalSortMode | MarketplaceServiceNearbySortMode;

type MarketplaceServiceSearchObservationInput = {
  mode: MarketplaceServiceSearchMode;
  queryPresent: boolean;
  queryTokenCount: number;
  locationPresent: boolean;
  categoryFilterApplied: boolean;
  price: MarketplaceServicePriceFilter;
  rating: MarketplaceServiceRatingFilter;
  provider: MarketplaceServiceProviderFilter;
  availableNow: boolean;
  sort: MarketplaceServiceSortMode;
  cursor: number;
  limit: number;
  returnedCount: number;
  total: number;
  hasMore: boolean;
  geoStatus: MarketplaceServiceGeoStatus;
  nearMe: boolean;
  fallbackUsed: boolean;
  durationMs: number;
};

function boundedObservationInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

export function buildMarketplaceServiceSearchObservation(input: MarketplaceServiceSearchObservationInput) {
  const total = boundedObservationInteger(input.total, 0, 1_000_000_000);

  return {
    event: 'marketplace_service_search',
    schema_version: 1,
    mode: input.mode,
    query_present: input.queryPresent,
    query_token_count: boundedObservationInteger(input.queryTokenCount, 0, 64),
    location_present: input.locationPresent,
    category_filter_applied: input.categoryFilterApplied,
    price_filter: input.price,
    rating_filter: input.rating,
    provider_filter: input.provider,
    availability_now: input.availableNow,
    sort: input.sort,
    first_page: input.cursor === 0,
    page_limit: boundedObservationInteger(input.limit, 1, 48),
    returned_count: boundedObservationInteger(input.returnedCount, 0, 48),
    total_count: total,
    zero_result: total === 0,
    has_more: input.hasMore,
    geo_status: input.geoStatus,
    near_me: input.nearMe,
    geo_fallback_used: input.fallbackUsed,
    duration_ms: boundedObservationInteger(input.durationMs, 0, 600_000),
  } as const;
}

export function emitMarketplaceServiceSearchObservation(input: MarketplaceServiceSearchObservationInput) {
  console.info('[marketplace-service-search]', JSON.stringify(buildMarketplaceServiceSearchObservation(input)));
}
