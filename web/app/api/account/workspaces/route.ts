import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { isWorkspaceKind, WORKSPACE_COOKIE, workspacePreferenceFromRequest, workspaceTarget, type WorkspaceKind } from '../../../../server/auth/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WorkspaceOption = {
  id: WorkspaceKind;
  label: string;
  display_name: string;
  description: string;
  target: string;
  verified?: boolean;
};

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const supabase = await createSupabaseServerClient();
    const [{ data: user, error: userError }, { data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
      supabase.from('users').select('name').eq('id', session.user_id).maybeSingle(),
      supabase.from('professional_profiles').select('id,headline,verified').eq('user_id', session.user_id).limit(1).maybeSingle(),
      supabase.from('businesses').select('id,name,verified').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
    ]);
    if (userError) throw new Error(userError.message);
    if (professionalError) throw new Error(professionalError.message);
    if (businessError) throw new Error(businessError.message);

    const accountName = user?.name?.trim() || 'My account';
    const workspaces: WorkspaceOption[] = [{
      id: 'customer',
      label: 'Customer',
      display_name: accountName,
      description: 'Bookings, requirements, notifications and account settings.',
      target: workspaceTarget('customer'),
    }];

    if (session.roles.includes('professional') && professional) {
      workspaces.push({
        id: 'professional',
        label: 'Professional',
        display_name: professional.headline?.trim() || accountName,
        description: 'Services, talents, portfolio, resume, jobs and provider operations.',
        target: workspaceTarget('professional'),
        verified: Boolean(professional.verified),
      });
    }

    if (session.roles.includes('business_owner') && business) {
      workspaces.push({
        id: 'business',
        label: 'Business',
        display_name: business.name,
        description: 'Business services, bookings, employer hiring and provider operations.',
        target: workspaceTarget('business'),
        verified: Boolean(business.verified),
      });
    }

    if (session.roles.includes('admin')) {
      workspaces.push({ id: 'admin', label: 'Admin', display_name: 'Admin workspace', description: 'Delegated platform operations and moderation.', target: workspaceTarget('admin') });
    }
    if (session.roles.includes('super_admin')) {
      workspaces.push({ id: 'super_admin', label: 'Super Admin', display_name: 'Platform control', description: 'Platform-wide control plane and governance.', target: workspaceTarget('super_admin') });
    }

    const preferred = workspacePreferenceFromRequest(request);
    const active = preferred && workspaces.some((workspace) => workspace.id === preferred) ? preferred : 'customer';
    return NextResponse.json({ active, workspaces });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load account workspaces.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json() as { workspace?: unknown };
    if (!isWorkspaceKind(body.workspace)) return NextResponse.json({ error: 'Invalid workspace.' }, { status: 400 });
    const workspace = body.workspace;

    const allowed = workspace === 'customer'
      || (workspace === 'professional' && session.roles.includes('professional'))
      || (workspace === 'business' && session.roles.includes('business_owner'))
      || (workspace === 'admin' && session.roles.includes('admin'))
      || (workspace === 'super_admin' && session.roles.includes('super_admin'));
    if (!allowed) return NextResponse.json({ error: 'This workspace is not available for your account.' }, { status: 403 });

    // For provider workspaces, re-check the exact owned identity before persisting the preference.
    if (workspace === 'professional' || workspace === 'business') {
      const supabase = await createSupabaseServerClient();
      const query = workspace === 'professional'
        ? supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).limit(1).maybeSingle()
        : supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: 'Owned provider profile was not found.' }, { status: 403 });
    }

    const response = NextResponse.json({ workspace, redirect: workspaceTarget(workspace) });
    response.cookies.set(WORKSPACE_COOKIE, workspace, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to switch workspace.' }, { status: 400 });
  }
}
