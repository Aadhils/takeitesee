import { apiFetch } from './api';

export type MarketplaceService = {
  id: string;
  service_name: { en: string };
  description: { en: string };
  provider_name: string;
  provider_type: 'professional' | 'business';
  provider_id: string | null;
  location: string;
  service_area: string;
  category_id: string;
  category_slug: string;
  category_code: string | null;
  category_group: string;
  category_aliases: string[];
  pricing: {
    base_price: {
      amount: number;
      currency: string;
    };
  };
  duration_minutes: number;
  rating: number;
  review_count: number;
  live_work_mode: 'available' | 'busy' | 'offline' | 'paused';
  availability: string;
  business_shop_state: 'open' | 'closed' | null;
  distance_band: string | null;
  distance_priority: number;
  nearby_match_mode: string | null;
  verified: boolean;
};

export type MarketplaceCategory = {
  slug: string;
  name: string;
};

export type MarketplaceSearchResponse = {
  services: MarketplaceService[];
  categories: MarketplaceCategory[];
  total: number;
  geo_status: 'not_requested' | string;
  page: {
    limit: number;
    next_cursor: number | null;
    has_more: boolean;
  };
};

export function searchMarketplaceServices(query: string) {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim();
  if (normalizedQuery) params.set('q', normalizedQuery);
  params.set('limit', '20');

  return apiFetch<MarketplaceSearchResponse>(
    `/api/marketplace/services/search?${params.toString()}`,
    { method: 'GET' },
  );
}

export function formatMarketplacePrice(service: MarketplaceService) {
  const amount = service.pricing.base_price.amount / 100;
  const currency = service.pricing.base_price.currency || 'INR';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
