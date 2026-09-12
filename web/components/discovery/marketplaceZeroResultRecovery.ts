export type MarketplaceZeroResultRecoveryMode = 'none' | 'named_location' | 'nearby' | 'query' | 'filters';

export type MarketplaceZeroResultRecoveryInput = {
  loading: boolean;
  hasError: boolean;
  resultCount: number;
  queryPresent: boolean;
  locationPresent: boolean;
  hasNarrowingFilters: boolean;
  preciseNearbyActive: boolean;
};

export type MarketplaceZeroResultRecovery = {
  show: boolean;
  mode: MarketplaceZeroResultRecoveryMode;
  showBroadenLocation: boolean;
  showClearNearby: boolean;
  showBroadenFilters: boolean;
};

export function resolveMarketplaceZeroResultRecovery(
  input: MarketplaceZeroResultRecoveryInput,
): MarketplaceZeroResultRecovery {
  const hasRecoveryContext = input.queryPresent
    || input.locationPresent
    || input.hasNarrowingFilters
    || input.preciseNearbyActive;
  const show = !input.loading && !input.hasError && input.resultCount === 0 && hasRecoveryContext;

  if (!show) {
    return {
      show: false,
      mode: 'none',
      showBroadenLocation: false,
      showClearNearby: false,
      showBroadenFilters: false,
    };
  }

  const mode: MarketplaceZeroResultRecoveryMode = input.locationPresent
    ? 'named_location'
    : input.preciseNearbyActive
      ? 'nearby'
      : input.queryPresent
        ? 'query'
        : 'filters';

  return {
    show: true,
    mode,
    showBroadenLocation: input.locationPresent,
    showClearNearby: input.preciseNearbyActive && !input.locationPresent,
    showBroadenFilters: input.hasNarrowingFilters,
  };
}
