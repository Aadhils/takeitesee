import type { EntityId } from '../../types/entities';
import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
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

export interface CreateProviderServiceInput {
  name: string;
  description: string;
  category_id: EntityId;
  location?: string;
  duration_minutes: number;
  base_price: number;
  currency?: 'INR' | 'USD';
  status?: ProviderServiceStatus;
}
export interface UpdateProviderServiceInput extends Partial<CreateProviderServiceInput> {}

type MarketplaceDisclosure = {
  legal_name?: string | null;
  principal_address?: string | null;
  public_contact_email?: string | null;
  public_contact_phone?: string | null;
  grievance_officer_name?: string | null;
  grievance_officer_designation?: string | null;
  grievance_email?: string | null;
  grievance_phone?: string | null;
};

type ResolvedOwner = {
  provider_type: 'professional' | 'business';
  professional_id: EntityId | null;
  business_id: EntityId | null;
  verified: boolean;
  marketplace_disclosure_complete: boolean;
  trust_status: ProviderTrustStatus;
};
type CanonicalCategory = { id: EntityId; name: string; application_id: EntityId };

function marketplaceDisclosureComplete(provider: MarketplaceDisclosure) {
  return Boolean(
    provider.legal_name?.trim()
    && provider.principal_address?.trim()
    && provider.public_contact_email?.trim()
    && provider.public_contact_phone?.trim()
    && provider.grievance_officer_name?.trim()
    && provider.grievance_officer_designation?.trim()
    && provider.grievance_email?.trim()
    && provider.grievance_phone?.trim(),
  );
}

function validateInput(input: CreateProviderServiceInput | UpdateProviderServiceInput, partial = false) {
  if (!partial || input.name !== undefined) if (!input.name?.trim()) throw new Error('Service name is required.');
  if (!partial || input.description !== undefined) if (!input.description?.trim()) throw new Error('Service description is required.');
  if (!partial || input.category_id !== undefined) if (!input.category_id?.trim()) throw new Error('Platform category is required.');
  if (!partial || input.duration_minutes !== undefined) if (!Number.isInteger(input.duration_minutes) || (input.duration_minutes ?? 0) <= 0) throw new Error('Service duration is invalid.');
  if (!partial || input.base_price !== undefined) if (!Number.isFinite(input.base_price) || (input.base_price ?? -1) < 0) throw new Error('Service price is invalid.');
  if (input.currency !== undefined && !['INR', 'USD'].includes(input.currency)) throw new Error('Currency is invalid.');
  if (input.status !== undefined && !['draft', 'active', 'paused'].includes(input.status)) throw new Error('Service status is invalid.');
}

async function resolveCanonicalCategory(categoryId: EntityId): Promise<CanonicalCategory> {
  const supabase = await createSupabaseServerClient();
  const { data: category, error: categoryError } = await supabase
    .from('platform_categories')
    .select('id,name,application_id')
    .eq('id', categoryId)
    .eq('active', true)
    .maybeSingle();
  if (categoryError) throw new Error(categoryError.message);
  if (!category) throw new Error('Selected platform category is not available.');

  const [{ data: application, error: applicationError }, { data: child, error: childError }] = await Promise.all([
    supabase.from('platform_applications').select('id').eq('id', category.application_id).eq('status', 'active').maybeSingle(),
    supabase.from('platform_categories').select('id').eq('parent_id', category.id).eq('active', true).limit(1).maybeSingle(),
  ]);
  if (applicationError) throw new Error(applicationError.message);
  if (childError) throw new Error(childError.message);
  if (!application) throw new Error('Selected platform category belongs to an inactive application.');
  if (child) throw new Error('Choose a specific specialty category instead of a category group.');

  return { id: category.id as EntityId, name: category.name, application_id: category.application_id as EntityId };
}

async function resolveTrustStatus(owner: Pick<ResolvedOwner, 'provider_type' | 'professional_id' | 'business_id'>): Promise<ProviderTrustStatus> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('provider_current_trust_status', {
    p_provider_type: owner.provider_type,
  });
  if (error) throw new Error(error.message);
  return (data ?? 'normal') as ProviderTrustStatus;
}

async function resolveOwner(session: ServerCustomerSession): Promise<ResolvedOwner> {
  const supabase = await createSupabaseServerClient();
  const disclosureColumns = 'legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone';
  if (session.roles.includes('professional')) {
    const { data, error } = await supabase.from('professional_profiles').select(`id,verified,${disclosureColumns}`).eq('user_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required before adding services.');
    const owner = {
      provider_type: 'professional' as const,
      professional_id: data.id as EntityId,
      business_id: null,
      verified: Boolean(data.verified),
      marketplace_disclosure_complete: marketplaceDisclosureComplete(data),
    };
    return { ...owner, trust_status: await resolveTrustStatus(owner) };
  }
  if (session.roles.includes('business_owner')) {
    const { data, error } = await supabase.from('businesses').select(`id,verified,${disclosureColumns}`).eq('owner_user_id', session.user_id).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Business profile is required before adding services.');
    const owner = {
      provider_type: 'business' as const,
      professional_id: null,
      business_id: data.id as EntityId,
      verified: Boolean(data.verified),
      marketplace_disclosure_complete: marketplaceDisclosureComplete(data),
    };
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
  if (!owner.marketplace_disclosure_complete) throw new Error('Complete marketplace public disclosure in Verification before publishing a service.');
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
    const category = await resolveCanonicalCategory(input.category_id);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('services').insert({ ...ownerFields(owner), name: input.name.trim(), description: input.description.trim(), category: category.name, location: input.location?.trim() || null, duration_minutes: input.duration_minutes, base_price: input.base_price, currency: input.currency ?? 'INR', status, active: status === 'active' }).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'Service could not be created.');
    return mapService(data as Record<string, unknown>);
  },

  async update(session: ServerCustomerSession, serviceId: EntityId, input: UpdateProviderServiceInput): Promise<ProviderServiceRecord> {
    assertProductionBackendConfigured(); validateInput(input, true);
    const owner = await resolveOwner(session); await assertPublishAllowed(owner, input.status, serviceId);
    const supabase = await createSupabaseServerClient(); const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description.trim();
    if (input.category_id !== undefined) patch.category = (await resolveCanonicalCategory(input.category_id)).name;
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
