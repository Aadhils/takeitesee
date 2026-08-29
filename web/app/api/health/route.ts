import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date().toISOString();
  const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local';

  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('users')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) throw new Error(error.message);

    return NextResponse.json(
      {
        status: 'ok',
        app: 'ok',
        database: 'ok',
        release,
        checked_at: checkedAt,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        app: 'ok',
        database: 'unavailable',
        release,
        checked_at: checkedAt,
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    );
  }
}
