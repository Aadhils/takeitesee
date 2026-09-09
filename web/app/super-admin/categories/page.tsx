import Link from 'next/link';
import { LocaleText } from '../../../components/i18n/LocaleText';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getSuperAdminSessionOrNull } from '../../../server/auth/session';
import { createCategory, reviewCategoryRequest, setCategoryActive } from './actions';

function suggestedCode(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 63);
}

export default async function CategoriesPage() {
  if (!await getSuperAdminSessionOrNull()) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: applications, error: appError }, { data: categories, error: categoryError }, { data: categoryRequests, error: requestError }] = await Promise.all([
    supabase.from('platform_applications').select('id, code, name, status').neq('status', 'retired').order('name'),
    supabase.from('platform_categories').select('id, application_id, parent_id, code, name, description, active, sort_order').order('sort_order').order('name'),
    supabase.from('provider_category_requests').select('id,requester_user_id,provider_type,application_id,suggested_parent_category_id,requested_name,requested_description,status,review_note,reviewed_at,created_category_id,created_at').order('created_at', { ascending: false }).limit(100),
  ]);

  if (appError || categoryError || requestError) throw new Error(appError?.message || categoryError?.message || requestError?.message);
  const appName = new Map((applications ?? []).map((app) => [app.id, app.name]));
  const categoryName = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const pendingRequests = (categoryRequests ?? []).filter((request) => request.status === 'pending');
  const resolvedRequests = (categoryRequests ?? []).filter((request) => request.status !== 'pending').slice(0, 20);

  return <main className="container section-stack">
    <section className="page-intro"><span className="eyebrow"><LocaleText en="SaaS control plane" ta="SaaS கட்டுப்பாட்டு மையம்" /></span><h1><LocaleText en="Category registry" ta="வகை பதிவகம்" /></h1><p><LocaleText en="Build application-specific categories and optional parent-child category trees without changing customer or provider flows." ta="Customer அல்லது provider flow-ஐ மாற்றாமல் application-specific categories மற்றும் optional parent-child category trees உருவாக்கவும்." /></p><Link href="/super-admin">← Super Admin</Link></section>

    <section className="section-stack">
      <div><span className="eyebrow">Provider taxonomy requests</span><h2>Category review queue</h2><p>Providers can suggest missing specialties, but only Super Admin approval creates an active canonical category.</p></div>
      {pendingRequests.length ? pendingRequests.map((request) => {
        const appCategories = (categories ?? []).filter((category) => category.application_id === request.application_id);
        const defaultParent = request.suggested_parent_category_id && appCategories.some((category) => category.id === request.suggested_parent_category_id) ? request.suggested_parent_category_id : '';
        return <article className="card section-stack" key={request.id}>
          <div><span className="eyebrow">{appName.get(request.application_id) ?? 'Application'} · {request.provider_type} · pending</span><h3>{request.requested_name}</h3><p>{request.requested_description || 'No description supplied.'}</p><p><strong>Provider suggestion:</strong> {request.suggested_parent_category_id ? categoryName.get(request.suggested_parent_category_id) ?? 'Category' : 'No parent selected'}</p></div>
          <form action={reviewCategoryRequest} className="section-stack">
            <input type="hidden" name="request_id" value={request.id} />
            <label>Final category name<input name="final_name" defaultValue={request.requested_name} maxLength={100} /></label>
            <label>Final category code<input name="final_code" defaultValue={suggestedCode(request.requested_name)} pattern="[a-z0-9][a-z0-9_-]{1,62}" placeholder="tyre_puncture_repair" /></label>
            <label>Final parent category<select name="parent_id" defaultValue={defaultParent}><option value="">None / root category</option>{appCategories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.active ? 'active' : 'inactive'})</option>)}</select></label>
            <label>Review note<textarea name="review_note" rows={3} maxLength={1000} placeholder="Optional provider-facing reason or guidance" /></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button type="submit" name="decision" value="approve">Approve & create category</button>
              <button type="submit" name="decision" value="reject">Reject request</button>
            </div>
          </form>
        </article>;
      }) : <div className="card"><p>No pending Provider category requests.</p></div>}
    </section>

    {resolvedRequests.length ? <section className="section-stack"><h2>Recently reviewed requests</h2>{resolvedRequests.map((request) => <article className="card" key={request.id}><span className="eyebrow">{appName.get(request.application_id) ?? 'Application'} · {request.provider_type} · {request.status}</span><h3>{request.requested_name}</h3>{request.review_note ? <p><strong>Review note:</strong> {request.review_note}</p> : null}{request.created_category_id ? <p><strong>Created category:</strong> {categoryName.get(request.created_category_id) ?? request.created_category_id}</p> : null}<p className="summary-note">Submitted {new Date(request.created_at).toLocaleString('en-IN')}{request.reviewed_at ? ` · Reviewed ${new Date(request.reviewed_at).toLocaleString('en-IN')}` : ''}</p></article>)}</section> : null}

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
