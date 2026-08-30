import { AdminLiveEmptyState, AdminLiveHeading, AdminLiveShell, AdminLiveText } from '../../../components/admin/AdminLiveChrome';
import { Badge, Card } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type ScopedBooking = { id: string; customer_id: string; status: string; created_at: string; };
type CustomerUser = { id: string; name: string; email: string; created_at: string; };
type CustomerSummary = CustomerUser & { bookings: number; completed: number; cancelled: number; open: number; lastBookingAt: string | null; };
function formatDate(value: string | null) { if (!value) return '—'; return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }

export default async function AdminCustomersRoute() {
  await productionAuthProvider.requireAdmin(); const supabase = await createSupabaseServerClient();
  const { data: mappedScopes, error: scopeError } = await supabase.from('service_ecosystem_scope').select('service_id').eq('enabled', true); if (scopeError) throw new Error(scopeError.message);
  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id)))); let scopedBookings: ScopedBooking[] = [];
  if (serviceIds.length) { const { data, error } = await supabase.from('bookings').select('id,customer_id,status,created_at').in('service_id', serviceIds).order('created_at', { ascending: false }).limit(500); if (error) throw new Error(error.message); scopedBookings = (data ?? []) as ScopedBooking[]; }
  const customerIds = Array.from(new Set(scopedBookings.map((booking) => booking.customer_id))); let users: CustomerUser[] = [];
  if (customerIds.length) { const { data, error } = await supabase.from('users').select('id,name,email,created_at').in('id', customerIds).order('created_at', { ascending: false }); if (error) throw new Error(error.message); users = (data ?? []) as CustomerUser[]; }
  const summaries: CustomerSummary[] = users.map((user) => { const bookings = scopedBookings.filter((booking) => booking.customer_id === user.id); const completed = bookings.filter((booking) => booking.status === 'completed').length; const cancelled = bookings.filter((booking) => booking.status === 'cancelled').length; return { ...user, bookings: bookings.length, completed, cancelled, open: bookings.length - completed - cancelled, lastBookingAt: bookings[0]?.created_at ?? null }; });

  return <AdminLiveShell active="/admin/customers">
    <AdminLiveHeading eyebrow={<AdminLiveText en="Scoped marketplace people" ta="Scope செய்யப்பட்ட marketplace பயனர்கள்" />} title={<AdminLiveText en="Live customer directory" ta="நேரடி customer directory" />} description={<AdminLiveText en="Only customers with bookings inside this administrator’s assigned service scope are visible. Customer access is enforced by Supabase RLS." ta="இந்த admin-ன் assigned service scope-இல் booking உள்ள customers மட்டும் காணப்படுவர். Customer access Supabase RLS மூலம் enforce செய்யப்படுகிறது." />} />
    {summaries.length ? <div className="admin-record-grid">{summaries.map((customer) => <Card key={customer.id}><div className="admin-record-top"><div><span className="eyebrow"><AdminLiveText en="Scoped customer" ta="Scoped customer" /></span><h2>{customer.name || <AdminLiveText en="Customer" ta="வாடிக்கையாளர்" />}</h2><p>{customer.email}</p></div><Badge tone="success"><AdminLiveText en="visible in scope" ta="scope-ல் visible" /></Badge></div><dl className="admin-record-details"><div><dt><AdminLiveText en="Bookings" ta="Bookings" /></dt><dd>{customer.bookings}</dd></div><div><dt><AdminLiveText en="Open" ta="திறந்தவை" /></dt><dd>{customer.open}</dd></div><div><dt><AdminLiveText en="Completed" ta="முடிந்தவை" /></dt><dd>{customer.completed}</dd></div><div><dt><AdminLiveText en="Cancelled" ta="ரத்து செய்யப்பட்டவை" /></dt><dd>{customer.cancelled}</dd></div><div><dt><AdminLiveText en="Last booking" ta="கடைசி booking" /></dt><dd>{customer.lastBookingAt ? formatDate(customer.lastBookingAt) : <AdminLiveText en="No booking yet" ta="இன்னும் booking இல்லை" />}</dd></div></dl></Card>)}</div> : <Card><AdminLiveEmptyState titleEn="No scoped customers yet" titleTa="Scoped customers இன்னும் இல்லை"><AdminLiveText en="Customers will appear automatically after they book a service inside this administrator scope. Unrelated marketplace customers remain hidden." ta="இந்த admin scope-இல் service book செய்த பிறகு customers தானாக இங்கே தோன்றுவர். தொடர்பில்லாத marketplace customers மறைக்கப்பட்டே இருப்பார்கள்." /></AdminLiveEmptyState></Card>}
  </AdminLiveShell>;
}
