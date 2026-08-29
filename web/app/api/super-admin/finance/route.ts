import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import {
  CashfreePayoutError,
  createCashfreePayoutTransfer,
  getCashfreePayoutConfig,
  getCashfreePayoutTransfer,
} from '../../../../server/payments/cashfree-payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FinanceAction =
  | { action: 'update_policy'; currency?: string; commission_bps?: number; settlement_hold_days?: number; minimum_payout_minor?: number; active?: boolean }
  | { action: 'prepare_payout'; owner_user_id?: string; currency?: string }
  | { action: 'cancel_payout'; batch_id?: string; reason?: string }
  | { action: 'send_payout'; batch_id?: string }
  | { action: 'verify_payout'; batch_id?: string };

type PayoutBatch = {
  id: string;
  owner_user_id: string;
  currency: string;
  status: string;
  provider_net_minor: number;
  payout_destination_id: string | null;
  transfer_id: string | null;
  gateway: string | null;
};

type PayoutDestination = {
  id: string;
  owner_user_id: string;
  destination_type: 'bank' | 'upi';
  masked_destination: string;
  beneficiary_name: string;
  status: string;
  gateway_beneficiary_id: string;
};

function integer(value: unknown, label: string) {
  if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
  return value as number;
}

function isDefinitiveClientFailure(error: CashfreePayoutError) {
  return error.httpStatus != null && [400, 401, 403, 404, 422].includes(error.httpStatus);
}

async function requireFinanceManage(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.rpc('admin_list_finance_overview');
  if (error) throw new Error(error.message);
}

async function applyGatewayStatus(
  service: ReturnType<typeof createSupabaseServiceClient>,
  batchId: string,
  transfer: { status: string; status_code?: string; status_description?: string; cf_transfer_id?: string; transfer_utr?: string },
) {
  const { data, error } = await service.rpc('gateway_apply_provider_payout_transfer_status', {
    target_batch_id: batchId,
    target_gateway_status: transfer.status,
    target_gateway_status_code: transfer.status_code ?? '',
    target_gateway_status_description: transfer.status_description ?? null,
    target_gateway_transfer_id: transfer.cf_transfer_id ?? null,
    target_transfer_utr: transfer.transfer_utr ?? null,
  }).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Payout transfer status could not be reconciled.');
  return data;
}

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const [{ data, error }, destinationResult] = await Promise.all([
      supabase.rpc('admin_list_finance_overview'),
      supabase.from('provider_payout_destinations')
        .select('id,owner_user_id,destination_type,masked_destination,beneficiary_name,status,gateway_status,verified_at,updated_at')
        .eq('gateway', 'cashfree_payout').neq('status', 'deleted').order('created_at', { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    if (destinationResult.error) throw new Error(destinationResult.error.message);

    const finance = (data ?? { policies: [], providers: [], payouts: [] }) as {
      policies?: unknown[];
      providers?: Array<Record<string, unknown>>;
      payouts?: unknown[];
    };
    const destinationMap = new Map<string, Record<string, unknown>>();
    for (const row of (destinationResult.data ?? []) as Array<Record<string, unknown>>) {
      const owner = String(row.owner_user_id ?? '');
      if (owner && !destinationMap.has(owner)) destinationMap.set(owner, row);
    }
    const providers = (finance.providers ?? []).map((provider) => ({
      ...provider,
      payout_destination: destinationMap.get(String(provider.owner_user_id ?? '')) ?? null,
    }));
    const config = getCashfreePayoutConfig();
    return NextResponse.json({
      finance: { ...finance, providers },
      payout_gateway: { enabled: config.enabled, provider: 'cashfree_payout', mode: config.mode },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load finance controls.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireAdmin(request);
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

    if (input.action === 'send_payout') {
      const batchId = input.batch_id?.trim() ?? '';
      if (!batchId) throw new Error('Payout batch is required.');
      await requireFinanceManage(supabase);
      const config = getCashfreePayoutConfig();
      if (!config.enabled) {
        return NextResponse.json({ error: 'Cashfree provider payouts are not configured yet.', code: 'PAYOUT_GATEWAY_NOT_CONFIGURED', mode: config.mode }, { status: 503 });
      }

      const service = createSupabaseServiceClient();
      const { data: batchData, error: batchError } = await service.from('provider_payout_batches')
        .select('id,owner_user_id,currency,status,provider_net_minor,payout_destination_id,transfer_id,gateway')
        .eq('id', batchId).maybeSingle();
      if (batchError) throw new Error(batchError.message);
      const batch = batchData as PayoutBatch | null;
      if (!batch || batch.status !== 'ready') throw new Error('Only a ready payout batch can be sent.');

      const { data: destinationData, error: destinationError } = await service.from('provider_payout_destinations')
        .select('id,owner_user_id,destination_type,masked_destination,beneficiary_name,status,gateway_beneficiary_id')
        .eq('owner_user_id', batch.owner_user_id).eq('gateway', 'cashfree_payout').eq('status', 'verified')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (destinationError) throw new Error(destinationError.message);
      const destination = destinationData as PayoutDestination | null;
      if (!destination) throw new Error('Provider must add a verified payout destination before this batch can be sent.');

      const transferId = `tis_${batch.id.replaceAll('-', '')}`;
      const transferMode = destination.destination_type === 'upi' ? 'upi' : 'banktransfer';
      const { data: reserved, error: reserveError } = await service.rpc('gateway_reserve_provider_payout_transfer', {
        target_batch_id: batch.id,
        target_destination_id: destination.id,
        target_transfer_id: transferId,
        target_transfer_mode: transferMode,
        target_actor_user_id: session.user_id,
      }).maybeSingle();
      if (reserveError || !reserved) throw new Error(reserveError?.message ?? 'Payout transfer could not be reserved.');

      try {
        const transfer = await createCashfreePayoutTransfer({
          transferId,
          amountMinor: Number(batch.provider_net_minor),
          beneficiaryId: destination.gateway_beneficiary_id,
          transferMode,
          remarks: `Takeitesee provider payout ${batch.id.slice(0, 8)}`,
        });
        if (transfer.transfer_id !== transferId) throw new Error('Cashfree payout transfer id did not match the reserved transfer.');
        if (Math.round(Number(transfer.transfer_amount) * 100) !== Number(batch.provider_net_minor)) {
          throw new Error('Cashfree payout amount did not match the provider payout batch.');
        }
        const payout = await applyGatewayStatus(service, batch.id, transfer);
        return NextResponse.json({ payout, gateway: { provider: 'cashfree_payout', mode: config.mode } });
      } catch (cause) {
        if (cause instanceof CashfreePayoutError && isDefinitiveClientFailure(cause)) {
          const payout = await applyGatewayStatus(service, batch.id, {
            status: 'REJECTED',
            status_code: cause.code ?? `HTTP_${cause.httpStatus}`,
            status_description: cause.message,
          });
          return NextResponse.json({ error: cause.message, payout }, { status: 400 });
        }
        return NextResponse.json({
          error: 'Payout submission status is uncertain. Do not resend this batch; refresh the existing transfer status.',
          code: 'PAYOUT_STATUS_UNCERTAIN',
          payout: reserved,
        }, { status: 202 });
      }
    }

    if (input.action === 'verify_payout') {
      const batchId = input.batch_id?.trim() ?? '';
      if (!batchId) throw new Error('Payout batch is required.');
      await requireFinanceManage(supabase);
      const config = getCashfreePayoutConfig();
      if (!config.enabled) {
        return NextResponse.json({ error: 'Cashfree provider payouts are not configured yet.', code: 'PAYOUT_GATEWAY_NOT_CONFIGURED', mode: config.mode }, { status: 503 });
      }

      const service = createSupabaseServiceClient();
      const { data: batchData, error: batchError } = await service.from('provider_payout_batches')
        .select('id,owner_user_id,currency,status,provider_net_minor,payout_destination_id,transfer_id,gateway')
        .eq('id', batchId).maybeSingle();
      if (batchError) throw new Error(batchError.message);
      const batch = batchData as PayoutBatch | null;
      if (!batch?.transfer_id || batch.gateway !== 'cashfree_payout') {
        throw new Error('This payout batch does not have a Cashfree transfer to verify.');
      }

      const transfer = await getCashfreePayoutTransfer(batch.transfer_id);
      if (transfer.transfer_id !== batch.transfer_id) throw new Error('Cashfree returned a different payout transfer id.');
      if (Math.round(Number(transfer.transfer_amount) * 100) !== Number(batch.provider_net_minor)) {
        throw new Error('Cashfree payout amount does not match the provider payout batch.');
      }
      const payout = await applyGatewayStatus(service, batch.id, transfer);
      return NextResponse.json({ payout, gateway: { provider: 'cashfree_payout', mode: config.mode } });
    }

    return NextResponse.json({ error: 'Finance action is invalid.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Finance action could not be completed.' }, { status: 400 });
  }
}