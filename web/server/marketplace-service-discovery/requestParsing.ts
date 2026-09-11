export const marketplaceServiceDefaultPageSize = 24;
export const marketplaceServiceMaxPageSize = 48;

export const marketplaceServicePriceFilters = ['any', 'under-1000', '1000-5000', 'over-5000'] as const;
export const marketplaceServiceRatingFilters = ['any', '4-plus', '4.5-plus'] as const;
export const marketplaceServiceProviderFilters = ['any', 'professional', 'business'] as const;
export const marketplaceServiceNormalSortModes = ['relevance', 'rating', 'price', 'price-desc'] as const;
export const marketplaceServiceNearbySortModes = ['relevance', 'nearest', 'rating', 'price', 'price-desc'] as const;

export type MarketplaceServicePriceFilter = typeof marketplaceServicePriceFilters[number];
export type MarketplaceServiceRatingFilter = typeof marketplaceServiceRatingFilters[number];
export type MarketplaceServiceProviderFilter = typeof marketplaceServiceProviderFilters[number];
export type MarketplaceServiceNormalSortMode = typeof marketplaceServiceNormalSortModes[number];
export type MarketplaceServiceNearbySortMode = typeof marketplaceServiceNearbySortModes[number];

function marketplaceServiceStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeMarketplaceServiceQuery(value: unknown) {
  return marketplaceServiceStringValue(value).trim().slice(0, 180);
}

export function normalizeMarketplaceServiceCategory(value: unknown) {
  return marketplaceServiceStringValue(value, 'all').trim().slice(0, 120) || 'all';
}

export function normalizeMarketplaceServiceLocation(value: unknown) {
  return marketplaceServiceStringValue(value)
    .trim()
    .slice(0, 120)
    .replace(/[%_\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMarketplaceServiceFilter<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T | null {
  if (value == null || value === '') return fallback;
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : null;
}

export function boundedMarketplaceServiceInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = typeof value === 'number'
    ? Math.trunc(value)
    : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}
