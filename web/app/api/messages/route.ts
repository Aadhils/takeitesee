import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InboxRow = { unread_count?: number | null };

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error } = await supabase.rpc('get_marketplace_inbox');
    if (error) throw new Error(error.message);
    const conversations = Array.isArray(data) ? data as InboxRow[] : [];

    const url = new URL(request.url);
    if (url.searchParams.get('mode') === 'unread-count') {
      const unreadCount = conversations.reduce((sum, row) => sum + Math.max(0, Number(row.unread_count ?? 0)), 0);
      return NextResponse.json({ unread_count: unreadCount });
    }

    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load messages.' }, { status: 400 });
  }
}
