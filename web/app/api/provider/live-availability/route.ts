import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import {
  productionProviderLiveAvailabilityRepository,
  type ProviderLiveAvailabilityInput,
} from '../../../../server/provider-live-availability/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const availability = await productionProviderLiveAvailabilityRepository.get(session);
    return NextResponse.json({ availability }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load Provider live availability.' },
      { status: 401 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const input = await request.json() as ProviderLiveAvailabilityInput;
    const availability = await productionProviderLiveAvailabilityRepository.save(session, input);
    return NextResponse.json({ availability }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update Provider live availability.' },
      { status: 400 },
    );
  }
}
