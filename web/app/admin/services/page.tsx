import { AdminLiveEmptyState, AdminLiveHeading, AdminLiveShell, AdminLiveStatusText, AdminLiveText } from '../../../components/admin/AdminLiveChrome';
import { Badge, Card } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getAdminSessionOrNull } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveService = { id: string; name: string; description: string | null; location: string; duration_minutes: number; base_price: number | string; currency: string; active: boolean; status: string; provider_type: string; };
function formatAmount(value: number | string, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(Number(value || 0)); }

export default async function AdminServicesRoute() {
  if (!await getAdminSessionOrNull()) return null; const supabase = await createSupabaseServerClient();
  const { data: mappedScopes, error: scopeError } = await supabase.from('service_ecosystem_scope').select('service_id,enabled').eq('enabled', true); if (scopeError) throw new Error(scopeError.message);
  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id)))); let services: LiveService[] = [];
  if (serviceIds.length) { const { data, error } = await supabase.from('services').select('id,name,description,location,duration_minutes,base_price,currency,active,status,provider_type').in('id', serviceIds).order('created_at', { ascending: false }); if (error) throw new Error(error.message); services = (data ?? []) as LiveService[]; }

  return <AdminLiveShell active="/admin/services">
    <AdminLiveHeading eyebrow={<AdminLiveText en="Scoped catalog operations" ta="Scope செய்யப்பட்ட catalog செயல்பாடுகள்" />} title={<AdminLiveText en="Live service listings" ta="நேரடி service listings" />} description={<AdminLiveText en="Only services mapped into this administrator’s Supabase scope are shown here." ta="இந்த admin-ன் Supabase scope-க்கு map செய்யப்பட்ட services மட்டும் இங்கே காட்டப்படுகின்றன." />} />
    {services.length ? <div className="admin-record-grid">{services.map((service) => <Card className="admin-service-card" key={service.id}><div className="admin-record-top"><div><span className="eyebrow">{service.provider_type === 'business' ? <AdminLiveText en="Business" ta="வணிகம்" /> : <AdminLiveText en="Professional" ta="நிபுணர்" />}</span><h2>{service.name}</h2></div><Badge tone={service.active && service.status === 'active' ? 'success' : 'warning'}><AdminLiveStatusText status={service.active && service.status === 'active' ? 'active' : service.status} /></Badge></div><p>{service.description || <AdminLiveText en="No service description yet." ta="Service description இன்னும் இல்லை." />}</p><div className="admin-provider-meta"><span><strong>{formatAmount(service.base_price, service.currency)}</strong> <AdminLiveText en="base price" ta="அடிப்படை விலை" /></span><span><strong>{service.duration_minutes}</strong> <AdminLiveText en="min" ta="நிமி" /></span><span><strong>{service.location || <AdminLiveText en="Not set" ta="அமைக்கப்படவில்லை" />}</strong> <AdminLiveText en="location" ta="இடம்" /></span></div></Card>)}</div> : <Card><AdminLiveEmptyState titleEn="No scoped services" titleTa="Scoped services இல்லை"><AdminLiveText en="Map an enabled service into this administrator scope to display it here." ta="இங்கே காட்ட enabled service ஒன்றை இந்த admin scope-க்கு map செய்யவும்." /></AdminLiveEmptyState></Card>}
  </AdminLiveShell>;
}
