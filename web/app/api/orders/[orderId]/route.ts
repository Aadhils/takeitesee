import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { productionBusinessOrderRepository } from '../../../../server/business-orders/repository';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  let session;
  try {
    session = await productionAuthProvider.requireCustomer(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication required.' }, { status: 401 });
  }

  try {
    const { orderId } = await context.params;
    const body = await request.json() as { action?: string };
    if (body.action !== 'cancel') {
      return NextResponse.json({ error: 'Only the cancel action is available to Customers.' }, { status: 400 });
    }
    const order = await productionBusinessOrderRepository.cancelCustomer(session, orderId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to cancel this order.' }, { status: 400 });
  }
}
