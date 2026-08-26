import { AdminHeading, AdminShell } from '../../../components/admin/AdminPresentation';
import { Badge, Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type ScopedBooking = {
  id: string;
  customer_id: string;
  status: string;
  created_at: string;
};

type CustomerUser = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

type CustomerSummary = CustomerUser & {
  bookings: number;
  completed: number;
  cancelled: number;
  open: number;
  lastBookingAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'No booking yet';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export default async function AdminCustomersRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopes, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let scopedBookings: ScopedBooking[] = [];

  if (serviceIds.length) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id,customer_id,status,created_at')
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    scopedBookings = (data ?? []) as ScopedBooking[];
  }

  const customerIds = Array.from(new Set(scopedBookings.map((booking) => booking.customer_id)));
  let users: CustomerUser[] = [];

  if (customerIds.length) {
    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,created_at')
      .in('id', customerIds)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    users = (data ?? []) as CustomerUser[];
  }

  const summaries: CustomerSummary[] = users.map((user) => {
    const bookings = scopedBookings.filter((booking) => booking.customer_id === user.id);
    const completed = bookings.filter((booking) => booking.status === 'completed').length;
    const cancelled = bookings.filter((booking) => booking.status === 'cancelled').length;

    return {
      ...user,
      bookings: bookings.length,
      completed,
      cancelled,
      open: bookings.length - completed - cancelled,
      lastBookingAt: bookings[0]?.created_at ?? null,
    };
  });

  return (
    <AdminShell active="/admin/customers">
      <AdminHeading
        eyebrow="Scoped marketplace people"
        title="Live customer directory"
        description="Only customers with bookings inside this administrator’s assigned service scope are visible. Customer access is enforced by Supabase RLS."
      />

      {summaries.length ? (
        <div className="admin-record-grid">
          {summaries.map((customer) => (
            <Card key={customer.id}>
              <div className="admin-record-top">
                <div>
                  <span className="eyebrow">Scoped customer</span>
                  <h2>{customer.name || 'Customer'}</h2>
                  <p>{customer.email}</p>
                </div>
                <Badge tone="success">visible in scope</Badge>
              </div>

              <dl className="admin-record-details">
                <div><dt>Bookings</dt><dd>{customer.bookings}</dd></div>
                <div><dt>Open</dt><dd>{customer.open}</dd></div>
                <div><dt>Completed</dt><dd>{customer.completed}</dd></div>
                <div><dt>Cancelled</dt><dd>{customer.cancelled}</dd></div>
                <div><dt>Last booking</dt><dd>{formatDate(customer.lastBookingAt)}</dd></div>
              </dl>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title="No scoped customers yet">
            Customers will appear automatically after they book a service inside this administrator scope. Unrelated marketplace customers remain hidden.
          </EmptyState>
        </Card>
      )}
    </AdminShell>
  );
}
