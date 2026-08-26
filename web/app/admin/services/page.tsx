import { AdminHeading, AdminShell } from '../../../components/admin/AdminPresentation';
import { Badge, Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveService = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  duration_minutes: number;
  base_price: number | string;
  currency: string;
  active: boolean;
  status: string;
  provider_type: string;
};

function formatAmount(value: number | string, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default async function AdminServicesRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopes, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id,enabled')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let services: LiveService[] = [];

  if (serviceIds.length) {
    const { data, error } = await supabase
      .from('services')
      .select('id,name,description,location,duration_minutes,base_price,currency,active,status,provider_type')
      .in('id', serviceIds)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    services = (data ?? []) as LiveService[];
  }

  return (
    <AdminShell active="/admin/services">
      <AdminHeading
        eyebrow="Scoped catalog operations"
        title="Live service listings"
        description="Only services mapped into this administrator’s Supabase scope are shown here."
      />

      {services.length ? (
        <div className="admin-record-grid">
          {services.map((service) => (
            <Card className="admin-service-card" key={service.id}>
              <div className="admin-record-top">
                <div>
                  <span className="eyebrow">{service.provider_type}</span>
                  <h2>{service.name}</h2>
                </div>
                <Badge tone={service.active && service.status === 'active' ? 'success' : 'warning'}>
                  {service.active && service.status === 'active' ? 'active' : service.status.replaceAll('_', ' ')}
                </Badge>
              </div>
              <p>{service.description || 'No service description yet.'}</p>
              <div className="admin-provider-meta">
                <span><strong>{formatAmount(service.base_price, service.currency)}</strong> base price</span>
                <span><strong>{service.duration_minutes}</strong> min</span>
                <span><strong>{service.location || 'Not set'}</strong> location</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title="No scoped services">Map an enabled service into this administrator scope to display it here.</EmptyState>
        </Card>
      )}
    </AdminShell>
  );
}
