import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import {
  productionProviderProductRepository,
  type UpdateBusinessProductInput,
} from '../../../../../server/provider-products/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { productId } = await context.params;
    const input = await request.json() as UpdateBusinessProductInput;
    const product = await productionProviderProductRepository.update(session, productId, input);
    return NextResponse.json({ product }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update Business product.' },
      { status: 400 },
    );
  }
}
