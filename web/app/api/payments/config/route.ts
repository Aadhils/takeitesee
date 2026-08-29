import { NextResponse } from 'next/server';
import { getCashfreeConfig } from '../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getCashfreeConfig();
  return NextResponse.json({
    enabled: config.enabled,
    provider: config.provider,
    mode: config.mode,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
