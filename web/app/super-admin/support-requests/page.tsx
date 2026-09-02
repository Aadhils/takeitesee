import { redirect } from 'next/navigation';
import { Badge, Card } from '../../../components/ui/primitives';
import { LocaleText } from '../../../components/i18n/LocaleText';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { updateSupportRequestAction } from './actions';

export const dynamic = 'force-dynamic';

type SupportRequest = {
  id: string;
  user_id: string;
  request_type: 'platform_grievance' | 'account_help' | 'safety' | 'provider_conduct' | 'other';
  subject: string;
  details: string;
  status: 'submitted' | 'in_review' | 'awaiting_information' | 'resolved' | 'closed';
  review_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type UserRow = { id: string; name: string; email: string };

function statusTone(status: SupportRequest['status']): 'success' | 'warning' | 'info' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'awaiting_information') return 'warning';
  return 'info';
}

export default async function SuperAdminSupportRequestsPage() {
  const session = await productionAuthProvider.getSession();
  if (!session) redirect('/account');
  if (!session.roles.includes('super_admin')) redirect('/admin');

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('platform_support_requests')
    .select('id,user_id,request_type,subject,details,status,review_note,reviewed_by,created_at,updated_at,resolved_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const requests = (data ?? []) as SupportRequest[];
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
    <section className="page-intro"><span className="eyebrow"><LocaleText en="Platform support operations" ta="Platform support operations" /></span><h1><LocaleText en="Support & grievance requests" ta="Support & grievance requests" /></h1><p><LocaleText en="Review signed-in customer platform grievances, account-help requests, safety concerns, provider-conduct concerns, and other non-booking support. Booking support and privacy requests remain in their dedicated workflows." ta="Signed-in customer platform grievance, account help, safety, provider conduct மற்றும் non-booking support requests-ஐ review செய்யவும். Booking support மற்றும் privacy requests தனி workflows-ல் தொடரும்." /></p></section>
    <section className="dashboard-grid" aria-label="Support request overview"><Card><span className="eyebrow"><LocaleText en="Total requests" ta="மொத்த requests" /></span><h2>{requests.length}</h2></Card><Card><span className="eyebrow"><LocaleText en="Needs attention" ta="கவனம் தேவை" /></span><h2>{activeCount}</h2></Card></section>
    {requests.length ? <section className="section-stack">{requests.map((item) => {
      const requester = userById.get(item.user_id);
      const reviewer = item.reviewed_by ? userById.get(item.reviewed_by) : undefined;
      return <Card key={item.id}>
        <div className="admin-record-top"><div><span className="eyebrow">SR-{item.id.slice(0, 8).toUpperCase()}</span><h2>{item.subject}</h2></div><Badge tone={statusTone(item.status)}>{item.status.replaceAll('_', ' ')}</Badge></div>
        <dl className="admin-detail-list"><div><dt>Customer</dt><dd>{requester?.name || requester?.email || item.user_id.slice(0, 8)}</dd></div><div><dt>Email</dt><dd>{requester?.email || '—'}</dd></div><div><dt>Type</dt><dd>{item.request_type.replaceAll('_', ' ')}</dd></div><div><dt>Submitted</dt><dd>{new Date(item.created_at).toLocaleString('en-IN')}</dd></div><div><dt>Reviewed by</dt><dd>{reviewer?.name || reviewer?.email || (item.reviewed_by ? item.reviewed_by.slice(0, 8) : 'Not reviewed')}</dd></div></dl>
        <div className="settings-note"><strong>Customer request</strong><p>{item.details}</p></div>
        <form action={updateSupportRequestAction} className="section-stack"><input type="hidden" name="request_id" value={item.id} /><div className="field"><label className="field-label" htmlFor={`status-${item.id}`}>Status</label><select className="field-control" id={`status-${item.id}`} name="status" defaultValue={item.status}><option value="submitted">submitted</option><option value="in_review">in review</option><option value="awaiting_information">awaiting information</option><option value="resolved">resolved</option><option value="closed">closed</option></select></div><div className="field"><label className="field-label" htmlFor={`note-${item.id}`}>Review note</label><textarea className="field-control field-textarea" id={`note-${item.id}`} name="review_note" maxLength={2000} defaultValue={item.review_note ?? ''} /><span className="field-hint">Visible to the customer. Required when requesting more information or closing a request.</span></div><button type="submit" className="button button-primary">Save review</button></form>
      </Card>;
    })}</section> : <Card><h2>No platform support requests yet</h2><p>Signed-in customer support requests will appear here after submission.</p></Card>}
  </main>;
}
