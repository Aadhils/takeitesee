import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { conversationId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error } = await supabase.rpc('get_marketplace_conversation', { target_conversation_id: conversationId });
    if (error || !data) throw new Error(error?.message ?? 'Conversation was not found.');
    const { error: readError } = await supabase.rpc('mark_marketplace_conversation_read', { target_conversation_id: conversationId });
    if (readError) throw new Error(readError.message);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load conversation.';
    const status = /authentication/i.test(message) ? 401 : /participant/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { conversationId } = await context.params;
    const body = await request.json() as { idempotency_key?: string; message?: string };
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error } = await supabase.rpc('send_marketplace_message', {
      target_conversation_id: conversationId,
      requested_idempotency_key: body.idempotency_key?.trim() ?? '',
      requested_body: body.message?.trim() ?? '',
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Message could not be sent.');
    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Message could not be sent.';
    const status = /authentication/i.test(message) ? 401 : /participant/i.test(message) ? 403 : /read-only|awarded|message|idempotency/i.test(message) ? 400 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
