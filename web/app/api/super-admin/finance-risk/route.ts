import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import {
  acceptCashfreeDispute,
  fetchCashfreeDispute,
  getCashfreeConfig,
  type CashfreeDispute,
} from '../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FinanceRiskAction =
  | { action: 'refresh_dispute'; dispute_id?: string }
  | { action: 'accept_dispute'; dispute_id?: string; confirmed?: boolean; note?: string }
  | { action: 'resolve_exception'; exception_id?: string; resolution?: 'resolve' | 'ignore'; note?: string }
  | { action: 'resolve_recovery'; recovery_id?: string; resolution?: 'recovered' | 'waived'; note?: string };

type DisputeRow = {
  id: string;
  gateway_dispute_id: string;
  booking_id: string | null;
  local_state: string;
  dispute_action_on: string | null;
};

async function requireFinanceManage(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.rpc('admin_list_finance_overview');
  if (error) throw new Error(error.message);
}

function normalizeDispute(entity: CashfreeDispute) {
  const order = entity.order_details;
  const currency = String(entity.dispute_amount_currency ?? order.payment_currency ?? order.order_currency ?? '').trim().toUpperCase();
  if (!entity.dispute_id || !entity.dispute_type || !entity.dispute_status || !order?.order_id || order.cf_payment_id == null || !currency) {
    throw new Error('Cashfree dispute response is missing required reconciliation fields.');
  }
  const amountMinor = Math.round(Number(entity.dispute_amount) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error('Cashfree dispute amount is invalid.');
  return {
    target_gateway_dispute_id: String(entity.dispute_id),
    target_event_type: entity.resolved_at ? 'DISPUTE_CLOSED' : 'DISPUTE_UPDATED',
    target_dispute_type: String(entity.dispute_type).toUpperCase(),
    target_reason_code: String(entity.reason_code ?? ''),
    target_reason_description: String(entity.reason_description ?? ''),
    target_amount_minor: amountMinor,
    target_currency: currency,
    target_gateway_status: String(entity.dispute_status).toUpperCase(),
    target_dispute_action_on: String(entity.dispute_action_on ?? '').toUpperCase(),
    target_cf_remarks: entity.cf_dispute_remarks ?? null,
    target_respond_by: entity.respond_by ?? null,
    target_gateway_created_at: entity.created_at ?? null,
    target_gateway_updated_at: entity.updated_at ?? null,
    target_gateway_resolved_at: entity.resolved_at ?? null,
    target_order_id: String(order.order_id),
    target_cf_payment_id: String(order.cf_payment_id),
    target_payload_sha256: null,
  };
}

async function applyDispute(service: ReturnType<typeof createSupabaseServiceClient>, entity: CashfreeDispute) {
  const { data, error } = await service.rpc('gateway_upsert_cashfree_dispute', normalizeDispute(entity)).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Cashfree dispute could not be reconciled.');
  return data;
}

function requireNote(value: unknown, label: string) {
  const note = typeof value === 'string' ? value.trim() : '';
  if (note.length < 3 || note.length > 500) throw new Error(`${label} must be 3 to 500 characters.`);
  return note;
}

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    await requireFinanceManage(supabase);

    const [disputesResult, exceptionsResult, holdsResult, recoveryResult] = await Promise.all([
      supabase.from('payment_disputes')
        .select('id,gateway_dispute_id,booking_id,dispute_type,reason_code,reason_description,amount_minor,currency,gateway_status,local_state,dispute_action_on,cf_remarks,respond_by,gateway_created_at,gateway_updated_at,gateway_resolved_at,last_seen_at')
        .order('last_seen_at', { ascending: false }).limit(100),
      supabase.from('payment_gateway_exceptions')
        .select('id,exception_key,event_type,category,booking_id,gateway_reference,amount_minor,currency,severity,status,summary,detail,first_seen_at,last_seen_at,resolved_at,resolution_note')
        .order('last_seen_at', { ascending: false }).limit(100),
      supabase.from('provider_finance_holds')
        .select('id,booking_id,owner_user_id,source_type,source_reference,amount_minor,currency,status,public_summary,opened_at,updated_at,released_at,release_reason')
        .neq('status', 'released').order('opened_at', { ascending: false }).limit(100),
      supabase.from('provider_recovery_entries')
        .select('id,owner_user_id,booking_id,settlement_id,payout_batch_id,source_type,source_reference,amount_minor,currency,status,reason,created_at,updated_at,resolved_at,resolution_note')
        .order('created_at', { ascending: false }).limit(100),
    ]);
    for (const result of [disputesResult, exceptionsResult, holdsResult, recoveryResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const bookingIds = Array.from(new Set([
      ...(disputesResult.data ?? []).map((row) => row.booking_id),
      ...(exceptionsResult.data ?? []).map((row) => row.booking_id),
      ...(holdsResult.data ?? []).map((row) => row.booking_id),
      ...(recoveryResult.data ?? []).map((row) => row.booking_id),
    ].filter((value): value is string => Boolean(value))));
    const bookingMap = new Map<string, { booking_reference: string; service_name_snapshot: string }>();
    if (bookingIds.length) {
      const { data, error } = await supabase.from('bookings').select('id,booking_reference,service_name_snapshot').in('id', bookingIds);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) bookingMap.set(String(row.id), { booking_reference: String(row.booking_reference), service_name_snapshot: String(row.service_name_snapshot) });
    }
    const withBooking = <T extends { booking_id?: string | null }>(row: T) => ({ ...row, booking: row.booking_id ? bookingMap.get(row.booking_id) ?? null : null });
    const config = getCashfreeConfig();
    return NextResponse.json({
      disputes: (disputesResult.data ?? []).map(withBooking),
      exceptions: (exceptionsResult.data ?? []).map(withBooking),
      holds: (holdsResult.data ?? []).map(withBooking),
      recoveries: (recoveryResult.data ?? []).map(withBooking),
      gateway: { enabled: config.enabled, provider: 'cashfree', mode: config.mode },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load finance risk controls.' }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as FinanceRiskAction;
    const supabase = await createSupabaseServerClient();
    await requireFinanceManage(supabase);

    if (input.action === 'resolve_exception') {
      const exceptionId = input.exception_id?.trim() ?? '';
      const resolution = input.resolution;
      const note = requireNote(input.note, 'Resolution note');
      if (!exceptionId || (resolution !== 'resolve' && resolution !== 'ignore')) throw new Error('Exception and resolution action are required.');
      const { data, error } = await supabase.rpc('admin_resolve_payment_gateway_exception', {
        target_exception_id: exceptionId,
        target_action: resolution,
        target_note: note,
      }).maybeSingle();
      if (error || !data) throw new Error(error?.message ?? 'Gateway exception could not be resolved.');
      return NextResponse.json({ exception: data });
    }

    if (input.action === 'resolve_recovery') {
      const recoveryId = input.recovery_id?.trim() ?? '';
      const resolution = input.resolution;
      const note = requireNote(input.note, 'Recovery note');
      if (!recoveryId || (resolution !== 'recovered' && resolution !== 'waived')) throw new Error('Recovery and resolution action are required.');
      const { data, error } = await supabase.rpc('admin_resolve_provider_recovery', {
        target_recovery_id: recoveryId,
        target_action: resolution,
        target_note: note,
      }).maybeSingle();
      if (error || !data) throw new Error(error?.message ?? 'Provider recovery could not be resolved.');
      return NextResponse.json({ recovery: data });
    }

    const disputeId = input.dispute_id?.trim() ?? '';
    if (!disputeId) throw new Error('Payment dispute is required.');
    const { data: disputeData, error: disputeError } = await supabase.from('payment_disputes')
      .select('id,gateway_dispute_id,booking_id,local_state,dispute_action_on')
      .eq('id', disputeId).maybeSingle();
    if (disputeError || !disputeData) throw new Error(disputeError?.message ?? 'Payment dispute was not found.');
    const dispute = disputeData as DisputeRow;
    const config = getCashfreeConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Cashfree payment gateway is not configured.' }, { status: 503 });
    const service = createSupabaseServiceClient();

    if (input.action === 'refresh_dispute') {
      const entity = await fetchCashfreeDispute(dispute.gateway_dispute_id);
      const saved = await applyDispute(service, entity);
      return NextResponse.json({ dispute: saved });
    }

    if (input.action === 'accept_dispute') {
      if (input.confirmed !== true) throw new Error('Explicit confirmation is required before accepting a dispute.');
      const note = requireNote(input.note, 'Acceptance note');
      if (!['action_required','under_review'].includes(dispute.local_state) || dispute.dispute_action_on !== 'MERCHANT') {
        throw new Error('This dispute is not currently awaiting a merchant decision.');
      }
      const entity = await acceptCashfreeDispute(dispute.gateway_dispute_id, dispute.id);
      const saved = await applyDispute(service, entity);
      const { error: auditError } = await supabase.rpc('admin_record_payment_dispute_action', {
        target_dispute_id: dispute.id,
        target_action: 'accepted',
        target_note: note,
      });
      if (auditError) throw new Error(auditError.message);
      return NextResponse.json({ dispute: saved });
    }

    throw new Error('Unsupported finance risk action.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Finance risk action failed.';
    return NextResponse.json({ error: message }, { status: /permission|authentication/i.test(message) ? 403 : 400 });
  }
}
