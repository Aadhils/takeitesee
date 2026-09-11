const distanceBands = new Set([
  'under_1km',
  '1_3km',
  '3_7km',
  '7_15km',
  '15_30km',
  '30_60km',
  'over_60km',
]);
const nearbyMatchModes = new Set(['at_provider', 'at_customer']);

export type MarketplaceServiceDiscoveryCandidateRow = {
  id: string;
  provider_type: 'professional' | 'business';
  professional_id: string | null;
  business_id: string | null;
  service_name: string;
  description: string | null;
  service_location: string | null;
  duration_minutes: number | null;
  base_price: number | string | null;
  currency: string | null;
  category: string | null;
  provider_name: string | null;
  service_area: string | null;
  category_code: string | null;
  category_group: string | null;
  category_aliases: string[] | null;
  rating: number | string | null;
  review_count: number | string | null;
  live_work_mode: 'available' | 'busy' | 'offline' | 'paused' | null;
  business_shop_state: 'open' | 'closed' | null;
  distance_band?: string | null;
  distance_priority?: number | string | null;
  nearby_match_mode?: string | null;
  total_count: number | string | null;
};

type MappingOptions = {
  nearby: boolean;
};

function categorySlug(category: string) {
  return category.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'other';
}

function canonicalCategorySlug(code: unknown, fallbackName: string) {
  const value = String(code ?? '').trim().toLocaleLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return value || categorySlug(fallbackName);
}

function availabilityLabel(mode: MarketplaceServiceDiscoveryCandidateRow['live_work_mode']) {
  if (mode === 'available') return 'Available now';
  if (mode === 'busy') return 'Busy now';
  if (mode === 'paused') return 'Paused';
  return 'Offline';
}

function nearbyDistanceFields(row: MarketplaceServiceDiscoveryCandidateRow, nearby: boolean) {
  if (!nearby) {
    return {
      distance_band: null,
      distance_priority: 0,
      nearby_match_mode: null,
    };
  }

  const rawDistancePriority = Number(row.distance_priority ?? 0);
  const distancePriority = Number.isFinite(rawDistancePriority)
    ? Math.min(Math.max(Math.trunc(rawDistancePriority), 0), 24)
    : 0;
  const distanceBand = distanceBands.has(String(row.distance_band ?? '')) ? String(row.distance_band) : null;
  const nearbyMatchMode = nearbyMatchModes.has(String(row.nearby_match_mode ?? ''))
    ? String(row.nearby_match_mode)
    : null;

  return {
    distance_band: distanceBand,
    distance_priority: distancePriority,
    nearby_match_mode: nearbyMatchMode,
  };
}

export function mapMarketplaceServiceDiscoveryServices(
  rows: MarketplaceServiceDiscoveryCandidateRow[],
  options: MappingOptions,
) {
  return rows.map((row) => {
    const categoryName = String(row.category || 'Other');
    const categoryId = canonicalCategorySlug(row.category_code, categoryName);
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    const workMode = ['available', 'busy', 'offline', 'paused'].includes(String(row.live_work_mode))
      ? row.live_work_mode
      : 'offline';

    return {
      id: row.id,
      service_name: { en: String(row.service_name || '') },
      description: { en: String(row.description || '') },
      provider_name: String(row.provider_name || (row.provider_type === 'business' ? 'Business provider' : 'Professional provider')),
      provider_type: row.provider_type,
      provider_id: providerId,
      location: String(row.service_location || row.service_area || ''),
      service_area: String(row.service_area || row.service_location || ''),
      category_id: categoryId,
      category_slug: categoryId,
      category_code: row.category_code || null,
      category_group: String(row.category_group || ''),
      category_aliases: Array.isArray(row.category_aliases) ? row.category_aliases : [],
      pricing: {
        base_price: {
          amount: Math.round(Number(row.base_price || 0) * 100),
          currency: String(row.currency || 'INR'),
        },
      },
      duration_minutes: Number(row.duration_minutes || 0),
      rating: Number(row.rating || 0),
      review_count: Number(row.review_count || 0),
      live_work_mode: workMode,
      availability: availabilityLabel(workMode),
      business_shop_state: row.provider_type === 'business' ? (row.business_shop_state === 'open' ? 'open' : 'closed') : null,
      ...nearbyDistanceFields(row, options.nearby),
      verified: true,
    };
  });
}
