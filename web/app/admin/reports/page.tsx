import { AdminHeading, AdminMetricCard, AdminShell } from '../../../components/admin/AdminPresentation';
import { Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveBooking = {
  id: string;
  customer_id: string;
  service_id: string;
  status: string;
  quoted_price: number | string;
  currency: string;
  created_at: string;
};

type LiveService = {
  id: string;
  category: string | null;
  provider_type: string;
  professional_id: string | null;
  business_id: string | null;
  active: boolean;
};

type ScopedServiceMapping = {
  service_id: string;
  category_id: string | null;
};

type PlatformCategory = {
  id: string;
  name: string;
  code: string;
};

function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
}

export default async function AdminReportsRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopeData, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id,category_id')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const mappedScopes = (mappedScopeData ?? []) as ScopedServiceMapping[];
  const serviceIds = Array.from(new Set(mappedScopes.map((row) => String(row.service_id))));
  const categoryIds = Array.from(new Set(mappedScopes.map((row) => row.category_id).filter(Boolean))) as string[];

  let bookings: LiveBooking[] = [];
  let services: LiveService[] = [];
  let platformCategories: PlatformCategory[] = [];

  if (serviceIds.length) {
    const [{ data: bookingData, error: bookingError }, { data: serviceData, error: serviceError }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id,customer_id,service_id,status,quoted_price,currency,created_at')
        .in('service_id', serviceIds)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('services')
        .select('id,category,provider_type,professional_id,business_id,active')
        .in('id', serviceIds),
    ]);

    if (bookingError) throw new Error(bookingError.message);
    if (serviceError) throw new Error(serviceError.message);
    bookings = (bookingData ?? []) as LiveBooking[];
    services = (serviceData ?? []) as LiveService[];
  }

  if (categoryIds.length) {
    const { data: categoryData, error: categoryError } = await supabase
      .from('platform_categories')
      .select('id,name,code')
      .in('id', categoryIds);

    if (categoryError) throw new Error(categoryError.message);
    platformCategories = (categoryData ?? []) as PlatformCategory[];
  }

  const totalBookings = bookings.length;
  const completed = bookings.filter((booking) => booking.status === 'completed').length;
  const cancelled = bookings.filter((booking) => booking.status === 'cancelled').length;
  const completionRate = totalBookings ? Math.round((completed / totalBookings) * 100) : 0;
  const cancellationRate = totalBookings ? Math.round((cancelled / totalBookings) * 100) : 0;
  const customers = new Set(bookings.map((booking) => booking.customer_id)).size;
  const activeServices = services.filter((service) => service.active);
  const providers = new Set(
    activeServices
      .map((service) => service.provider_type === 'business' ? service.business_id : service.professional_id)
      .filter(Boolean),
  ).size;
  const grossActivity = bookings
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + Number(booking.quoted_price || 0), 0);

  const now = new Date();
  const months = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (3 - index), 1));
    return { key: monthKey(date), label: monthLabel(date), count: 0 };
  });
  const monthMap = new Map(months.map((month) => [month.key, month]));
  bookings.forEach((booking) => {
    const key = monthKey(new Date(booking.created_at));
    const entry = monthMap.get(key);
    if (entry) entry.count += 1;
  });
  const maxMonthCount = Math.max(1, ...months.map((month) => month.count));

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const categoryById = new Map(platformCategories.map((category) => [category.id, category.name]));
  const categoryByServiceId = new Map(
    mappedScopes.map((scope) => [scope.service_id, scope.category_id ? categoryById.get(scope.category_id) ?? null : null]),
  );
  const categoryCounts = new Map<string, number>();
  bookings.forEach((booking) => {
    const category = categoryByServiceId.get(booking.service_id) || serviceById.get(booking.service_id)?.category || 'Uncategorised';
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  });
  if (!bookings.length) {
    services.forEach((service) => {
      const category = categoryByServiceId.get(service.id) || service.category || 'Uncategorised';
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    });
  }
  const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategoryCount = Math.max(1, ...categories.map(([, count]) => count));

  return (
    <AdminShell active="/admin/reports">
      <AdminHeading
        eyebrow="Scoped marketplace insights"
        title="Live reports"
        description="Operational metrics are calculated from live Supabase data and restricted to this administrator’s assigned service scope."
      />

      <div className="admin-metric-grid">
        <AdminMetricCard label="Booking volume" value={`${totalBookings}`} detail="Live scoped bookings" tone="info" />
        <AdminMetricCard label="Completion rate" value={`${completionRate}%`} detail={`${completed} completed`} tone="success" />
        <AdminMetricCard label="Cancellation rate" value={`${cancellationRate}%`} detail={`${cancelled} cancelled`} tone="warning" />
        <AdminMetricCard label="Gross activity" value={formatInr(grossActivity)} detail="Non-cancelled scoped value" />
        <AdminMetricCard label="Customers" value={`${customers}`} detail="Distinct scoped customers" />
        <AdminMetricCard label="Active providers" value={`${providers}`} detail="Providers in scoped services" tone="success" />
        <AdminMetricCard label="Listed services" value={`${activeServices.length}`} detail="Active scoped catalog" tone="info" />
      </div>

      {serviceIds.length ? (
        <div className="admin-report-grid">
          <Card className="admin-report-card">
            <span className="eyebrow">Booking volume</span>
            <h2>Recent four months</h2>
            {months.map((month) => {
              const width = `${Math.round((month.count / maxMonthCount) * 100)}%`;
              return (
                <div className="admin-bar-row" key={month.key}>
                  <span>{month.label}</span>
                  <i><b style={{ width }} /></i>
                  <strong>{month.count}</strong>
                </div>
              );
            })}
          </Card>

          <Card className="admin-report-card">
            <span className="eyebrow">Scope activity</span>
            <h2>{bookings.length ? 'Bookings by category' : 'Services by category'}</h2>
            {categories.length ? categories.map(([label, count]) => {
              const width = `${Math.round((count / maxCategoryCount) * 100)}%`;
              return (
                <div className="admin-bar-row" key={label}>
                  <span>{label.replaceAll('_', ' ')}</span>
                  <i><b style={{ width }} /></i>
                  <strong>{count}</strong>
                </div>
              );
            }) : <EmptyState title="No category activity yet">Category reporting will populate with scoped services and bookings.</EmptyState>}
          </Card>

          <Card className="admin-report-card">
            <span className="eyebrow">Marketplace health</span>
            <h2>Live scoped summary</h2>
            <div className="admin-health-list">
              <p><strong>{providers}</strong><span>Active providers</span></p>
              <p><strong>{customers}</strong><span>Customers</span></p>
              <p><strong>{activeServices.length}</strong><span>Listed services</span></p>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState title="No assigned scope yet">Reports will populate after services are assigned to this administrator scope.</EmptyState>
        </Card>
      )}
    </AdminShell>
  );
}
