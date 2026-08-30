import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { conversationId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_marketplace_conversation_safety', { target_conversation_id: conversationId });
    if (error) throw new Error(error.message);
    return NextResponse.json({ safety: data ?? { blocked_by_me: false, messaging_blocked: false } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversation safety state could not be loaded.';
    return NextResponse.json({ error: message }, { status: /authentication/i.test(message) ? 401 : /participant/i.test(message) ? 403 : 400 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { conversationId } = await context.params;
    const body = await request.json() as { blocked?: boolean; reason?: string };
    if (typeof body.blocked !== 'boolean') return NextResponse.json({ error: 'Block state is required.' }, { status: 400 });
    const reason = String(body.reason ?? '').trim();
    if (reason.length > 500) return NextResponse.json({ error: 'Block reason must be 500 characters or fewer.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('set_marketplace_conversation_block', {
      target_conversation_id: conversationId,
      should_block: body.blocked,
      block_reason: reason || null,
    });
    if (error) throw new Error(error.message);
    const { data: safety, error: safetyError } = await supabase.rpc('get_marketplace_conversation_safety', { target_conversation_id: conversationId });
    if (safetyError) throw new Error(safetyError.message);
    return NextResponse.json({ safety });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversation block could not be updated.';
    return NextResponse.json({ error: message }, { status: /authentication/i.test(message) ? 401 : /participant/i.test(message) ? 403 : 400 });
  }
}
