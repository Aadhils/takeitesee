import { apiFetch } from './api';
import { supabase } from './supabase';
export const privacyRequestTypes = ['access', 'correction', 'deletion'] as const;
export type PrivacyRequestType = typeof privacyRequestTypes[number];
export type PrivacyRequest = { id: string; request_type: string; details: string; status: string; review_note: string | null; created_at: string; updated_at: string; resolved_at: string | null };
type OwnedRequest = PrivacyRequest & { user_id: string };
async function token(userId: string) { const { data, error } = await supabase.auth.getSession(); if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to manage privacy requests.'); return data.session.access_token; }
function summary(row: OwnedRequest): PrivacyRequest { const { id, request_type, details, status, review_note, created_at, updated_at, resolved_at } = row; return { id, request_type, details, status, review_note, created_at, updated_at, resolved_at }; }
export async function fetchPrivacyRequests(userId: string) {
 const result = await apiFetch<{ requests: OwnedRequest[] }>('/api/account/privacy-requests', { accessToken: await token(userId) });
 await token(userId);
 if (!Array.isArray(result?.requests) || result.requests.some(row => !row || row.user_id !== userId)) throw new Error('Your privacy request ownership could not be verified.');
 return result.requests.map(summary);
}
export function privacyRequestInput(type: PrivacyRequestType, details: string) {
 if (!privacyRequestTypes.includes(type)) throw new Error('Choose a valid privacy request type.');
 const normalized = details.trim(); if (normalized.length < 10 || normalized.length > 2000) throw new Error('Request details must be 10 to 2000 characters.');
 return { request_type: type, details: normalized };
}
export async function submitPrivacyRequest(userId: string, type: PrivacyRequestType, details: string) {
 const body = privacyRequestInput(type, details);
 const result = await apiFetch<{ request: OwnedRequest }>('/api/account/privacy-requests', { accessToken: await token(userId), method: 'POST', body: JSON.stringify(body) });
 await token(userId);
 if (!result?.request || result.request.user_id !== userId || result.request.request_type !== type || !result.request.id) throw new Error('Submission could not be confirmed. Reload your request history before submitting again.');
 return summary(result.request);
}
export function privacyTypeLabel(type: string) { return ({ access: 'Access to my information', correction: 'Correct my information', deletion: 'Account deletion request' } as Record<string,string>)[type] || 'Privacy request'; }
export function privacyStatusLabel(status: string) { return ({ submitted: 'Submitted', in_review: 'In review', awaiting_information: 'Awaiting information', completed: 'Completed', declined: 'Declined' } as Record<string,string>)[status] || 'Status unavailable'; }
