import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireProvider(request);
    const { bookingId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('provider_get_booking_requirement_context', { target_booking_id: bookingId });
    if (error) throw new Error(error.message);
    return NextResponse.json({ context: data ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requirement context.' }, { status: 400 });
  }
}
