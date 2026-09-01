import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();
    let provider: { id: string; provider_type: 'professional' | 'business'; display_name: string; verified: boolean } | null = null;

    if (session.roles.includes('professional')) {
      const { data, error } = await supabase.from('professional_profiles').select('id,headline,verified').eq('user_id', session.user_id).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) provider = { id: data.id, provider_type: 'professional', display_name: data.headline || 'Professional provider', verified: Boolean(data.verified) };
    }
    if (!provider && session.roles.includes('business_owner')) {
      const { data, error } = await supabase.from('businesses').select('id,name,verified').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) provider = { id: data.id, provider_type: 'business', display_name: data.name, verified: Boolean(data.verified) };
    }
    if (!provider) throw new Error('Provider profile is required.');

    const [{ data: requests, error }, { data: documents, error: documentError }] = await Promise.all([
      supabase.from('provider_verification_requests')
        .select('id,provider_type,professional_id,business_id,legal_name,contact_phone,address,public_contact_email,website_url,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone,evidence_type,evidence_reference,evidence_note,status,review_note,reviewed_at,created_at,updated_at')
        .eq('applicant_user_id', session.user_id)
        .order('created_at', { ascending: false }),
      supabase.from('provider_verification_documents')
        .select('id,verification_request_id,original_filename,mime_type,size_bytes,status,created_at,deleted_at')
        .eq('applicant_user_id', session.user_id)
        .order('created_at', { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    if (documentError) throw new Error(documentError.message);
    return NextResponse.json({ provider, requests: requests ?? [], documents: documents ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load verification status.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as {
      legal_name?: string;
      contact_phone?: string;
      address?: string;
      public_contact_email?: string;
      website_url?: string;
      grievance_officer_name?: string;
      grievance_officer_designation?: string;
      grievance_email?: string;
      grievance_phone?: string;
      evidence_type?: string;
      evidence_reference?: string;
      evidence_note?: string;
    };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('submit_provider_verification', {
      requested_legal_name: input.legal_name ?? '',
      requested_contact_phone: input.contact_phone ?? '',
      requested_address: input.address ?? '',
      requested_public_contact_email: input.public_contact_email ?? '',
      requested_website_url: input.website_url?.trim() || null,
      requested_grievance_officer_name: input.grievance_officer_name ?? '',
      requested_grievance_officer_designation: input.grievance_officer_designation ?? '',
      requested_grievance_email: input.grievance_email ?? '',
      requested_grievance_phone: input.grievance_phone ?? '',
      requested_evidence_type: input.evidence_type ?? '',
      requested_evidence_reference: input.evidence_reference ?? '',
      requested_evidence_note: input.evidence_note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Verification request could not be submitted.');
    return NextResponse.json({ request: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification request could not be submitted.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as { request_id?: string; action?: 'withdraw' };
    if (!input.request_id || input.action !== 'withdraw') return NextResponse.json({ error: 'Pending verification request and withdraw action are required.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('withdraw_provider_verification', { target_request_id: input.request_id }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Verification request could not be withdrawn.');
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification request could not be withdrawn.' }, { status: 400 });
  }
}
