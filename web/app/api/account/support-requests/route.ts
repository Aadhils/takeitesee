import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['platform_grievance', 'account_help', 'safety', 'provider_conduct', 'other']);
const selectFields = 'id,user_id,request_type,subject,details,status,review_note,reviewed_by,created_at,updated_at,resolved_at';
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('platform_support_requests')
      .select(selectFields)
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return NextResponse.json({ requests: data ?? [] }, { headers: noStoreHeaders });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unable to load support requests.';
    const status = /authentication|required|sign in/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : message }, { status, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const payload = await request.json() as { request_type?: string; subject?: string; details?: string };
    const requestType = String(payload.request_type ?? '').trim();
    const subject = String(payload.subject ?? '').trim();
    const details = String(payload.details ?? '').trim();

    if (!allowedTypes.has(requestType)) return NextResponse.json({ error: 'Choose a valid request type.' }, { status: 400, headers: noStoreHeaders });
    if (subject.length < 5 || subject.length > 160) return NextResponse.json({ error: 'Subject must be 5–160 characters.' }, { status: 400, headers: noStoreHeaders });
    if (details.length < 10 || details.length > 4000) return NextResponse.json({ error: 'Details must be 10–4000 characters.' }, { status: 400, headers: noStoreHeaders });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('platform_support_requests')
      .insert({ user_id: session.user_id, request_type: requestType, subject, details })
      .select(selectFields)
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ request: data }, { status: 201, headers: noStoreHeaders });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unable to submit support request.';
    const status = /authentication|required|sign in/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : message }, { status, headers: noStoreHeaders });
  }
}
