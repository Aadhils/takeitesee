import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { productionProviderAvailabilityRepository, type ProviderAvailabilityInput } from '../../../../../../server/provider-availability/repository';
import type { EntityId } from '../../../../../../types/entities';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ serviceId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { serviceId } = await context.params;
    const availability = await productionProviderAvailabilityRepository.get(session, serviceId as EntityId);
    return NextResponse.json({ availability });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load availability.' }, { status: 400 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { serviceId } = await context.params;
    const input = await request.json() as ProviderAvailabilityInput;
    const availability = await productionProviderAvailabilityRepository.save(session, serviceId as EntityId, input);
    return NextResponse.json({ availability });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save availability.' }, { status: 400 });
  }
}
