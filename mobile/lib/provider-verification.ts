import { apiFetch } from './api';
import { supabase } from './supabase';
type RequestRow = { id: string; provider_type: string; professional_id: string | null; business_id: string | null; status: string; review_note?: string | null; created_at: string };
type DocumentRow = { verification_request_id: string; status: string };
type Payload = { provider: { id: string; provider_type: 'professional' | 'business'; display_name: string; verified: boolean; marketplace_disclosure_complete: boolean; missing_disclosure_fields: string[] }; requests: RequestRow[]; documents: DocumentRow[] };
export type VerificationStatus = { name: string; verified: boolean; disclosureComplete: boolean; missingFields: string[]; requests: { id: string; status: string; note: string; createdAt: string; documentCount: number }[] };
const statuses: Record<string, string> = { pending: 'Pending review', approved: 'Approved', changes_requested: 'Changes requested', rejected: 'Rejected', withdrawn: 'Withdrawn', revoked: 'Revoked' };
export function verificationStatusLabel(value: string) { return statuses[value] ?? 'Status unavailable'; }
export function summarizeVerification(payload: Payload, scope: 'professional' | 'business', entityId?: string): VerificationStatus {
  const provider = payload.provider;
  if (!provider || provider.provider_type !== scope || !provider.id || (entityId && provider.id !== entityId) || !Array.isArray(payload.requests) || !Array.isArray(payload.documents)) throw new Error('This Provider verification status could not be verified.');
  return { name: provider.display_name, verified: provider.verified === true, disclosureComplete: provider.marketplace_disclosure_complete === true, missingFields: provider.missing_disclosure_fields ?? [], requests: payload.requests.filter((row) => row.provider_type === scope && (scope === 'professional' ? row.professional_id : row.business_id) === provider.id).map((row) => ({ id: row.id, status: row.status, note: row.review_note ?? '', createdAt: row.created_at, documentCount: payload.documents.filter((doc) => doc.verification_request_id === row.id && doc.status === 'active').length })) };
}
export async function fetchVerificationStatus(userId: string, scope: 'professional' | 'business', entityId?: string) {
  async function token() { const { data, error } = await supabase.auth.getSession(); if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to check verification.'); return data.session.access_token; }
  const accessToken = await token();
  const payload = await apiFetch<Payload>('/api/provider/verification', { accessToken });
  await token();
  return summarizeVerification(payload, scope, entityId);
}
