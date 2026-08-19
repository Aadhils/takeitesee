import { createSupabaseServerClient } from '../lib/supabase/server';
import { isSupabaseConfigured } from '../lib/supabase/config';
import type { EntityId } from '../types/entities';
import type { Money } from '../types/money';

export type CatalogService = {
  id: EntityId;
  name: string;
  providerId: EntityId;
  providerType: 'professional' | 'business';
  providerName: string;
  providerHeadline: string;
  providerVerified: boolean;
  description: string;
  location: string;
  durationMinutes: number;
  price: Money;
};

type ServiceRow = {
  id: string;
  provider_type: 'professional' | 'business';
  professional_id: string | null;
  business_id: string | null;
  name: string;
  description: string;
  location: string | null;
  duration_minutes: number;
  base_price: number | string;
  currency: 'INR' | 'USD';
};

type ProfessionalRow = {
  headline: string | null;
  description: string | null;
  verified: boolean;
};

type BusinessRow = {
  name: string;
  description: string | null;
  verified: boolean;
};

export async function getCatalogService(serviceId: string): Promise<CatalogService | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('services')
    .select('id, provider_type, professional_id, business_id, name, description, location, duration_minutes, base_price, currency')
    .eq('id', serviceId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toCatalogService(supabase, data as ServiceRow);
}

async function toCatalogService(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, service: ServiceRow): Promise<CatalogService> {
  const providerId = service.provider_type === 'professional' ? service.professional_id : service.business_id;
  if (!providerId) throw new Error('Service provider is unavailable.');

  if (service.provider_type === 'professional') {
    const { data, error } = await supabase.from('professional_profiles').select('headline, description, verified').eq('id', providerId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Service provider is unavailable.');
    const provider = data as ProfessionalRow;
    return createCatalogService(service, providerId, provider.headline ?? 'Professional', provider.description ?? '', provider.verified);
  }

  const { data, error } = await supabase.from('businesses').select('name, description, verified').eq('id', providerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Service provider is unavailable.');
  const provider = data as BusinessRow;
  return createCatalogService(service, providerId, provider.name, provider.description ?? '', provider.verified);
}

function createCatalogService(service: ServiceRow, providerId: string, providerName: string, providerHeadline: string, providerVerified: boolean): CatalogService {
  return {
    id: service.id as EntityId,
    name: service.name,
    providerId: providerId as EntityId,
    providerType: service.provider_type,
    providerName,
    providerHeadline,
    providerVerified,
    description: service.description,
    location: service.location ?? 'Location confirmed with provider',
    durationMinutes: service.duration_minutes,
    price: { amount: Number(service.base_price), currency: service.currency },
  };
}