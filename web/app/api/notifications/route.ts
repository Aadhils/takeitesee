import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseAuthenticatedUser } from '../../../lib/supabase/server';

const requirementIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productOrderUpdateEvents = ['product_order_accepted', 'product_order_declined', 'product_order_fulfilled'];

type InboxDestinationRow = {
  id?: string;
  participant_role?: 'customer' | 'provider' | 'applicant' | 'employer' | 'business' | null;
};

type NotificationRow = {
  id: string;
  booking_id: string | null;
  conversation_id: string | null;
  target_path: string | null;
  event_type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient(request);
    const { data: { user }, error: authError } = await getSupabaseAuthenticatedUser(supabase, request);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const url = new URL(request.url);
    if (url.searchParams.get('mode') === 'proposal-unread-count') {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .eq('event_type', 'requirement_proposal_received')
        .is('read_at', null);
      if (error) throw new Error(error.message);
      return NextResponse.json({ unread_count: count ?? 0 });
    }

    if (url.searchParams.get('mode') === 'product-order-unread-updates') {
      const [countResult, latestResult] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_user_id', user.id)
          .in('event_type', productOrderUpdateEvents)
          .like('target_path', '/orders/%')
          .is('read_at', null),
        supabase
          .from('notifications')
          .select('id,target_path,event_type,title,body,created_at')
          .eq('recipient_user_id', user.id)
          .in('event_type', productOrderUpdateEvents)
          .like('target_path', '/orders/%')
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      if (countResult.error) throw new Error(countResult.error.message);
      if (latestResult.error) throw new Error(latestResult.error.message);
      return NextResponse.json({ unread_count: countResult.count ?? 0, latest: latestResult.data?.[0] ?? null });
    }

    if (url.searchParams.get('mode') === 'unread-count') {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .is('read_at', null);
      if (error) throw new Error(error.message);
      return NextResponse.json({ unread_count: count ?? 0 });
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id,booking_id,conversation_id,target_path,event_type,title,body,created_at,read_at')
      .eq('recipient_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const notifications = (data ?? []) as NotificationRow[];
    const needsMessageDestination = notifications.some((item) => item.event_type === 'message_received' && item.conversation_id && !item.target_path);
    if (!needsMessageDestination) return NextResponse.json({ notifications });

    const { data: inboxData, error: inboxError } = await supabase.rpc('get_marketplace_inbox');
    if (inboxError) return NextResponse.json({ notifications });
    const destinationByConversation = new Map<string, string>();
    for (const row of (Array.isArray(inboxData) ? inboxData : []) as InboxDestinationRow[]) {
      if (!row.id) continue;
      const providerSide = row.participant_role === 'provider' || row.participant_role === 'business' || row.participant_role === 'employer';
      destinationByConversation.set(row.id, `${providerSide ? '/provider/messages' : '/messages'}?conversation=${encodeURIComponent(row.id)}`);
    }

    return NextResponse.json({
      notifications: notifications.map((item) => item.event_type === 'message_received' && item.conversation_id && !item.target_path
        ? { ...item, target_path: destinationByConversation.get(item.conversation_id) ?? item.target_path }
        : item),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load notifications.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      id?: string;
      mark_all_read?: boolean;
      mark_requirement_proposals_read?: boolean;
      requirement_id?: string;
      mark_product_order_updates_read?: boolean;
      order_id?: string;
    };
    const supabase = await createSupabaseServerClient(request);
    const { data: { user }, error: authError } = await getSupabaseAuthenticatedUser(supabase, request);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_user_id', user.id);

    if (body.mark_requirement_proposals_read) {
      const requirementId = body.requirement_id?.trim() ?? '';
      if (!requirementIdPattern.test(requirementId)) {
        return NextResponse.json({ error: 'A valid requirement id is required.' }, { status: 400 });
      }
      query = query
        .eq('event_type', 'requirement_proposal_received')
        .like('target_path', `/requirements/${requirementId}?proposal=%`)
        .is('read_at', null);
    } else if (body.mark_product_order_updates_read) {
      const orderId = body.order_id?.trim() ?? '';
      if (!requirementIdPattern.test(orderId)) {
        return NextResponse.json({ error: 'A valid product order id is required.' }, { status: 400 });
      }
      query = query
        .in('event_type', productOrderUpdateEvents)
        .eq('target_path', `/orders/${orderId}`)
        .is('read_at', null);
    } else if (body.mark_all_read) {
      query = query.is('read_at', null);
    } else {
      if (!body.id) return NextResponse.json({ error: 'Notification id is required.' }, { status: 400 });
      query = query.eq('id', body.id);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update notification.' }, { status: 400 });
  }
}
