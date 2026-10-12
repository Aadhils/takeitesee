import { apiFetch } from './api';
import { supabase } from './supabase';
import { mobileEnv } from './env';
export type PortfolioItem = { id: string; professional_id: string; object_path: string; professional_role_id: string | null; updated_at: string; media_type: 'image' | 'video'; caption: string | null; alt_text: string | null; active: boolean; moderation_state: string; signed_url: string | null; display_order: number };
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

export function portfolioTextInput(item: PortfolioItem, caption: string, altText: string) {
  if (typeof caption !== 'string' || typeof altText !== 'string' || caption.trim().length > 600 || altText.trim().length > 240) throw new Error('Caption must be at most 600 characters; image description at most 240.');
  if (!item.id || !item.professional_id || typeof item.updated_at !== 'string' || !item.updated_at || typeof item.active !== 'boolean' || !Number.isInteger(item.display_order) || item.display_order < 0 || item.display_order > 9999 || (item.professional_role_id !== null && typeof item.professional_role_id !== 'string')) throw new Error('Reload the portfolio before editing.');
  if (item.moderation_state !== 'clear' && item.moderation_state !== 'paused') throw new Error('Reload to verify moderation status.');
  if (item.moderation_state === 'paused' && item.active) throw new Error('This item is paused by moderation. Review it on the website before editing.');
  return { id: item.id, caption: caption.trim() || null, alt_text: item.media_type === 'image' ? altText.trim() || null : item.alt_text, active: item.active, display_order: item.display_order, professional_role_id: item.professional_role_id };
}
function portfolioRevision(item: PortfolioItem) { return JSON.stringify([item.id,item.professional_id,item.professional_role_id,item.caption,item.alt_text,item.active,item.display_order,item.moderation_state,item.media_type,item.updated_at]); }
export async function savePortfolioText(userId: string, item: PortfolioItem, caption: string, altText: string) {
  const input = portfolioTextInput(item,caption,altText);
  const current = (await fetchPortfolio(userId,item.professional_id)).find(row => row.id === item.id);
  if (!current || portfolioRevision(current) !== portfolioRevision(item)) throw new Error('This item changed. Reload before saving.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to edit portfolio text.');
  const result = await apiFetch<{media: PortfolioItem}>('/api/provider/profile/media', { accessToken: data.session.access_token, method: 'PATCH', body: JSON.stringify(input) });
  const rows = await fetchPortfolio(userId,item.professional_id);
  const saved = rows.find(row => row.id === item.id);
  if (!result.media || result.media.id !== item.id || result.media.professional_id !== item.professional_id || !saved || saved.caption !== input.caption || saved.alt_text !== input.alt_text || saved.active !== input.active || saved.display_order !== input.display_order || saved.professional_role_id !== input.professional_role_id) throw new Error('Save could not be confirmed. Reload before saving again.');
  return saved;
}
