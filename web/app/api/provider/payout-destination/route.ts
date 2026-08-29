import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import {
  CashfreePayoutError,
  createCashfreeBeneficiary,
  getCashfreeBeneficiary,
  getCashfreePayoutConfig,
  removeCashfreeBeneficiary,
  type CashfreeBeneficiary,
} from '../../../../server/payments/cashfree-payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DestinationRow = {
  id: string;
  owner_user_id: string;
  provider_type: 'professional' | 'business';
  professional_id: string | null;
  business_id: string | null;
  gateway: string;
  gateway_beneficiary_id: string;
  destination_type: 'bank' | 'upi';
  masked_destination: string;
  beneficiary_name: string;
  status: 'pending' | 'verified' | 'invalid' | 'failed' | 'deleted';
  gateway_status: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

function safeDestination(row: DestinationRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    gateway: row.gateway,
    destination_type: row.destination_type,
    masked_destination: row.masked_destination,
    beneficiary_name: row.beneficiary_name,
    status: row.status,
    gateway_status: row.gateway_status,
    last_error_code: row.last_error_code,
    last_error_message: row.last_error_message,
    verified_at: row.verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapBeneficiaryStatus(status: string): DestinationRow['status'] {
  const value = status.toUpperCase();
  if (value === 'VERIFIED') return 'verified';
  if (value === 'INITIATED') return 'pending';
  if (value === 'INVALID') return 'invalid';
  if (value === 'DELETED') return 'deleted';
  return 'failed';
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

function validateBeneficiaryName(value: unknown) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z ]{2,100}$/.test(name)) throw new Error('Beneficiary name must use English letters and spaces only.');
  return name;
}

function validateBank(accountValue: unknown, ifscValue: unknown) {
  const account = String(accountValue ?? '').trim();
  const ifsc = String(ifscValue ?? '').trim().toUpperCase();
  if (!/^[A-Za-z0-9]{4,25}$/.test(account)) throw new Error('Enter a valid bank account number.');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new Error('Enter a valid 11-character IFSC.');
  return { account, ifsc };
}

function validateVpa(value: unknown) {
  const vpa = String(value ?? '').trim();
  if (!/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/.test(vpa) || vpa.length > 100) throw new Error('Enter a valid UPI ID.');
  return vpa;
}

function maskBank(account: string) { return `Bank ••••${account.slice(-4)}`; }
function maskVpa(vpa: string) {
  const [local, handle] = vpa.split('@');
  const prefix = local.length <= 2 ? local[0] ?? '' : local.slice(0, 2);
  return `UPI ${prefix}••••@${handle}`;
}

async function providerIdentity(session: Awaited<ReturnType<typeof productionAuthProvider.requireProvider>>, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  if (session.roles.includes('professional')) {
    const { data, error } = await supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required.');
    return { provider_type: 'professional' as const, professional_id: data.id as string, business_id: null };
  }
  const { data, error } = await supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Business profile is required.');
  return { provider_type: 'business' as const, professional_id: null, business_id: data.id as string };
}

async function activeDestination(service: ReturnType<typeof createSupabaseServiceClient>, ownerUserId: string) {
  const { data, error } = await service.from('provider_payout_destinations')
    .select('*').eq('owner_user_id', ownerUserId).neq('status', 'deleted').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as DestinationRow | null;
}

async function persistGatewayStatus(service: ReturnType<typeof createSupabaseServiceClient>, row: DestinationRow, beneficiary: CashfreeBeneficiary) {
  if (beneficiary.beneficiary_id !== row.gateway_beneficiary_id) throw new Error('Gateway beneficiary reference did not match the registered payout destination.');
  const status = mapBeneficiaryStatus(beneficiary.beneficiary_status);
  const { data, error } = await service.from('provider_payout_destinations').update({
    status,
    gateway_status: beneficiary.beneficiary_status,
    verified_at: status === 'verified' ? new Date().toISOString() : null,
    deleted_at: status === 'deleted' ? new Date().toISOString() : null,
    last_error_code: null,
    last_error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id).select('*').single();
  if (error) throw new Error(error.message);
  return data as DestinationRow;
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const config = getCashfreePayoutConfig();
    const service = createSupabaseServiceClient();
    const destination = await activeDestination(service, session.user_id);
    return NextResponse.json({ gateway: { enabled: config.enabled, provider: 'cashfree_payout', mode: config.mode }, destination: safeDestination(destination) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load payout destination.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const config = getCashfreePayoutConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Provider payouts are not configured yet.', code: 'PAYOUT_GATEWAY_NOT_CONFIGURED', mode: config.mode }, { status: 503 });
    const input = await request.json() as {
      action?: 'register' | 'refresh'; destination_type?: 'bank' | 'upi'; beneficiary_name?: string;
      bank_account_number?: string; bank_ifsc?: string; vpa?: string;
    };
    const action = input.action ?? 'register';
    const supabase = await createSupabaseServerClient();
    const service = createSupabaseServiceClient();
    const existing = await activeDestination(service, session.user_id);

    if (action === 'refresh') {
      if (!existing) return NextResponse.json({ error: 'No payout destination is registered.' }, { status: 404 });
      const beneficiary = await getCashfreeBeneficiary(existing.gateway_beneficiary_id);
      const saved = await persistGatewayStatus(service, existing, beneficiary);
      return NextResponse.json({ destination: safeDestination(saved) });
    }

    if (existing?.status === 'verified') return NextResponse.json({ error: 'Remove the existing verified payout destination before adding another.' }, { status: 409 });
    if (existing?.status === 'pending') {
      try {
        const beneficiary = await getCashfreeBeneficiary(existing.gateway_beneficiary_id);
        const saved = await persistGatewayStatus(service, existing, beneficiary);
        return NextResponse.json({ destination: safeDestination(saved) });
      } catch { return NextResponse.json({ error: 'Existing payout destination verification is still pending. Refresh it before replacing.' }, { status: 409 }); }
    }
    if (existing) {
      const { error } = await service.from('provider_payout_destinations').update({ status: 'deleted', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw new Error(error.message);
    }

    const identity = await providerIdentity(session, supabase);
    const { data: user, error: userError } = await supabase.from('users').select('email,phone').eq('id', session.user_id).maybeSingle();
    if (userError) throw new Error(userError.message);
    const beneficiaryName = validateBeneficiaryName(input.beneficiary_name);
    const destinationType = input.destination_type;
    if (destinationType !== 'bank' && destinationType !== 'upi') throw new Error('Choose bank account or UPI as the payout destination.');

    let bankAccount: string | undefined;
    let bankIfsc: string | undefined;
    let vpa: string | undefined;
    let masked: string;
    if (destinationType === 'bank') {
      const bank = validateBank(input.bank_account_number, input.bank_ifsc);
      bankAccount = bank.account; bankIfsc = bank.ifsc; masked = maskBank(bank.account);
    } else {
      vpa = validateVpa(input.vpa); masked = maskVpa(vpa);
    }

    const beneficiaryId = `tis_bene_${randomUUID().replaceAll('-', '')}`;
    const pendingInsert = {
      owner_user_id: session.user_id, ...identity, gateway: 'cashfree_payout', gateway_beneficiary_id: beneficiaryId,
      destination_type: destinationType, masked_destination: masked, beneficiary_name: beneficiaryName,
      status: 'pending', gateway_status: 'LOCAL_PENDING',
    };
    const { data: pending, error: pendingError } = await service.from('provider_payout_destinations').insert(pendingInsert).select('*').single();
    if (pendingError) throw new Error(pendingError.message);
    const pendingRow = pending as DestinationRow;

    try {
      let beneficiary: CashfreeBeneficiary;
      try {
        beneficiary = await createCashfreeBeneficiary({
          beneficiaryId, beneficiaryName, bankAccountNumber: bankAccount, bankIfsc, vpa,
          email: user?.email ?? null, phone: normalizePhone(user?.phone),
        });
      } catch (cause) {
        if (cause instanceof CashfreePayoutError && cause.httpStatus === 409 && cause.code === 'beneficiary_id_already_exists') {
          beneficiary = await getCashfreeBeneficiary(beneficiaryId);
        } else if (cause instanceof CashfreePayoutError && cause.httpStatus === 409 && cause.code === 'beneficiary_already_exists') {
          throw new Error('This payout instrument is already registered in the merchant payout account and cannot be automatically linked to this provider. Contact platform support for a secure review.');
        } else throw cause;
      }
      const saved = await persistGatewayStatus(service, pendingRow, beneficiary);
      await service.from('notifications').insert({ recipient_user_id: session.user_id, event_type: 'provider_payout_destination_updated', title: 'Payout destination updated', body: `Your ${destinationType === 'bank' ? 'bank' : 'UPI'} payout destination is ${saved.status}.` });
      return NextResponse.json({ destination: safeDestination(saved) }, { status: 201 });
    } catch (cause) {
      const code = cause instanceof CashfreePayoutError ? cause.code : null;
      await service.from('provider_payout_destinations').update({
        status: 'failed', gateway_status: 'FAILED', last_error_code: code,
        last_error_message: 'Gateway beneficiary registration failed. Review the destination and try again.', updated_at: new Date().toISOString(),
      }).eq('id', pendingRow.id);
      throw cause;
    }
  } catch (error) {
    const code = error instanceof CashfreePayoutError ? error.code : null;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payout destination could not be registered.', ...(code ? { code } : {}) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const config = getCashfreePayoutConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Provider payouts are not configured yet.', code: 'PAYOUT_GATEWAY_NOT_CONFIGURED' }, { status: 503 });
    const service = createSupabaseServiceClient();
    const destination = await activeDestination(service, session.user_id);
    if (!destination) return NextResponse.json({ removed: true });
    const { count, error: batchError } = await service.from('provider_payout_batches').select('id', { count: 'exact', head: true })
      .eq('owner_user_id', session.user_id).eq('status', 'processing');
    if (batchError) throw new Error(batchError.message);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'A payout is currently processing. The destination cannot be removed yet.' }, { status: 409 });

    try { await removeCashfreeBeneficiary(destination.gateway_beneficiary_id); }
    catch (cause) { if (!(cause instanceof CashfreePayoutError && cause.httpStatus === 404)) throw cause; }
    const { error } = await service.from('provider_payout_destinations').update({
      status: 'deleted', gateway_status: 'DELETED', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', destination.id);
    if (error) throw new Error(error.message);
    await service.from('notifications').insert({ recipient_user_id: session.user_id, event_type: 'provider_payout_destination_updated', title: 'Payout destination removed', body: 'Your payout destination was removed. Add a verified destination before the next transfer.' });
    return NextResponse.json({ removed: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payout destination could not be removed.' }, { status: 400 });
  }
}