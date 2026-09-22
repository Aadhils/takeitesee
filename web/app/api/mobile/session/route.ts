import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user_id: session.user_id,
      roles: session.roles,
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unable to validate session.',
    }, { status: 401 });
  }
}
