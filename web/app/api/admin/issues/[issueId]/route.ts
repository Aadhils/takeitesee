import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

async function loadIssue(issueId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: issue, error: issueError } = await supabase
    .from('marketplace_issues')
    .select('id,booking_id,service_id,reported_by,category,summary,details,priority,status,resolution_note,handled_by,created_at,updated_at,resolved_at')
    .eq('id', issueId)
    .maybeSingle();
  if (issueError) throw new Error(issueError.message);
  if (!issue) return null;

  const [{ data: booking, error: bookingError }, { data: reporter, error: reporterError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from('bookings').select('id,booking_reference,service_name_snapshot,provider_type,business_id,professional_id,booking_date,start_time,timezone,status,payment_status,quoted_price,currency').eq('id', issue.booking_id).maybeSingle(),
    supabase.from('users').select('id,name,email').eq('id', issue.reported_by).maybeSingle(),
    supabase.from('marketplace_issue_events').select('id,actor_type,event_type,from_status,to_status,note,created_at').eq('issue_id', issueId).order('created_at', { ascending: true }),
  ]);
  if (bookingError) throw new Error(bookingError.message);
  if (reporterError) throw new Error(reporterError.message);
  if (eventsError) throw new Error(eventsError.message);

  return { issue, booking, reporter, events: events ?? [] };
}

export async function GET(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const { issueId } = await params;
    const data = await loadIssue(issueId);
    if (!data) return NextResponse.json({ error: 'Support case not found or outside your scope.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load support case.' }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const { issueId } = await params;
    const body = await request.json() as { status?: string; note?: string };
    const status = body.status?.trim() ?? '';
    const note = body.note?.trim() ?? '';
    if (!['open','investigating','awaiting_information','resolved','closed'].includes(status)) {
      return NextResponse.json({ error: 'Choose a valid support status.' }, { status: 400 });
    }
    if (['resolved','closed'].includes(status) && note.length < 3) {
      return NextResponse.json({ error: 'A resolution note is required to resolve or close a case.' }, { status: 400 });
    }
    if (note.length > 2000) return NextResponse.json({ error: 'Resolution note must be 2000 characters or fewer.' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('update_marketplace_issue', {
      target_issue_id: issueId,
      new_status: status,
      admin_note: note || null,
    }).maybeSingle();
    if (error) throw new Error(error.message);

    const data = await loadIssue(issueId);
    if (!data) return NextResponse.json({ error: 'Support case could not be reloaded.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update support case.' }, { status: 400 });
  }
}
