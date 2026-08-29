import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as { request_id?: string; object_path?: string; original_filename?: string };
    if (!input.request_id || !input.object_path || !input.original_filename) {
      return NextResponse.json({ error: 'Verification request, storage path, and file name are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('register_provider_verification_document', {
      target_request_id: input.request_id,
      target_object_path: input.object_path,
      target_original_filename: input.original_filename,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Verification document could not be registered.');
    return NextResponse.json({ document: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification document could not be registered.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as { document_id?: string };
    if (!input.document_id) return NextResponse.json({ error: 'Verification document is required.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: document, error: documentError } = await supabase
      .from('provider_verification_documents')
      .select('id,object_path,status')
      .eq('id', input.document_id)
      .eq('status', 'active')
      .maybeSingle();
    if (documentError) throw new Error(documentError.message);
    if (!document) throw new Error('Active verification document was not found.');

    const { error: removeError } = await supabase.storage.from('provider-verification-documents').remove([document.object_path]);
    if (removeError) throw new Error(removeError.message);
    const { data, error } = await supabase.rpc('mark_provider_verification_document_deleted', { target_document_id: input.document_id }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Verification document could not be removed.');
    return NextResponse.json({ document: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification document could not be removed.' }, { status: 400 });
  }
}
