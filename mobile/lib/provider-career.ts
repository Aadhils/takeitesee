import { apiFetch } from './api';
import { supabase } from './supabase';
export type CareerProfile = { professional_id: string; career_headline: string | null; career_summary: string | null; preferred_location: string | null; open_to_remote: boolean; willing_to_relocate: boolean; available_from: string | null; notice_period_days: number | null; availability_note: string | null; public_resume_enabled: boolean };
export type CareerItem = { id: string; professional_id: string; role_title?: string; organization?: string; institution?: string; qualification?: string; field_of_study?: string | null; name?: string; issuing_organization?: string; start_date?: string | null; end_date?: string | null; is_current?: boolean; description?: string | null; proficiency?: string | null; years_experience?: number | null; issue_date?: string | null; expiry_date?: string | null };
export type CareerData = { verified: boolean; career_profile: CareerProfile | null; experiences: CareerItem[]; education: CareerItem[]; certifications: CareerItem[]; skills: CareerItem[]; roles: { id: string; title: string; active: boolean }[] };
export async function fetchCareer(userId: string, expectedId?: string): Promise<CareerData> {
  async function token() { const { data, error } = await supabase.auth.getSession(); if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to view your résumé.'); return data.session.access_token; }
  const { profile } = await apiFetch<{ profile: { id: string; provider_type: string } }>('/api/provider/profile', { accessToken: await token() });
  await token();
  if (!profile?.id || profile.provider_type !== 'professional' || (expectedId && profile.id !== expectedId)) throw new Error('A Professional identity is required for this résumé.');
  const result = await apiFetch<CareerData>('/api/provider/resume', { accessToken: await token() });
  await token();
  if (!result || (result.career_profile && result.career_profile.professional_id !== profile.id) || ['experiences', 'education', 'certifications', 'skills'].some((key) => { const rows = result[key as 'experiences']; return !Array.isArray(rows) || rows.some((row) => !row || row.professional_id !== profile.id); }) || !Array.isArray(result.roles)) throw new Error('Your résumé ownership could not be verified.');
  return result;
}
