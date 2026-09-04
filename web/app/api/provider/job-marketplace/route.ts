import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';

async function providerContext(request: Request) {
  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase.from('businesses').select('id,name,verified').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (business) return { session, supabase, mode: 'business' as const, business };
  const { data: professional, error: professionalError } = await supabase.from('professional_profiles').select('id,headline,verified').eq('user_id', session.user_id).limit(1).maybeSingle();
  if (professionalError) throw new Error(professionalError.message);
  if (!professional) throw new Error('Provider profile not found.');
  return { session, supabase, mode: 'professional' as const, professional };
}

async function communicationContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  applicationIds: string[],
) {
  if (!applicationIds.length) return { conversations: [], interviews: [], interview_events: [] };

  const [conversationResult, interviewResult, eventResult] = await Promise.all([
    supabase
      .from('marketplace_conversations')
      .select('id,job_application_id,status,closed_reason,last_message_at')
      .eq('conversation_kind', 'job_application')
      .in('job_application_id', applicationIds),
    supabase
      .from('job_interviews')
      .select('*')
      .in('job_application_id', applicationIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('job_interview_events')
      .select('*')
      .in('job_application_id', applicationIds)
      .order('created_at', { ascending: false }),
  ]);

  if (conversationResult.error) throw new Error(conversationResult.error.message);
  if (interviewResult.error) throw new Error(interviewResult.error.message);
  if (eventResult.error) throw new Error(eventResult.error.message);

  return {
    conversations: conversationResult.data ?? [],
    interviews: interviewResult.data ?? [],
    interview_events: eventResult.data ?? [],
  };
}

export async function GET(request: Request) {
  try {
    const context = await providerContext(request);
    if (context.mode === 'business') {
      const { data: jobs, error: jobsError } = await context.supabase.from('job_postings').select('*').eq('business_id', context.business.id).order('created_at', { ascending: false });
      if (jobsError) throw new Error(jobsError.message);
      const jobIds = (jobs ?? []).map((job) => job.id);
      let applications: Record<string, unknown>[] = [];
      if (jobIds.length) {
        const { data, error } = await context.supabase.from('job_applications').select('*').in('job_posting_id', jobIds).order('applied_at', { ascending: false });
        if (error) throw new Error(error.message);
        applications = (data ?? []) as Record<string, unknown>[];
      }
      const professionalIds = [...new Set(applications.map((item) => String(item.professional_id || '')).filter(Boolean))];
      let professionals: Record<string, unknown>[] = [];
      if (professionalIds.length) {
        const { data, error } = await context.supabase.from('professional_profiles').select('id,headline,service_area,verified').in('id', professionalIds);
        if (error) throw new Error(error.message);
        professionals = (data ?? []) as Record<string, unknown>[];
      }
      const applicationIds = applications.map((item) => String(item.id || '')).filter(Boolean);
      const communication = await communicationContext(context.supabase, applicationIds);
      return NextResponse.json({ mode: 'business', business: context.business, jobs: jobs ?? [], applications, professionals, ...communication });
    }

    const [{ data: applications, error: applicationsError }, { data: roles, error: rolesError }] = await Promise.all([
      context.supabase.from('job_applications').select('*').eq('professional_id', context.professional.id).order('applied_at', { ascending: false }),
      context.supabase.from('professional_roles').select('id,title,active,open_to_full_time,open_to_part_time,open_to_contract,open_to_freelance').eq('professional_id', context.professional.id).order('display_order'),
    ]);
    if (applicationsError) throw new Error(applicationsError.message);
    if (rolesError) throw new Error(rolesError.message);
    const jobIds = (applications ?? []).map((application) => application.job_posting_id);
    let jobs: Record<string, unknown>[] = [];
    if (jobIds.length) {
      const { data, error } = await context.supabase.from('job_postings').select('*').in('id', jobIds);
      if (error) throw new Error(error.message);
      jobs = (data ?? []) as Record<string, unknown>[];
    }
    const applicationIds = (applications ?? []).map((application) => application.id);
    const communication = await communicationContext(context.supabase, applicationIds);
    return NextResponse.json({ mode: 'professional', professional: context.professional, roles: roles ?? [], applications: applications ?? [], jobs, ...communication });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load job workspace.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await providerContext(request);
    if (context.mode !== 'professional') return NextResponse.json({ error: 'Professional profile required to apply.' }, { status: 403 });
    if (!context.professional.verified) return NextResponse.json({ error: 'Verify your professional profile before applying.' }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const jobId = typeof body.job_posting_id === 'string' ? body.job_posting_id : '';
    const roleId = typeof body.selected_professional_role_id === 'string' && body.selected_professional_role_id ? body.selected_professional_role_id : null;
    const coverNote = typeof body.cover_note === 'string' ? body.cover_note.trim().slice(0, 2400) : null;
    if (!jobId) return NextResponse.json({ error: 'Job is required.' }, { status: 400 });

    if (roleId) {
      const { data: role, error: roleError } = await context.supabase.from('professional_roles').select('id').eq('id', roleId).eq('professional_id', context.professional.id).maybeSingle();
      if (roleError) throw new Error(roleError.message);
      if (!role) return NextResponse.json({ error: 'Selected talent does not belong to this profile.' }, { status: 400 });
    }

    const { data, error } = await context.supabase.from('job_applications').insert({
      job_posting_id: jobId,
      professional_id: context.professional.id,
      selected_professional_role_id: roleId,
      cover_note: coverNote || null,
      status: 'submitted',
    }).select('*').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ application: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to apply.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await providerContext(request);
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'application_status') {
      const applicationId = typeof body.application_id === 'string' ? body.application_id : '';
      const status = typeof body.status === 'string' ? body.status : '';
      if (!applicationId || !['shortlisted','interview','hired','rejected','withdrawn'].includes(status)) return NextResponse.json({ error: 'Invalid application update.' }, { status: 400 });
      if (context.mode === 'professional' && status !== 'withdrawn') return NextResponse.json({ error: 'Professionals can only withdraw applications.' }, { status: 403 });
      if (context.mode === 'business' && status === 'withdrawn') return NextResponse.json({ error: 'Only the applicant can withdraw.' }, { status: 403 });
      const { data, error } = await context.supabase.from('job_applications').update({ status }).eq('id', applicationId).select('*').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ application: data });
    }

    if (action === 'job_status') {
      if (context.mode !== 'business') return NextResponse.json({ error: 'Business provider required.' }, { status: 403 });
      const jobId = typeof body.job_id === 'string' ? body.job_id : '';
      const status = typeof body.status === 'string' ? body.status : '';
      if (!jobId || !['draft','open','closed','filled'].includes(status)) return NextResponse.json({ error: 'Invalid job status.' }, { status: 400 });
      if (status === 'open' && !context.business.verified) return NextResponse.json({ error: 'Verify your business before publishing jobs.' }, { status: 403 });
      const { data, error } = await context.supabase.from('job_postings').update({ status, updated_at: new Date().toISOString() }).eq('id', jobId).eq('business_id', context.business.id).select('*').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ job: data });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update job marketplace.' }, { status: 400 });
  }
}
