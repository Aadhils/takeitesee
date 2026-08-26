import { AdminHeading, AdminShell } from '../../../components/admin/AdminPresentation';
import { Badge, Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type ScopedService = {
  id: string;
  name: string;
  provider_type: string;
  professional_id: string | null;
  business_id: string | null;
};

type Business = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  verified: boolean;
};

type Professional = {
  id: string;
  headline: string | null;
  description: string | null;
  service_area: string | null;
  verified: boolean;
};

type ProviderView = {
  key: string;
  name: string;
  type: string;
  description: string;
  location: string;
  verified: boolean;
  services: string[];
};

export default async function AdminProvidersRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopes, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let services: ScopedService[] = [];

  if (serviceIds.length) {
    const { data, error } = await supabase
      .from('services')
      .select('id,name,provider_type,professional_id,business_id')
      .in('id', serviceIds)
      .eq('active', true);

    if (error) throw new Error(error.message);
    services = (data ?? []) as ScopedService[];
  }

  const businessIds = Array.from(new Set(services.map((service) => service.business_id).filter((id): id is string => Boolean(id))));
  const professionalIds = Array.from(new Set(services.map((service) => service.professional_id).filter((id): id is string => Boolean(id))));

  let businesses: Business[] = [];
  let professionals: Professional[] = [];

  if (businessIds.length) {
    const { data, error } = await supabase
      .from('businesses')
      .select('id,name,description,location,verified')
      .in('id', businessIds);
    if (error) throw new Error(error.message);
    businesses = (data ?? []) as Business[];
  }

  if (professionalIds.length) {
    const { data, error } = await supabase
      .from('professional_profiles')
      .select('id,headline,description,service_area,verified')
      .in('id', professionalIds);
    if (error) throw new Error(error.message);
    professionals = (data ?? []) as Professional[];
  }

  const businessMap = new Map(businesses.map((business) => [business.id, business]));
  const professionalMap = new Map(professionals.map((professional) => [professional.id, professional]));
  const providerMap = new Map<string, ProviderView>();

  for (const service of services) {
    if (service.provider_type === 'business' && service.business_id) {
      const business = businessMap.get(service.business_id);
      const key = `business:${service.business_id}`;
      const existing = providerMap.get(key);
      if (existing) existing.services.push(service.name);
      else providerMap.set(key, {
        key,
        name: business?.name || 'Business provider',
        type: 'Business',
        description: business?.description || 'Business provider in this administrator scope.',
        location: business?.location || 'Location not set',
        verified: Boolean(business?.verified),
        services: [service.name],
      });
    }

    if (service.provider_type === 'professional' && service.professional_id) {
      const professional = professionalMap.get(service.professional_id);
      const key = `professional:${service.professional_id}`;
      const existing = providerMap.get(key);
      if (existing) existing.services.push(service.name);
      else providerMap.set(key, {
        key,
        name: professional?.headline || 'Professional provider',
        type: 'Professional',
        description: professional?.description || 'Professional provider in this administrator scope.',
        location: professional?.service_area || 'Service area not set',
        verified: Boolean(professional?.verified),
        services: [service.name],
      });
    }
  }

  const providers = Array.from(providerMap.values());

  return (
    <AdminShell active="/admin/providers">
      <AdminHeading
        eyebrow="Scoped trust and supply"
        title="Live provider directory"
        description="Providers are derived from active services visible inside this administrator’s assigned Supabase scope."
      />

      {providers.length ? (
        <div className="admin-record-grid">
          {providers.map((provider) => (
            <Card className="admin-provider-card" key={provider.key}>
              <div className="admin-record-top">
                <div>
                  <span className="eyebrow">{provider.type}</span>
                  <h2>{provider.name}</h2>
                </div>
                <Badge tone={provider.verified ? 'success' : 'warning'}>{provider.verified ? 'Verified' : 'Verification pending'}</Badge>
              </div>
              <p>{provider.description}</p>
              <div className="admin-provider-meta">
                <span><strong>{provider.services.length}</strong> scoped service{provider.services.length === 1 ? '' : 's'}</span>
                <span><strong>{provider.location}</strong></span>
              </div>
              <div className="admin-tag-list">
                {provider.services.map((service) => <Badge tone="neutral" key={service}>{service}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title="No scoped providers">Providers will appear when mapped active services are available inside this administrator scope.</EmptyState>
        </Card>
      )}
    </AdminShell>
  );
}
