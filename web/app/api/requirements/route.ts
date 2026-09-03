import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequirementRow = {
  id: string;
  requirement_reference: string;
  customer_id: string;
  category_id: string;
  location_id: string;
  title: string;
  description: string;
  service_mode: 'onsite' | 'remote' | 'either';
  budget_type: 'fixed' | 'range' | 'negotiable';
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: 'INR' | 'USD';
  needed_by: string | null;
  preferred_start_time: string | null;
  expected_duration_minutes: number | null;
  schedule_pattern: 'one_time' | 'recurring';
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number | null;
  recurrence_count: number | null;
  status: 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
  published_at: string;
  closed_at: string | null;
  awarded_at: string | null;
  accepted_proposal_id: string | null;
  created_at: string;
  updated_at: string;
  platform_categories?: { name?: string | null; code?: string | null } | Array<{ name?: string | null; code?: string | null }> | null;
  platform_locations?: { name?: string | null; code?: string | null; timezone?: string | null } | Array<{ name?: string | null; code?: string | null; timezone?: string | null }> | null;
};

function related(value: RequirementRow['platform_categories'] | RequirementRow['platform_locations']) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? row : null;
}

function safeRequirement(row: RequirementRow) {
  const category = related(row.platform_categories);
  const location = related(row.platform_locations);
  return {
    id: row.id,
    reference: row.requirement_reference,
    category_id: row.category_id,
    category_name: String(category?.name ?? ''),
    location_id: row.location_id,
    location_name: String(location?.name ?? ''),
    title: row.title,
    description: row.description,
    service_mode: row.service_mode,
    budget_type: row.budget_type,
    budget_min_minor: row.budget_min_minor == null ? null : Number(row.budget_min_minor),
    budget_max_minor: row.budget_max_minor == null ? null : Number(row.budget_max_minor),
    currency: row.currency,
    needed_by: row.needed_by,
    preferred_start_time: row.preferred_start_time,
    expected_duration_minutes: row.expected_duration_minutes == null ? null : Number(row.expected_duration_minutes),
    schedule_pattern: row.schedule_pattern,
    recurrence_frequency: row.recurrence_frequency,
    recurrence_interval: row.recurrence_interval == null ? null : Number(row.recurrence_interval),
    recurrence_count: row.recurrence_count == null ? null : Number(row.recurrence_count),
    status: row.status,
    published_at: row.published_at,
    closed_at: row.closed_at,
    awarded_at: row.awarded_at,
    accepted_proposal_id: row.accepted_proposal_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const requirementSelect = 'id,requirement_reference,customer_id,category_id,location_id,title,description,service_mode,budget_type,budget_min_minor,budget_max_minor,currency,needed_by,preferred_start_time,expected_duration_minutes,schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,status,published_at,closed_at,awarded_at,accepted_proposal_id,created_at,updated_at,platform_categories(name,code),platform_locations(name,code,timezone)';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('customer_requirements')
      .select(requirementSelect)
      .eq('customer_id', session.user_id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ requirements: ((data ?? []) as unknown as RequirementRow[]).map(safeRequirement) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requirements.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const input = await request.json() as {
      idempotency_key?: string;
      category_id?: string;
      location_id?: string;
      title?: string;
      description?: string;
      service_mode?: string;
      budget_type?: string;
      budget_min_minor?: number | null;
      budget_max_minor?: number | null;
      currency?: string;
      needed_by?: string | null;
      preferred_start_time?: string | null;
      expected_duration_minutes?: number | null;
      schedule_pattern?: 'one_time' | 'recurring';
      recurrence_frequency?: 'daily' | 'weekly' | 'monthly' | null;
      recurrence_interval?: number | null;
      recurrence_count?: number | null;
    };

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_customer_requirement', {
      requested_idempotency_key: input.idempotency_key?.trim() ?? '',
      target_category_id: input.category_id ?? null,
      target_location_id: input.location_id ?? null,
      target_title: input.title?.trim() ?? '',
      target_description: input.description?.trim() ?? '',
      target_service_mode: input.service_mode ?? 'onsite',
      target_budget_type: input.budget_type ?? 'negotiable',
      target_budget_min_minor: input.budget_min_minor ?? null,
      target_budget_max_minor: input.budget_max_minor ?? null,
      target_currency: input.currency ?? 'INR',
      target_needed_by: input.needed_by || null,
      target_preferred_start_time: input.preferred_start_time || null,
      target_expected_duration_minutes: input.expected_duration_minutes ?? null,
      target_schedule_pattern: input.schedule_pattern ?? 'one_time',
      target_recurrence_frequency: input.recurrence_frequency ?? null,
      target_recurrence_interval: input.recurrence_interval ?? null,
      target_recurrence_count: input.recurrence_count ?? null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Requirement could not be posted.');

    const created = data as unknown as RequirementRow;
    const { data: hydrated, error: hydrateError } = await supabase
      .from('customer_requirements')
      .select(requirementSelect)
      .eq('id', created.id)
      .maybeSingle();
    if (hydrateError) throw new Error(hydrateError.message);

    return NextResponse.json({ requirement: safeRequirement((hydrated ?? created) as unknown as RequirementRow) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Requirement could not be posted.';
    const status = /authentication|required|own/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
