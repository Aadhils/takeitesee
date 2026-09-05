import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderType = 'professional' | 'business';
type TrustStatus = 'normal' | 'reverification_required' | 'suspended';
type RawReadiness = {
  provider_id?: string;
  profile_complete?: boolean;
  verified?: boolean;
  first_service_created?: boolean;
  first_service_scoped?: boolean;
  marketplace_live?: boolean;
  services_total?: number;
  services_scoped?: number;
  services_active?: number;
  pending_launch_requests?: number;
};

type OwnedProvider = {
  provider_type: ProviderType;
  display_name: string;
  provider_id: string;
};

function nextAction(readiness: RawReadiness, trustStatus: TrustStatus, marketplaceLive: boolean) {
  if (!readiness.profile_complete) return { id: 'profile', label: 'Complete provider profile', href: '/provider/profile' };
  if (!readiness.verified) return { id: 'verification', label: 'Complete provider verification', href: '/provider/verification' };
  if (trustStatus !== 'normal') return { id: 'trust', label: 'Clear provider trust state', href: '/provider/verification' };
  if (!readiness.first_service_created) return { id: 'service', label: 'Create your first service', href: '/provider/services' };
  if (!readiness.first_service_scoped) return { id: 'scope', label: 'Approve category & location', href: '/provider/setup#service-launch' };
  if (!marketplaceLive) return { id: 'launch', label: 'Launch to marketplace', href: '/provider/services' };
  return { id: 'review', label: 'Review provider setup', href: '/provider/setup' };
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const supabase = await createSupabaseServerClient();
    const [professionalResult, businessResult] = await Promise.all([
      session.roles.includes('professional')
        ? supabase.from('professional_profiles').select('id,headline').eq('user_id', session.user_id).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      session.roles.includes('business_owner')
        ? supabase.from('businesses').select('id,name').eq('owner_user_id', session.user_id).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (professionalResult.error) throw new Error(professionalResult.error.message);
    if (businessResult.error) throw new Error(businessResult.error.message);

    const owned: OwnedProvider[] = [];
    if (professionalResult.data) {
      owned.push({
        provider_type: 'professional',
        provider_id: professionalResult.data.id,
        display_name: professionalResult.data.headline?.trim() || 'Professional profile',
      });
    }
    if (businessResult.data) {
      owned.push({
        provider_type: 'business',
        provider_id: businessResult.data.id,
        display_name: businessResult.data.name?.trim() || 'Business profile',
      });
    }

    const providers = await Promise.all(owned.map(async (provider) => {
      const readinessResult = await supabase.rpc('get_provider_setup_readiness_for_type', {
        requested_provider_type: provider.provider_type,
      });
      if (readinessResult.error) throw new Error(readinessResult.error.message);
      const raw = (readinessResult.data ?? {}) as RawReadiness;
      if (!raw.provider_id || raw.provider_id !== provider.provider_id) throw new Error('Provider readiness identity mismatch.');

      const trustResult = provider.provider_type === 'professional'
        ? await supabase.from('provider_trust_states').select('status,reason').eq('professional_id', provider.provider_id).maybeSingle()
        : await supabase.from('provider_trust_states').select('status,reason').eq('business_id', provider.provider_id).maybeSingle();
      if (trustResult.error) throw new Error(trustResult.error.message);
      const trustStatus = (trustResult.data?.status ?? 'normal') as TrustStatus;
      const trustNormal = trustStatus === 'normal';
      const marketplaceLive = Boolean(raw.marketplace_live) && trustNormal;
      const gates = [
        Boolean(raw.profile_complete),
        Boolean(raw.verified),
        trustNormal,
        Boolean(raw.first_service_created),
        Boolean(raw.first_service_scoped),
        marketplaceLive,
      ];
      const progressPercent = Math.round((gates.filter(Boolean).length / gates.length) * 100);

      return {
        provider_type: provider.provider_type,
        provider_id: provider.provider_id,
        display_name: provider.display_name,
        profile_complete: Boolean(raw.profile_complete),
        verified: Boolean(raw.verified),
        trust_status: trustStatus,
        trust_reason: trustResult.data?.reason ?? null,
        first_service_created: Boolean(raw.first_service_created),
        first_service_scoped: Boolean(raw.first_service_scoped),
        marketplace_live: marketplaceLive,
        services_total: Number(raw.services_total ?? 0),
        services_scoped: Number(raw.services_scoped ?? 0),
        services_active: Number(raw.services_active ?? 0),
        pending_launch_requests: Number(raw.pending_launch_requests ?? 0),
        progress_percent: progressPercent,
        next_action: nextAction(raw, trustStatus, marketplaceLive),
      };
    }));

    return NextResponse.json({ providers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider readiness.' }, { status: 500 });
  }
}
