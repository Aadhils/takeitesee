import { AdminHeading, AdminShell } from '../../../components/admin/AdminPresentation';
import { Badge, Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveIssue = {
  id: string;
  booking_id: string;
  service_id: string;
  reported_by: string;
  category: string;
  summary: string;
  priority: string;
  status: string;
  created_at: string;
};

type BookingRow = { id: string; booking_reference: string };
type UserRow = { id: string; name: string; email: string };

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'investigating' || status === 'awaiting_information') return 'warning';
  return 'info';
}

function priorityTone(priority: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

export default async function AdminDisputesRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopes, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let issues: LiveIssue[] = [];

  if (serviceIds.length) {
    const { data, error } = await supabase
      .from('marketplace_issues')
      .select('id,booking_id,service_id,reported_by,category,summary,priority,status,created_at')
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    issues = (data ?? []) as LiveIssue[];
  }

  const bookingIds = Array.from(new Set(issues.map((issue) => issue.booking_id)));
  const reporterIds = Array.from(new Set(issues.map((issue) => issue.reported_by)));
  let bookings: BookingRow[] = [];
  let users: UserRow[] = [];

  if (bookingIds.length) {
    const { data, error } = await supabase.from('bookings').select('id,booking_reference').in('id', bookingIds);
    if (error) throw new Error(error.message);
    bookings = (data ?? []) as BookingRow[];
  }

  if (reporterIds.length) {
    const { data, error } = await supabase.from('users').select('id,name,email').in('id', reporterIds);
    if (error) throw new Error(error.message);
    users = (data ?? []) as UserRow[];
  }

  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return (
    <AdminShell active="/admin/disputes">
      <AdminHeading
        eyebrow="Scoped operations queue"
        title="Live issues and disputes"
        description="Complaints and service issues are loaded from Supabase and restricted to this administrator’s assigned service scope."
      />

      {issues.length ? (
        <div className="admin-record-grid">
          {issues.map((issue) => {
            const reporter = userById.get(issue.reported_by);
            const booking = bookingById.get(issue.booking_id);
            return (
              <Card className="admin-issue-card" key={issue.id}>
                <div className="admin-record-top">
                  <div>
                    <span className="eyebrow">{booking?.booking_reference || 'Scoped booking'}</span>
                    <h2>{issue.category}</h2>
                  </div>
                  <Badge tone={statusTone(issue.status)}>{issue.status.replaceAll('_', ' ')}</Badge>
                </div>
                <p>{issue.summary}</p>
                <dl className="admin-detail-list">
                  <div><dt>Raised by</dt><dd>{reporter?.name || reporter?.email || 'Customer'}</dd></div>
                  <div><dt>Priority</dt><dd><Badge tone={priorityTone(issue.priority)}>{issue.priority}</Badge></dd></div>
                  <div><dt>Created</dt><dd>{formatDate(issue.created_at)}</dd></div>
                </dl>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState title="No scoped issues yet">
            Issues will appear automatically when a customer raises a concern for a booking inside this administrator scope.
          </EmptyState>
        </Card>
      )}
    </AdminShell>
  );
}
