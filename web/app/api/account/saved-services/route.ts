import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

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
  professional_profiles?: { headline?: string | null; service_area?: string | null; verified?: boolean | null } | Array<{ headline?: string | null; service_area?: string | null; verified?: boolean | null }> | null;
  businesses?: { name?: string | null; location?: string | null; verified?: boolean | null } | Array<{ name?: string | null; location?: string | null; verified?: boolean | null }> | null;
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

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

function presentation(service: ServiceRow) {
  const professional = relation(service.professional_profiles);
  const business = relation(service.businesses);
  const provider = service.provider_type === 'business' ? business : professional;
  const verified = provider?.verified === true;
  const available = service.active === true && service.status === 'active' && verified;
  const providerName = service.provider_type === 'business' ? business?.name : professional?.headline;
  const providerLocation = service.provider_type === 'business' ? business?.location : professional?.service_area;
  return {
    available,
    service: available ? {
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      location: service.location ?? providerLocation ?? null,
      duration_minutes: service.duration_minutes,
      base_price: Number(service.base_price),
      currency: service.currency,
      provider_type: service.provider_type,
      provider_name: providerName || 'Verified provider',
    } : null,
  };
}

const serviceSelect = 'id,provider_type,professional_id,business_id,name,description,location,duration_minutes,base_price,currency,category,active,status,professional_profiles(headline,service_area,verified),businesses(name,location,verified)';

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

    const byId = new Map(services.map((service) => [service.id, service]));
    const saved_services = rows.map((row) => {
      const service = byId.get(row.service_id);
      if (!service) return { service_id: row.service_id, saved_at: row.saved_at, available: false, service: null };
      const view = presentation(service);
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

    const view = presentation(data as unknown as ServiceRow);
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
