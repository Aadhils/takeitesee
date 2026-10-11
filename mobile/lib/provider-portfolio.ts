import { apiFetch } from './api';
import { supabase } from './supabase';
import { mobileEnv } from './env';
export type PortfolioItem = { id: string; professional_id: string; media_type: 'image' | 'video'; caption: string | null; alt_text: string | null; active: boolean; moderation_state: string; signed_url: string | null; display_order: number };
export function portfolioImageUrl(item: PortfolioItem) {
  if (item.media_type !== 'image' || !item.signed_url) return null;
  try {
    const url = new URL(item.signed_url), base = new URL(mobileEnv.supabaseUrl);
    if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password || !url.pathname.startsWith('/storage/v1/object/sign/professional-portfolio-media/') || !url.searchParams.get('token')) return null;
    return url.toString();
  } catch { return null; }
}
export async function fetchPortfolio(userId: string, expectedId?: string) {
  async function token() { const { data, error } = await supabase.auth.getSession(); if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to view your portfolio.'); return data.session.access_token; }
  const accessToken = await token();
  const { profile } = await apiFetch<{ profile: { id: string; provider_type: string } }>('/api/provider/profile', { accessToken });
  await token();
  if (!profile?.id || profile.provider_type !== 'professional' || (expectedId && profile.id !== expectedId)) throw new Error('A Professional identity is required for this portfolio.');
  const { media } = await apiFetch<{ media: PortfolioItem[] }>('/api/provider/profile/media', { accessToken: await token() });
  await token();
  if (!Array.isArray(media) || media.some((item) => item.professional_id !== profile.id)) throw new Error('Your portfolio ownership could not be verified.');
  return media;
}
