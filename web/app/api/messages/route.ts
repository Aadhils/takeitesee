import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseAuthenticatedUser } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InboxRow = {
  unread_count?: number | null;
  participant_role?: 'customer' | 'provider' | 'applicant' | 'employer' | 'business' | null;
};

function scopeConversations(rows: InboxRow[], workspace: string | null) {
  if (workspace === 'customer') {
    return rows.filter((row) => row.participant_role === 'customer' || row.participant_role === 'applicant');
  }
  if (workspace === 'provider') {
    return rows.filter((row) => row.participant_role === 'provider' || row.participant_role === 'business' || row.participant_role === 'employer');
  }
  return rows;
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient(request);
    const { data: { user }, error: authError } = await getSupabaseAuthenticatedUser(supabase, request);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data, error } = await supabase.rpc('get_marketplace_inbox');
    if (error) throw new Error(error.message);
    const conversations = Array.isArray(data) ? data as InboxRow[] : [];

    const url = new URL(request.url);
    const scopedConversations = scopeConversations(conversations, url.searchParams.get('workspace'));
    if (url.searchParams.get('mode') === 'unread-count') {
      const unreadCount = scopedConversations.reduce((sum, row) => sum + Math.max(0, Number(row.unread_count ?? 0)), 0);
      return NextResponse.json({ unread_count: unreadCount });
    }

    return NextResponse.json({ conversations: scopedConversations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load messages.' }, { status: 400 });
  }
}
