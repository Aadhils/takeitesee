import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import PublicProviderIdentityLayout from '../../components/detail/PublicProviderIdentityLayout';
import BusinessPublicProfileContent, {
  loadPublicBusiness,
  publicBusinessSeoText,
  publicSiteUrl,
} from '../../components/detail/BusinessPublicProfileContent';

const siteUrl = publicSiteUrl;

type HandleResolution = {
  requested_handle: string;
  canonical_handle: string;
  identity_type: 'customer' | 'professional' | 'business';
  identity_id: string;
  is_canonical: boolean;
};

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizeRouteHandle(value: string) {
  return decodeURIComponent(value).trim().replace(/^@+/, '').toLowerCase();
}

const resolveHandle = cache(async (rawHandle: string): Promise<HandleResolution | null> => {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('resolve_public_identity_handle', {
    raw_handle: rawHandle,
  });
  if (error || !Array.isArray(data) || !data.length) return null;

  const row = data[0] as HandleResolution;
  if (!row?.canonical_handle || !row?.identity_id || !row?.identity_type) return null;
  return row;
});

function unavailableMetadata(): Metadata {
  return {
    title: { absolute: 'Profile unavailable | TakeItEsee' },
    robots: { index: false, follow: false },
  };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const normalized = normalizeRouteHandle(handle);
  const resolved = await resolveHandle(normalized);

  if (!resolved || resolved.identity_type === 'customer') return unavailableMetadata();

  const canonical = `${siteUrl}/@${encodeURIComponent(resolved.canonical_handle)}`;

  if (resolved.identity_type === 'business') {
    const record = await loadPublicBusiness(resolved.identity_id);
    if (!record) return unavailableMetadata();

    const { business, services } = record;
    const location = business.location || '';
    const pageTitle = `${business.name || `@${resolved.canonical_handle}`}${location ? ` in ${location}` : ''}`;
    const socialTitle = `${pageTitle} | TakeItEsee`;
    const description = publicBusinessSeoText(
      business.description,
      `Explore services from ${business.name || `@${resolved.canonical_handle}`}${location ? ` in ${location}` : ''} on TakeItEsee.`,
    );
    const indexable = services.length > 0;

    return {
      title: { absolute: socialTitle },
      description,
      alternates: indexable ? { canonical } : undefined,
      robots: { index: indexable, follow: indexable },
      openGraph: indexable ? {
        title: socialTitle,
        description,
        url: canonical,
        type: 'website',
        images: ['/brand/social'],
      } : undefined,
      twitter: indexable ? {
        card: 'summary_large_image',
        title: socialTitle,
        description,
        images: ['/brand/social'],
      } : undefined,
    };
  }

  return {
    title: { absolute: `@${resolved.canonical_handle} · Professional | TakeItEsee` },
    description: `View @${resolved.canonical_handle} on TakeItEsee.`,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `@${resolved.canonical_handle} | TakeItEsee`,
      description: `View @${resolved.canonical_handle} on TakeItEsee.`,
      url: canonical,
      type: 'profile',
      images: ['/brand/social'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `@${resolved.canonical_handle} | TakeItEsee`,
      description: `View @${resolved.canonical_handle} on TakeItEsee.`,
      images: ['/brand/social'],
    },
  };
}

export default async function PublicHandlePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const normalized = normalizeRouteHandle(handle);
  if (!normalized) notFound();

  const resolved = await resolveHandle(normalized);
  if (!resolved) notFound();

  if (!resolved.is_canonical || normalized !== resolved.canonical_handle) {
    permanentRedirect(`/@${encodeURIComponent(resolved.canonical_handle)}`);
  }

  // Customer handles remain globally reserved, but Customer profile details and media stay private.
  if (resolved.identity_type === 'customer') notFound();

  if (resolved.identity_type === 'business') {
    const record = await loadPublicBusiness(resolved.identity_id);
    if (!record) notFound();

    const canonical = `${siteUrl}/@${encodeURIComponent(resolved.canonical_handle)}`;
    return <PublicProviderIdentityLayout kind="business" providerId={resolved.identity_id}>
      <BusinessPublicProfileContent providerId={resolved.identity_id} canonicalUrl={canonical} />
    </PublicProviderIdentityLayout>;
  }

  if (resolved.identity_type === 'professional') {
    redirect(`/professionals/${encodeURIComponent(resolved.identity_id)}`);
  }

  notFound();
}
