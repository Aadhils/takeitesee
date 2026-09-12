import type {
  MarketplaceServiceNearbySortMode,
  MarketplaceServiceNormalSortMode,
  MarketplaceServicePriceFilter,
  MarketplaceServiceProviderFilter,
  MarketplaceServiceRatingFilter,
} from './requestParsing';

type MarketplaceServiceRpcSort = MarketplaceServiceNormalSortMode | MarketplaceServiceNearbySortMode;

type MarketplaceServiceDiscoveryRpcInput = {
  semanticQuery: string;
  queryTokens: string[];
  category: string;
  location: string;
  price: MarketplaceServicePriceFilter;
  rating: MarketplaceServiceRatingFilter;
  provider: MarketplaceServiceProviderFilter;
  availableNow: boolean;
  sort: MarketplaceServiceRpcSort;
  cursor: number;
  limit: number;
};

type MarketplaceServiceNearbyRpcInput = MarketplaceServiceDiscoveryRpcInput & {
  origin: {
    latitude: number;
    longitude: number;
  };
  nearMe: boolean;
};

export function buildMarketplaceServiceDiscoveryRpcArgs(input: MarketplaceServiceDiscoveryRpcInput) {
  return {
    target_query: input.semanticQuery || null,
    target_tokens: input.queryTokens,
    target_category: input.category,
    target_location: input.location || null,
    target_price: input.price,
    target_rating: input.rating,
    target_provider: input.provider,
    target_available_now: input.availableNow,
    target_sort: input.sort,
    target_offset: input.cursor,
    target_limit: input.limit + 1,
  };
}

export function buildMarketplaceServiceNearbyRpcArgs(input: MarketplaceServiceNearbyRpcInput) {
  return {
    origin_lat: input.origin.latitude,
    origin_long: input.origin.longitude,
    ...buildMarketplaceServiceDiscoveryRpcArgs(input),
    target_near_me: input.nearMe,
  };
}
