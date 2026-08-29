import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

const priorityByCategory: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
  'Service quality': 'medium',
  'Provider no-show': 'high',
  'Payment or refund': 'high',
  'Safety concern': 'urgent',
  Other: 'medium',
};

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await params;
    const body = await request.json() as { category?: string; summary?: string; details?: string };
    const category = body.category?.trim() ?? '';
    const summary = body.summary?.trim() ?? '';
    const details = body.details?.trim() ?? '';
    if (!priorityByCategory[category]) return NextResponse.json({ error: 'Choose a valid support category.' }, { status: 400 });
    if (summary.length < 3 || summary.length > 180) return NextResponse.json({ error: 'Support summary must be 3 to 180 characters.' }, { status: 400 });
    if (details.length > 2000) return NextResponse.json({ error: 'Support details must be 2000 characters or fewer.' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('open_booking_support_case', {
      target_booking_id: bookingId,
      issue_category: category,
      issue_summary: summary,
      issue_details: details || null,
      issue_priority: priorityByCategory[category],
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Support case could not be opened.');
    return NextResponse.json({ issue: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to open support case.' }, { status: 400 });
  }
}
