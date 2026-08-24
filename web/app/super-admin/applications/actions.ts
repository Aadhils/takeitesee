'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAccess } from '../../../lib/admin/access';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const allowedStatuses = new Set(['draft', 'active', 'paused', 'retired']);

export async function createApplication(formData: FormData) {
  const access = await requireAdminAccess({ superAdminOnly: true });
  const supabase = await createSupabaseServerClient();
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toLowerCase();
  const description = String(formData.get('description') ?? '').trim();
  if (!name || !/^[a-z0-9][a-z0-9_-]{1,62}$/.test(code)) throw new Error('Valid application name and code are required.');

  const { data, error } = await supabase.from('platform_applications').insert({ name, code, description: description || null, status: 'draft' }).select('id').single();
  if (error) throw new Error(error.message);
  await supabase.from('admin_audit_log').insert({ actor_user_id: access.platformUserId, action: 'application.created', resource_type: 'platform_application', resource_id: data.id, application_id: data.id, metadata: { code, name } });
  revalidatePath('/super-admin');
  revalidatePath('/super-admin/applications');
}

export async function setApplicationStatus(formData: FormData) {
  const access = await requireAdminAccess({ superAdminOnly: true });
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !allowedStatuses.has(status)) throw new Error('Invalid application status change.');

  const { error } = await supabase.from('platform_applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await supabase.from('admin_audit_log').insert({ actor_user_id: access.platformUserId, action: 'application.status_changed', resource_type: 'platform_application', resource_id: id, application_id: id, metadata: { status } });
  revalidatePath('/super-admin');
  revalidatePath('/super-admin/applications');
}
