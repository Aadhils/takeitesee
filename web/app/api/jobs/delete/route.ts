import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function DELETE(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_user_id', session.user_id)
      .limit(1)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) return NextResponse.json({ error: 'Business provider required.' }, { status: 403 });

    const body = await request.json() as { job_id?: unknown };
    const jobId = text(body.job_id, 64);
    if (!jobId) return NextResponse.json({ error: 'Job is required.' }, { status: 400 });

    const { data: job, error: jobError } = await supabase
      .from('job_postings')
      .select('id,title')
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
      return NextResponse.json(
        { error: 'Job posting cannot be deleted after applications exist.' },
        { status: 409 },
      );
    }

    const { data: deleted, error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', jobId)
      .eq('business_id', business.id)
      .select('id,title')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) return NextResponse.json({ error: 'Job posting was not found.' }, { status: 404 });

    return NextResponse.json({ deleted_job: deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete job.';
    return NextResponse.json(
      { error: message },
      { status: message.includes('cannot be deleted after applications exist') ? 409 : 400 },
    );
  }
}
