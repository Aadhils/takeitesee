import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LaunchReview = {
  id: string;
  application_id: string;
  location_id: string;
  category_id: string;
  service_id: string;
  [key: string]: unknown;
};

type AdminScope = {
  scope_type: string;
  application_id: string | null;
  location_id: string | null;
  category_id: string | null;
  service_id: string | null;
  can_manage: boolean;
};

function scopeCanManage(row: LaunchReview, scopes: AdminScope[]) {
  return scopes.some((scope) => {
    if (!scope.can_manage) return false;
    if (scope.scope_type === 'platform') return true;
    if (scope.scope_type === 'application') return scope.application_id === row.application_id;
    if (scope.scope_type === 'location') {
      return scope.location_id === row.location_id && (!scope.application_id || scope.application_id === row.application_id);
    }
    if (scope.scope_type === 'category') {
      return scope.category_id === row.category_id && (!scope.application_id || scope.application_id === row.application_id);
    }
    if (scope.scope_type === 'service') {
      return scope.service_id === row.service_id && (!scope.application_id || scope.application_id === row.application_id);
    }
    return false;
  });
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_service_launch_review_queue');
    if (error) throw new Error(error.message);

    const requests = (Array.isArray(data) ? data : []) as LaunchReview[];
    if (session.roles.includes('super_admin')) {
      return NextResponse.json({ requests: requests.map((row) => ({ ...row, can_manage: true })) });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('admin_memberships')
      .select('id')
      .eq('user_id', session.user_id)
      .eq('active', true)
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);

    let scopes: AdminScope[] = [];
    if (membership) {
      const { data: scopeData, error: scopeError } = await supabase
        .from('admin_scopes')
        .select('scope_type,application_id,location_id,category_id,service_id,can_manage')
        .eq('admin_membership_id', membership.id);
      if (scopeError) throw new Error(scopeError.message);
      scopes = (scopeData ?? []) as AdminScope[];
    }

    return NextResponse.json({
      requests: requests.map((row) => ({ ...row, can_manage: scopeCanManage(row, scopes) })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load service launch reviews.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as { request_id?: string; decision?: 'approve' | 'changes_requested' | 'reject'; note?: string };
    if (!input.request_id || !input.decision || !['approve','changes_requested','reject'].includes(input.decision)) {
      return NextResponse.json({ error: 'Launch request and a valid decision are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('review_service_launch_request', {
      target_request_id: input.request_id,
      decision: input.decision,
      reviewer_note: input.note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Service launch request could not be reviewed.');
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Service launch request could not be reviewed.' }, { status: 400 });
  }
}
