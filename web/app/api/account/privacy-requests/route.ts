import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['access', 'correction', 'deletion']);
const selectFields = 'id,user_id,request_type,details,status,review_note,reviewed_by,created_at,updated_at,resolved_at';
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('privacy_requests')
      .select(selectFields)
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ requests: data ?? [] }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load privacy requests.' },
      { status: 401, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const body = await request.json() as { request_type?: string; details?: string };
    const requestType = body.request_type?.trim() ?? '';
    const details = body.details?.trim() ?? '';

    if (!allowedTypes.has(requestType)) {
      return NextResponse.json({ error: 'Choose a valid privacy request type.' }, { status: 400, headers: noStoreHeaders });
    }
    if (details.length < 10 || details.length > 2000) {
      return NextResponse.json({ error: 'Request details must be 10 to 2000 characters.' }, { status: 400, headers: noStoreHeaders });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('privacy_requests')
      .insert({ user_id: session.user_id, request_type: requestType, details })
      .select(selectFields)
      .single();

    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'You already have an active request of this type. Wait for it to be reviewed before submitting another.' },
        { status: 409, headers: noStoreHeaders },
      );
    }
    if (error || !data) throw new Error(error?.message ?? 'Privacy request could not be submitted.');

    return NextResponse.json({ request: data }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit privacy request.' },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
