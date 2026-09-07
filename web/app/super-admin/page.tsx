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

  const [admins, adminScopes, auditEvents, applications, locations, categories, privacyRequests, supportRequests] = await Promise.all([
    supabase.from('admin_memberships').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('admin_scopes').select('id', { count: 'exact', head: true }).or('can_view.eq.true,can_manage.eq.true'),
    supabase.from('admin_audit_log').select('id', { count: 'exact', head: true }),
    supabase.from('platform_applications').select('id', { count: 'exact', head: true }),
    supabase.from('platform_locations').select('id', { count: 'exact', head: true }),
    supabase.from('platform_categories').select('id', { count: 'exact', head: true }),
    supabase.from('privacy_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_review', 'awaiting_information']),
    supabase.from('platform_support_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_review', 'awaiting_information']),
  ]);

  const metrics = [
    ['Active admins', 'செயலில் உள்ள admins', admins.count ?? 0],
    ['Delegated scopes', 'Delegated scopes', adminScopes.count ?? 0],
    ['Audit events', 'Audit நிகழ்வுகள்', auditEvents.count ?? 0],
    ['Applications', 'Applications', applications.count ?? 0],
    ['Locations', 'இடங்கள்', locations.count ?? 0],
    ['Categories', 'வகைகள்', categories.count ?? 0],
  ] as const;

  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow"><LocaleText en="Platform authority" ta="Platform authority" /></span>
      <h1>Super Admin</h1>
      <p><LocaleText en="Govern administrators, delegated permissions, auditability, and platform configuration. Day-to-day Provider reviews and marketplace operations belong in the Admin workspace." ta="Admins, delegated permissions, audit மற்றும் platform configuration-ஐ நிர்வகிக்கவும். Provider reviews மற்றும் day-to-day marketplace operations Admin workspace-ல் நடைபெறும்." /></p>
    </section>

    <section className="dashboard-grid" aria-label="Super Admin governance overview">
      {metrics.map(([en, ta, value]) => <article className="card" key={en}><span className="eyebrow"><LocaleText en={en} ta={ta} /></span><h2>{value}</h2></article>)}
    </section>

    <section className="card section-stack">
      <div>
        <span className="eyebrow"><LocaleText en="Primary responsibility" ta="Primary responsibility" /></span>
        <h2><LocaleText en="Admin governance" ta="Admin governance" /></h2>
        <p><LocaleText en="Create the operating boundary by controlling who has Admin access, which scopes they can view or manage, and reviewing the audit trail for protected changes." ta="யாருக்கு Admin access வேண்டும், எந்த scopes-ஐ view/manage செய்யலாம், protected changes audit trail என்ன என்பதை இங்கிருந்து கட்டுப்படுத்தவும்." /></p>
      </div>
      <div className="dashboard-grid">
        <article className="card">
          <span className="eyebrow"><LocaleText en="People & permissions" ta="People & permissions" /></span>
          <h3><LocaleText en="Manage delegated Admins" ta="Delegated Admins நிர்வகி" /></h3>
          <p><LocaleText en="Enable or revoke Admin access and maintain view/manage scope permissions." ta="Admin access enable/revoke செய்து view/manage scope permissions-ஐ maintain செய்யவும்." /></p>
          <p><Link href="/super-admin/admins"><LocaleText en="Open Admin controls →" ta="Admin controls திற →" /></Link></p>
        </article>
        <article className="card">
          <span className="eyebrow"><LocaleText en="Accountability" ta="Accountability" /></span>
          <h3><LocaleText en="Review Admin audit" ta="Admin audit review செய்" /></h3>
          <p><LocaleText en="See protected administrative changes and retain platform-level oversight." ta="Protected administrative changes-ஐ பார்த்து platform-level oversight வைத்திருக்கவும்." /></p>
          <p><Link href="/super-admin/audit"><LocaleText en="Open audit log →" ta="Audit log திற →" /></Link></p>
        </article>
      </div>
    </section>

    <section className="card section-stack">
      <div>
        <span className="eyebrow"><LocaleText en="Platform governance" ta="Platform governance" /></span>
        <h2><LocaleText en="Configuration & protected requests" ta="Configuration & protected requests" /></h2>
        <p><LocaleText en="Keep global marketplace structure and platform-level privacy/support governance separate from routine Provider operations." ta="Global marketplace structure மற்றும் platform-level privacy/support governance-ஐ routine Provider operations-லிருந்து தனியாக வைத்திருக்கவும்." /></p>
      </div>
      <div className="dashboard-grid">
        <article className="card"><h3><LocaleText en="Applications" ta="Applications" /></h3><p><Link href="/super-admin/applications"><LocaleText en="Manage platform applications →" ta="Platform applications நிர்வகி →" /></Link></p></article>
        <article className="card"><h3><LocaleText en="Locations & markets" ta="Locations & markets" /></h3><p><Link href="/super-admin/locations"><LocaleText en="Manage locations →" ta="Locations நிர்வகி →" /></Link></p></article>
        <article className="card"><h3><LocaleText en="Categories" ta="Categories" /></h3><p><Link href="/super-admin/categories"><LocaleText en="Manage categories →" ta="Categories நிர்வகி →" /></Link></p></article>
        <article className="card"><h3><LocaleText en="Privacy requests" ta="Privacy requests" /> · {privacyRequests.count ?? 0}</h3><p><Link href="/super-admin/privacy-requests"><LocaleText en="Review privacy governance →" ta="Privacy governance review செய் →" /></Link></p></article>
        <article className="card"><h3><LocaleText en="Platform support" ta="Platform support" /> · {supportRequests.count ?? 0}</h3><p><Link href="/super-admin/support-requests"><LocaleText en="Review platform support →" ta="Platform support review செய் →" /></Link></p></article>
      </div>
    </section>

    <section className="card">
      <span className="eyebrow"><LocaleText en="Operations handoff" ta="Operations handoff" /></span>
      <h2><LocaleText en="Provider operations now live in Admin" ta="Provider operations இப்போது Admin-ல்" /></h2>
      <p><LocaleText en="Provider applications, Provider verification, Provider management, trust work, and service launch review are operational Admin responsibilities. Super Admin keeps platform authority and can enter Admin only when oversight or emergency intervention is needed." ta="Provider applications, verification, Provider management, trust மற்றும் service launch review ஆகியவை Admin operational responsibilities. Super Admin platform authority-ஐ வைத்திருந்து oversight அல்லது emergency intervention தேவைப்பட்டால் மட்டும் Admin workspace-க்கு செல்லலாம்." /></p>
      <p><Link href="/admin"><LocaleText en="Open Admin operations →" ta="Admin operations திற →" /></Link></p>
      <p className="muted"><LocaleText en="Signed in as platform authority" ta="Platform authority ஆக signed in" /> {session.user_id.slice(0, 8)}…</p>
    </section>
  </main>;
}
