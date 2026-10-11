import { apiFetch } from './api';
import { supabase } from './supabase';
export type TrackedJob = { id: string; title: string; employment_type: string; workplace_type: string; location: string | null; application_deadline: string | null; status: string; business?: { name: string } | null };
export type TrackedApplication = { id: string; professional_id: string; job_posting_id: string; status: string; applied_at: string; cover_note: string | null };
export type SavedJob = { job_posting_id: string; saved_at: string; available: boolean; job: TrackedJob | null };
export type JobTracker = { applications: TrackedApplication[]; jobs: TrackedJob[]; saved: SavedJob[] };
export async function fetchJobTracker(userId: string, expectedId?: string): Promise<JobTracker> {
 async function token() { const { data, error } = await supabase.auth.getSession(); if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to view your jobs.'); return data.session.access_token; }
 const { profile } = await apiFetch<{ profile: { id: string; provider_type: string } }>('/api/provider/profile', { accessToken: await token() });
 await token();
 if (!profile?.id || profile.provider_type !== 'professional' || (expectedId && profile.id !== expectedId)) throw new Error('A Professional identity is required for this tracker.');
 const workspace = await apiFetch<{ mode: string; professional: { id: string }; applications: TrackedApplication[]; jobs: TrackedJob[] }>('/api/provider/job-marketplace', { accessToken: await token() });
 await token();
 if (workspace.mode !== 'professional' || workspace.professional?.id !== profile.id || !Array.isArray(workspace.applications) || workspace.applications.some(row => !row || row.professional_id !== profile.id) || !Array.isArray(workspace.jobs) || workspace.jobs.some(job => !job || !workspace.applications.some(row => row.job_posting_id === job.id))) throw new Error('Your application ownership could not be verified.');
 const saved = await apiFetch<{ professional: { id: string }; saved_jobs: SavedJob[] }>('/api/provider/saved-jobs', { accessToken: await token() });
 await token();
 if (saved.professional?.id !== profile.id || !Array.isArray(saved.saved_jobs) || saved.saved_jobs.some(row => !row || (row.available && (!row.job || row.job.id !== row.job_posting_id)))) throw new Error('Your saved job ownership could not be verified.');
 return { applications: workspace.applications, jobs: workspace.jobs, saved: saved.saved_jobs.map(row => ({ ...row, job: row.available ? row.job : null })) };
}
export function applicationStatusLabel(status: string) { return ({ submitted: 'Submitted', shortlisted: 'Shortlisted', interview: 'Interview stage', hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn' } as Record<string,string>)[status] || 'Status unavailable'; }
