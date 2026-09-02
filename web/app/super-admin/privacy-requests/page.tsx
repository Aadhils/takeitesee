import { redirect } from 'next/navigation';
import { Badge, Card } from '../../../components/ui/primitives';
import { LocaleText } from '../../../components/i18n/LocaleText';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { updatePrivacyRequestAction } from './actions';

export const dynamic = 'force-dynamic';

type PrivacyRequest = {
  id: string;
  user_id: string;
  request_type: 'access' | 'correction' | 'deletion';
  details: string;
  status: 'submitted' | 'in_review' | 'awaiting_information' | 'completed' | 'declined';
  review_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type UserRow = { id: string; name: string; email: string };

function statusTone(status: PrivacyRequest['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'declined') return 'danger';
  if (status === 'awaiting_information') return 'warning';
  return 'info';
}

function label(value: string) {
  return value.replaceAll('_', ' ');
}

export default async function SuperAdminPrivacyRequestsPage() {
  const session = await productionAuthProvider.getSession();
  if (!session) redirect('/account');
  if (!session.roles.includes('super_admin')) redirect('/admin');

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('privacy_requests')
    .select('id,user_id,request_type,details,status,review_note,reviewed_by,created_at,updated_at,resolved_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const requests = (data ?? []) as PrivacyRequest[];
  const userIds = Array.from(new Set(requests.flatMap((item) => [item.user_id, item.reviewed_by].filter(Boolean) as string[])));
  let users: UserRow[] = [];
  if (userIds.length) {
    const result = await supabase.from('users').select('id,name,email').in('id', userIds);
    if (result.error) throw new Error(result.error.message);
    users = (result.data ?? []) as UserRow[];
  }
  const userById = new Map(users.map((user) => [user.id, user]));
  const activeCount = requests.filter((item) => ['submitted', 'in_review', 'awaiting_information'].includes(item.status)).length;

  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow"><LocaleText en="Platform privacy operations" ta="Platform privacy operations" /></span>
      <h1><LocaleText en="Privacy requests" ta="Privacy requests" /></h1>
      <p><LocaleText en="Review customer access, correction, and deletion requests. This queue records decisions but does not automatically delete accounts or override retention requirements." ta="Customer access, correction மற்றும் deletion requests-ஐ review செய்யவும். இந்த queue decisions-ஐ record செய்கிறது; account-ஐ தானாக delete செய்யாது, retention requirements-ஐ override செய்யாது." /></p>
    </section>

    <section className="dashboard-grid" aria-label="Privacy request overview">
      <Card><span className="eyebrow"><LocaleText en="Total requests" ta="மொத்த requests" /></span><h2>{requests.length}</h2></Card>
      <Card><span className="eyebrow"><LocaleText en="Needs attention" ta="கவனம் தேவை" /></span><h2>{activeCount}</h2></Card>
    </section>

    {requests.length ? <section className="section-stack">
      {requests.map((item) => {
        const requester = userById.get(item.user_id);
        const reviewer = item.reviewed_by ? userById.get(item.reviewed_by) : undefined;
        return <Card key={item.id}>
          <div className="admin-record-top">
            <div>
              <span className="eyebrow">PR-{item.id.slice(0, 8).toUpperCase()}</span>
              <h2>{label(item.request_type)}</h2>
            </div>
            <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
          </div>

          <dl className="admin-detail-list">
            <div><dt><LocaleText en="Customer" ta="Customer" /></dt><dd>{requester?.name || requester?.email || item.user_id.slice(0, 8)}</dd></div>
            <div><dt><LocaleText en="Email" ta="Email" /></dt><dd>{requester?.email || '—'}</dd></div>
            <div><dt><LocaleText en="Submitted" ta="Submitted" /></dt><dd>{new Date(item.created_at).toLocaleString('en-IN')}</dd></div>
            <div><dt><LocaleText en="Last update" ta="Last update" /></dt><dd>{new Date(item.updated_at).toLocaleString('en-IN')}</dd></div>
            <div><dt><LocaleText en="Reviewed by" ta="Reviewed by" /></dt><dd>{reviewer?.name || reviewer?.email || (item.reviewed_by ? item.reviewed_by.slice(0, 8) : 'Not reviewed')}</dd></div>
          </dl>

          <div className="settings-note"><strong><LocaleText en="Customer request" ta="Customer request" /></strong><p>{item.details}</p></div>

          <form action={updatePrivacyRequestAction} className="section-stack">
            <input type="hidden" name="request_id" value={item.id} />
            <div className="field">
              <label className="field-label" htmlFor={`status-${item.id}`}><LocaleText en="Status" ta="Status" /></label>
              <select className="field-control" id={`status-${item.id}`} name="status" defaultValue={item.status}>
                <option value="submitted">submitted</option>
                <option value="in_review">in review</option>
                <option value="awaiting_information">awaiting information</option>
                <option value="completed">completed</option>
                <option value="declined">declined</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`note-${item.id}`}><LocaleText en="Review note" ta="Review note" /></label>
              <textarea className="field-control field-textarea" id={`note-${item.id}`} name="review_note" maxLength={2000} defaultValue={item.review_note ?? ''} />
              <span className="field-hint"><LocaleText en="Required when awaiting information or declining a request. This note is visible to the customer." ta="Awaiting information அல்லது decline செய்யும் போது note required. இந்த note customer-க்கு தெரியும்." /></span>
            </div>
            <button type="submit" className="button button-primary"><LocaleText en="Save review" ta="Review save செய்" /></button>
          </form>
        </Card>;
      })}
    </section> : <Card><h2><LocaleText en="No privacy requests yet" ta="Privacy requests இன்னும் இல்லை" /></h2><p><LocaleText en="Customer privacy requests will appear here after submission." ta="Customer privacy request submit செய்ததும் இங்கே வரும்." /></p></Card>}
  </main>;
}
