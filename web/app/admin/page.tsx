import { AdminHeading, AdminMetricCard, AdminShell } from '../../components/admin/AdminPresentation';
import { Badge, Card, EmptyState } from '../../components/ui/primitives';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { productionAuthProvider } from '../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveService = {
  id: string;
  name: string;
  location: string;
  status: string;
  active: boolean;
  provider_type: string;
  professional_id: string | null;
  business_id: string | null;
};

type LiveBooking = {
  id: string;
  booking_reference: string;
  customer_id: string;
  service_id: string;
  service_name_snapshot: string;
  status: string;
  quoted_price: number | string;
  currency: string;
  created_at: string;
};

function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function providerKey(service: LiveService) {
  if (service.provider_type === 'professional' && service.professional_id) return `professional:${service.professional_id}`;
  if (service.provider_type === 'business' && service.business_id) return `business:${service.business_id}`;
  return null;
}

export default async function AdminDashboardRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopes, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let services: LiveService[] = [];
  let bookings: LiveBooking[] = [];

  if (serviceIds.length) {
    const [servicesResult, bookingsResult] = await Promise.all([
      supabase
        .from('services')
        .select('id,name,location,status,active,provider_type,professional_id,business_id')
        .in('id', serviceIds),
      supabase
        .from('bookings')
        .select('id,booking_reference,customer_id,service_id,service_name_snapshot,status,quoted_price,currency,created_at')
        .in('service_id', serviceIds)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (servicesResult.error) throw new Error(servicesResult.error.message);
    if (bookingsResult.error) throw new Error(bookingsResult.error.message);

    services = (servicesResult.data ?? []) as LiveService[];
    bookings = (bookingsResult.data ?? []) as LiveBooking[];
  }

  const activeServices = services.filter((service) => service.active && service.status === 'active');
  const activeProviders = new Set(activeServices.map(providerKey).filter(Boolean)).size;
  const customers = new Set(bookings.map((booking) => booking.customer_id)).size;
  const completed = bookings.filter((booking) => booking.status === 'completed').length;
  const closedStatuses = new Set(['completed', 'cancelled', 'rejected', 'no_show']);
  const openBookings = bookings.filter((booking) => !closedStatuses.has(booking.status)).length;
  const grossActivity = bookings.reduce((total, booking) => total + Number(booking.quoted_price || 0), 0);
  const completionRate = bookings.length ? Math.round((completed / bookings.length) * 100) : 0;

  return (
    <AdminShell active="/admin">
      <AdminHeading
        eyebrow="Scoped marketplace operations"
        title="Live operations dashboard"
        description="These metrics are loaded from Supabase and restricted by the administrator scopes assigned to this signed-in account."
      />

      <div className="admin-metric-grid">
        <AdminMetricCard label="Total bookings" value={`${bookings.length}`} detail="Live scoped records" tone="info" />
        <AdminMetricCard label="Open bookings" value={`${openBookings}`} detail="Inside assigned scope" tone="warning" />
        <AdminMetricCard label="Customers" value={`${customers}`} detail="Distinct scoped customers" />
        <AdminMetricCard label="Listed services" value={`${activeServices.length}`} detail="Active scoped catalog" tone="success" />
        <AdminMetricCard label="Active providers" value={`${activeProviders}`} detail="Providers in scoped services" tone="success" />
        <AdminMetricCard label="Completed" value={`${completed}`} detail="Live completed bookings" tone="success" />
        <AdminMetricCard label="Gross activity" value={formatInr(grossActivity)} detail="Scoped booking value" tone="info" />
        <AdminMetricCard label="Completion rate" value={`${completionRate}%`} detail="From live scoped bookings" tone="success" />
      </div>

      <div className="admin-dashboard-grid">
        <Card>
          <div className="admin-section-heading">
            <div>
              <span className="eyebrow">Scope coverage</span>
              <h2>Visible services</h2>
            </div>
            <Badge tone="success">Supabase scoped</Badge>
          </div>
          {services.length ? (
            <div className="admin-compact-list">
              {services.slice(0, 6).map((service) => (
                <div key={service.id}>
                  <div>
                    <strong>{service.name}</strong>
                    <span>{service.location} · {service.status}</span>
                  </div>
                  <Badge tone={service.active && service.status === 'active' ? 'success' : 'warning'}>
                    {service.active && service.status === 'active' ? 'Active' : 'Restricted'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No services in this scope">Assign a mapped service to this administrator scope to make it visible here.</EmptyState>
          )}
        </Card>

        <Card>
          <div className="admin-section-heading">
            <div>
              <span className="eyebrow">Recent live activity</span>
              <h2>Scoped bookings</h2>
            </div>
            <Badge tone="info">RLS enforced</Badge>
          </div>
          {bookings.length ? (
            <div className="admin-compact-list">
              {bookings.slice(0, 5).map((booking) => (
                <div key={booking.id}>
                  <div>
                    <strong>{booking.booking_reference}</strong>
                    <span>{booking.service_name_snapshot}</span>
                  </div>
                  <Badge tone={booking.status === 'completed' ? 'success' : closedStatuses.has(booking.status) ? 'neutral' : 'warning'}>
                    {booking.status.replaceAll('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No scoped bookings yet">The dashboard will populate automatically when bookings exist for services inside this admin scope.</EmptyState>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
