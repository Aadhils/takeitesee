import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';

type SavedJobRow = { job_posting_id: string; saved_at: string };
type JobRow = {
  id: string;
  business_id: string;
  title: string;
  description: string;
  employment_type: string;
  workplace_type: string;
  location?: string | null;
  required_skills?: string[] | null;
  minimum_experience_years?: number | null;
  openings: number;
  salary_min_minor?: number | null;
  salary_max_minor?: number | null;
  salary_currency: string;
  salary_period?: string | null;
  application_deadline?: string | null;
  status: string;
  moderation_state: string;
};

type BusinessRow = { id: string; name: string; verified: boolean; location?: string | null; owner_user_id: string };

async function professionalContext(request: Request) {
  const session = await productionAuthProvider.getSession(request);
  if (!session) throw new Error('Authentication required.');
  if (!session.roles.includes('professional')) throw new Error('Professional profile required.');

  const supabase = await createSupabaseServerClient();
  const { data: professional, error } = await supabase
    .from('professional_profiles')
    .select('id,verified')
    .eq('user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!professional) throw new Error('Professional profile not found.');
  return { session, supabase, professional };
}

function isCurrentlyAvailable(job: JobRow, business?: BusinessRow) {
  const deadlineOk = !job.application_deadline || job.application_deadline >= new Date().toISOString().slice(0, 10);
  return job.status === 'open' && job.moderation_state === 'clear' && deadlineOk && business?.verified === true;
}

export async function GET(request: Request) {
  try {
    const context = await professionalContext(request);
    const { data: savedRows, error: savedError } = await context.supabase
      .from('professional_saved_jobs')
      .select('job_posting_id,saved_at')
      .eq('professional_id', context.professional.id)
      .order('saved_at', { ascending: false });
    if (savedError) throw new Error(savedError.message);

    const rows = (savedRows ?? []) as SavedJobRow[];
    const jobIds = rows.map((row) => row.job_posting_id);
    let jobs: JobRow[] = [];
    if (jobIds.length) {
      const { data, error } = await context.supabase
        .from('job_postings')
        .select('id,business_id,title,description,employment_type,workplace_type,location,required_skills,minimum_experience_years,openings,salary_min_minor,salary_max_minor,salary_currency,salary_period,application_deadline,status,moderation_state')
        .in('id', jobIds);
      if (error) throw new Error(error.message);
      jobs = (data ?? []) as JobRow[];
    }

    const businessIds = [...new Set(jobs.map((job) => job.business_id))];
    let businesses: BusinessRow[] = [];
    if (businessIds.length) {
      const { data, error } = await context.supabase
        .from('businesses')
        .select('id,name,verified,location,owner_user_id')
        .in('id', businessIds);
      if (error) throw new Error(error.message);
      businesses = (data ?? []) as BusinessRow[];
    }

    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const businessesById = new Map(businesses.map((business) => [business.id, business]));
    const saved_jobs = rows.map((row) => {
      const job = jobsById.get(row.job_posting_id);
      if (!job) return { job_posting_id: row.job_posting_id, saved_at: row.saved_at, available: false, job: null };
      const business = businessesById.get(job.business_id);
      const available = isCurrentlyAvailable(job, business) && business?.owner_user_id !== context.session.user_id;
      return {
        job_posting_id: row.job_posting_id,
        saved_at: row.saved_at,
        available,
        job: available ? { ...job, business: business ? { id: business.id, name: business.name, verified: business.verified, location: business.location ?? null } : null } : null,
      };
    });

    return NextResponse.json({ professional: context.professional, saved_jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load saved jobs.';
    const status = message === 'Authentication required.' ? 401 : message.includes('Professional') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const context = await professionalContext(request);
    const body = await request.json() as Record<string, unknown>;
    const jobId = typeof body.job_posting_id === 'string' ? body.job_posting_id : '';
    if (!jobId) return NextResponse.json({ error: 'Job is required.' }, { status: 400 });

    const { data: job, error: jobError } = await context.supabase
      .from('job_postings')
      .select('id,business_id,status,moderation_state,application_deadline')
      .eq('id', jobId)
      .maybeSingle();
    if (jobError) throw new Error(jobError.message);
    if (!job) return NextResponse.json({ error: 'This job is not available to save.' }, { status: 409 });

    const { data: business, error: businessError } = await context.supabase
      .from('businesses')
      .select('id,verified,owner_user_id')
      .eq('id', job.business_id)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business || business.owner_user_id === context.session.user_id) {
      return NextResponse.json({ error: 'You cannot save your own Business job.' }, { status: 403 });
    }
    const deadlineOk = !job.application_deadline || job.application_deadline >= new Date().toISOString().slice(0, 10);
    if (job.status !== 'open' || job.moderation_state !== 'clear' || !deadlineOk || !business.verified) {
      return NextResponse.json({ error: 'This job is no longer available to save.' }, { status: 409 });
    }

    const { data, error } = await context.supabase
      .from('professional_saved_jobs')
      .insert({ professional_id: context.professional.id, job_posting_id: jobId })
      .select('job_posting_id,saved_at')
      .single();
    if (error?.code === '23505') {
      const { data: existing, error: existingError } = await context.supabase
        .from('professional_saved_jobs')
        .select('job_posting_id,saved_at')
        .eq('professional_id', context.professional.id)
        .eq('job_posting_id', jobId)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      return NextResponse.json({ saved_job: existing, already_saved: true });
    }
    if (error) throw new Error(error.message);
    return NextResponse.json({ saved_job: data, already_saved: false }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save job.';
    const status = message === 'Authentication required.' ? 401 : message.includes('Professional') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await professionalContext(request);
    const body = await request.json() as Record<string, unknown>;
    const jobId = typeof body.job_posting_id === 'string' ? body.job_posting_id : '';
    if (!jobId) return NextResponse.json({ error: 'Job is required.' }, { status: 400 });

    const { error } = await context.supabase
      .from('professional_saved_jobs')
      .delete()
      .eq('professional_id', context.professional.id)
      .eq('job_posting_id', jobId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ removed: true, job_posting_id: jobId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove saved job.';
    const status = message === 'Authentication required.' ? 401 : message.includes('Professional') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
