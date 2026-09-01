import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const [{ data, error }, { data: documents, error: documentError }] = await Promise.all([
      supabase.from('provider_verification_requests')
        .select('id,applicant_user_id,provider_type,professional_id,business_id,legal_name,contact_phone,address,public_contact_email,website_url,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone,evidence_type,evidence_reference,evidence_note,status,review_note,reviewed_by,reviewed_at,created_at,updated_at')
        .order('created_at', { ascending: false }),
      supabase.from('provider_verification_documents')
        .select('id,verification_request_id,original_filename,mime_type,size_bytes,status,created_at,deleted_at')
        .order('created_at', { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    if (documentError) throw new Error(documentError.message);
    return NextResponse.json({ requests: data ?? [], documents: documents ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load verification requests.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as { request_id?: string; decision?: 'approve' | 'changes_requested' | 'reject' | 'revoke'; note?: string };
    if (!input.request_id || !input.decision || !['approve','changes_requested','reject','revoke'].includes(input.decision)) {
      return NextResponse.json({ error: 'Verification request and a valid decision are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();

    if (input.decision === 'revoke') {
      const note = input.note?.trim() ?? '';
      if (note.length < 3) return NextResponse.json({ error: 'A revocation reason is required.' }, { status: 400 });
      const { data: current, error: currentError } = await supabase
        .from('provider_verification_requests')
        .select('provider_type,professional_id,business_id,status')
        .eq('id', input.request_id)
        .maybeSingle();
      if (currentError || !current) throw new Error(currentError?.message ?? 'Verification request not found.');
      if (current.status !== 'approved') throw new Error('Only an approved verification can be revoked.');
      const providerId = current.provider_type === 'professional' ? current.professional_id : current.business_id;
      if (!providerId) throw new Error('Provider reference is missing.');
      const { error } = await supabase.rpc('revoke_provider_verification', { target_provider_type: current.provider_type, target_provider_id: providerId, revocation_note: note });
      if (error) throw new Error(error.message);
      const { data: refreshed, error: refreshError } = await supabase.from('provider_verification_requests').select('*').eq('id', input.request_id).maybeSingle();
      if (refreshError || !refreshed) throw new Error(refreshError?.message ?? 'Verification was revoked but could not be reloaded.');
      return NextResponse.json({ request: refreshed });
    }

    const { data, error } = await supabase.rpc('review_provider_verification', {
      target_request_id: input.request_id,
      decision: input.decision,
      reviewer_note: input.note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Verification request could not be reviewed.');
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider verification action failed.' }, { status: 400 });
  }
}
