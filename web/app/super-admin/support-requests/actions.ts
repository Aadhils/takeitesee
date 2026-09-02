'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

const allowedStatuses = new Set(['submitted', 'in_review', 'awaiting_information', 'resolved', 'closed']);

export async function updateSupportRequestAction(formData: FormData) {
  const session = await productionAuthProvider.getSession();
  if (!session || !session.roles.includes('super_admin')) throw new Error('Super Admin access required.');

  const requestId = String(formData.get('request_id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const reviewNote = String(formData.get('review_note') ?? '').trim();
  if (!requestId || !allowedStatuses.has(status)) throw new Error('Invalid support request update.');
  if ((status === 'awaiting_information' || status === 'closed') && reviewNote.length < 5) throw new Error('Add a review note before requesting information or closing a request.');
  if (reviewNote.length > 2000) throw new Error('Review note is too long.');

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('platform_support_requests')
    .update({
      status,
      review_note: reviewNote || null,
      reviewed_by: session.user_id,
      updated_at: now,
      resolved_at: status === 'resolved' || status === 'closed' ? now : null,
    })
    .eq('id', requestId);
  if (error) throw new Error(error.message);

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/support-requests');
}
