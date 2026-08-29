import Link from 'next/link';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { productionAuthProvider } from '../../server/auth/session';

export default async function SuperAdminPage() {
  const session = await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [applications, providerApplications, providerVerifications, serviceLaunches, providerTrust, locations, categories, admins, auditEvents] = await Promise.all([
    supabase.from('platform_applications').select('id', { count: 'exact', head: true }),
    supabase.from('provider_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('provider_verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('service_launch_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('provider_trust_states').select('id', { count: 'exact', head: true }).neq('status', 'normal'),
    supabase.from('platform_locations').select('id', { count: 'exact', head: true }),
    supabase.from('platform_categories').select('id', { count: 'exact', head: true }),
    supabase.from('admin_memberships').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('admin_audit_log').select('id', { count: 'exact', head: true }),
  ]);

  const metrics = [
    ['Applications', applications.count ?? 0],
    ['Provider reviews', providerApplications.count ?? 0],
    ['Verification reviews', providerVerifications.count ?? 0],
    ['Launch reviews', serviceLaunches.count ?? 0],
    ['Trust attention', providerTrust.count ?? 0],
    ['Locations', locations.count ?? 0],
    ['Categories', categories.count ?? 0],
    ['Active admins', admins.count ?? 0],
    ['Audit events', auditEvents.count ?? 0],
  ] as const;

  return <main className="container section-stack">
    <section className="page-intro"><span className="eyebrow">SaaS control plane</span><h1>Super Admin</h1><p>Manage the takeitesee ecosystem across provider access, verification, trust state, controlled service launch, applications, markets, categories, and delegated administrators.</p></section>
    <section className="dashboard-grid" aria-label="Platform overview">{metrics.map(([label, value]) => <article className="card" key={label}><span className="eyebrow">{label}</span><h2>{value}</h2></article>)}</section>
    <section className="card"><h2>Control plane</h2><p>Provider onboarding, identity verification, trust state, and service launch scope are separate guarded decisions. Public service activation requires all launch gates plus normal trust state.</p>
      <p><Link href="/super-admin/provider-applications">Review provider applications →</Link></p>
      <p><Link href="/super-admin/provider-verifications">Review provider verification →</Link></p>
      <p><Link href="/super-admin/provider-trust">Manage provider trust state →</Link></p>
      <p><Link href="/super-admin/service-launches">Review service launches →</Link></p>
      <p><Link href="/super-admin/applications">Manage applications →</Link></p>
      <p><Link href="/super-admin/locations">Manage locations & markets →</Link></p>
      <p><Link href="/super-admin/categories">Manage categories →</Link></p>
      <p><Link href="/super-admin/admins">Manage delegated admins →</Link></p>
      <p><Link href="/super-admin/audit">Review admin audit log →</Link></p>
      <p className="muted">Signed in as platform user {session.user_id.slice(0, 8)}…</p>
    </section>
  </main>;
}
