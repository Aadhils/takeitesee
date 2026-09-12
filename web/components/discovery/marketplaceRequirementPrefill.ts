export type MarketplaceRequirementPrefillInput = {
  search: string;
  service: string;
  location: string;
  category: string;
};

function tidy(value: string, maxLength: number) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function buildMarketplaceRequirementHref(input: MarketplaceRequirementPrefillInput) {
  const params = new URLSearchParams({ source: 'explore' });
  const search = tidy(input.search, 180);
  const service = tidy(input.service, 120);
  const category = input.category === 'all' ? '' : tidy(input.category, 120);
  const location = tidy(input.location, 120);
  const servicePrefill = service || category;

  if (search) params.set('search', search);
  if (servicePrefill) params.set('service', servicePrefill);
  if (location) params.set('location', location);
  return `/requirements?${params.toString()}`;
}
