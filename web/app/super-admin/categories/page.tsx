import Link from 'next/link';
import { LocaleText } from '../../../components/i18n/LocaleText';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { createCategory, setCategoryActive } from './actions';

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

  return <main className="container section-stack">
    <section className="page-intro"><span className="eyebrow"><LocaleText en="SaaS control plane" ta="SaaS கட்டுப்பாட்டு மையம்" /></span><h1><LocaleText en="Category registry" ta="வகை பதிவகம்" /></h1><p><LocaleText en="Build application-specific categories and optional parent-child category trees without changing customer or provider flows." ta="Customer அல்லது provider flow-ஐ மாற்றாமல் application-specific categories மற்றும் optional parent-child category trees உருவாக்கவும்." /></p><Link href="/super-admin">← Super Admin</Link></section>
    <section className="card"><h2><LocaleText en="Add category" ta="வகை சேர்க்க" /></h2><form action={createCategory} className="section-stack">
      <label><LocaleText en="Application" ta="Application" /><select name="application_id" required defaultValue=""><option value="" disabled>Select application</option>{(applications ?? []).map((app) => <option key={app.id} value={app.id}>{app.name} ({app.status})</option>)}</select></label>
      <label><LocaleText en="Name" ta="பெயர்" /><input name="name" required placeholder="Home Services" /></label>
      <label><LocaleText en="Code" ta="குறியீடு" /><input name="code" required pattern="[a-z0-9][a-z0-9_-]{1,62}" placeholder="home_services" /></label>
      <label><LocaleText en="Parent category" ta="மேல் வகை" /><select name="parent_id" defaultValue=""><option value="">None / root category</option>{(categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name} — {appName.get(category.application_id) ?? 'Application'}</option>)}</select></label>
      <label><LocaleText en="Description" ta="விளக்கம்" /><textarea name="description" rows={3} placeholder="What this category contains" /></label>
      <button type="submit"><LocaleText en="Create category" ta="வகை உருவாக்க" /></button>
    </form></section>
    <section className="section-stack"><h2><LocaleText en="Registered categories" ta="பதிவுசெய்யப்பட்ட வகைகள்" /></h2>{(categories ?? []).length ? (categories ?? []).map((category) => <article className="card" key={category.id}><span className="eyebrow">{appName.get(category.application_id) ?? 'Application'} · {category.code}</span><h3>{category.name}</h3><p>{category.description || <LocaleText en="No description yet." ta="இன்னும் விளக்கம் இல்லை." />}</p><p><strong><LocaleText en="Status:" ta="நிலை:" /></strong> <LocaleText en={category.active ? 'Active' : 'Inactive'} ta={category.active ? 'செயலில்' : 'செயலற்றது'} /> · <LocaleText en={category.parent_id ? 'Child category' : 'Root category'} ta={category.parent_id ? 'Child category' : 'Root category'} /></p><form action={setCategoryActive}><input type="hidden" name="id" value={category.id} /><input type="hidden" name="application_id" value={category.application_id} /><input type="hidden" name="active" value={String(!category.active)} /><button type="submit"><LocaleText en={category.active ? 'Deactivate' : 'Activate'} ta={category.active ? 'செயலிழக்கச் செய்' : 'செயல்படுத்து'} /></button></form></article>) : <div className="card"><p><LocaleText en="No categories registered yet." ta="இன்னும் categories பதிவு செய்யப்படவில்லை." /></p></div>}</section>
  </main>;
}
