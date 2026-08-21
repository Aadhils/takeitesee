import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { productionProviderServiceRepository, type UpdateProviderServiceInput } from '../../../../../server/provider-services/repository';
import type { EntityId } from '../../../../../types/entities';

export const runtime = 'nodejs';

export async function PATCH(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { serviceId } = await context.params;
    const input = await request.json() as UpdateProviderServiceInput;
    const service = await productionProviderServiceRepository.update(session, serviceId as EntityId, input);
    return NextResponse.json({ service });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update service.' }, { status: 400 });
  }
}
