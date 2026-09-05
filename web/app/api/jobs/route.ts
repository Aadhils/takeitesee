import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const runtime = 'nodejs';

const EMPLOYMENT_TYPES = new Set(['full_time','part_time','contract','freelance','internship','temporary']);
const WORKPLACE_TYPES = new Set(['onsite','remote','hybrid']);
const SALARY_PERIODS = new Set(['hour','day','month','year','project']);

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function nullableNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}
function skills(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 80)).filter(Boolean))].slice(0, 20);
}
function jobTerms(body: Record<string, unknown>) {
  const employmentType = text(body.employment_type, 40);
  const workplaceType = text(body.workplace_type, 40) || 'onsite';
  const salaryPeriod = text(body.salary_period, 40) || null;
  if (!EMPLOYMENT_TYPES.has(employmentType) || !WORKPLACE_TYPES.has(workplaceType)) throw new Error('Invalid job type.');
  if (salaryPeriod && !SALARY_PERIODS.has(salaryPeriod)) throw new Error('Invalid salary period.');

  const payload = {
    title: text(body.title, 180),
    description: text(body.description, 5000),
    employment_type: employmentType,
    workplace_type: workplaceType,
    location: text(body.location, 180) || null,
    required_skills: skills(body.required_skills),
    minimum_experience_years: nullableNumber(body.minimum_experience_years),
    openings: nullableNumber(body.openings) ?? 1,
    salary_min_minor: nullableNumber(body.salary_min_minor),
    salary_max_minor: nullableNumber(body.salary_max_minor),
    salary_currency: text(body.salary_currency, 3) || 'INR',
    salary_period: salaryPeriod,
    application_deadline: text(body.application_deadline, 10) || null,
  };
  if (payload.title.length < 3 || payload.description.length < 10) throw new Error('Add a clear title and description.');
  return payload;
}
async function ownedBusiness(
  request: Request,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const session = await productionAuthProvider.requireProvider(request);
  const { data: business, error } = await supabase
    .from('businesses')
    .select('id,verified')
    .eq('owner_user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return business;
}
async function attachBusinesses(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, jobs: Record<string, unknown>[]) {
  const ids = [...new Set(jobs.map((job) => String(job.business_id || '')).filter(Boolean))];
  if (!ids.length) return jobs.map((job) => ({ ...job, business: null }));
  const { data, error } = await supabase.from('businesses').select('id,name,verified,location').in('id', ids);
  if (error) throw new Error(error.message);
  const map = new Map((data ?? []).map((business) => [business.id, business]));
  return jobs.map((job) => ({ ...job, business: map.get(String(job.business_id)) ?? null }));
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const url = new URL(request.url);
    const owned = url.searchParams.get('owned') === '1';
    let query = supabase.from('job_postings').select('*').order('created_at', { ascending: false }).limit(100);

    if (owned) {
      const business = await ownedBusiness(request, supabase);
      if (!business) return NextResponse.json({ error: 'Business provider required.' }, { status: 403 });
      query = query.eq('business_id', business.id);
    } else {
      query = query.eq('status', 'open');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ jobs: await attachBusinesses(supabase, (data ?? []) as Record<string, unknown>[]) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load jobs.' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const business = await ownedBusiness(request, supabase);
    if (!business) return NextResponse.json({ error: 'Business provider required.' }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const status = text(body.status, 20) || 'draft';
    if (!['draft','open'].includes(status)) return NextResponse.json({ error: 'New jobs must be draft or open.' }, { status: 400 });
    if (status === 'open' && !business.verified) return NextResponse.json({ error: 'Verify your business before publishing jobs.' }, { status: 403 });

    const payload = { business_id: business.id, ...jobTerms(body), status };
    const { data, error } = await supabase.from('job_postings').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ job: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create job.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const business = await ownedBusiness(request, supabase);
    if (!business) return NextResponse.json({ error: 'Business provider required.' }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const jobId = text(body.job_id, 64);
    if (!jobId) return NextResponse.json({ error: 'Job is required.' }, { status: 400 });

    const { data: job, error: jobError } = await supabase
      .from('job_postings')
      .select('id')
      .eq('id', jobId)
      .eq('business_id', business.id)
      .maybeSingle();
    if (jobError) throw new Error(jobError.message);
    if (!job) return NextResponse.json({ error: 'Job posting was not found.' }, { status: 404 });

    const { count, error: applicationError } = await supabase
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('job_posting_id', jobId);
    if (applicationError) throw new Error(applicationError.message);
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Job terms are locked after the first application.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('job_postings')
      .update({ ...jobTerms(body), updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('business_id', business.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ job: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update job.';
    return NextResponse.json(
      { error: message },
      { status: message.includes('locked after the first application') ? 409 : 400 },
    );
  }
}
