'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Select, Textarea } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderDashboardLaunchCenter.module.css';

type ServiceStatus = 'draft' | 'active' | 'paused';
type Service = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  base_price: number;
  duration_minutes: number;
  status: ServiceStatus;
};
type ReadinessService = {
  id: string;
  name: string;
  status: ServiceStatus;
  catalog_category?: string | null;
  scope_enabled: boolean;
  application_id?: string | null;
  application_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  launch_ready: boolean;
};
type Readiness = {
  profile_complete: boolean;
  verified: boolean;
  marketplace_disclosure_complete: boolean;
  trust_status: 'normal' | 'reverification_required' | 'suspended';
  services_total: number;
  services_scoped: number;
  services_active: number;
  pending_launch_requests: number;
  first_service_created: boolean;
  first_service_scoped: boolean;
  marketplace_live: boolean;
  progress_percent: number;
  services: ReadinessService[];
};
type Category = { id: string; application_id: string; parent_id?: string | null; code: string; name: string };
type SetupOptions = {
  applications: { id: string; code: string; name: string }[];
  categories: Category[];
  locations: { id: string; type: string; code: string; name: string }[];
};
type LaunchRequest = {
  id: string;
  service_id: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn';
  review_note?: string | null;
};

type Draft = { name: string; description: string; category_id: string; price: string; duration: string };
const emptyDraft: Draft = { name: '', description: '', category_id: '', price: '0', duration: '60' };

function normalized(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

export default function ProviderDashboardLaunchCenter() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const copy = useMemo(() => tamil ? {
    eyebrow: 'Marketplace launch', title: 'Service-ஐ இங்கிருந்தே launch செய்யுங்கள்', intro: 'First service create செய்வது முதல் category/location approval மற்றும் activation வரை Dashboard-லேயே முடிக்கலாம்.',
    ready: 'Marketplace live', progress: 'Setup in progress', create: 'Add first service', addAnother: 'Add service', manage: 'Advanced service manager', name: 'Service name', description: 'Service description', category: 'Platform category', price: 'Starting price (INR)', duration: 'Duration (minutes)', save: 'Save draft service', cancel: 'Cancel',
    created: 'Draft service created. இப்போது launch location தேர்வு செய்து approval request செய்யலாம்.', approval: 'Request approval', location: 'Launch location', pending: 'Approval pending', approved: 'Scope approved', live: 'Live', activate: 'Activate service', withdraw: 'Withdraw request', retry: 'Try again', noCategory: 'இந்த service-க்கு valid platform category தேவை.',
    identity: 'Identity ready', service: 'Service created', scope: 'Scope approved', public: 'Public live', reload: 'Reload', loading: 'Marketplace setup load ஆகிறது…',
  } : {
    eyebrow: 'Marketplace launch', title: 'Launch a service from this Dashboard', intro: 'Create your first service, request category/location approval and activate it without leaving the Provider workspace.',
    ready: 'Marketplace live', progress: 'Setup in progress', create: 'Add first service', addAnother: 'Add service', manage: 'Advanced service manager', name: 'Service name', description: 'Service description', category: 'Platform category', price: 'Starting price (INR)', duration: 'Duration (minutes)', save: 'Save draft service', cancel: 'Cancel',
    created: 'Draft service created. Choose a launch location and request approval next.', approval: 'Request approval', location: 'Launch location', pending: 'Approval pending', approved: 'Scope approved', live: 'Live', activate: 'Activate service', withdraw: 'Withdraw request', retry: 'Try again', noCategory: 'This service needs a valid platform category.',
    identity: 'Identity ready', service: 'Service created', scope: 'Scope approved', public: 'Public live', reload: 'Reload', loading: 'Loading marketplace setup…',
  }, [tamil]);

  const [services, setServices] = useState<Service[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [options, setOptions] = useState<SetupOptions>({ applications: [], categories: [], locations: [] });
  const [requests, setRequests] = useState<LaunchRequest[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [locationByService, setLocationByService] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const parentIds = useMemo(() => new Set(options.categories.map((item) => item.parent_id).filter(Boolean) as string[]), [options.categories]);
  const serviceApplicationIds = useMemo(() => new Set(options.applications.filter((item) => item.code === 'services').map((item) => item.id)), [options.applications]);
  const selectableCategories = useMemo(() => options.categories.filter((item) => !parentIds.has(item.id) && (!serviceApplicationIds.size || serviceApplicationIds.has(item.application_id))), [options.categories, parentIds, serviceApplicationIds]);
  const preferredLocations = useMemo(() => {
    const cities = options.locations.filter((item) => item.type === 'city');
    return cities.length ? cities : options.locations;
  }, [options.locations]);
  const parentById = useMemo(() => new Map(options.categories.map((item) => [item.id, item])), [options.categories]);
  const latestByService = useMemo(() => {
    const map = new Map<string, LaunchRequest>();
    for (const request of requests) if (!map.has(request.service_id)) map.set(request.service_id, request);
    return map;
  }, [requests]);

  const categoryLabel = (category: Category) => category.parent_id
    ? `${parentById.get(category.parent_id)?.name ?? 'Category'} → ${category.name}`
    : category.name;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [serviceResponse, setupResponse] = await Promise.all([
        fetch('/api/provider/services', { cache: 'no-store' }),
        fetch('/api/provider/setup', { cache: 'no-store' }),
      ]);
      const serviceBody = await serviceResponse.json() as { services?: Service[]; error?: string };
      const setupBody = await setupResponse.json() as { readiness?: Readiness; options?: SetupOptions; requests?: LaunchRequest[]; error?: string };
      if (!serviceResponse.ok) throw new Error(serviceBody.error ?? 'Unable to load services.');
      if (!setupResponse.ok || !setupBody.readiness || !setupBody.options) throw new Error(setupBody.error ?? 'Unable to load marketplace setup.');
      setServices(serviceBody.services ?? []);
      setReadiness(setupBody.readiness);
      setOptions(setupBody.options);
      setRequests(setupBody.requests ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load marketplace setup.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!draft.category_id && selectableCategories[0]?.id) setDraft((current) => ({ ...current, category_id: selectableCategories[0].id }));
  }, [draft.category_id, selectableCategories]);
  useEffect(() => {
    if (!preferredLocations[0]?.id || !readiness) return;
    setLocationByService((current) => {
      const next = { ...current };
      for (const service of readiness.services) if (!next[service.id]) next[service.id] = service.location_id || preferredLocations[0].id;
      return next;
    });
  }, [preferredLocations, readiness]);

  const refreshWorkspace = () => window.dispatchEvent(new Event('provider-services-refresh'));

  const createService = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const price = Number(draft.price);
    const duration = Number(draft.duration);
    if (!draft.name.trim() || !draft.description.trim() || !draft.category_id || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration <= 0) return;
    setBusy('create'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name, description: draft.description, category_id: draft.category_id, base_price: price, duration_minutes: duration, currency: 'INR', status: 'draft' }),
      });
      const body = await response.json() as { service?: Service; error?: string };
      if (!response.ok || !body.service) throw new Error(body.error ?? 'Service could not be created.');
      setDraft(emptyDraft); setFormOpen(false); setNotice(copy.created);
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Service could not be created.'); }
    finally { setBusy(null); }
  };

  const requestApproval = async (service: ReadinessService) => {
    if (busy) return;
    const category = selectableCategories.find((item) => normalized(item.name) === normalized(service.catalog_category));
    const locationId = locationByService[service.id];
    if (!category || !locationId) return;
    setBusy(`approval:${service.id}`); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: service.id, application_id: category.application_id, category_id: category.id, location_id: locationId }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Launch request could not be submitted.');
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Launch request could not be submitted.'); }
    finally { setBusy(null); }
  };

  const withdraw = async (requestId: string) => {
    if (busy) return;
    setBusy(`withdraw:${requestId}`); setError('');
    try {
      const response = await fetch('/api/provider/setup', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: requestId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to withdraw request.');
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to withdraw request.'); }
    finally { setBusy(null); }
  };

  const activate = async (serviceId: string) => {
    if (busy) return;
    setBusy(`activate:${serviceId}`); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/provider/services/${serviceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
      const body = await response.json() as { service?: Service; error?: string };
      if (!response.ok || !body.service) throw new Error(body.error ?? 'Service could not be activated.');
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Service could not be activated.'); }
    finally { setBusy(null); }
  };

  const identityReady = Boolean(readiness?.profile_complete && readiness.verified && readiness.marketplace_disclosure_complete && readiness.trust_status === 'normal');

  return <section id="provider-marketplace-launch" className={styles.center} aria-label="Provider marketplace launch controls">
    <Card className={styles.card}>
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.intro}</p></div>
        <Badge tone={readiness?.marketplace_live ? 'success' : 'warning'}>{readiness?.marketplace_live ? copy.ready : copy.progress}</Badge>
      </div>

      {loading ? <p>{copy.loading}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{copy.reload}</button></p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {readiness ? <div className={styles.steps} aria-label="Marketplace launch progress">
        <div className={identityReady ? styles.stepDone : styles.step}><span>1</span><strong>{copy.identity}</strong></div>
        <div className={readiness.first_service_created ? styles.stepDone : styles.step}><span>2</span><strong>{copy.service}</strong></div>
        <div className={readiness.first_service_scoped ? styles.stepDone : styles.step}><span>3</span><strong>{copy.scope}</strong></div>
        <div className={readiness.marketplace_live ? styles.stepDone : styles.step}><span>4</span><strong>{copy.public}</strong></div>
      </div> : null}

      {!loading && readiness && services.length === 0 && !formOpen ? <div className={styles.emptyState}>
        <div><strong>{tamil ? 'முதல் service-ஐ சேர்க்கவும்' : 'Create your first service'}</strong><p>{tamil ? 'Customer search மற்றும் booking-க்கு தெரியும் service இதிலிருந்து ஆரம்பிக்கிறது.' : 'Start with the service customers will discover and book.'}</p></div>
        <Button type="button" onClick={() => setFormOpen(true)}>{copy.create}</Button>
      </div> : null}

      {!loading && services.length > 0 && !formOpen ? <div className={styles.topActions}>
        <Button type="button" variant="secondary" onClick={() => setFormOpen(true)}>{copy.addAnother}</Button>
        <Link href="/provider/services" className={styles.secondaryLink}>{copy.manage}</Link>
      </div> : null}

      {formOpen ? <form className={styles.form} onSubmit={createService}>
        <div className={styles.twoColumns}>
          <Input label={copy.name} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required maxLength={120} />
          <Select label={copy.category} value={draft.category_id} onChange={(event) => setDraft((current) => ({ ...current, category_id: event.target.value }))} required>
            {selectableCategories.map((category) => <option value={category.id} key={category.id}>{categoryLabel(category)}</option>)}
          </Select>
        </div>
        <Textarea label={copy.description} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} required maxLength={1200} rows={3} />
        <div className={styles.twoColumns}>
          <Input label={copy.price} type="number" min={0} step="0.01" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} required />
          <Input label={copy.duration} type="number" min={1} step={1} value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} required />
        </div>
        <div className={styles.actions}><Button type="submit" loading={busy === 'create'}>{copy.save}</Button><Button type="button" variant="secondary" onClick={() => { setFormOpen(false); setDraft(emptyDraft); }}>{copy.cancel}</Button></div>
      </form> : null}

      {readiness?.services.length ? <div className={styles.serviceRail}>
        {readiness.services.map((service) => {
          const latest = latestByService.get(service.id);
          const pending = latest?.status === 'pending';
          const canonicalCategory = selectableCategories.find((item) => normalized(item.name) === normalized(service.catalog_category));
          const blockedByIdentity = !identityReady;
          return <article className={styles.serviceCard} key={service.id}>
            <div className={styles.serviceHead}><div><small>{service.status}</small><h3>{service.name}</h3><p>{service.catalog_category || copy.noCategory}</p></div><Badge tone={service.status === 'active' ? 'success' : service.scope_enabled ? 'info' : pending ? 'warning' : 'neutral'}>{service.status === 'active' ? copy.live : service.scope_enabled ? copy.approved : pending ? copy.pending : 'Draft'}</Badge></div>

            {!service.scope_enabled && !pending && canonicalCategory ? <div className={styles.inlineAction}>
              <Select label={copy.location} value={locationByService[service.id] ?? ''} onChange={(event) => setLocationByService((current) => ({ ...current, [service.id]: event.target.value }))} disabled={blockedByIdentity}>
                {preferredLocations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.type ? ` · ${location.type}` : ''}</option>)}
              </Select>
              <Button type="button" loading={busy === `approval:${service.id}`} disabled={blockedByIdentity || !locationByService[service.id]} onClick={() => void requestApproval(service)}>{copy.approval}</Button>
              {blockedByIdentity ? <p className={styles.help}>{tamil ? 'Profile, verification, disclosure மற்றும் trust status complete ஆன பிறகு launch approval தொடரலாம்.' : 'Finish profile, verification, disclosure and trust readiness before requesting launch approval.'}</p> : null}
            </div> : null}

            {!service.scope_enabled && !pending && !canonicalCategory ? <div className={styles.inlineAction}><p className={styles.help}>{copy.noCategory}</p><Link href="/provider/services" className={styles.secondaryLink}>{copy.manage}</Link></div> : null}

            {pending && latest ? <div className={styles.inlineAction}><p className={styles.help}>{latest.review_note || (tamil ? 'Platform review pending.' : 'Platform review is pending.')}</p><Button type="button" variant="secondary" loading={busy === `withdraw:${latest.id}`} onClick={() => void withdraw(latest.id)}>{copy.withdraw}</Button></div> : null}

            {service.scope_enabled ? <div className={styles.scopeSummary}><span><small>{copy.category}</small><strong>{service.category_name || service.catalog_category || '—'}</strong></span><span><small>{copy.location}</small><strong>{service.location_name || '—'}</strong></span></div> : null}

            {service.scope_enabled && service.launch_ready && service.status !== 'active' ? <Button type="button" loading={busy === `activate:${service.id}`} onClick={() => void activate(service.id)}>{copy.activate}</Button> : null}
            {service.scope_enabled && !service.launch_ready ? <p className={styles.help}>{tamil ? 'Scope approved. Remaining public readiness gate complete ஆனதும் Activate கிடைக்கும்.' : 'Scope approved. Activate becomes available after the remaining public readiness gate is complete.'}</p> : null}
          </article>;
        })}
      </div> : null}
    </Card>
  </section>;
}
