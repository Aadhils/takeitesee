import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('provider_verification_requests')
      .select('id,applicant_user_id,provider_type,professional_id,business_id,legal_name,contact_phone,address,evidence_type,evidence_reference,evidence_note,status,review_note,reviewed_by,reviewed_at,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load verification requests.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as { request_id?: string; decision?: 'approve' | 'changes_requested' | 'reject'; note?: string };
    if (!input.request_id || !input.decision || !['approve','changes_requested','reject'].includes(input.decision)) {
      return NextResponse.json({ error: 'Verification request and a valid decision are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('review_provider_verification', {
      target_request_id: input.request_id,
      decision: input.decision,
      reviewer_note: input.note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Verification request could not be reviewed.');
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification request could not be reviewed.' }, { status: 400 });
  }
}
