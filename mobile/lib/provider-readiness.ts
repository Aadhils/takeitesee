import { apiFetch } from './api';
import { supabase } from './supabase';
export type ReadinessProfile = { id: string; provider_type: 'professional' | 'business'; display_name: string; verified: boolean; profile_complete: boolean; marketplace_disclosure_complete: boolean; trust_status: string; services_active: number; services_paused: number };
export function readinessGates(profile: ReadinessProfile) {
  const common = [
    { label: 'Provider verification', done: profile.verified === true, detail: 'Your Provider identity must be verified.' },
    { label: 'Marketplace disclosure', done: profile.marketplace_disclosure_complete === true, detail: 'Complete legal identity and public contact information.' },
    { label: 'Marketplace trust access', done: profile.trust_status === 'normal', detail: profile.trust_status === 'normal' ? 'Your trust state allows public visibility.' : 'Public visibility remains restricted. Review your status on the website.' },
  ];
  return profile.provider_type === 'professional' ? [{ label: 'Public profile basics', done: profile.profile_complete === true, detail: 'Complete your name, description and service area.' }, ...common] : common;
}
export async function fetchProviderReadiness(userId: string, scope: ReadinessProfile['provider_type'], profileId?: string) {
  async function session() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to check your Provider profile.');
    return data.session.access_token;
  }
  const accessToken = await session();
  const { profile } = await apiFetch<{ profile: ReadinessProfile }>('/api/provider/profile', { accessToken });
  await session();
  if (!profile || profile.provider_type !== scope || !profile.id || (profileId !== undefined && profile.id !== profileId)) throw new Error('This Provider profile could not be verified.');
  return profile;
}
