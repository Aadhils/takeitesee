import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { productionAuthProvider } from '../../server/auth/session';
import { LocaleText } from '../../components/i18n/LocaleText';

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '14px',
} as const;

const workspaceGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '18px',
  alignItems: 'start',
} as const;

const actionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: '12px',
} as const;

const metricCardStyle = {
  padding: '18px 20px',
  minHeight: '112px',
  display: 'grid',
  alignContent: 'space-between',
  gap: '12px',
} as const;

const panelStyle = {
  padding: '24px',
  display: 'grid',
  gap: '20px',
} as const;

const actionCardStyle = {
  padding: '18px',
  minHeight: '152px',
  display: 'grid',
  alignContent: 'start',
  gap: '8px',
} as const;

export default async function SuperAdminPage() {
  const session = await productionAuthProvider.getSession();
  if (!session) redirect('/account');
  if (!session.roles.includes('super_admin')) redirect('/admin');

  const supabase = await createSupabaseServerClient();

  const [admins, adminScopes, auditEvents, applications, locations, categories, privacyRequests, supportRequests, productLaunchRequests] = await Promise.all([
    supabase.from('admin_memberships').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('admin_scopes').select('id', { count: 'exact', head: true }).or('can_view.eq.true,can_manage.eq.true'),
    supabase.from('admin_audit_log').select('id', { count: 'exact', head: true }),
    supabase.from('platform_applications').select('id', { count: 'exact', head: true }),
    supabase.from('platform_locations').select('id', { count: 'exact', head: true }),
    supabase.from('platform_categories').select('id', { count: 'exact', head: true }),
    supabase.from('privacy_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_review', 'awaiting_information']),
    supabase.from('platform_support_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_review', 'awaiting_information']),
    supabase.from('business_product_launch_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
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
    <section className="page-intro" style={{ maxWidth: '760px' }}>
      <span className="eyebrow"><LocaleText en="Platform authority" ta="Platform authority" /></span>
      <h1>Super Admin</h1>
      <p><LocaleText en="Govern administrators, delegated permissions, auditability, and platform configuration. Day-to-day Provider reviews and marketplace operations belong in the Admin workspace." ta="Admins, delegated permissions, audit மற்றும் platform configuration-ஐ நிர்வகிக்கவும். Provider reviews மற்றும் day-to-day marketplace operations Admin workspace-ல் நடைபெறும்." /></p>
    </section>

    <section style={metricGridStyle} aria-label="Super Admin governance overview">
      {metrics.map(([en, ta, value]) => <article className="card" style={metricCardStyle} key={en}>
        <span className="eyebrow"><LocaleText en={en} ta={ta} /></span>
        <h2 style={{ margin: 0, fontSize: '2rem' }}>{value}</h2>
      </article>)}
    </section>

    <section style={workspaceGridStyle} aria-label="Super Admin workspaces">
      <article className="card" style={panelStyle}>
        <div>
          <span className="eyebrow"><LocaleText en="Primary responsibility" ta="Primary responsibility" /></span>
          <h2 style={{ marginBottom: '8px' }}><LocaleText en="Admin governance" ta="Admin governance" /></h2>
          <p><LocaleText en="Control who has Admin access, what they can view or manage, and keep every protected change accountable." ta="யாருக்கு Admin access வேண்டும், எந்த scopes-ஐ view/manage செய்யலாம் மற்றும் protected changes அனைத்தையும் audit செய்ய இங்கிருந்து கட்டுப்படுத்தவும்." /></p>
        </div>
        <div style={actionGridStyle}>
          <div className="card" style={actionCardStyle}>
            <span className="eyebrow"><LocaleText en="People & permissions" ta="People & permissions" /></span>
            <h3 style={{ margin: 0 }}><LocaleText en="Manage delegated Admins" ta="Delegated Admins நிர்வகி" /></h3>
            <p style={{ margin: 0 }}><LocaleText en="Enable, revoke, and maintain view/manage scopes." ta="Admin access enable/revoke செய்து view/manage scopes maintain செய்யவும்." /></p>
            <p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/admins"><LocaleText en="Open Admin controls →" ta="Admin controls திற →" /></Link></p>
          </div>
          <div className="card" style={actionCardStyle}>
            <span className="eyebrow"><LocaleText en="Accountability" ta="Accountability" /></span>
            <h3 style={{ margin: 0 }}><LocaleText en="Review Admin audit" ta="Admin audit review செய்" /></h3>
            <p style={{ margin: 0 }}><LocaleText en="Review protected administrative changes and platform oversight." ta="Protected administrative changes மற்றும் platform oversight-ஐ review செய்யவும்." /></p>
            <p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/audit"><LocaleText en="Open audit log →" ta="Audit log திற →" /></Link></p>
          </div>
        </div>
      </article>

      <article className="card" style={panelStyle}>
        <div>
          <span className="eyebrow"><LocaleText en="Platform governance" ta="Platform governance" /></span>
          <h2 style={{ marginBottom: '8px' }}><LocaleText en="Configuration & protected requests" ta="Configuration & protected requests" /></h2>
          <p><LocaleText en="Manage global marketplace structure and platform-level privacy, support, and Business product publication governance." ta="Global marketplace structure மற்றும் platform-level privacy/support/Business product publication governance-ஐ நிர்வகிக்கவும்." /></p>
        </div>
        <div style={actionGridStyle}>
          <div className="card" style={actionCardStyle}><h3 style={{ margin: 0 }}><LocaleText en="Applications" ta="Applications" /></h3><p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/applications"><LocaleText en="Manage applications →" ta="Applications நிர்வகி →" /></Link></p></div>
          <div className="card" style={actionCardStyle}><h3 style={{ margin: 0 }}><LocaleText en="Locations & markets" ta="Locations & markets" /></h3><p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/locations"><LocaleText en="Manage locations →" ta="Locations நிர்வகி →" /></Link></p></div>
          <div className="card" style={actionCardStyle}><h3 style={{ margin: 0 }}><LocaleText en="Categories" ta="Categories" /></h3><p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/categories"><LocaleText en="Manage categories →" ta="Categories நிர்வகி →" /></Link></p></div>
          <div className="card" style={actionCardStyle}><span className="eyebrow"><LocaleText en="Pending" ta="Pending" /> · {productLaunchRequests.count ?? 0}</span><h3 style={{ margin: 0 }}><LocaleText en="Product launch reviews" ta="Product launch reviews" /></h3><p style={{ margin: 0 }}><LocaleText en="Approve only the submitted current catalog revision before public storefront exposure." ta="Public storefront exposure-க்கு முன் submitted current product revision-ஐ review செய்யவும்." /></p><p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/product-launches"><LocaleText en="Review products →" ta="Products review செய் →" /></Link></p></div>
          <div className="card" style={actionCardStyle}><span className="eyebrow"><LocaleText en="Pending" ta="Pending" /> · {privacyRequests.count ?? 0}</span><h3 style={{ margin: 0 }}><LocaleText en="Privacy requests" ta="Privacy requests" /></h3><p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/privacy-requests"><LocaleText en="Review privacy →" ta="Privacy review செய் →" /></Link></p></div>
          <div className="card" style={actionCardStyle}><span className="eyebrow"><LocaleText en="Pending" ta="Pending" /> · {supportRequests.count ?? 0}</span><h3 style={{ margin: 0 }}><LocaleText en="Platform support" ta="Platform support" /></h3><p style={{ margin: 'auto 0 0' }}><Link href="/super-admin/support-requests"><LocaleText en="Review support →" ta="Support review செய் →" /></Link></p></div>
        </div>
      </article>
    </section>

    <section className="card" style={{ ...panelStyle, gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center' }}>
      <div>
        <span className="eyebrow"><LocaleText en="Operations handoff" ta="Operations handoff" /></span>
        <h2 style={{ marginBottom: '8px' }}><LocaleText en="Provider operations live in Admin" ta="Provider operations Admin-ல்" /></h2>
        <p style={{ marginBottom: 0 }}><LocaleText en="Provider applications, verification, management, trust, and service launch review belong to Admin. Revision-bound Business product publication is retained here as a Super Admin commerce-governance gate for now." ta="Provider applications, verification, management, trust மற்றும் service launch review Admin பொறுப்பு. Revision-bound Business product publication தற்போது Super Admin commerce-governance gate ஆக இங்கே இருக்கும்." /></p>
      </div>
      <Link className="button button-secondary" href="/admin"><LocaleText en="Open Admin operations" ta="Admin operations திற" /></Link>
    </section>

    <p className="muted" style={{ marginTop: '-8px' }}><LocaleText en="Signed in as platform authority" ta="Platform authority ஆக signed in" /> {session.user_id.slice(0, 8)}…</p>
  </main>;
}
