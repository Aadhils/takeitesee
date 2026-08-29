import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_service_launch_review_queue');
    if (error) throw new Error(error.message);
    return NextResponse.json({ requests: Array.isArray(data) ? data : [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load service launch reviews.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as { request_id?: string; decision?: 'approve' | 'changes_requested' | 'reject'; note?: string };
    if (!input.request_id || !input.decision || !['approve','changes_requested','reject'].includes(input.decision)) {
      return NextResponse.json({ error: 'Launch request and a valid decision are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('review_service_launch_request', {
      target_request_id: input.request_id,
      decision: input.decision,
      reviewer_note: input.note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Service launch request could not be reviewed.');
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Service launch request could not be reviewed.' }, { status: 400 });
  }
}
