'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

const allowedScopeTypes = new Set(['platform', 'application', 'location', 'category', 'service']);

async function requireSuperAdmin() {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');
  return session;
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1';
}

export async function assignAdministrator(formData: FormData) {
  const session = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const scopeType = String(formData.get('scope_type') ?? '').trim();
  const targetId = String(formData.get('target_id') ?? '').trim();
  const canManage = asBoolean(formData.get('can_manage'));
  const canView = canManage || asBoolean(formData.get('can_view'));

  if (!email || !email.includes('@')) throw new Error('A valid existing user email is required.');
  if (!allowedScopeTypes.has(scopeType)) throw new Error('Invalid admin scope type.');
  if (!canView && !canManage) throw new Error('Choose at least View or Manage permission.');
  if (scopeType !== 'platform' && !targetId) throw new Error('Choose the resource this administrator can access.');

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', email)
    .maybeSingle();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error('No Takeitesee account exists with that email. Ask the user to create an account first.');

  let targetLabel = 'Entire platform';
  if (scopeType === 'application') {
    const { data, error } = await supabase.from('platform_applications').select('id, name').eq('id', targetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Selected application no longer exists.');
    targetLabel = data.name;
  } else if (scopeType === 'location') {
    const { data, error } = await supabase.from('platform_locations').select('id, name').eq('id', targetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Selected location no longer exists.');
    targetLabel = data.name;
  } else if (scopeType === 'category') {
    const { data, error } = await supabase.from('platform_categories').select('id, name').eq('id', targetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Selected category no longer exists.');
    targetLabel = data.name;
  } else if (scopeType === 'service') {
    const { data, error } = await supabase.from('services').select('id, name').eq('id', targetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Selected service no longer exists.');
    targetLabel = data.name;
  }

  const { data: existingMembership, error: membershipLookupError } = await supabase
    .from('admin_memberships')
    .select('id, active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipLookupError) throw new Error(membershipLookupError.message);

  let membershipId = existingMembership?.id as string | undefined;
  if (!membershipId) {
    const { data, error } = await supabase
      .from('admin_memberships')
      .insert({ user_id: user.id, active: true, created_by: session.user_id })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    membershipId = data.id;
  } else if (!existingMembership.active) {
    const { error } = await supabase
      .from('admin_memberships')
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq('id', membershipId);
    if (error) throw new Error(error.message);
  }

  const { data: existingScopes, error: scopeLookupError } = await supabase
    .from('admin_scopes')
    .select('id, scope_type, application_id, location_id, category_id, service_id')
    .eq('admin_membership_id', membershipId);
  if (scopeLookupError) throw new Error(scopeLookupError.message);

  const sameScope = (existingScopes ?? []).find((scope) => {
    if (scope.scope_type !== scopeType) return false;
    if (scopeType === 'platform') return true;
    if (scopeType === 'application') return scope.application_id === targetId;
    if (scopeType === 'location') return scope.location_id === targetId;
    if (scopeType === 'category') return scope.category_id === targetId;
    return scope.service_id === targetId;
  });

  const scopePayload = {
    can_view: canView,
    can_manage: canManage,
    created_by: session.user_id,
    application_id: scopeType === 'application' ? targetId : null,
    location_id: scopeType === 'location' ? targetId : null,
    category_id: scopeType === 'category' ? targetId : null,
    service_id: scopeType === 'service' ? targetId : null,
  };

  let scopeId: string;
  if (sameScope) {
    const { data, error } = await supabase
      .from('admin_scopes')
      .update({ can_view: canView, can_manage: canManage })
      .eq('id', sameScope.id)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    scopeId = data.id;
  } else {
    const { data, error } = await supabase
      .from('admin_scopes')
      .insert({ admin_membership_id: membershipId, scope_type: scopeType, ...scopePayload })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    scopeId = data.id;
  }

  await supabase.from('admin_audit_log').insert({
    actor_user_id: session.user_id,
    action: sameScope ? 'admin.scope_updated' : 'admin.scope_assigned',
    resource_type: 'admin_scope',
    resource_id: scopeId,
    metadata: {
      admin_user_id: user.id,
      admin_email: user.email,
      scope_type: scopeType,
      target_id: scopeType === 'platform' ? null : targetId,
      target_label: targetLabel,
      can_view: canView,
      can_manage: canManage,
    },
  });

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/admins');
}
