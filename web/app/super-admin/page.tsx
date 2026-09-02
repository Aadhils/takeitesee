import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { productionAuthProvider } from '../../server/auth/session';
import { LocaleText } from '../../components/i18n/LocaleText';

export default async function SuperAdminPage() {
  const session = await productionAuthProvider.getSession();
  if (!session) redirect('/account');
  if (!session.roles.includes('super_admin')) redirect('/admin');

  const supabase = await createSupabaseServerClient();

  const [applications, providerApplications, providerVerifications, serviceLaunches, providerTrust, privacyRequests, payoutBatches, locations, categories, admins, auditEvents] = await Promise.all([
    supabase.from('platform_applications').select('id', { count: 'exact', head: true }),
    supabase.from('provider_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('provider_verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('service_launch_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('provider_trust_states').select('id', { count: 'exact', head: true }).neq('status', 'normal'),
    supabase.from('privacy_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_review', 'awaiting_information']),
    supabase.from('provider_payout_batches').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
    supabase.from('platform_locations').select('id', { count: 'exact', head: true }),
    supabase.from('platform_categories').select('id', { count: 'exact', head: true }),
    supabase.from('admin_memberships').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('admin_audit_log').select('id', { count: 'exact', head: true }),
  ]);

  const metrics = [
    ['Applications', 'Applications', applications.count ?? 0],
    ['Provider reviews', 'Provider reviews', providerApplications.count ?? 0],
    ['Verification reviews', 'Verification reviews', providerVerifications.count ?? 0],
    ['Launch reviews', 'Launch reviews', serviceLaunches.count ?? 0],
    ['Trust attention', 'Trust கவனம்', providerTrust.count ?? 0],
    ['Privacy requests', 'Privacy requests', privacyRequests.count ?? 0],
    ['Payout batches', 'Payout batches', payoutBatches.count ?? 0],
    ['Locations', 'இடங்கள்', locations.count ?? 0],
    ['Categories', 'வகைகள்', categories.count ?? 0],
    ['Active admins', 'செயலில் உள்ள admins', admins.count ?? 0],
    ['Audit events', 'Audit நிகழ்வுகள்', auditEvents.count ?? 0],
  ] as const;

  return <main className="container section-stack">
    <section className="page-intro"><span className="eyebrow"><LocaleText en="SaaS control plane" ta="SaaS கட்டுப்பாட்டு மையம்" /></span><h1>Super Admin</h1><p><LocaleText en="Manage the takeitesee ecosystem across provider access, verification, trust state, controlled service launch, platform finance, applications, markets, categories, and delegated administrators." ta="Provider access, verification, trust state, controlled service launch, platform finance, applications, markets, categories மற்றும் delegated administrators உட்பட takeitesee ecosystem-ஐ நிர்வகிக்கவும்." /></p></section>
    <section className="dashboard-grid" aria-label="Platform overview">{metrics.map(([en, ta, value]) => <article className="card" key={en}><span className="eyebrow"><LocaleText en={en} ta={ta} /></span><h2>{value}</h2></article>)}</section>
    <section className="card"><h2><LocaleText en="Control plane" ta="கட்டுப்பாட்டு மையம்" /></h2><p><LocaleText en="Provider onboarding, identity verification, trust state, service launch scope, and finance settlement are separate guarded decisions. Public service activation and provider payout readiness remain independently controlled." ta="Provider onboarding, identity verification, trust state, service launch scope மற்றும் finance settlement தனித்தனி பாதுகாக்கப்பட்ட முடிவுகள். Public service activation மற்றும் provider payout readiness தனித்தனியாக கட்டுப்படுத்தப்படுகின்றன." /></p>
      <p><Link href="/super-admin/provider-applications"><LocaleText en="Review provider applications →" ta="Provider applications review செய் →" /></Link></p>
      <p><Link href="/super-admin/provider-verifications"><LocaleText en="Review provider verification →" ta="Provider verification review செய் →" /></Link></p>
      <p><Link href="/super-admin/provider-trust"><LocaleText en="Manage provider trust state →" ta="Provider trust state நிர்வகி →" /></Link></p>
      <p><Link href="/super-admin/service-launches"><LocaleText en="Review service launches →" ta="Service launches review செய் →" /></Link></p>
      <p><Link href="/super-admin/privacy-requests"><LocaleText en="Review privacy requests →" ta="Privacy requests review செய் →" /></Link></p>
      <p><Link href="/super-admin/finance"><LocaleText en="Manage commission & payouts →" ta="Commission & payouts நிர்வகி →" /></Link></p>
      <p><Link href="/super-admin/applications"><LocaleText en="Manage applications →" ta="Applications நிர்வகி →" /></Link></p>
      <p><Link href="/super-admin/locations"><LocaleText en="Manage locations & markets →" ta="Locations & markets நிர்வகி →" /></Link></p>
      <p><Link href="/super-admin/categories"><LocaleText en="Manage categories →" ta="Categories நிர்வகி →" /></Link></p>
      <p><Link href="/super-admin/admins"><LocaleText en="Manage delegated admins →" ta="Delegated admins நிர்வகி →" /></Link></p>
      <p><Link href="/super-admin/audit"><LocaleText en="Review admin audit log →" ta="Admin audit log review செய் →" /></Link></p>
      <p className="muted"><LocaleText en="Signed in as platform user" ta="Platform user ஆக signed in" /> {session.user_id.slice(0, 8)}…</p>
    </section>
  </main>;
}
