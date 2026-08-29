import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FinanceAction =
  | {
      action: 'update_policy';
      currency?: string;
      commission_bps?: number;
      settlement_hold_days?: number;
      minimum_payout_minor?: number;
      active?: boolean;
    }
  | { action: 'prepare_payout'; owner_user_id?: string; currency?: string }
  | { action: 'cancel_payout'; batch_id?: string; reason?: string };

function integer(value: unknown, label: string) {
  if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
  return value as number;
}

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('admin_list_finance_overview');
    if (error) throw new Error(error.message);
    return NextResponse.json({ finance: data ?? { policies: [], providers: [], payouts: [] } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load finance controls.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as FinanceAction;
    const supabase = await createSupabaseServerClient();

    if (input.action === 'update_policy') {
      const currency = input.currency?.trim().toUpperCase() ?? '';
      const commissionBps = integer(input.commission_bps, 'Commission basis points');
      const holdDays = integer(input.settlement_hold_days, 'Settlement hold days');
      const minimumPayoutMinor = integer(input.minimum_payout_minor, 'Minimum payout');
      if (typeof input.active !== 'boolean') throw new Error('Finance policy active state is required.');
      const { data, error } = await supabase.rpc('admin_update_finance_policy', {
        target_currency: currency,
        target_commission_bps: commissionBps,
        target_settlement_hold_days: holdDays,
        target_minimum_payout_minor: minimumPayoutMinor,
        target_active: input.active,
      }).maybeSingle();
      if (error || !data) throw new Error(error?.message ?? 'Finance policy could not be updated.');
      return NextResponse.json({ policy: data });
    }

    if (input.action === 'prepare_payout') {
      const ownerUserId = input.owner_user_id?.trim() ?? '';
      const currency = input.currency?.trim().toUpperCase() ?? '';
      if (!ownerUserId || !currency) throw new Error('Provider and currency are required.');
      const { data, error } = await supabase.rpc('admin_prepare_provider_payout', {
        target_owner_user_id: ownerUserId,
        target_currency: currency,
      }).maybeSingle();
      if (error || !data) throw new Error(error?.message ?? 'Provider payout could not be prepared.');
      return NextResponse.json({ payout: data });
    }

    if (input.action === 'cancel_payout') {
      const batchId = input.batch_id?.trim() ?? '';
      const reason = input.reason?.trim() ?? '';
      if (!batchId) throw new Error('Payout batch is required.');
      const { data, error } = await supabase.rpc('admin_cancel_provider_payout', {
        target_batch_id: batchId,
        action_reason: reason,
      }).maybeSingle();
      if (error || !data) throw new Error(error?.message ?? 'Provider payout could not be cancelled.');
      return NextResponse.json({ payout: data });
    }

    return NextResponse.json({ error: 'Finance action is invalid.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Finance action could not be completed.' }, { status: 400 });
  }
}
