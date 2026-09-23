import { NextResponse } from 'next/server';
import { loadPublicBusiness } from '../../../../../../components/detail/BusinessPublicProfileContent';
import { loadPublicProfessional } from '../../../../../../components/detail/ProfessionalPublicProfileContent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ providerType: string; providerId: string }>;
};

type ProviderType = 'professional' | 'business';

function normalizedService(service: any) {
  return {
    id: String(service.id),
    name: String(service.name || ''),
    description: String(service.description || ''),
    base_price: service.base_price == null ? null : Number(service.base_price),
    currency: String(service.currency || 'INR'),
    duration_minutes: service.duration_minutes == null ? null : Number(service.duration_minutes),
    location: service.location == null ? null : String(service.location),
  };
}

function publicIdentity(
  providerType: ProviderType,
  providerId: string,
  provider: any,
) {
  return {
    id: providerId,
    provider_type: providerType,
    profile_path: `/${providerType === 'business' ? 'businesses' : 'professionals'}/${encodeURIComponent(providerId)}`,
    name: String(providerType === 'business' ? provider.name || '' : provider.headline || ''),
    description: String(provider.description || ''),
    location: String(providerType === 'business' ? provider.location || '' : provider.service_area || ''),
    website_url: provider.website_url ? String(provider.website_url) : null,
    public_contact: {
      email: String(provider.public_contact_email || ''),
      phone: String(provider.public_contact_phone || ''),
    },
    marketplace_disclosure: {
      legal_name: String(provider.legal_name || ''),
      principal_address: String(provider.principal_address || ''),
      grievance_officer_name: String(provider.grievance_officer_name || ''),
      grievance_officer_designation: String(provider.grievance_officer_designation || ''),
      grievance_email: String(provider.grievance_email || ''),
      grievance_phone: String(provider.grievance_phone || ''),
    },
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { providerType, providerId } = await context.params;
  const type = providerType.trim().toLowerCase();
  const id = providerId.trim();

  if (type !== 'professional' && type !== 'business') {
    return NextResponse.json(
      { error: 'Provider type must be professional or business.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!id) {
    return NextResponse.json(
      { error: 'Provider id is required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (type === 'professional') {
    const record = await loadPublicProfessional(id);
    if (!record) {
      return NextResponse.json(
        { error: 'Professional provider was not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { provider, services, roles, media, career } = record;
    return NextResponse.json(
      {
        provider: {
          ...publicIdentity('professional', id, provider),
          services: services.map(normalizedService),
          roles: roles.map((role: any) => ({
            id: String(role.id),
            title: String(role.title || ''),
            summary: String(role.summary || ''),
            experience_years: role.experience_years == null ? null : Number(role.experience_years),
            service_bookings_enabled: Boolean(role.service_bookings_enabled),
            freelance_enabled: Boolean(role.freelance_enabled),
            part_time_enabled: Boolean(role.part_time_enabled),
            full_time_enabled: Boolean(role.full_time_enabled),
            contract_enabled: Boolean(role.contract_enabled),
          })),
          media,
          career,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const record = await loadPublicBusiness(id);
  if (!record) {
    return NextResponse.json(
      { error: 'Business provider was not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { business, services, products } = record;
  return NextResponse.json(
    {
      provider: {
        ...publicIdentity('business', id, business),
        services: services.map(normalizedService),
        products: products.map((product) => ({
          id: String(product.id),
          name: String(product.name || ''),
          description: String(product.description || ''),
          price: product.price == null ? null : Number(product.price),
          currency: String(product.currency || 'INR'),
          unit_label: String(product.unit_label || 'item'),
          stock_mode: product.stock_mode,
          has_primary_image: Boolean(product.has_primary_image),
        })),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
