import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { productionProviderProductRepository } from '../../../../../../server/provider-products/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { productId } = await context.params;
    const launch = await productionProviderProductRepository.submitLaunch(session, productId);
    return NextResponse.json({ launch }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit product launch request.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { productId } = await context.params;
    const launch = await productionProviderProductRepository.withdrawLaunch(session, productId);
    return NextResponse.json({ launch }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to withdraw product launch request.' },
      { status: 400 },
    );
  }
}
