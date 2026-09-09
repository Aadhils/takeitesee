'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

async function requireSuperAdmin() {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');
  return session;
}

function parseSearchAliases(value: FormDataEntryValue | null) {
  const aliases = String(value ?? '')
    .split(/[\n,]+/)
    .map((alias) => alias.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const uniqueAliases = Array.from(new Set(aliases));
  if (uniqueAliases.length > 40) throw new Error('A category can have at most 40 search aliases.');
  if (uniqueAliases.some((alias) => alias.length > 80)) throw new Error('Each search alias must be 80 characters or fewer.');
  return uniqueAliases;
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
    metadata: { category_id: data.id, name, code, parent_id: parentId },
  });

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/categories');
}

export async function reviewCategoryRequest(formData: FormData) {
  await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();

  const requestId = String(formData.get('request_id') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim().toLowerCase();
  const finalName = String(formData.get('final_name') ?? '').trim();
  const finalCode = String(formData.get('final_code') ?? '').trim().toLowerCase();
  const parentId = String(formData.get('parent_id') ?? '').trim() || null;
  const reviewNote = String(formData.get('review_note') ?? '').trim() || null;

  if (!requestId || !['approve', 'reject'].includes(decision)) throw new Error('Category request and decision are required.');

  const { error } = await supabase.rpc('review_provider_category_request', {
    target_request_id: requestId,
    decision,
    final_category_name: finalName,
    final_category_code: finalCode,
    final_parent_category_id: parentId,
    note: reviewNote,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/categories');
  revalidatePath('/provider/category-requests');
  revalidatePath('/provider/services');
  revalidatePath('/provider/setup');
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
    metadata: { category_id: id, active },
  });

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/categories');
}

export async function updateCategorySearchAliases(formData: FormData) {
  const session = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();

  const id = String(formData.get('id') ?? '').trim();
  const applicationId = String(formData.get('application_id') ?? '').trim();
  const aliases = parseSearchAliases(formData.get('search_aliases'));
  if (!id || !applicationId) throw new Error('Category and application are required.');

  const [{ data: category, error: categoryError }, { data: application, error: applicationError }] = await Promise.all([
    supabase.from('platform_categories').select('id,application_id,parent_id,name,metadata').eq('id', id).eq('application_id', applicationId).maybeSingle(),
    supabase.from('platform_applications').select('id,code').eq('id', applicationId).maybeSingle(),
  ]);
  if (categoryError || applicationError) throw new Error(categoryError?.message || applicationError?.message);
  if (!category || !application) throw new Error('Category was not found.');
  if (application.code !== 'services') throw new Error('Search aliases are available only for the Services taxonomy.');
  if (!category.parent_id) throw new Error('Search aliases are managed on leaf/specialty categories, not root groups.');

  const currentMetadata = category.metadata && typeof category.metadata === 'object' && !Array.isArray(category.metadata)
    ? category.metadata as Record<string, unknown>
    : {};
  const beforeAliases = Array.isArray(currentMetadata.search_aliases)
    ? currentMetadata.search_aliases.filter((alias): alias is string => typeof alias === 'string')
    : [];
  const updatedAt = new Date().toISOString();
  const nextMetadata: Record<string, unknown> = { ...currentMetadata };
  if (aliases.length) nextMetadata.search_aliases = aliases;
  else delete nextMetadata.search_aliases;
  nextMetadata.search_alias_version = 'admin_v1';
  nextMetadata.search_alias_source = 'super_admin';
  nextMetadata.search_alias_updated_at = updatedAt;

  const { error } = await supabase
    .from('platform_categories')
    .update({ metadata: nextMetadata, updated_at: updatedAt })
    .eq('id', id)
    .eq('application_id', applicationId);
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from('admin_audit_log').insert({
    actor_user_id: session.user_id,
    action: 'category.search_aliases_changed',
    resource_type: 'platform_category',
    resource_id: id,
    application_id: applicationId,
    metadata: {
      category_id: id,
      category_name: category.name,
      before_aliases: beforeAliases,
      after_aliases: aliases,
      alias_count: aliases.length,
    },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/categories');
  revalidatePath('/explore');
}
