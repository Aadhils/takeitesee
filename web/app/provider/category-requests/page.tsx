import Link from 'next/link';
import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { submitProviderCategoryRequest } from './actions';

export const dynamic = 'force-dynamic';

type CategoryRequest = {
  id: string;
  provider_type: 'professional' | 'business';
  application_id: string;
  suggested_parent_category_id: string | null;
  requested_name: string;
  requested_description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  created_category_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function statusStyle(status: CategoryRequest['status']) {
  if (status === 'approved') return { background: '#ecfdf3', color: '#067647', borderColor: '#abefc6' };
  if (status === 'rejected') return { background: '#fef3f2', color: '#b42318', borderColor: '#fecdca' };
  return { background: '#fffaeb', color: '#b54708', borderColor: '#fedf89' };
}

export default async function ProviderCategoryRequestsPage() {
  const session = await productionAuthProvider.requireProvider();
  const supabase = await createSupabaseServerClient();

  const [{ data: applications, error: appError }, { data: categories, error: categoryError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.from('platform_applications').select('id,code,name,status').eq('status', 'active').order('name'),
    supabase.from('platform_categories').select('id,application_id,parent_id,code,name,active').eq('active', true).order('sort_order').order('name'),
    supabase.from('provider_category_requests')
      .select('id,provider_type,application_id,suggested_parent_category_id,requested_name,requested_description,status,review_note,created_category_id,created_at,reviewed_at')
      .eq('requester_user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (appError || categoryError || requestError) throw new Error(appError?.message || categoryError?.message || requestError?.message);

  const appName = new Map((applications ?? []).map((app) => [app.id, app.name]));
  const categoryName = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const rootCategories = (categories ?? []).filter((category) => !category.parent_id);

  return <LiveProviderShell active="/provider/services">
    <section className="page-intro">
      <span className="eyebrow">Marketplace taxonomy</span>
      <h1>Request a missing category</h1>
      <p>If the exact service specialty is not available, submit it for Super Admin review. Requested categories never become public automatically.</p>
      <Link href="/provider/services" className="text-link">← Back to Services</Link>
    </section>

    <section className="card section-stack">
      <div>
        <span className="eyebrow">Can’t find my category?</span>
        <h2>Suggest a platform category</h2>
        <p>Choose the closest application and, when possible, a parent category. The Super Admin can correct the final name, code, or parent before approval.</p>
      </div>
      <form action={submitProviderCategoryRequest} className="section-stack">
        <label>Application
          <select name="application_id" required defaultValue={applications?.[0]?.id ?? ''}>
            {(applications ?? []).map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </label>
        <label>Closest category group
          <select name="parent_category_id" defaultValue="">
            <option value="">Not sure / let Admin decide</option>
            {rootCategories.map((category) => <option key={category.id} value={category.id}>{category.name} — {appName.get(category.application_id) ?? 'Application'}</option>)}
          </select>
        </label>
        <label>Requested category name
          <input name="requested_name" required minLength={2} maxLength={100} placeholder="Example: Tyre Puncture Repair" />
        </label>
        <label>What does this category cover?
          <textarea name="requested_description" rows={4} maxLength={1000} placeholder="Briefly explain the service so Admin can place it in the right taxonomy." />
        </label>
        <button type="submit" disabled={!applications?.length}>Send for Admin review</button>
      </form>
    </section>

    <section className="section-stack">
      <div><span className="eyebrow">Review history</span><h2>My category requests</h2></div>
      {(requests ?? []).length ? (requests as CategoryRequest[]).map((request) => <article className="card" key={request.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">{appName.get(request.application_id) ?? 'Application'} · {request.provider_type}</span>
            <h3>{request.requested_name}</h3>
          </div>
          <span style={{ ...statusStyle(request.status), border: '1px solid', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{request.status}</span>
        </div>
        {request.requested_description ? <p>{request.requested_description}</p> : null}
        <p><strong>Suggested group:</strong> {request.suggested_parent_category_id ? categoryName.get(request.suggested_parent_category_id) ?? 'Category' : 'Admin to decide'}</p>
        {request.review_note ? <p><strong>Admin note:</strong> {request.review_note}</p> : null}
        {request.status === 'approved' ? <p><strong>Approved category:</strong> {request.created_category_id ? categoryName.get(request.created_category_id) ?? request.requested_name : request.requested_name}. It is now available from the Services category selector.</p> : null}
        {request.status === 'pending' ? <p className="summary-note">Pending requests cannot be used for publishing until Super Admin approval creates the canonical category.</p> : null}
        <p className="summary-note">Submitted {new Date(request.created_at).toLocaleString('en-IN')}{request.reviewed_at ? ` · Reviewed ${new Date(request.reviewed_at).toLocaleString('en-IN')}` : ''}</p>
      </article>) : <div className="card"><p>No category requests yet.</p></div>}
    </section>
  </LiveProviderShell>;
}
