import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_marketplace_moderation_queue');
    if (error) throw new Error(error.message);
    return NextResponse.json({ reports: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moderation queue could not be loaded.';
    return NextResponse.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const body = await request.json() as { report_id?: string; status?: 'open'|'reviewing'|'actioned'|'dismissed'; note?: string };
    if (!body.report_id) return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
    if (!body.status || !['open','reviewing','actioned','dismissed'].includes(body.status)) return NextResponse.json({ error: 'Choose a valid moderation status.' }, { status: 400 });
    const note = String(body.note ?? '').trim();
    if (note.length > 2000) return NextResponse.json({ error: 'Moderation note must be 2000 characters or fewer.' }, { status: 400 });
    if (['actioned','dismissed'].includes(body.status) && note.length < 3) return NextResponse.json({ error: 'A moderation note is required to close a report.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('admin_update_marketplace_moderation_report', {
      target_report_id: body.report_id,
      requested_status: body.status,
      requested_note: note || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Moderation report could not be updated.');
    return NextResponse.json({ report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moderation report could not be updated.';
    const status = /authentication/i.test(message) ? 401 : /permission|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
