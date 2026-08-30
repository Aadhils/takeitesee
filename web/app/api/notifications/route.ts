import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error } = await supabase
      .from('notifications')
      .select('id,booking_id,conversation_id,event_type,title,body,created_at,read_at')
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
    const body = await request.json() as { id?: string; mark_all_read?: boolean };
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_user_id', user.id);
    if (!body.mark_all_read) {
      if (!body.id) return NextResponse.json({ error: 'Notification id is required.' }, { status: 400 });
      query = query.eq('id', body.id);
    } else {
      query = query.is('read_at', null);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update notification.' }, { status: 400 });
  }
}
