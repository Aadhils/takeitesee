import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportTarget = 'requirement' | 'proposal' | 'conversation' | 'message' | 'portfolio_media' | 'job_posting';
type ReportCategory = 'spam' | 'harassment' | 'fraud' | 'unsafe' | 'off_platform' | 'inappropriate' | 'other';

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json() as { target_type?: ReportTarget; target_id?: string; category?: ReportCategory; details?: string };
    if (!body.target_type || !['requirement','proposal','conversation','message','portfolio_media','job_posting'].includes(body.target_type)) {
      return NextResponse.json({ error: 'Choose a valid report target.' }, { status: 400 });
    }
    if (!body.target_id) return NextResponse.json({ error: 'Report target is required.' }, { status: 400 });
    if (!body.category || !['spam','harassment','fraud','unsafe','off_platform','inappropriate','other'].includes(body.category)) {
      return NextResponse.json({ error: 'Choose a valid report category.' }, { status: 400 });
    }
    const details = String(body.details ?? '').trim();
    if (details.length > 2000) return NextResponse.json({ error: 'Report details must be 2000 characters or fewer.' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const result = body.target_type === 'job_posting'
      ? await supabase.rpc('open_job_posting_moderation_report', {
          target_job_posting_id: body.target_id,
          requested_category: body.category,
          requested_details: details || null,
        }).maybeSingle()
      : await supabase.rpc('open_marketplace_moderation_report', {
          requested_target_type: body.target_type,
          requested_target_id: body.target_id,
          requested_category: body.category,
          requested_details: details || null,
        }).maybeSingle();
    if (result.error || !result.data) throw new Error(result.error?.message ?? 'Report could not be submitted.');
    const row = result.data as Record<string, unknown>;
    return NextResponse.json({ report: { id: row.id, report_reference: row.report_reference, status: row.status } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report could not be submitted.';
    const status = /authentication/i.test(message) ? 401 : /not reportable|only the|cannot report|participant|own portfolio|own job/i.test(message) ? 403 : /already have an active report/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
