import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';

async function providerContext(request: Request) {
  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id,name,verified')
    .eq('owner_user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (business) return { session, supabase, mode: 'business' as const, business };

  const { data: professional, error: professionalError } = await supabase
    .from('professional_profiles')
    .select('id,headline,verified')
    .eq('user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (professionalError) throw new Error(professionalError.message);
  if (!professional) throw new Error('Provider profile not found.');
  return { session, supabase, mode: 'professional' as const, professional };
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function compensationMinor(value: unknown) {
  if (value == null || String(value).trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Compensation must be a valid non-negative amount.');
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor)) throw new Error('Compensation amount is too large.');
  return minor;
}

function optionalIsoDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`${label} must be a valid date.`);
  return trimmed;
}

function optionalIsoTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Offer response deadline is invalid.');
  if (date.getTime() <= Date.now()) throw new Error('Offer response deadline must be in the future.');
  return date.toISOString();
}

async function workspacePayload(request: Request) {
  const context = await providerContext(request);

  if (context.mode === 'business') {
    const { data: jobs, error: jobsError } = await context.supabase
      .from('job_postings')
      .select('id,title,employment_type,workplace_type,location,salary_min_minor,salary_max_minor,salary_currency,salary_period,status')
      .eq('business_id', context.business.id)
      .order('created_at', { ascending: false });
    if (jobsError) throw new Error(jobsError.message);

    const jobIds = (jobs ?? []).map((job) => job.id);
    let applications: Record<string, unknown>[] = [];
    if (jobIds.length) {
      const { data, error } = await context.supabase
        .from('job_applications')
        .select('id,job_posting_id,professional_id,status,applied_at')
        .in('job_posting_id', jobIds)
        .order('applied_at', { ascending: false });
      if (error) throw new Error(error.message);
      applications = (data ?? []) as Record<string, unknown>[];
    }

    const applicationIds = applications.map((application) => String(application.id || '')).filter(Boolean);
    const professionalIds = [...new Set(applications.map((application) => String(application.professional_id || '')).filter(Boolean))];

    let offers: Record<string, unknown>[] = [];
    if (applicationIds.length) {
      const { data, error } = await context.supabase
        .from('job_offers')
        .select('*')
        .in('job_application_id', applicationIds)
        .order('issued_at', { ascending: false });
      if (error) throw new Error(error.message);
      offers = (data ?? []) as Record<string, unknown>[];
    }

    let professionals: Record<string, unknown>[] = [];
    if (professionalIds.length) {
      const { data, error } = await context.supabase
        .from('professional_profiles')
        .select('id,headline,service_area,verified')
        .in('id', professionalIds);
      if (error) throw new Error(error.message);
      professionals = (data ?? []) as Record<string, unknown>[];
    }

    return { mode: 'business' as const, business: context.business, jobs: jobs ?? [], applications, professionals, offers };
  }

  const { data: applications, error: applicationsError } = await context.supabase
    .from('job_applications')
    .select('id,job_posting_id,professional_id,status,applied_at')
    .eq('professional_id', context.professional.id)
    .order('applied_at', { ascending: false });
  if (applicationsError) throw new Error(applicationsError.message);

  const applicationIds = (applications ?? []).map((application) => application.id);
  const jobIds = (applications ?? []).map((application) => application.job_posting_id);

  let offers: Record<string, unknown>[] = [];
  if (applicationIds.length) {
    const { data, error } = await context.supabase
      .from('job_offers')
      .select('*')
      .in('job_application_id', applicationIds)
      .order('issued_at', { ascending: false });
    if (error) throw new Error(error.message);
    offers = (data ?? []) as Record<string, unknown>[];
  }

  let jobs: Record<string, unknown>[] = [];
  if (jobIds.length) {
    const { data, error } = await context.supabase
      .from('job_postings')
      .select('id,title,employment_type,workplace_type,location,salary_min_minor,salary_max_minor,salary_currency,salary_period,status')
      .in('id', jobIds);
    if (error) throw new Error(error.message);
    jobs = (data ?? []) as Record<string, unknown>[];
  }

  return { mode: 'professional' as const, professional: context.professional, applications: applications ?? [], jobs, offers };
}

export async function GET(request: Request) {
  try {
    return NextResponse.json(await workspacePayload(request));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load employment offers.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await providerContext(request);
    if (context.mode !== 'business') return NextResponse.json({ error: 'Business employer required to issue an offer.' }, { status: 403 });
    if (!context.business.verified) return NextResponse.json({ error: 'Verify your business before issuing employment offers.' }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const applicationId = typeof body.application_id === 'string' ? body.application_id : '';
    if (!applicationId) return NextResponse.json({ error: 'Job application is required.' }, { status: 400 });

    const { data: application, error: applicationError } = await context.supabase
      .from('job_applications')
      .select('id,job_posting_id,status')
      .eq('id', applicationId)
      .maybeSingle();
    if (applicationError) throw new Error(applicationError.message);
    if (!application) return NextResponse.json({ error: 'Job application was not found.' }, { status: 404 });
    if (application.status !== 'interview') return NextResponse.json({ error: 'Employment offers can only be issued while the application is in interview stage.' }, { status: 409 });

    const { data: job, error: jobError } = await context.supabase
      .from('job_postings')
      .select('id,business_id,title,employment_type,workplace_type,location')
      .eq('id', application.job_posting_id)
      .eq('business_id', context.business.id)
      .maybeSingle();
    if (jobError) throw new Error(jobError.message);
    if (!job) return NextResponse.json({ error: 'This application does not belong to your business.' }, { status: 403 });

    const positionTitle = cleanText(body.position_title, 180) ?? job.title;
    const employmentType = cleanText(body.employment_type, 32) ?? job.employment_type;
    const workplaceType = cleanText(body.workplace_type, 32) ?? job.workplace_type;
    const location = cleanText(body.location, 300) ?? (job.location || null);
    const proposedStartDate = optionalIsoDate(body.proposed_start_date, 'Proposed start date');
    const compensation = compensationMinor(body.compensation_amount);
    const currency = typeof body.compensation_currency === 'string' && ['INR', 'USD'].includes(body.compensation_currency) ? body.compensation_currency : 'INR';
    const requestedPeriod = typeof body.compensation_period === 'string' ? body.compensation_period : '';
    const allowedPeriods = ['hour', 'day', 'month', 'year', 'project'];
    const period = compensation == null ? null : (allowedPeriods.includes(requestedPeriod) ? requestedPeriod : 'year');
    const responseDeadline = optionalIsoTimestamp(body.response_deadline);
    const note = cleanText(body.note, 3000);

    const { data, error } = await context.supabase
      .from('job_offers')
      .insert({
        job_application_id: applicationId,
        offer_number: 1,
        position_title: positionTitle,
        employment_type: employmentType,
        workplace_type: workplaceType,
        location,
        proposed_start_date: proposedStartDate,
        compensation_minor: compensation,
        compensation_currency: currency,
        compensation_period: period,
        response_deadline: responseDeadline,
        note,
        status: 'pending',
        issued_by_user_id: context.session.user_id,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ offer: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to issue employment offer.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await providerContext(request);
    const body = await request.json() as Record<string, unknown>;
    const offerId = typeof body.offer_id === 'string' ? body.offer_id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    if (!offerId) return NextResponse.json({ error: 'Employment offer is required.' }, { status: 400 });

    if (action === 'respond') {
      if (context.mode !== 'professional') return NextResponse.json({ error: 'Only the applicant can accept or decline an offer.' }, { status: 403 });
      const status = typeof body.status === 'string' ? body.status : '';
      if (!['accepted', 'declined'].includes(status)) return NextResponse.json({ error: 'Offer response must be accepted or declined.' }, { status: 400 });
      const { data, error } = await context.supabase
        .from('job_offers')
        .update({ status })
        .eq('id', offerId)
        .eq('status', 'pending')
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ offer: data });
    }

    if (action === 'withdraw') {
      if (context.mode !== 'business') return NextResponse.json({ error: 'Only the employer can withdraw a pending offer.' }, { status: 403 });
      const { data, error } = await context.supabase
        .from('job_offers')
        .update({ status: 'withdrawn' })
        .eq('id', offerId)
        .eq('status', 'pending')
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ offer: data });
    }

    return NextResponse.json({ error: 'Unknown employment offer action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update employment offer.' }, { status: 400 });
  }
}
