import { apiFetch } from './api';
import { supabase } from './supabase';
import type { ProfileScope } from './profile-model';

export type ProfileDetails = { scope: ProfileScope; id: string; name: string; phone: string; email: string; location: string; description: string; complete?: boolean };
export type ProfileDraft = Pick<ProfileDetails, 'name' | 'phone' | 'location' | 'description'>;
type ProviderProfile = { provider_type: 'professional' | 'business'; id: string; display_name: string; description: string; location: string; profile_complete?: boolean };
async function ownerToken(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to edit your profile.');
  return data.session.access_token;
}
export function validateProfileDraft(scope: ProfileScope, input: ProfileDraft): ProfileDraft {
  const draft = { name: input.name.trim(), phone: input.phone.trim(), location: input.location.trim(), description: input.description.trim() };
  const minimum = scope === 'customer' ? 1 : 2;
  if (draft.name.length < minimum || draft.name.length > 120) throw new Error(`Name must be ${minimum} to 120 characters.`);
  if (draft.location.length > 160 || (scope !== 'customer' && draft.location.length < 2)) throw new Error(scope === 'customer' ? 'Location must be 160 characters or fewer.' : 'Service area must be 2 to 160 characters.');
  if (draft.phone.length > 40) throw new Error('Phone must be 40 characters or fewer.');
  if (draft.description.length > 1200) throw new Error('Description must be 1200 characters or fewer.');
  return draft;
}
export async function fetchProfileDetails(userId: string, scope: ProfileScope): Promise<ProfileDetails> {
  const accessToken = await ownerToken(userId);
  if (scope !== 'customer') {
    const { profile } = await apiFetch<{ profile: ProviderProfile }>('/api/provider/profile', { accessToken });
    await ownerToken(userId);
    if (!profile || profile.provider_type !== scope || !profile.id) throw new Error('This Provider profile is unavailable.');
    return { scope, id: profile.id, name: profile.display_name, description: profile.description, location: profile.location, phone: '', email: '', complete: profile.profile_complete };
  }
  const [user, profile] = await Promise.all([
    supabase.from('users').select('id,name,email,phone').eq('id', userId).single(),
    supabase.from('customer_profiles').select('default_location').eq('user_id', userId).maybeSingle(),
  ]);
  await ownerToken(userId);
  if (user.error || profile.error || !user.data || user.data.id !== userId) throw new Error('Your profile could not load. Please retry.');
  return { scope, id: userId, name: user.data.name, phone: user.data.phone ?? '', email: user.data.email, location: profile.data?.default_location ?? '', description: '' };
}
export async function saveProfileDetails(userId: string, current: ProfileDetails, input: ProfileDraft): Promise<ProfileDetails> {
  const draft = validateProfileDraft(current.scope, input);
  let accessToken = await ownerToken(userId);
  if (current.scope !== 'customer') {
    const latest = await fetchProfileDetails(userId, current.scope);
    if (latest.id !== current.id) throw new Error('Your Provider profile changed. Reload before saving.');
    accessToken = await ownerToken(userId);
    const { result } = await apiFetch<{ result: { provider_type: string; provider_id: string } }>('/api/provider/profile', { method: 'PATCH', accessToken, body: JSON.stringify({ display_name: draft.name, description: draft.description, location: draft.location }) });
    if (!result || result.provider_type !== current.scope || result.provider_id !== current.id) throw new Error('The save result could not be verified. Reload your profile before retrying.');
  } else {
    if (current.id !== userId) throw new Error('This Customer profile is unavailable.');
    // Existing self-owned RLS; never write email, roles or preference fields.
    try {
      const user = await supabase.from('users').update({ name: draft.name, phone: draft.phone || null, updated_at: new Date().toISOString() }).eq('id', userId).select('id').single();
      if (user.error || user.data?.id !== userId) throw new Error('Customer update failed.');
      await ownerToken(userId);
      const profile = await supabase.from('customer_profiles').upsert({ user_id: userId, default_location: draft.location || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('user_id').single();
      if (profile.error || profile.data?.user_id !== userId) throw new Error('Location update failed.');
    } catch {
      throw new Error('Some changes may have saved. Reload your profile to check before retrying.');
    }
  }
  try { return await fetchProfileDetails(userId, current.scope); }
  catch { throw new Error('Changes were submitted, but could not be reloaded. Reload your profile to check before retrying.'); }
}
