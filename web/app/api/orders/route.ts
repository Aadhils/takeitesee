import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { productionBusinessOrderRepository, type CreateBusinessProductOrderInput } from '../../../server/business-orders/repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  let session;
  try {
    session = await productionAuthProvider.requireCustomer(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication required.' }, { status: 401 });
  }

  try {
    const orders = await productionBusinessOrderRepository.listCustomer(session);
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load product orders.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let session;
  try {
    session = await productionAuthProvider.requireCustomer(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication required.' }, { status: 401 });
  }

  try {
    const input = await request.json() as CreateBusinessProductOrderInput;
    const order = await productionBusinessOrderRepository.create(session, input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to request this product order.' }, { status: 400 });
  }
}
