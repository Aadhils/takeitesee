import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import {
  productionProviderServiceReachRepository,
  type ProviderServiceReachInput,
} from '../../../../../../server/provider-service-reach/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { serviceId } = await context.params;
    const reach = await productionProviderServiceReachRepository.get(session, serviceId);
    return NextResponse.json({ reach }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load service reach settings.' },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { serviceId } = await context.params;
    const input = await request.json() as ProviderServiceReachInput;
    const reach = await productionProviderServiceReachRepository.save(session, serviceId, input);
    return NextResponse.json({ reach }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update service reach settings.' },
      { status: 400 },
    );
  }
}
