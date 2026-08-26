import Link from 'next/link';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { productionAuthProvider } from '../../server/auth/session';

export default async function SuperAdminPage() {
  const session = await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [applications, locations, categories, admins, auditEvents] = await Promise.all([
    supabase.from('platform_applications').select('id', { count: 'exact', head: true }),
    supabase.from('platform_locations').select('id', { count: 'exact', head: true }),
    supabase.from('platform_categories').select('id', { count: 'exact', head: true }),
    supabase.from('admin_memberships').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('admin_audit_log').select('id', { count: 'exact', head: true }),
  ]);

  const metrics = [
    ['Applications', applications.count ?? 0],
    ['Locations', locations.count ?? 0],
    ['Categories', categories.count ?? 0],
    ['Active admins', admins.count ?? 0],
    ['Audit events', auditEvents.count ?? 0],
  ] as const;

  return (
    <main className="container section-stack">
      <section className="page-intro">
        <span className="eyebrow">SaaS control plane</span>
        <h1>Super Admin</h1>
        <p>Manage the takeitesee ecosystem across applications, locations, categories, services, and delegated administrators.</p>
      </section>

      <section className="dashboard-grid" aria-label="Platform overview">
        {metrics.map(([label, value]) => (
          <article className="card" key={label}>
            <span className="eyebrow">{label}</span>
            <h2>{value}</h2>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>Control plane</h2>
        <p>Application registry, hierarchical locations, category scopes, delegated admin permissions, and audit logging are protected behind Super Admin access.</p>
        <p><Link href="/super-admin/applications">Manage applications →</Link></p>
        <p><Link href="/super-admin/locations">Manage locations & markets →</Link></p>
        <p><Link href="/super-admin/categories">Manage categories →</Link></p>
        <p><Link href="/super-admin/admins">Manage delegated admins →</Link></p>
        <p><Link href="/super-admin/audit">Review admin audit log →</Link></p>
        <p className="muted">Signed in as platform user {session.user_id.slice(0, 8)}…</p>
      </section>
    </main>
  );
}
