import { NextResponse } from 'next/server';
import {
  loadPublicBusinesses,
  loadPublicProfessionals,
  type PublicDirectoryEntry,
} from '../../../../server/marketplace/public-directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderType = 'professional' | 'business';
type ProviderTypeFilter = ProviderType | 'all';

function parseProviderType(value: string | null): ProviderTypeFilter | null {
  const normalized = String(value ?? 'all').trim().toLowerCase();
  if (!normalized || normalized === 'all') return 'all';
  if (normalized === 'professional' || normalized === 'business') return normalized;
  return null;
}

function publicProvider(entry: PublicDirectoryEntry, providerType: ProviderType) {
  return {
    ...entry,
    provider_type: providerType,
    profile_path: `/${providerType === 'business' ? 'businesses' : 'professionals'}/${encodeURIComponent(entry.id)}`,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerType = parseProviderType(url.searchParams.get('type'));
  if (!providerType) {
    return NextResponse.json(
      { error: 'Provider type must be professional, business, or all.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [professionals, businesses] = await Promise.all([
    providerType === 'business' ? Promise.resolve([]) : loadPublicProfessionals(),
    providerType === 'professional' ? Promise.resolve([]) : loadPublicBusinesses(),
  ]);

  if (professionals === null || businesses === null) {
    return NextResponse.json(
      { error: 'Public provider directory is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const providers = [
    ...professionals.map((entry) => publicProvider(entry, 'professional')),
    ...businesses.map((entry) => publicProvider(entry, 'business')),
  ].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);
    if (nameOrder !== 0) return nameOrder;
    const typeOrder = left.provider_type.localeCompare(right.provider_type);
    if (typeOrder !== 0) return typeOrder;
    return left.id.localeCompare(right.id);
  });

  return NextResponse.json(
    {
      providers,
      total: providers.length,
      filter: { provider_type: providerType },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
