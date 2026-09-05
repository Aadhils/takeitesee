import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type ExistingProfessional = { id: string; user_id: string; headline: string; verified: boolean };
type ExistingBusiness = { id: string; owner_user_id: string; name: string; verified: boolean };
type ApplicantUser = { id: string; name: string | null; email: string | null };

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('provider_applications')
      .select('id,applicant_user_id,provider_type,display_name,description,location,status,review_note,reviewed_by,reviewed_at,result_provider_id,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const applications = data ?? [];
    if (!applications.length) return NextResponse.json({ applications: [] });

    const applicantIds = Array.from(new Set(applications.map((item) => item.applicant_user_id)));
    const [usersResult, professionalsResult, businessesResult] = await Promise.all([
      supabase.from('users').select('id,name,email').in('id', applicantIds),
      supabase.from('professional_profiles').select('id,user_id,headline,verified').in('user_id', applicantIds),
      supabase.from('businesses').select('id,owner_user_id,name,verified').in('owner_user_id', applicantIds),
    ]);
    for (const result of [usersResult, professionalsResult, businessesResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const users = new Map((usersResult.data as ApplicantUser[] | null ?? []).map((item) => [item.id, item]));
    const professionals = new Map((professionalsResult.data as ExistingProfessional[] | null ?? []).map((item) => [item.user_id, item]));
    const businesses = new Map((businessesResult.data as ExistingBusiness[] | null ?? []).map((item) => [item.owner_user_id, item]));

    return NextResponse.json({
      applications: applications.map((application) => {
        const user = users.get(application.applicant_user_id) ?? null;
        const professional = professionals.get(application.applicant_user_id) ?? null;
        const business = businesses.get(application.applicant_user_id) ?? null;
        return {
          ...application,
          applicant: user ? { name: user.name, email: user.email } : null,
          existing_profiles: {
            professional: professional ? { id: professional.id, display_name: professional.headline, verified: Boolean(professional.verified) } : null,
            business: business ? { id: business.id, display_name: business.name, verified: Boolean(business.verified) } : null,
          },
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider applications.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as { application_id?: string; decision?: 'approve' | 'reject'; note?: string };
    if (!input.application_id || !input.decision || !['approve', 'reject'].includes(input.decision)) {
      return NextResponse.json({ error: 'Application and review decision are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('review_provider_application', {
      target_application_id: input.application_id,
      decision: input.decision,
      reviewer_note: input.note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Provider application could not be reviewed.');
    return NextResponse.json({ application: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider application could not be reviewed.' }, { status: 400 });
  }
}
