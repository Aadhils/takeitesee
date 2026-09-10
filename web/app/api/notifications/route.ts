import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const requirementIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const url = new URL(request.url);
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
    return NextResponse.json({ notifications: data ?? [] });
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
    };
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
