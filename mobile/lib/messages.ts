import { apiFetch } from './api';
import { supabase } from './supabase';

export type MessageWorkspace = 'customer' | 'provider';
export type ConversationKind = 'requirement' | 'job_application' | 'product_order';

export type ConversationSummary = {
  id: string;
  conversation_kind: ConversationKind;
  requirement_id: string | null;
  requirement_reference: string | null;
  requirement_title: string | null;
  requirement_status: string | null;
  job_application_id: string | null;
  job_posting_id: string | null;
  job_title: string | null;
  application_status: string | null;
  business_name: string | null;
  business_product_order_id: string | null;
  product_order_status: string | null;
  product_name: string | null;
  product_order_business_name: string | null;
  product_order_quantity: number | null;
  conversation_status: 'open' | 'closed';
  closed_reason: string | null;
  participant_role: 'customer' | 'provider' | 'applicant' | 'employer' | 'business';
  counterpart_name: string;
  proposal_reference: string | null;
  amount_minor: number | null;
  currency: 'INR' | 'USD' | null;
  service_name: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  opened_at: string;
  unread_count: number;
};

export type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  sender_name: string;
};

export type ConversationDetail = Omit<ConversationSummary, 'last_message_body' | 'unread_count'>;
export type ConversationPayload = {
  conversation: ConversationDetail;
  messages: MessageRow[];
};

export type ConversationSafety = {
  blocked_by_me: boolean;
  messaging_blocked: boolean;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export async function fetchMessageInbox(workspace: MessageWorkspace) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ conversations: ConversationSummary[] }>(`/api/messages?workspace=${workspace}`, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchConversation(conversationId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<ConversationPayload>(`/api/messages/${encodeURIComponent(conversationId)}`, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchConversationSafety(conversationId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ safety: ConversationSafety }>(`/api/messages/${encodeURIComponent(conversationId)}/safety`, {
    method: 'GET',
    accessToken,
  });
}

export async function sendConversationMessage(conversationId: string, message: string) {
  const accessToken = await currentAccessToken();
  const idempotencyKey = `mobile-message-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return apiFetch<{ message: MessageRow }>(`/api/messages/${encodeURIComponent(conversationId)}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ idempotency_key: idempotencyKey, message: message.trim() }),
  });
}

export function conversationTitle(row: ConversationSummary | ConversationDetail) {
  if (row.conversation_kind === 'product_order') return row.product_name || 'Product order';
  if (row.conversation_kind === 'job_application') return row.job_title || 'Job opportunity';
  return row.requirement_title || 'Service requirement';
}

export function conversationCanCompose(row: ConversationDetail, safety: ConversationSafety) {
  if (safety.messaging_blocked || row.conversation_status !== 'open') return false;
  if (row.conversation_kind === 'requirement') return row.requirement_status === 'awarded';
  if (row.conversation_kind === 'job_application') return ['shortlisted', 'interview'].includes(row.application_status || '');
  return ['requested', 'accepted'].includes(row.product_order_status || '');
}
