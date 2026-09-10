import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data: job, error: jobError } = await supabase
      .from('marketplace_requirement_jobs')
      .select('requirement_id,proposal_id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (jobError || !job) return NextResponse.json({ context: null });

    const { data: requirement, error: requirementError } = await supabase
      .from('customer_requirements')
      .select('id,title')
      .eq('id', job.requirement_id)
      .eq('customer_id', session.user_id)
      .maybeSingle();

    if (requirementError || !requirement) return NextResponse.json({ context: null });

    const { data: conversation, error: conversationError } = await supabase
      .from('marketplace_conversations')
      .select('id')
      .eq('requirement_id', job.requirement_id)
      .eq('proposal_id', job.proposal_id)
      .eq('customer_id', session.user_id)
      .maybeSingle();

    return NextResponse.json({
      context: {
        requirement_id: requirement.id,
        requirement_title: requirement.title,
        conversation_id: conversationError ? null : conversation?.id ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requirement booking context.' }, { status: 401 });
  }
}
