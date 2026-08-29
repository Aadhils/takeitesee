import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const { documentId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: document, error } = await supabase
      .from('provider_verification_documents')
      .select('id,object_path,status')
      .eq('id', documentId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!document) throw new Error('Verification document was not found.');

    const { data: signed, error: signedError } = await supabase.storage
      .from('provider-verification-documents')
      .createSignedUrl(document.object_path, 300);
    if (signedError || !signed?.signedUrl) throw new Error(signedError?.message ?? 'Secure document link could not be created.');

    const { error: auditError } = await supabase.rpc('record_provider_verification_document_access', { target_document_id: document.id });
    if (auditError) throw new Error(auditError.message);
    return NextResponse.redirect(signed.signedUrl);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Verification document could not be opened.' }, { status: 403 });
  }
}
