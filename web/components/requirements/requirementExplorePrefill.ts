export type RequirementExploreContext = {
  sourceExplore: boolean;
  rawSearch: string;
  explicitService: string;
  explicitLocation: string;
};

function tidy(value: string, maxLength: number) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function resolveRequirementExploreContext(
  currentUrl: string,
  referrerUrl?: string,
): RequirementExploreContext {
  const current = new URL(currentUrl);
  let sourceExplore = current.searchParams.get('source') === 'explore';
  let rawSearch = tidy(current.searchParams.get('search') || current.searchParams.get('q') || '', 180);
  let explicitService = tidy(current.searchParams.get('service') || '', 120);
  let explicitLocation = tidy(current.searchParams.get('location') || '', 120);

  if (referrerUrl) {
    try {
      const referrer = new URL(referrerUrl);
      if (referrer.origin === current.origin && referrer.pathname === '/explore') {
        sourceExplore = true;
        if (!rawSearch) rawSearch = tidy(referrer.searchParams.get('q') || '', 180);
        if (!explicitLocation) explicitLocation = tidy(referrer.searchParams.get('location') || '', 120);
        if (!explicitService) {
          const category = tidy(referrer.searchParams.get('category') || '', 120);
          if (category && category !== 'all') explicitService = category;
        }
      }
    } catch {
      // Referrer enrichment is optional; explicit requirement parameters remain authoritative.
    }
  }

  return { sourceExplore, rawSearch, explicitService, explicitLocation };
}
