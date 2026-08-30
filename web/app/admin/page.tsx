import { AdminLiveEmptyState, AdminLiveHeading, AdminLiveMetricCard, AdminLiveShell, AdminLiveStatusText, AdminLiveText } from '../../components/admin/AdminLiveChrome';
import { Badge, Card } from '../../components/ui/primitives';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { productionAuthProvider } from '../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveService = { id: string; name: string; location: string; status: string; active: boolean; provider_type: string; professional_id: string | null; business_id: string | null; };
type LiveBooking = { id: string; booking_reference: string; customer_id: string; service_id: string; service_name_snapshot: string; status: string; quoted_price: number | string; currency: string; created_at: string; };

function formatInr(value: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value); }
function providerKey(service: LiveService) { if (service.provider_type === 'professional' && service.professional_id) return `professional:${service.professional_id}`; if (service.provider_type === 'business' && service.business_id) return `business:${service.business_id}`; return null; }

export default async function AdminDashboardRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: mappedScopes, error: scopeError } = await supabase.from('service_ecosystem_scope').select('service_id').eq('enabled', true);
  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let services: LiveService[] = []; let bookings: LiveBooking[] = [];
  if (serviceIds.length) {
    const [servicesResult, bookingsResult] = await Promise.all([
      supabase.from('services').select('id,name,location,status,active,provider_type,professional_id,business_id').in('id', serviceIds),
      supabase.from('bookings').select('id,booking_reference,customer_id,service_id,service_name_snapshot,status,quoted_price,currency,created_at').in('service_id', serviceIds).order('created_at', { ascending: false }).limit(100),
    ]);
    if (servicesResult.error) throw new Error(servicesResult.error.message);
    if (bookingsResult.error) throw new Error(bookingsResult.error.message);
    services = (servicesResult.data ?? []) as LiveService[]; bookings = (bookingsResult.data ?? []) as LiveBooking[];
  }

  const activeServices = services.filter((service) => service.active && service.status === 'active');
  const activeProviders = new Set(activeServices.map(providerKey).filter(Boolean)).size;
  const customers = new Set(bookings.map((booking) => booking.customer_id)).size;
  const completed = bookings.filter((booking) => booking.status === 'completed').length;
  const closedStatuses = new Set(['completed', 'cancelled', 'rejected', 'no_show']);
  const openBookings = bookings.filter((booking) => !closedStatuses.has(booking.status)).length;
  const grossActivity = bookings.reduce((total, booking) => total + Number(booking.quoted_price || 0), 0);
  const completionRate = bookings.length ? Math.round((completed / bookings.length) * 100) : 0;

  return <AdminLiveShell active="/admin">
    <AdminLiveHeading eyebrow={<AdminLiveText en="Scoped marketplace operations" ta="Scope செய்யப்பட்ட marketplace செயல்பாடுகள்" />} title={<AdminLiveText en="Live operations dashboard" ta="நேரடி operations dashboard" />} description={<AdminLiveText en="These metrics are loaded from Supabase and restricted by the administrator scopes assigned to this signed-in account." ta="இந்த metrics Supabase-லிருந்து load ஆகி, signed-in admin account-க்கு assign செய்யப்பட்ட scopes மூலம் கட்டுப்படுத்தப்படுகின்றன." />} />
    <div className="admin-metric-grid">
      <AdminLiveMetricCard label={<AdminLiveText en="Total bookings" ta="மொத்த bookings" />} value={`${bookings.length}`} detail={<AdminLiveText en="Live scoped records" ta="Live scoped records" />} tone="info" />
      <AdminLiveMetricCard label={<AdminLiveText en="Open bookings" ta="திறந்த bookings" />} value={`${openBookings}`} detail={<AdminLiveText en="Inside assigned scope" ta="Assigned scope-க்குள்" />} tone="warning" />
      <AdminLiveMetricCard label={<AdminLiveText en="Customers" ta="வாடிக்கையாளர்கள்" />} value={`${customers}`} detail={<AdminLiveText en="Distinct scoped customers" ta="தனித்த scoped customers" />} />
      <AdminLiveMetricCard label={<AdminLiveText en="Listed services" ta="பட்டியலிடப்பட்ட சேவைகள்" />} value={`${activeServices.length}`} detail={<AdminLiveText en="Active scoped catalog" ta="Active scoped catalog" />} tone="success" />
      <AdminLiveMetricCard label={<AdminLiveText en="Active providers" ta="செயலில் உள்ள providers" />} value={`${activeProviders}`} detail={<AdminLiveText en="Providers in scoped services" ta="Scoped services-ல் providers" />} tone="success" />
      <AdminLiveMetricCard label={<AdminLiveText en="Completed" ta="முடிந்தவை" />} value={`${completed}`} detail={<AdminLiveText en="Live completed bookings" ta="Live completed bookings" />} tone="success" />
      <AdminLiveMetricCard label={<AdminLiveText en="Gross activity" ta="மொத்த activity" />} value={formatInr(grossActivity)} detail={<AdminLiveText en="Scoped booking value" ta="Scoped booking value" />} tone="info" />
      <AdminLiveMetricCard label={<AdminLiveText en="Completion rate" ta="முடிவு விகிதம்" />} value={`${completionRate}%`} detail={<AdminLiveText en="From live scoped bookings" ta="Live scoped bookings-லிருந்து" />} tone="success" />
    </div>
    <div className="admin-dashboard-grid">
      <Card><div className="admin-section-heading"><div><span className="eyebrow"><AdminLiveText en="Scope coverage" ta="Scope coverage" /></span><h2><AdminLiveText en="Visible services" ta="காணக்கூடிய சேவைகள்" /></h2></div><Badge tone="success">Supabase scoped</Badge></div>{services.length ? <div className="admin-compact-list">{services.slice(0, 6).map((service) => <div key={service.id}><div><strong>{service.name}</strong><span>{service.location} · {service.status}</span></div><Badge tone={service.active && service.status === 'active' ? 'success' : 'warning'}>{service.active && service.status === 'active' ? <AdminLiveStatusText status="active" /> : <AdminLiveStatusText status="restricted" />}</Badge></div>)}</div> : <AdminLiveEmptyState titleEn="No services in this scope" titleTa="இந்த scope-ல் சேவைகள் இல்லை"><AdminLiveText en="Assign a mapped service to this administrator scope to make it visible here." ta="இந்த admin scope-ல் காண mapped service ஒன்றை assign செய்யவும்." /></AdminLiveEmptyState>}</Card>
      <Card><div className="admin-section-heading"><div><span className="eyebrow"><AdminLiveText en="Recent live activity" ta="சமீபத்திய live activity" /></span><h2><AdminLiveText en="Scoped bookings" ta="Scoped bookings" /></h2></div><Badge tone="info">RLS enforced</Badge></div>{bookings.length ? <div className="admin-compact-list">{bookings.slice(0, 5).map((booking) => <div key={booking.id}><div><strong>{booking.booking_reference}</strong><span>{booking.service_name_snapshot}</span></div><Badge tone={booking.status === 'completed' ? 'success' : closedStatuses.has(booking.status) ? 'neutral' : 'warning'}><AdminLiveStatusText status={booking.status} /></Badge></div>)}</div> : <AdminLiveEmptyState titleEn="No scoped bookings yet" titleTa="Scoped bookings இன்னும் இல்லை"><AdminLiveText en="The dashboard will populate automatically when bookings exist for services inside this admin scope." ta="இந்த admin scope-இல் உள்ள services-க்கு bookings வந்ததும் dashboard தானாக populate ஆகும்." /></AdminLiveEmptyState>}</Card>
    </div>
  </AdminLiveShell>;
}
