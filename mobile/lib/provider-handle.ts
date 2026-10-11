import { apiFetch } from './api';
import { supabase } from './supabase';
export type ProviderHandle = { context: 'provider'; identity_type: 'professional' | 'business'; handle: string | null; public_profile_ready: boolean };
export class HandleSaveUncertainError extends Error {}
export function normalizeHandle(value: string) {
  const handle = value.trim().toLowerCase();
  if (handle.length < 3 || handle.length > 30 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle) || handle.includes('--')) throw new Error('Use 3–30 letters, numbers and single hyphens, with a letter or number at each end.');
  return handle;
}
async function token(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to manage your public handle.');
  return data.session.access_token;
}
export async function fetchProviderHandle(userId: string, scope: ProviderHandle['identity_type']) {
  const accessToken = await token(userId);
  const result = await apiFetch<ProviderHandle>('/api/identity-handle?context=provider', { accessToken });
  await token(userId);
  if (result.context !== 'provider' || result.identity_type !== scope || (result.handle !== null && normalizeHandle(result.handle) !== result.handle)) throw new Error('This Provider handle could not be verified.');
  return result;
}
export async function saveProviderHandle(userId: string, scope: ProviderHandle['identity_type'], previous: string | null, input: string) {
  const handle = normalizeHandle(input);
  const current = await fetchProviderHandle(userId, scope);
  if (current.handle !== previous) throw new Error('Your handle changed elsewhere. Reload before saving.');
  const accessToken = await token(userId);
  try {
    const payload = await apiFetch<{ result: { handle: string; identity_type: string } }>('/api/identity-handle?context=provider', { method: 'PATCH', accessToken, body: JSON.stringify({ handle }) });
    if (payload.result?.handle !== handle || payload.result.identity_type !== scope) throw new Error('Handle save could not be verified.');
    return await fetchProviderHandle(userId, scope);
  } catch {
    throw new HandleSaveUncertainError('The save could not be confirmed. Reload your handle before trying again. If it is unchanged, the requested handle may be reserved or unavailable.');
  }
}
export function publicHandleUrl(handle: ProviderHandle) {
  return handle.public_profile_ready === true && handle.handle ? `https://www.takeitesee.com/@${normalizeHandle(handle.handle)}` : null;
}
