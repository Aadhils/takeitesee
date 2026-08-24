'use server';
import { revalidatePath } from 'next/cache';
import { requireAdminAccess } from '../../../lib/admin/access';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const types = new Set(['country','state','city','zone']);
export async function createLocation(formData: FormData) {
  const access = await requireAdminAccess({ superAdminOnly: true });
  const supabase = await createSupabaseServerClient();
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toLowerCase();
  const type = String(formData.get('type') ?? '');
  const parentId = String(formData.get('parent_id') ?? '') || null;
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase() || null;
  const timezone = String(formData.get('timezone') ?? '').trim() || null;
  if (!name || !code || !types.has(type)) throw new Error('Valid location details are required.');
  const { data, error } = await supabase.from('platform_locations').insert({ name, code, type, parent_id: parentId, country_code: countryCode, timezone }).select('id').single();
  if (error) throw new Error(error.message);
  await supabase.from('admin_audit_log').insert({ actor_user_id: access.platformUserId, action:'location.created', resource_type:'platform_location', resource_id:data.id, location_id:data.id, metadata:{name,code,type,parent_id:parentId} });
  revalidatePath('/super-admin'); revalidatePath('/super-admin/locations');
}

export async function setApplicationLocation(formData: FormData) {
  const access = await requireAdminAccess({ superAdminOnly: true });
  const supabase = await createSupabaseServerClient();
  const applicationId = String(formData.get('application_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const enabled = String(formData.get('enabled')) === 'true';
  if (!applicationId || !locationId) throw new Error('Application and location are required.');
  const { error } = await supabase.from('application_locations').upsert({ application_id:applicationId, location_id:locationId, enabled, updated_at:new Date().toISOString() }, { onConflict:'application_id,location_id' });
  if (error) throw new Error(error.message);
  await supabase.from('admin_audit_log').insert({ actor_user_id:access.platformUserId, action:'application.location_changed', resource_type:'application_location', resource_id:`${applicationId}:${locationId}`, application_id:applicationId, location_id:locationId, metadata:{enabled} });
  revalidatePath('/super-admin/locations');
}
