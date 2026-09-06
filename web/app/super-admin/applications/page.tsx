import Link from 'next/link';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getSuperAdminSessionOrNull } from '../../../server/auth/session';
import { createApplication, setApplicationStatus } from './actions';

const statuses = ['draft', 'active', 'paused', 'retired'] as const;

export default async function ApplicationsPage() {
  if (!await getSuperAdminSessionOrNull()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: applications, error } = await supabase
    .from('platform_applications')
    .select('id, code, name, description, status, created_at')
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);

  return (
    <main className="container section-stack">
      <section className="page-intro">
        <span className="eyebrow">SaaS control plane</span>
        <h1>Application registry</h1>
        <p>Register approved ecosystem applications. New applications start as draft until explicitly activated.</p>
        <Link href="/super-admin">← Super Admin</Link>
      </section>

      <section className="card">
        <h2>Add application</h2>
        <form action={createApplication} className="section-stack">
          <label>Name<input name="name" required placeholder="Takeitesee Services" /></label>
          <label>Code<input name="code" required pattern="[a-z0-9][a-z0-9_-]{1,62}" placeholder="services" /></label>
          <label>Description<textarea name="description" rows={3} placeholder="What this application provides" /></label>
          <button type="submit">Create draft application</button>
        </form>
      </section>

      <section className="section-stack">
        <h2>Registered applications</h2>
        {applications?.length ? applications.map((app) => (
          <article className="card" key={app.id}>
            <div className="section-stack">
              <div><span className="eyebrow">{app.code}</span><h3>{app.name}</h3></div>
              <p>{app.description || 'No description yet.'}</p>
              <p><strong>Status:</strong> {app.status}</p>
              <form action={setApplicationStatus}>
                <input type="hidden" name="id" value={app.id} />
                <label>Change status <select name="status" defaultValue={app.status}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <button type="submit">Update status</button>
              </form>
            </div>
          </article>
        )) : <div className="card"><p>No applications registered yet.</p></div>}
      </section>
    </main>
  );
}
