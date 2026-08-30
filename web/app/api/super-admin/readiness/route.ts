import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import { getCashfreeConfig } from '../../../../server/payments/cashfree';
import { getCashfreePayoutConfig } from '../../../../server/payments/cashfree-payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_SUPABASE_REF = 'bukrpkymivkhdpueropt';

type DatabaseProbe = {
  rpc_anon_mutations_closed: boolean;
  trigger_rpc_surface_closed: boolean;
  public_marketplace_helpers_available: boolean;
  sandbox_payment_api_verified: boolean;
  sandbox_payment_webhook_verified: boolean;
  inr_finance_policy_active: boolean;
};

export async function GET(request: Request) {
  const session = await productionAuthProvider.getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!session.roles.includes('super_admin')) {
    return NextResponse.json({ error: 'Super Admin permission required.' }, { status: 403 });
  }

  const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const canonicalDatabaseMatch = supabaseUrl.includes(CANONICAL_SUPABASE_REF);
  const payment = getCashfreeConfig();
  const payout = getCashfreePayoutConfig();

  let serviceRoleDatabase = false;
  let databaseProbe: DatabaseProbe | null = null;

  try {
    const service = createSupabaseServiceClient();
    const { error: serviceReadError } = await service
      .from('users')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (serviceReadError) throw new Error(serviceReadError.message);
    serviceRoleDatabase = true;

    const { data, error } = await service.rpc('platform_launch_readiness');
    if (error) throw new Error(error.message);
    databaseProbe = data as DatabaseProbe;
  } catch {
    serviceRoleDatabase = false;
    databaseProbe = null;
  }

  const blockers: string[] = [];
  if (!canonicalDatabaseMatch) blockers.push('canonical_database_mismatch');
  if (!serviceRoleDatabase) blockers.push('service_role_database_unavailable');
  if (!databaseProbe?.rpc_anon_mutations_closed) blockers.push('anonymous_rpc_mutation_surface_open');
  if (!databaseProbe?.trigger_rpc_surface_closed) blockers.push('trigger_rpc_surface_open');
  if (!databaseProbe?.public_marketplace_helpers_available) blockers.push('public_marketplace_helper_unavailable');
  if (!payment.enabled) blockers.push('cashfree_payment_configuration_incomplete');
  if (payment.mode !== 'sandbox') blockers.push('cashfree_payment_not_in_sandbox');
  if (payment.enabled && payment.mode === 'sandbox' && !databaseProbe?.sandbox_payment_api_verified) blockers.push('sandbox_payment_api_e2e_unverified');
  if (payment.enabled && payment.mode === 'sandbox' && !databaseProbe?.sandbox_payment_webhook_verified) blockers.push('sandbox_payment_webhook_e2e_unverified');
  if (!payout.enabled) blockers.push('cashfree_payout_configuration_incomplete');
  if (payout.mode !== 'sandbox') blockers.push('cashfree_payout_not_in_sandbox');
  if (databaseProbe?.inr_finance_policy_active) blockers.push('inr_finance_policy_already_active');

  return NextResponse.json({
    status: blockers.length === 0 ? 'sandbox_ready' : 'blocked',
    release,
    checked_at: new Date().toISOString(),
    database: {
      canonical_match: canonicalDatabaseMatch,
      service_role_database: serviceRoleDatabase,
      rpc_anon_mutations_closed: databaseProbe?.rpc_anon_mutations_closed ?? false,
      trigger_rpc_surface_closed: databaseProbe?.trigger_rpc_surface_closed ?? false,
      public_marketplace_helpers_available: databaseProbe?.public_marketplace_helpers_available ?? false,
      sandbox_payment_api_verified: databaseProbe?.sandbox_payment_api_verified ?? false,
      sandbox_payment_webhook_verified: databaseProbe?.sandbox_payment_webhook_verified ?? false,
      inr_finance_policy_active: databaseProbe?.inr_finance_policy_active ?? false,
    },
    payment_gateway: {
      provider: payment.provider,
      enabled: payment.enabled,
      mode: payment.mode,
      missing: payment.missing,
    },
    payout_gateway: {
      provider: 'cashfree_payout',
      enabled: payout.enabled,
      mode: payout.mode,
      missing: payout.missing,
      ip_whitelist_mode: payout.useIpWhitelist,
    },
    blockers,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
