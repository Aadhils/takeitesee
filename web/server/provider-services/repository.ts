import type { EntityId } from '../../types/entities';
import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../lib/supabase/service';
import { assertProductionBackendConfigured } from '../config';

export type ProviderServiceStatus = 'draft' | 'active' | 'paused';
export type ProviderTrustStatus = 'normal' | 'reverification_required' | 'suspended';

export interface ProviderServiceRecord {
  id: EntityId;
  provider_type: 'professional' | 'business';
  professional_id: EntityId | null;
  business_id: EntityId | null;
  name: string;
  description: string;
  category: string | null;
  location: string | null;
  duration_minutes: number;
  base_price: number;
  currency: 'INR' | 'USD';
  status: ProviderServiceStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderServiceInput { name: string; description: string; category?: string; location?: string; duration_minutes: number; base_price: number; currency?: 'INR' | 'USD'; status?: ProviderServiceStatus; }
export interface UpdateProviderServiceInput extends Partial<CreateProviderServiceInput> {}

type ResolvedOwner = { provider_type: 'professional' | 'business'; professional_id: EntityId | null; business_id: EntityId | null; verified: boolean; trust_status: ProviderTrustStatus };

function validateInput(input: CreateProviderServiceInput | UpdateProviderServiceInput, partial = false) {
  if (!partial || input.name !== undefined) if (!input.name?.trim()) throw new Error('Service name is required.');
  if (!partial || input.description !== undefined) if (!input.description?.trim()) throw new Error('Service description is required.');
  if (!partial || input.duration_minutes !== undefined) if (!Number.isInteger(input.duration_minutes) || (input.duration_minutes ?? 0) <= 0) throw new Error('Service duration is invalid.');
  if (!partial || input.base_price !== undefined) if (!Number.isFinite(input.base_price) || (input.base_price ?? -1) < 0) throw new Error('Service price is invalid.');
  if (input.currency !== undefined && !['INR', 'USD'].includes(input.currency)) throw new Error('Currency is invalid.');
  if (input.status !== undefined && !['draft', 'active', 'paused'].includes(input.status)) throw new Error('Service status is invalid.');
}

async function resolveTrustStatus(owner: Omit<ResolvedOwner, 'trust_status'>): Promise<ProviderTrustStatus> {
  // Phase 17 moved the trust primitive to the non-exposed private schema. Use the
  // service-role-only public compatibility bridge; never re-expose it to provider sessions.
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc('provider_trust_status', {
    p_provider_type: owner.provider_type,
    p_professional_id: owner.professional_id,
    p_business_id: owner.business_id,
  });
  if (error) throw new Error(error.message);
  return (data ?? 'normal') as ProviderTrustStatus;
}

async function resolveOwner(session: ServerCustomerSession): Promise<ResolvedOwner> {
  const supabase = await createSupabaseServerClient();
  if (session.roles.includes('professional')) {
    const { data, error } = await supabase.from('professional_profiles').select('id,verified').eq('user_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required before adding services.');
    const owner = { provider_type: 'professional' as const, professional_id: data.id as EntityId, business_id: null, verified: Boolean(data.verified) };
    return { ...owner, trust_status: await resolveTrustStatus(owner) };
  }
  if (session.roles.includes('business_owner')) {
    const { data, error } = await supabase.from('businesses').select('id,verified').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Business profile is required before adding services.');
    const owner = { provider_type: 'business' as const, professional_id: null, business_id: data.id as EntityId, verified: Boolean(data.verified) };
    return { ...owner, trust_status: await resolveTrustStatus(owner) };
  }
  throw new Error('Provider role is required.');
}

async function assertPublishAllowed(owner: ResolvedOwner, status: ProviderServiceStatus | undefined, serviceId?: EntityId) {
  if (status !== 'active') return;
  if (owner.trust_status === 'suspended') throw new Error('Provider suspension must be resolved by the platform before services can be activated.');
  if (owner.trust_status === 'reverification_required') throw new Error('Provider re-verification is required before services can be activated. Open Verification to submit current evidence.');
  if (!owner.verified) throw new Error('Provider verification is required before a service can be published. Complete Verification first.');
  const supabase = await createSupabaseServerClient();
  const { data: profileComplete, error: profileError } = await supabase.rpc('provider_profile_is_complete', {
    p_provider_type: owner.provider_type,
    p_professional_id: owner.professional_id,
    p_business_id: owner.business_id,
  });
  if (profileError) throw new Error(profileError.message);
  if (!profileComplete) throw new Error('Complete your provider profile before publishing a service.');
  if (!serviceId) throw new Error('Save the service as a draft, then request platform category and location approval from Provider Setup before activation.');
  const { data: scopeReady, error: scopeError } = await supabase.rpc('service_scope_is_launchable', { p_service_id: serviceId });
  if (scopeError) throw new Error(scopeError.message);
  if (!scopeReady) throw new Error('Platform category and location approval is required before activation. Open Provider Setup to request approval.');
}

function mapService(row: Record<string, unknown>): ProviderServiceRecord {
  return { id: row.id as EntityId, provider_type: row.provider_type as 'professional' | 'business', professional_id: (row.professional_id as EntityId | null) ?? null, business_id: (row.business_id as EntityId | null) ?? null, name: row.name as string, description: row.description as string, category: (row.category as string | null) ?? null, location: (row.location as string | null) ?? null, duration_minutes: Number(row.duration_minutes), base_price: Number(row.base_price), currency: row.currency as 'INR' | 'USD', status: row.status as ProviderServiceStatus, created_at: row.created_at as string, updated_at: row.updated_at as string };
}

function ownerFields(owner: ResolvedOwner) { return { provider_type: owner.provider_type, professional_id: owner.professional_id, business_id: owner.business_id }; }

export const productionProviderServiceRepository = {
  async list(session: ServerCustomerSession): Promise<ProviderServiceRecord[]> {
    assertProductionBackendConfigured();
    const owner = await resolveOwner(session);
    const supabase = await createSupabaseServerClient();
    let query = supabase.from('services').select('*').order('created_at', { ascending: false });
    query = owner.provider_type === 'professional' ? query.eq('professional_id', owner.professional_id) : query.eq('business_id', owner.business_id);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapService(row as Record<string, unknown>));
  },

  async create(session: ServerCustomerSession, input: CreateProviderServiceInput): Promise<ProviderServiceRecord> {
    assertProductionBackendConfigured(); validateInput(input);
    const owner = await resolveOwner(session); const status = input.status ?? 'draft';
    await assertPublishAllowed(owner, status);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('services').insert({ ...ownerFields(owner), name: input.name.trim(), description: input.description.trim(), category: input.category?.trim() || null, location: input.location?.trim() || null, duration_minutes: input.duration_minutes, base_price: input.base_price, currency: input.currency ?? 'INR', status, active: status === 'active' }).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'Service could not be created.');
    return mapService(data as Record<string, unknown>);
  },

  async update(session: ServerCustomerSession, serviceId: EntityId, input: UpdateProviderServiceInput): Promise<ProviderServiceRecord> {
    assertProductionBackendConfigured(); validateInput(input, true);
    const owner = await resolveOwner(session); await assertPublishAllowed(owner, input.status, serviceId);
    const supabase = await createSupabaseServerClient(); const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description.trim();
    if (input.category !== undefined) patch.category = input.category.trim() || null;
    if (input.location !== undefined) patch.location = input.location.trim() || null;
    if (input.duration_minutes !== undefined) patch.duration_minutes = input.duration_minutes;
    if (input.base_price !== undefined) patch.base_price = input.base_price;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.status !== undefined) { patch.status = input.status; patch.active = input.status === 'active'; }
    let query = supabase.from('services').update(patch).eq('id', serviceId);
    query = owner.provider_type === 'professional' ? query.eq('professional_id', owner.professional_id) : query.eq('business_id', owner.business_id);
    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Service was not found or is not owned by this provider.');
    return mapService(data as Record<string, unknown>);
  },
};
