import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const cookieName = 'takeitesee_ref_attribution';
const maxAgeSeconds = 60 * 60 * 24 * 30;

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizeHandle(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const payload = body as { referrer?: unknown; destination?: unknown };
  const referrer = normalizeHandle(payload.referrer);
  const destination = normalizeHandle(payload.destination);
  if (!referrer || !destination) {
    return NextResponse.json({ ok: false, error: 'Referrer and destination are required.' }, { status: 400 });
  }

  const supabase = publicSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Referral attribution is unavailable.' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const existingAttributionId = cookieStore.get(cookieName)?.value;
  const attributionId = existingAttributionId && /^[0-9a-f-]{36}$/i.test(existingAttributionId)
    ? existingAttributionId
    : randomUUID();
  const landingPath = `/@${encodeURIComponent(destination)}`;

  const { error } = await supabase.rpc('record_public_referral_attribution', {
    raw_referrer: referrer,
    raw_destination: destination,
    attribution_id: attributionId,
    landing_path: landingPath,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: 'Referral attribution was not recorded.' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  if (!existingAttributionId) {
    response.cookies.set(cookieName, attributionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });
  }
  return response;
}
