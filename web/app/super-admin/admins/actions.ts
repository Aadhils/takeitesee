'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requireSuperAdmin() {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) redirect('/admin');
  return session;
}

export async function grantExistingAdminAccess(formData: FormData) {
  await requireSuperAdmin();
  const email = value(formData, 'email').toLowerCase();
  const applicationId = value(formData, 'application_id');
  const canManage = formData.get('permission') === 'manage';

  if (!email || !applicationId) redirect('/super-admin/admins?error=grant_input');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('super_admin_grant_existing_admin', {
    p_email: email,
    p_application_id: applicationId,
    p_can_manage: canManage,
  });

  if (error) {
    if (error.code === '42501') redirect('/super-admin/admins?error=protected');
    if (error.code === 'P0002') redirect('/super-admin/admins?error=account_or_application_not_found');
    redirect('/super-admin/admins?error=admin_grant_failed');
  }

  revalidatePath('/super-admin/admins');
  revalidatePath('/super-admin/audit');
  revalidatePath('/admin');
  redirect('/super-admin/admins?updated=granted');
}

export async function updateDelegatedAdminScope(formData: FormData) {
  await requireSuperAdmin();
  const scopeId = value(formData, 'scope_id');

  if (!scopeId) redirect('/super-admin/admins?error=invalid_scope');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('super_admin_update_admin_scope', {
    p_scope_id: scopeId,
    p_can_view: formData.get('can_view') === 'on',
    p_can_manage: formData.get('can_manage') === 'on',
  });

  if (error) {
    redirect(error.code === '42501'
      ? '/super-admin/admins?error=protected'
      : '/super-admin/admins?error=scope_update_failed');
  }

  revalidatePath('/super-admin/admins');
  revalidatePath('/super-admin/audit');
  revalidatePath('/admin');
  redirect('/super-admin/admins?updated=scope');
}

export async function setDelegatedAdminMembershipActive(formData: FormData) {
  await requireSuperAdmin();
  const membershipId = value(formData, 'membership_id');
  const active = value(formData, 'active') === 'true';

  if (!membershipId) redirect('/super-admin/admins?error=invalid_membership');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('super_admin_set_admin_membership_active', {
    p_membership_id: membershipId,
    p_active: active,
  });

  if (error) {
    redirect(error.code === '42501'
      ? '/super-admin/admins?error=protected'
      : '/super-admin/admins?error=membership_update_failed');
  }

  revalidatePath('/super-admin/admins');
  revalidatePath('/super-admin/audit');
  revalidatePath('/admin');
  redirect(`/super-admin/admins?updated=${active ? 'activated' : 'revoked'}`);
}
