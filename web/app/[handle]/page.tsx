import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import PublicProviderIdentityLayout from '../../components/detail/PublicProviderIdentityLayout';
import BusinessPublicProfileContent, {
  loadPublicBusiness,
  publicBusinessSeoText,
  publicSiteUrl,
} from '../../components/detail/BusinessPublicProfileContent';
import BusinessShopPublicStatus from '../../components/detail/BusinessShopPublicStatus';
import ProfessionalPublicProfileContent, {
  loadPublicProfessional,
  publicProfessionalSeoText,
} from '../../components/detail/ProfessionalPublicProfileContent';

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

    const { business, services, products } = record;
    const location = business.location || '';
    const pageTitle = `${business.name || `@${resolved.canonical_handle}`}${location ? ` in ${location}` : ''}`;
    const socialTitle = `${pageTitle} | TakeItEsee`;
    const offeringLabel = services.length > 0 && products.length > 0
      ? 'services and products'
      : products.length > 0
        ? 'products'
        : 'services';
    const description = publicBusinessSeoText(
      business.description,
      `Explore ${offeringLabel} from ${business.name || `@${resolved.canonical_handle}`}${location ? ` in ${location}` : ''} on TakeItEsee.`,
    );
    const indexable = services.length > 0 || products.length > 0;

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

  const record = await loadPublicProfessional(resolved.identity_id);
  if (!record) return unavailableMetadata();

  const { provider, services, roles, career } = record;
  const displayName = provider.headline || `@${resolved.canonical_handle}`;
  const location = provider.service_area || '';
  const primaryTalent = roles[0]?.title ? ` · ${String(roles[0].title)}` : '';
  const pageTitle = `${displayName}${primaryTalent}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const skillNames = career?.skills?.slice(0, 3).map((skill: any) => String(skill.name || '')).filter(Boolean) ?? [];
  const talentNames = roles.slice(0, Math.max(0, 3 - skillNames.length)).map((role: any) => String(role.title || '')).filter(Boolean);
  const careerText = [...talentNames, ...skillNames].length ? ` Skills include ${[...talentNames, ...skillNames].join(', ')}.` : '';
  const description = publicProfessionalSeoText(
    career?.profile?.career_summary || provider.description,
    `Explore services, professional talents, career experience and work samples from ${displayName}${location ? ` in ${location}` : ''} on TakeItEsee.${careerText}`,
  );
  const indexable = services.length > 0 || roles.length > 0 || Boolean(career);

  return {
    title: { absolute: socialTitle },
    description,
    alternates: indexable ? { canonical } : undefined,
    robots: { index: indexable, follow: indexable },
    openGraph: indexable ? {
      title: socialTitle,
      description,
      url: canonical,
      type: 'profile',
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

  const canonical = `${siteUrl}/@${encodeURIComponent(resolved.canonical_handle)}`;

  if (resolved.identity_type === 'business') {
    const record = await loadPublicBusiness(resolved.identity_id);
    if (!record) notFound();

    return <PublicProviderIdentityLayout kind="business" providerId={resolved.identity_id}>
      <BusinessShopPublicStatus businessId={resolved.identity_id} />
      <BusinessPublicProfileContent providerId={resolved.identity_id} canonicalUrl={canonical} />
    </PublicProviderIdentityLayout>;
  }

  if (resolved.identity_type === 'professional') {
    const record = await loadPublicProfessional(resolved.identity_id);
    if (!record) notFound();

    return <PublicProviderIdentityLayout kind="professional" providerId={resolved.identity_id}>
      <ProfessionalPublicProfileContent providerId={resolved.identity_id} canonicalUrl={canonical} />
    </PublicProviderIdentityLayout>;
  }

  notFound();
}
