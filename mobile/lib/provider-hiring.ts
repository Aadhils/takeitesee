import { apiFetch } from './api';
import { supabase } from './supabase';
export type HiringJob = { id: string; business_id: string; title: string; status: string; moderation_state: string; employment_type: string; workplace_type: string; location: string | null; openings: number; application_deadline: string | null };
export type HiringApplicant = { id: string; job_posting_id: string; professional_id: string; status: string; applied_at: string };
export type ApplicantProfile = { id: string; headline: string | null; service_area: string | null; verified: boolean };
export type HiringPreview = { jobs: HiringJob[]; applicants: HiringApplicant[]; professionals: ApplicantProfile[] };
export async function fetchHiring(userId: string, expectedId?: string): Promise<HiringPreview> {
 async function token() { const { data, error } = await supabase.auth.getSession(); if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to view hiring.'); return data.session.access_token; }
 const { profile } = await apiFetch<{ profile: { id: string; provider_type: string } }>('/api/provider/profile', { accessToken: await token() });
 await token();
 if (!profile?.id || profile.provider_type !== 'business' || (expectedId && profile.id !== expectedId)) throw new Error('A Business identity is required for hiring.');
 const data = await apiFetch<{ mode: string; business: { id: string }; jobs: HiringJob[]; applications: HiringApplicant[]; professionals: ApplicantProfile[] }>('/api/provider/job-marketplace', { accessToken: await token() });
 await token();
 if (!data || data.mode !== 'business' || data.business?.id !== profile.id || !Array.isArray(data.jobs) || data.jobs.some(job => !job || job.business_id !== profile.id) || !Array.isArray(data.applications) || data.applications.some(row => !row || !data.jobs.some(job => job.id === row.job_posting_id)) || !Array.isArray(data.professionals) || data.professionals.some(person => !person || !data.applications.some(row => row.professional_id === person.id))) throw new Error('Your hiring ownership could not be verified.');
 // Keep only the reviewed summary. Résumé snapshots, interview evidence and contact data are not retained.
 return { jobs: data.jobs.map(({id,business_id,title,status,moderation_state,employment_type,workplace_type,location,openings,application_deadline}) => ({id,business_id,title,status,moderation_state,employment_type,workplace_type,location,openings,application_deadline})), applicants: data.applications.map(({id,job_posting_id,professional_id,status,applied_at}) => ({id,job_posting_id,professional_id,status,applied_at})), professionals: data.professionals.map(({id,headline,service_area,verified}) => ({id,headline,service_area,verified})) };
}
export function hiringJobStatus(status: string) { return ({draft:'Draft',open:'Open',closed:'Closed',filled:'Filled'} as Record<string,string>)[status] || 'Status unavailable'; }
