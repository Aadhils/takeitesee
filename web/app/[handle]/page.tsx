import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

const siteUrl = 'https://www.takeitesee.com';

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

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const normalized = normalizeRouteHandle(handle);
  const resolved = await resolveHandle(normalized);

  if (!resolved || resolved.identity_type === 'customer') {
    return {
      title: { absolute: 'Profile unavailable | TakeItEsee' },
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${siteUrl}/@${encodeURIComponent(resolved.canonical_handle)}`;
  const kind = resolved.identity_type === 'professional' ? 'Professional' : 'Business';

  return {
    title: { absolute: `@${resolved.canonical_handle} · ${kind} | TakeItEsee` },
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

  // Customer handles are globally reserved now, but Customer identity media and
  // profile details remain private until an explicit public-Customer contract exists.
  if (resolved.identity_type === 'customer') notFound();

  if (resolved.identity_type === 'professional') {
    redirect(`/professionals/${encodeURIComponent(resolved.identity_id)}`);
  }

  if (resolved.identity_type === 'business') {
    redirect(`/businesses/${encodeURIComponent(resolved.identity_id)}`);
  }

  notFound();
}
