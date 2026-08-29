import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('provider_applications')
      .select('id,applicant_user_id,provider_type,display_name,description,location,status,review_note,reviewed_by,reviewed_at,result_provider_id,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ applications: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider applications.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as { application_id?: string; decision?: 'approve' | 'reject'; note?: string };
    if (!input.application_id || !input.decision || !['approve', 'reject'].includes(input.decision)) {
      return NextResponse.json({ error: 'Application and review decision are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('review_provider_application', {
      target_application_id: input.application_id,
      decision: input.decision,
      reviewer_note: input.note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Provider application could not be reviewed.');
    return NextResponse.json({ application: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider application could not be reviewed.' }, { status: 400 });
  }
}
