import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ bookingId: string }> };
type RequirementContextPayload = Record<string, unknown> & { requirement_id?: unknown };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { bookingId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('provider_get_booking_requirement_context', { target_booking_id: bookingId });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return NextResponse.json({ context: data ?? null });

    const requirementContext = data as RequirementContextPayload;
    let conversationId: string | null = null;

    const { data: job, error: jobError } = await supabase
      .from('marketplace_requirement_jobs')
      .select('requirement_id,proposal_id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (!jobError && job) {
      const { data: conversation, error: conversationError } = await supabase
        .from('marketplace_conversations')
        .select('id')
        .eq('requirement_id', job.requirement_id)
        .eq('proposal_id', job.proposal_id)
        .eq('provider_user_id', session.user_id)
        .maybeSingle();
      if (!conversationError) conversationId = conversation?.id ?? null;
    }

    return NextResponse.json({
      context: {
        ...requirementContext,
        conversation_id: conversationId,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requirement context.' }, { status: 400 });
  }
}
