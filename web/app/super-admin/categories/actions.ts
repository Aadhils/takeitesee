'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

async function requireSuperAdmin() {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');
  return session;
}

export async function createCategory(formData: FormData) {
  const session = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();

  const applicationId = String(formData.get('application_id') ?? '').trim();
  const parentId = String(formData.get('parent_id') ?? '').trim() || null;
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toLowerCase();
  const description = String(formData.get('description') ?? '').trim() || null;

  if (!applicationId || !name || !/^[a-z0-9][a-z0-9_-]{1,62}$/.test(code)) {
    throw new Error('Valid application, category name and code are required.');
  }

  const { data, error } = await supabase
    .from('platform_categories')
    .insert({ application_id: applicationId, parent_id: parentId, name, code, description, active: true })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('admin_audit_log').insert({
    actor_user_id: session.user_id,
    action: 'category.created',
    resource_type: 'platform_category',
    resource_id: data.id,
    application_id: applicationId,
    category_id: data.id,
    metadata: { name, code, parent_id: parentId },
  });

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/categories');
}

export async function setCategoryActive(formData: FormData) {
  const session = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();

  const id = String(formData.get('id') ?? '').trim();
  const applicationId = String(formData.get('application_id') ?? '').trim();
  const active = String(formData.get('active')) === 'true';
  if (!id || !applicationId) throw new Error('Category and application are required.');

  const { error } = await supabase
    .from('platform_categories')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('application_id', applicationId);

  if (error) throw new Error(error.message);

  await supabase.from('admin_audit_log').insert({
    actor_user_id: session.user_id,
    action: 'category.status_changed',
    resource_type: 'platform_category',
    resource_id: id,
    application_id: applicationId,
    category_id: id,
    metadata: { active },
  });

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/categories');
}
