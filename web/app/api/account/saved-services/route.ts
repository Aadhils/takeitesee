import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { loadPublicProviderIdentity, type PublicProviderIdentity } from '../../../../server/marketplace/public-provider-identity';

export const runtime = 'nodejs';

type SavedServiceRow = { service_id: string; saved_at: string };
type ProviderType = 'professional' | 'business';
type ServiceRow = {
  id: string;
  provider_type: ProviderType;
  professional_id: string | null;
  business_id: string | null;
  name: string;
  description: string;
  location: string | null;
  duration_minutes: number;
  base_price: number | string;
  currency: string;
  category: string | null;
  active: boolean;
  status: string;
};

async function customerContext(request: Request) {
  const session = await productionAuthProvider.getSession(request);
  if (!session) throw new Error('Authentication required.');

  const supabase = await createSupabaseServerClient();
  const { data: customer, error } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) throw new Error('Customer profile required.');
  return { session, supabase, customer };
}

function providerId(service: ServiceRow) {
  return service.provider_type === 'business' ? service.business_id : service.professional_id;
}

function presentation(service: ServiceRow, provider: PublicProviderIdentity | null) {
  const available = service.active === true && service.status === 'active' && provider?.verified === true;
  return {
    available,
    service: available ? {
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      location: service.location ?? provider?.location ?? null,
      duration_minutes: service.duration_minutes,
      base_price: Number(service.base_price),
      currency: service.currency,
      provider_type: service.provider_type,
      provider_name: provider?.display_name || 'Verified provider',
    } : null,
  };
}

const serviceSelect = 'id,provider_type,professional_id,business_id,name,description,location,duration_minutes,base_price,currency,category,active,status';

async function providerIdentities(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, services: ServiceRow[]) {
  const unique = new Map<string, { type: ProviderType; id: string }>();
  for (const service of services) {
    const id = providerId(service);
    if (id) unique.set(`${service.provider_type}:${id}`, { type: service.provider_type, id });
  }

  const entries = await Promise.all(Array.from(unique.entries()).map(async ([key, value]) => {
    const identity = await loadPublicProviderIdentity(supabase, value.type, value.id);
    return [key, identity] as const;
  }));
  return new Map(entries);
}

export async function GET(request: Request) {
  try {
    const context = await customerContext(request);
    const requestedServiceId = new URL(request.url).searchParams.get('service_id')?.trim() || '';

    if (requestedServiceId) {
      const { data, error } = await context.supabase
        .from('customer_saved_services')
        .select('service_id')
        .eq('customer_id', context.customer.id)
        .eq('service_id', requestedServiceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return NextResponse.json({ saved: Boolean(data) });
    }

    const { data: savedRows, error: savedError } = await context.supabase
      .from('customer_saved_services')
      .select('service_id,saved_at')
      .eq('customer_id', context.customer.id)
      .order('saved_at', { ascending: false });
    if (savedError) throw new Error(savedError.message);

    const rows = (savedRows ?? []) as SavedServiceRow[];
    const serviceIds = rows.map((row) => row.service_id);
    let services: ServiceRow[] = [];
    if (serviceIds.length) {
      const { data, error } = await context.supabase
        .from('services')
        .select(serviceSelect)
        .in('id', serviceIds);
      if (error) throw new Error(error.message);
      services = (data ?? []) as unknown as ServiceRow[];
    }

    const identities = await providerIdentities(context.supabase, services);
    const byId = new Map(services.map((service) => [service.id, service]));
    const saved_services = rows.map((row) => {
      const service = byId.get(row.service_id);
      if (!service) return { service_id: row.service_id, saved_at: row.saved_at, available: false, service: null };
      const id = providerId(service);
      const identity = id ? identities.get(`${service.provider_type}:${id}`) ?? null : null;
      const view = presentation(service, identity);
      return { service_id: row.service_id, saved_at: row.saved_at, ...view };
    });

    return NextResponse.json({ saved_services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load saved services.';
    const status = message === 'Authentication required.' ? 401 : message === 'Customer profile required.' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const context = await customerContext(request);
    const body = await request.json() as Record<string, unknown>;
    const serviceId = typeof body.service_id === 'string' ? body.service_id.trim() : '';
    if (!serviceId) return NextResponse.json({ error: 'Service is required.' }, { status: 400 });

    const { data, error } = await context.supabase
      .from('services')
      .select(serviceSelect)
      .eq('id', serviceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'This service is not available to save.' }, { status: 409 });

    const service = data as unknown as ServiceRow;
    const id = providerId(service);
    const identity = await loadPublicProviderIdentity(context.supabase, service.provider_type, id);
    const view = presentation(service, identity);
    if (!view.available) return NextResponse.json({ error: 'This service is not currently available to save.' }, { status: 409 });

    const { data: saved, error: saveError } = await context.supabase
      .from('customer_saved_services')
      .insert({ customer_id: context.customer.id, service_id: serviceId })
      .select('service_id,saved_at')
      .single();

    if (saveError?.code === '23505') {
      const { data: existing, error: existingError } = await context.supabase
        .from('customer_saved_services')
        .select('service_id,saved_at')
        .eq('customer_id', context.customer.id)
        .eq('service_id', serviceId)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      return NextResponse.json({ saved_service: existing, already_saved: true });
    }
    if (saveError) throw new Error(saveError.message);
    return NextResponse.json({ saved_service: saved, already_saved: false }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save service.';
    const status = message === 'Authentication required.' ? 401 : message === 'Customer profile required.' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await customerContext(request);
    const body = await request.json() as Record<string, unknown>;
    const serviceId = typeof body.service_id === 'string' ? body.service_id.trim() : '';
    if (!serviceId) return NextResponse.json({ error: 'Service is required.' }, { status: 400 });

    const { error } = await context.supabase
      .from('customer_saved_services')
      .delete()
      .eq('customer_id', context.customer.id)
      .eq('service_id', serviceId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ removed: true, service_id: serviceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove saved service.';
    const status = message === 'Authentication required.' ? 401 : message === 'Customer profile required.' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
