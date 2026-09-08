import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { productionBusinessOrderRepository, type BusinessProductOrderAction } from '../../../../../server/business-orders/repository';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  let session;
  try {
    session = await productionAuthProvider.requireProvider(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider authentication required.' }, { status: 401 });
  }

  try {
    const { orderId } = await context.params;
    const body = await request.json() as { action?: BusinessProductOrderAction; note?: string | null };
    if (!body.action || !['accept', 'decline', 'fulfill'].includes(body.action)) {
      return NextResponse.json({ error: 'Choose accept, decline, or fulfill.' }, { status: 400 });
    }
    const order = await productionBusinessOrderRepository.transitionBusiness(session, orderId, body.action, body.note);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update this product order.' }, { status: 400 });
  }
}
