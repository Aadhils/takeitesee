import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import {
  productionBusinessShopStatusRepository,
  type BusinessShopStatusInput,
} from '../../../../server/business-shop-status/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const shop = await productionBusinessShopStatusRepository.get(session);
    return NextResponse.json({ shop }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load Business Shop Open/Closed state.' },
      { status: 401 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const input = await request.json() as BusinessShopStatusInput;
    const shop = await productionBusinessShopStatusRepository.save(session, input);
    return NextResponse.json({ shop }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update Business Shop Open/Closed state.' },
      { status: 400 },
    );
  }
}
