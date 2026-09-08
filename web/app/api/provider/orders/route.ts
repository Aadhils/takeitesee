import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { productionBusinessOrderRepository } from '../../../../server/business-orders/repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  let session;
  try {
    session = await productionAuthProvider.requireProvider(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider authentication required.' }, { status: 401 });
  }

  try {
    const orders = await productionBusinessOrderRepository.listBusiness(session);
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load Business product orders.' }, { status: 400 });
  }
}
