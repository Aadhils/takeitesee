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

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('platform_categories')
      .select('id, application_id')
      .eq('id', parentId)
      .maybeSingle();
    if (parentError) throw new Error(parentError.message);
    if (!parent || parent.application_id !== applicationId) {
      throw new Error('Parent category must belong to the selected application.');
    }
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

export async function seedHomeServicesCategories(formData: FormData) {
  const session = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();
  const applicationId = String(formData.get('application_id') ?? '').trim();
  const parentId = String(formData.get('parent_id') ?? '').trim();

  if (!applicationId || !parentId) throw new Error('Application and Home Services parent are required.');

  const { data: parent, error: parentError } = await supabase
    .from('platform_categories')
    .select('id, application_id, code')
    .eq('id', parentId)
    .maybeSingle();
  if (parentError) throw new Error(parentError.message);
  if (!parent || parent.application_id !== applicationId || parent.code !== 'home_services') {
    throw new Error('Starter categories can only be seeded under Home Services.');
  }

  const starter = [
    { code: 'plumbing', name: 'Plumbing', description: 'Plumbing installation, repair, maintenance and emergency plumbing services.' },
    { code: 'electrical', name: 'Electrical', description: 'Electrical installation, repair, safety checks and household electrical services.' },
    { code: 'cleaning', name: 'Cleaning', description: 'Home cleaning, deep cleaning, kitchen, bathroom and move-in or move-out cleaning.' },
    { code: 'ac_service', name: 'AC Service', description: 'Air-conditioner installation, servicing, repair, gas refill and maintenance.' },
    { code: 'appliance_repair', name: 'Appliance Repair', description: 'Repair and maintenance for common household appliances.' },
    { code: 'pest_control', name: 'Pest Control', description: 'Residential pest inspection, treatment and preventive pest-control services.' },
  ];

  const { data: existing, error: existingError } = await supabase
    .from('platform_categories')
    .select('code')
    .eq('application_id', applicationId)
    .eq('parent_id', parentId)
    .in('code', starter.map((item) => item.code));
  if (existingError) throw new Error(existingError.message);

  const existingCodes = new Set((existing ?? []).map((item) => item.code));
  const missing = starter
    .filter((item) => !existingCodes.has(item.code))
    .map((item, index) => ({
      application_id: applicationId,
      parent_id: parentId,
      name: item.name,
      code: item.code,
      description: item.description,
      active: true,
      sort_order: (index + 1) * 10,
    }));

  if (missing.length) {
    const { data: inserted, error: insertError } = await supabase
      .from('platform_categories')
      .insert(missing)
      .select('id, code');
    if (insertError) throw new Error(insertError.message);

    await supabase.from('admin_audit_log').insert({
      actor_user_id: session.user_id,
      action: 'category.starter_set_seeded',
      resource_type: 'platform_category',
      resource_id: parentId,
      application_id: applicationId,
      category_id: parentId,
      metadata: { inserted: inserted ?? [], skipped_existing: [...existingCodes] },
    });
  }

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
