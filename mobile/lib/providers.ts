import { apiFetch } from './api';

export type PublicProviderType = 'professional' | 'business';

export type PublicProviderService = {
  id: string;
  name: string;
  description: string;
  base_price: number | null;
  currency: string;
  duration_minutes: number | null;
  location: string | null;
};

type PublicContact = {
  email: string;
  phone: string;
};

type MarketplaceDisclosure = {
  legal_name: string;
  principal_address: string;
  grievance_officer_name: string;
  grievance_officer_designation: string;
  grievance_email: string;
  grievance_phone: string;
};

export type PublicProviderProfile = {
  id: string;
  provider_type: PublicProviderType;
  profile_path: string;
  name: string;
  description: string;
  location: string;
  website_url: string | null;
  public_contact: PublicContact;
  marketplace_disclosure: MarketplaceDisclosure;
  services: PublicProviderService[];
  roles?: Array<{
    id: string;
    title: string;
    summary: string;
    experience_years: number | null;
    service_bookings_enabled: boolean;
    freelance_enabled: boolean;
    part_time_enabled: boolean;
    full_time_enabled: boolean;
    contract_enabled: boolean;
  }>;
  media?: unknown[];
  career?: unknown;
  products?: Array<{
    id: string;
    name: string;
    description: string;
    price: number | null;
    currency: string;
    unit_label: string;
    stock_mode: unknown;
    has_primary_image: boolean;
  }>;
};

type PublicProviderResponse = {
  provider: PublicProviderProfile;
};

export function fetchPublicProvider(providerType: PublicProviderType, providerId: string) {
  return apiFetch<PublicProviderResponse>(
    `/api/marketplace/providers/${providerType}/${encodeURIComponent(providerId)}`,
    { method: 'GET' },
  );
}

export function findProviderService(provider: PublicProviderProfile, serviceId: string) {
  return provider.services.find((service) => service.id === serviceId) ?? null;
}

export function formatPublicServicePrice(service: PublicProviderService) {
  if (service.base_price == null) return 'Price on request';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: service.currency || 'INR',
      maximumFractionDigits: Number.isInteger(service.base_price) ? 0 : 2,
    }).format(service.base_price);
  } catch {
    return `${service.currency || 'INR'} ${service.base_price.toFixed(2)}`;
  }
}
