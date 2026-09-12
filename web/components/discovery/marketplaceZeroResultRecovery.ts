export type MarketplaceZeroResultRecoveryMode = 'none' | 'named_location' | 'nearby' | 'query' | 'category' | 'filters';

export type MarketplaceZeroResultRecoveryInput = {
  loading: boolean;
  hasError: boolean;
  resultCount: number;
  queryPresent: boolean;
  locationPresent: boolean;
  categoryPresent: boolean;
  hasNarrowingFilters: boolean;
  otherNarrowingFiltersPresent: boolean;
  preciseNearbyActive: boolean;
};

export type MarketplaceZeroResultRecovery = {
  show: boolean;
  mode: MarketplaceZeroResultRecoveryMode;
  showBroadenLocation: boolean;
  showClearNearby: boolean;
  showClearCategory: boolean;
  showBroadenFilters: boolean;
  showClearQuery: boolean;
};

export function resolveMarketplaceZeroResultRecovery(
  input: MarketplaceZeroResultRecoveryInput,
): MarketplaceZeroResultRecovery {
  const hasRecoveryContext = input.queryPresent
    || input.locationPresent
    || input.categoryPresent
    || input.hasNarrowingFilters
    || input.preciseNearbyActive;
  const show = !input.loading && !input.hasError && input.resultCount === 0 && hasRecoveryContext;

  if (!show) {
    return {
      show: false,
      mode: 'none',
      showBroadenLocation: false,
      showClearNearby: false,
      showClearCategory: false,
      showBroadenFilters: false,
      showClearQuery: false,
    };
  }

  const mode: MarketplaceZeroResultRecoveryMode = input.locationPresent
    ? 'named_location'
    : input.preciseNearbyActive
      ? 'nearby'
      : input.queryPresent
        ? 'query'
        : input.categoryPresent
          ? 'category'
          : 'filters';

  return {
    show: true,
    mode,
    showBroadenLocation: input.locationPresent,
    showClearNearby: input.preciseNearbyActive && !input.locationPresent,
    showClearCategory: mode === 'category',
    showBroadenFilters: mode === 'category' ? input.otherNarrowingFiltersPresent : input.hasNarrowingFilters,
    showClearQuery: mode === 'query',
  };
}
