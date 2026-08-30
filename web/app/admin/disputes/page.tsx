import Link from 'next/link';
import { AdminLiveEmptyState, AdminLiveHeading, AdminLiveShell, AdminLiveStatusText, AdminLiveText } from '../../../components/admin/AdminLiveChrome';
import { Badge, Card } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveIssue = { id: string; booking_id: string; service_id: string; reported_by: string; category: string; summary: string; priority: string; status: string; created_at: string; };
type BookingRow = { id: string; booking_reference: string };
type UserRow = { id: string; name: string; email: string };
function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' { if (status === 'resolved' || status === 'closed') return 'success'; if (status === 'investigating' || status === 'awaiting_information') return 'warning'; return 'info'; }
function priorityTone(priority: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' { if (priority === 'urgent') return 'danger'; if (priority === 'high') return 'warning'; return 'neutral'; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }

export default async function AdminDisputesRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: mappedScopes, error: scopeError } = await supabase.from('service_ecosystem_scope').select('service_id').eq('enabled', true);
  if (scopeError) throw new Error(scopeError.message);
  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let issues: LiveIssue[] = [];
  if (serviceIds.length) { const { data, error } = await supabase.from('marketplace_issues').select('id,booking_id,service_id,reported_by,category,summary,priority,status,created_at').in('service_id', serviceIds).order('created_at', { ascending: false }).limit(200); if (error) throw new Error(error.message); issues = (data ?? []) as LiveIssue[]; }
  const bookingIds = Array.from(new Set(issues.map((issue) => issue.booking_id))); const reporterIds = Array.from(new Set(issues.map((issue) => issue.reported_by)));
  let bookings: BookingRow[] = []; let users: UserRow[] = [];
  if (bookingIds.length) { const { data, error } = await supabase.from('bookings').select('id,booking_reference').in('id', bookingIds); if (error) throw new Error(error.message); bookings = (data ?? []) as BookingRow[]; }
  if (reporterIds.length) { const { data, error } = await supabase.from('users').select('id,name,email').in('id', reporterIds); if (error) throw new Error(error.message); users = (data ?? []) as UserRow[]; }
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking])); const userById = new Map(users.map((user) => [user.id, user]));

  return <AdminLiveShell active="/admin/disputes">
    <AdminLiveHeading eyebrow={<AdminLiveText en="Scoped operations queue" ta="Scope செய்யப்பட்ட operations queue" />} title={<AdminLiveText en="Live issues and disputes" ta="நேரடி issues மற்றும் disputes" />} description={<AdminLiveText en="Complaints and service issues are loaded from Supabase and restricted to this administrator’s assigned service scope." ta="Complaints மற்றும் service issues Supabase-லிருந்து load ஆகி இந்த admin-ன் assigned service scope-க்கு மட்டும் கட்டுப்படுத்தப்படுகின்றன." />} />
    {issues.length ? <div className="admin-record-grid">{issues.map((issue) => { const reporter = userById.get(issue.reported_by); const booking = bookingById.get(issue.booking_id); return <Card className="admin-issue-card" key={issue.id}><div className="admin-record-top"><div><span className="eyebrow">{booking?.booking_reference || 'Scoped booking'}</span><h2>{issue.category}</h2></div><Badge tone={statusTone(issue.status)}><AdminLiveStatusText status={issue.status} /></Badge></div><p>{issue.summary}</p><dl className="admin-detail-list"><div><dt><AdminLiveText en="Raised by" ta="புகார் அளித்தவர்" /></dt><dd>{reporter?.name || reporter?.email || <AdminLiveText en="Customer" ta="வாடிக்கையாளர்" />}</dd></div><div><dt><AdminLiveText en="Priority" ta="முன்னுரிமை" /></dt><dd><Badge tone={priorityTone(issue.priority)}><AdminLiveStatusText status={issue.priority} /></Badge></dd></div><div><dt><AdminLiveText en="Created" ta="உருவாக்கப்பட்டது" /></dt><dd>{formatDate(issue.created_at)}</dd></div></dl><Link href={`/admin/disputes/${encodeURIComponent(issue.id)}`} className="text-link"><AdminLiveText en="Open support case" ta="Support case திற" /></Link></Card>; })}</div> : <Card><AdminLiveEmptyState titleEn="No scoped issues yet" titleTa="Scoped issues இன்னும் இல்லை"><AdminLiveText en="Issues will appear automatically when a customer raises a concern for a booking inside this administrator scope." ta="இந்த admin scope-இல் உள்ள booking குறித்து customer concern raise செய்ததும் issue தானாக இங்கே வரும்." /></AdminLiveEmptyState></Card>}
  </AdminLiveShell>;
}
