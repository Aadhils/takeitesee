import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import {
  productionProviderProductRepository,
  type CreateBusinessProductInput,
} from '../../../../server/provider-products/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const products = await productionProviderProductRepository.list(session);
    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load Business products.' },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const input = await request.json() as CreateBusinessProductInput;
    const product = await productionProviderProductRepository.create(session, input);
    return NextResponse.json({ product }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create Business product.' },
      { status: 400 },
    );
  }
}
