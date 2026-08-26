import Link from 'next/link';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { createCategory, seedHomeServicesCategories, setCategoryActive } from './actions';

export default async function CategoriesPage() {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');

  const supabase = await createSupabaseServerClient();
  const [{ data: applications, error: appError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.from('platform_applications').select('id, code, name, status').neq('status', 'retired').order('name'),
    supabase.from('platform_categories').select('id, application_id, parent_id, code, name, description, active, sort_order').order('sort_order').order('name'),
  ]);

  if (appError || categoryError) throw new Error(appError?.message || categoryError?.message);

  const appName = new Map((applications ?? []).map((app) => [app.id, app.name]));
  const childCount = new Map<string, number>();
  for (const category of categories ?? []) {
    if (category.parent_id) childCount.set(category.parent_id, (childCount.get(category.parent_id) ?? 0) + 1);
  }

  return (
    <main className="container section-stack">
      <section className="page-intro">
        <span className="eyebrow">SaaS control plane</span>
        <h1>Category registry</h1>
        <p>Build application-specific categories and optional parent-child category trees without changing customer or provider flows.</p>
        <Link href="/super-admin">← Super Admin</Link>
      </section>

      <section className="card">
        <h2>Add category</h2>
        <form action={createCategory} className="section-stack">
          <label>
            Application
            <select name="application_id" required defaultValue="">
              <option value="" disabled>Select application</option>
              {(applications ?? []).map((app) => <option key={app.id} value={app.id}>{app.name} ({app.status})</option>)}
            </select>
          </label>
          <label>Name<input name="name" required placeholder="Home Services" /></label>
          <label>Code<input name="code" required pattern="[a-z0-9][a-z0-9_-]{1,62}" placeholder="home_services" /></label>
          <label>
            Parent category
            <select name="parent_id" defaultValue="">
              <option value="">None / root category</option>
              {(categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name} — {appName.get(category.application_id) ?? 'Application'}</option>)}
            </select>
          </label>
          <label>Description<textarea name="description" rows={3} placeholder="What this category contains" /></label>
          <button type="submit">Create category</button>
        </form>
      </section>

      <section className="section-stack">
        <div className="admin-section-heading">
          <div><span className="eyebrow">Catalog structure</span><h2>Registered categories</h2></div>
          <span>{(categories ?? []).length} total</span>
        </div>
        {(categories ?? []).length ? (categories ?? []).map((category) => (
          <article className="card section-stack" key={category.id}>
            <div className="admin-record-top">
              <div>
                <span className="eyebrow">{appName.get(category.application_id) ?? 'Application'} · {category.code}</span>
                <h3>{category.name}</h3>
                <p>{category.description || 'No description yet.'}</p>
              </div>
              <span className={`badge ${category.active ? 'badge-success' : 'badge-neutral'}`}>{category.active ? 'Active' : 'Inactive'}</span>
            </div>
            <p><strong>{category.parent_id ? 'Child category' : 'Root category'}</strong>{!category.parent_id ? ` · ${childCount.get(category.id) ?? 0} child categories` : ''}</p>

            {category.code === 'home_services' && !category.parent_id ? (
              <div className="card section-stack">
                <div>
                  <span className="eyebrow">Starter catalog</span>
                  <h4>Home Services starter set</h4>
                  <p>Add the standard child categories in one safe, repeatable action. Existing categories such as Plumbing are skipped automatically.</p>
                </div>
                <form action={seedHomeServicesCategories}>
                  <input type="hidden" name="application_id" value={category.application_id} />
                  <input type="hidden" name="parent_id" value={category.id} />
                  <button className="button button-secondary" type="submit">Add starter categories</button>
                </form>
              </div>
            ) : null}

            <form action={setCategoryActive}>
              <input type="hidden" name="id" value={category.id} />
              <input type="hidden" name="application_id" value={category.application_id} />
              <input type="hidden" name="active" value={String(!category.active)} />
              <button type="submit">{category.active ? 'Deactivate' : 'Activate'}</button>
            </form>
          </article>
        )) : <div className="card"><p>No categories registered yet.</p></div>}
      </section>
    </main>
  );
}
