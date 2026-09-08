import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import {
  productionProviderLiveLocationRepository,
  type ProviderLiveLocationInput,
} from '../../../../server/provider-live-location/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const location = await productionProviderLiveLocationRepository.get(session);
    return NextResponse.json({ location }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load nearby-matching location status.' },
      { status: 401 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const input = await request.json() as ProviderLiveLocationInput;
    const location = await productionProviderLiveLocationRepository.save(session, input);
    return NextResponse.json({ location }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update nearby-matching location.' },
      { status: 400 },
    );
  }
}
