import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../lib/supabase/service';

const cookieName = 'takeitesee_ref_attribution';
const maxAgeSeconds = 60 * 60 * 24 * 30;
const maxRawHandleLength = 128;
const canonicalHandlePattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeHandle(value: unknown) {
  if (typeof value !== 'string' || value.length > maxRawHandleLength) return '';
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[ _]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidHandle(value: string) {
  return value.length >= 3 && value.length <= 30 && canonicalHandlePattern.test(value);
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
  if (!isValidHandle(referrer) || !isValidHandle(destination) || referrer === destination) {
    return NextResponse.json({ ok: false, error: 'Invalid referral handles.' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'Referral attribution is unavailable.' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const existingAttributionId = cookieStore.get(cookieName)?.value;
  const hasValidAttributionCookie = Boolean(existingAttributionId && uuidPattern.test(existingAttributionId));
  const attributionId = hasValidAttributionCookie && existingAttributionId
    ? existingAttributionId
    : randomUUID();
  const landingPath = `/@${destination}`;

  const { error } = await supabase.rpc('record_public_referral_attribution', {
    p_raw_referrer: referrer,
    p_raw_destination: destination,
    p_attribution_id: attributionId,
    p_landing_path: landingPath,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: 'Referral attribution was not recorded.' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  if (!hasValidAttributionCookie) {
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
