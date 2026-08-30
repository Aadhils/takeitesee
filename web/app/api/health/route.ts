import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date().toISOString();
  const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local';

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('Public Supabase configuration is missing.');

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await supabase
      .from('services')
      .select('id', { head: true })
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
