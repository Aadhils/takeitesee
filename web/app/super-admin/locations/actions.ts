'use server';

import { revalidatePath } from 'next/cache';
import { productionAuthProvider } from '../../../server/auth/session';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const allowedTypes = new Set(['country', 'state', 'city', 'zone']);

async function requireSuperAdmin() {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');
  return session;
}

export async function createLocation(formData: FormData) {
  const session = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toLowerCase();
  const type = String(formData.get('type') ?? '');
  const parentId = String(formData.get('parent_id') ?? '') || null;
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase() || null;
  const timezone = String(formData.get('timezone') ?? '').trim() || null;

  if (!name || !/^[a-z0-9][a-z0-9_-]{1,62}$/.test(code) || !allowedTypes.has(type)) {
    throw new Error('Valid location name, code, and type are required.');
  }
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) throw new Error('Country code must be a 2-letter ISO code.');

  const { data, error } = await supabase
    .from('platform_locations')
    .insert({ name, code, type, parent_id: parentId, country_code: countryCode, timezone })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from('admin_audit_log').insert({
    actor_user_id: session.user_id,
    action: 'location.created',
    resource_type: 'platform_location',
    resource_id: data.id,
    location_id: data.id,
    metadata: { name, code, type, parent_id: parentId },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath('/super-admin');
  revalidatePath('/super-admin/locations');
}

export async function setApplicationLocation(formData: FormData) {
  const session = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();
  const applicationId = String(formData.get('application_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const enabled = String(formData.get('enabled')) === 'true';
  if (!applicationId || !locationId) throw new Error('Application and location are required.');

  const { error } = await supabase.from('application_locations').upsert(
    { application_id: applicationId, location_id: locationId, enabled, updated_at: new Date().toISOString() },
    { onConflict: 'application_id,location_id' },
  );
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from('admin_audit_log').insert({
    actor_user_id: session.user_id,
    action: 'application.location_changed',
    resource_type: 'application_location',
    resource_id: `${applicationId}:${locationId}`,
    application_id: applicationId,
    location_id: locationId,
    metadata: { enabled },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath('/super-admin/locations');
}
