'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

const allowedStatuses = new Set(['submitted', 'in_review', 'awaiting_information', 'completed', 'declined']);

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

export async function updatePrivacyRequestAction(formData: FormData) {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');

  const requestId = formText(formData, 'request_id');
  const status = formText(formData, 'status');
  const reviewNote = formText(formData, 'review_note');

  if (!requestId) throw new Error('Privacy request id is required.');
  if (!allowedStatuses.has(status)) throw new Error('Choose a valid privacy request status.');
  if (reviewNote.length > 2000) throw new Error('Review note must be 2000 characters or fewer.');
  if ((status === 'awaiting_information' || status === 'declined') && reviewNote.length < 3) {
    throw new Error('A review note is required for this status.');
  }

  const now = new Date().toISOString();
  const resolvedAt = status === 'completed' || status === 'declined' ? now : null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('privacy_requests')
    .update({
      status,
      review_note: reviewNote || null,
      reviewed_by: session.user_id,
      updated_at: now,
      resolved_at: resolvedAt,
    })
    .eq('id', requestId);

  if (error) throw new Error(error.message);
  revalidatePath('/super-admin/privacy-requests');
}
