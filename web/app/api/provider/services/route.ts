import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { productionProviderServiceRepository, type CreateProviderServiceInput } from '../../../../server/provider-services/repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const services = await productionProviderServiceRepository.list(session);
    return NextResponse.json({ services });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load services.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const input = await request.json() as CreateProviderServiceInput;
    const service = await productionProviderServiceRepository.create(session, input);
    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create service.' }, { status: 400 });
  }
}
