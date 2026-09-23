import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../../server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AvailabilityMode = 'always_available' | 'on_request' | 'scheduled';
type ProviderIdentity = {
  provider_type: 'professional' | 'business';
  provider_id: string;
};

type UpdatePayload = {
  service_id?: string;
  mode?: AvailabilityMode;
};

async function resolveProviderIdentity(request: Request, userId: string): Promise<ProviderIdentity> {
  const supabase = await createSupabaseServerClient(request);
  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', userId).limit(1).maybeSingle(),
  ]);

  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) return { provider_type: 'professional', provider_id: professional.id };
  if (business) return { provider_type: 'business', provider_id: business.id };
  throw new Error('Provider identity was not found.');
}

async function loadOwnedService(request: Request, identity: ProviderIdentity, serviceId: string) {
  const supabase = await createSupabaseServerClient(request);
  let query = supabase
    .from('services')
    .select('id,name,status,category,location,duration_minutes,base_price,currency')
    .eq('id', serviceId);
  query = identity.provider_type === 'professional'
    ? query.eq('professional_id', identity.provider_id).eq('provider_type', 'professional')
    : query.eq('business_id', identity.provider_id).eq('provider_type', 'business');
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Service was not found or is not owned by this Provider.');
  return data;
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const identity = await resolveProviderIdentity(request, session.user_id);
    const supabase = await createSupabaseServerClient(request);

    let serviceQuery = supabase
      .from('services')
      .select('id,name,status,category,location,duration_minutes,base_price,currency')
      .order('created_at', { ascending: false });
    serviceQuery = identity.provider_type === 'professional'
      ? serviceQuery.eq('professional_id', identity.provider_id).eq('provider_type', 'professional')
      : serviceQuery.eq('business_id', identity.provider_id).eq('provider_type', 'business');

    const { data: services, error: servicesError } = await serviceQuery;
    if (servicesError) throw new Error(servicesError.message);
    const serviceIds = (services ?? []).map((service) => service.id);

    if (serviceIds.length === 0) {
      return NextResponse.json({ services: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const [{ data: settings, error: settingsError }, { data: windows, error: windowsError }] = await Promise.all([
      supabase.from('service_availability').select('service_id,mode,timezone').in('service_id', serviceIds),
      supabase.from('service_availability_windows').select('service_id').in('service_id', serviceIds),
    ]);
    if (settingsError) throw new Error(settingsError.message);
    if (windowsError) throw new Error(windowsError.message);

    const settingByService = new Map((settings ?? []).map((setting) => [setting.service_id, setting]));
    const windowCountByService = new Map<string, number>();
    for (const window of windows ?? []) {
      windowCountByService.set(window.service_id, (windowCountByService.get(window.service_id) ?? 0) + 1);
    }

    return NextResponse.json({
      services: (services ?? []).map((service) => {
        const setting = settingByService.get(service.id);
        return {
          ...service,
          availability_mode: (setting?.mode as AvailabilityMode | undefined) ?? 'on_request',
          timezone: setting?.timezone ?? 'Asia/Kolkata',
          weekly_window_count: windowCountByService.get(service.id) ?? 0,
        };
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load Provider service availability.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const identity = await resolveProviderIdentity(request, session.user_id);
    const payload = await request.json() as UpdatePayload;
    const serviceId = payload.service_id?.trim() ?? '';
    const mode = payload.mode;

    if (!serviceId) throw new Error('Service is required.');
    if (!mode || !['always_available', 'on_request', 'scheduled'].includes(mode)) {
      throw new Error('Availability mode is invalid.');
    }

    const service = await loadOwnedService(request, identity, serviceId);
    const supabase = await createSupabaseServerClient(request);
    const [{ data: setting, error: settingError }, { count: weeklyWindowCount, error: windowError }] = await Promise.all([
      supabase.from('service_availability').select('timezone').eq('service_id', serviceId).maybeSingle(),
      supabase.from('service_availability_windows').select('service_id', { count: 'exact', head: true }).eq('service_id', serviceId),
    ]);
    if (settingError) throw new Error(settingError.message);
    if (windowError) throw new Error(windowError.message);

    if (mode === 'scheduled' && (weeklyWindowCount ?? 0) === 0) {
      throw new Error('Scheduled availability requires existing weekly hours. Configure the detailed schedule on web first.');
    }

    const timezone = setting?.timezone ?? 'Asia/Kolkata';
    const { error: saveError } = await supabase.from('service_availability').upsert({
      service_id: serviceId,
      mode,
      timezone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'service_id' });
    if (saveError) throw new Error(saveError.message);

    return NextResponse.json({
      service: {
        ...service,
        availability_mode: mode,
        timezone,
        weekly_window_count: weeklyWindowCount ?? 0,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update Provider service availability.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
