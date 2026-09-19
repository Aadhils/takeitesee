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
  const { t } = useIdentityWorkspaceTranslations();

  const [services, setServices] = useState<Service[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [options, setOptions] = useState<SetupOptions>({ applications: [], categories: [], locations: [] });
  const [requests, setRequests] = useState<LaunchRequest[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [categoryQuery, setCategoryQuery] = useState('');
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
  const categoryMatches = useMemo(() => {
    const query = normalized(categoryQuery);
    if (!query) return selectableCategories;
    return selectableCategories.filter((category) => {
      const parentName = category.parent_id ? parentById.get(category.parent_id)?.name ?? '' : '';
      return normalized(`${parentName} ${category.name} ${category.code}`).includes(query);
    });
  }, [categoryQuery, parentById, selectableCategories]);
  const categoryOptions = useMemo(() => {
    const selected = selectableCategories.find((category) => category.id === draft.category_id);
    if (!selected || categoryMatches.some((category) => category.id === selected.id)) return categoryMatches;
    return [selected, ...categoryMatches];
  }, [categoryMatches, draft.category_id, selectableCategories]);
  const latestByService = useMemo(() => {
    const map = new Map<string, LaunchRequest>();
    for (const request of requests) if (!map.has(request.service_id)) map.set(request.service_id, request);
    return map;
  }, [requests]);

  const categoryLabel = (category: Category) => category.parent_id
    ? `${parentById.get(category.parent_id)?.name ?? t('provider.launch.categoryFallback')} → ${category.name}`
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
      if (!serviceResponse.ok) throw new Error(serviceBody.error ?? t('provider.launch.loadServicesFallback'));
      if (!setupResponse.ok || !setupBody.readiness || !setupBody.options) throw new Error(setupBody.error ?? t('provider.launch.loadFallback'));
      setServices(serviceBody.services ?? []);
      setReadiness(setupBody.readiness);
      setOptions(setupBody.options);
      setRequests(setupBody.requests ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.launch.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
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
      if (!response.ok || !body.service) throw new Error(body.error ?? t('provider.launch.createFallback'));
      setDraft(emptyDraft); setCategoryQuery(''); setFormOpen(false); setNotice(t('provider.launch.create')d);
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('provider.launch.createFallback')); }
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
      if (!response.ok) throw new Error(body.error ?? t('provider.launch.approvalFallback'));
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('provider.launch.approvalFallback')); }
    finally { setBusy(null); }
  };

  const withdraw = async (requestId: string) => {
    if (busy) return;
    setBusy(`withdraw:${requestId}`); setError('');
    try {
      const response = await fetch('/api/provider/setup', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: requestId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.launch.withdrawFallback'));
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('provider.launch.withdrawFallback')); }
    finally { setBusy(null); }
  };

  const activate = async (serviceId: string) => {
    if (busy) return;
    setBusy(`activate:${serviceId}`); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/provider/services/${serviceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
      const body = await response.json() as { service?: Service; error?: string };
      if (!response.ok || !body.service) throw new Error(body.error ?? t('provider.launch.activateFallback'));
      await load(); refreshWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('provider.launch.activateFallback')); }
    finally { setBusy(null); }
  };

  const identityReady = Boolean(readiness?.profile_complete && readiness.verified && readiness.marketplace_disclosure_complete && readiness.trust_status === 'normal');

  return <section id="provider-marketplace-launch" className={styles.center} aria-label={t('provider.launch.controlsLabel')}>
    <Card className={styles.card}>
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>{t('provider.launch.eyebrow')}</span><h2>{t('provider.launch.title')}</h2><p>{t('provider.launch.intro')}</p></div>
        <Badge tone={readiness?.marketplace_live ? 'success' : 'warning'}>{readiness?.marketplace_live ? t('provider.launch.ready') : t('provider.launch.progress')}</Badge>
      </div>

      {loading ? <p>{t('provider.launch.loading')}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{t('provider.launch.reload')}</button></p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {readiness ? <div className={styles.steps} aria-label={t('provider.launch.progressLabel')}>
        <div className={identityReady ? styles.stepDone : styles.step}><span>1</span><strong>{t('provider.launch.identity')}</strong></div>
        <div className={readiness.first_service_created ? styles.stepDone : styles.step}><span>2</span><strong>{t('provider.launch.service')}</strong></div>
        <div className={readiness.first_service_scoped ? styles.stepDone : styles.step}><span>3</span><strong>{t('provider.launch.scope')}</strong></div>
        <div className={readiness.marketplace_live ? styles.stepDone : styles.step}><span>4</span><strong>{t('provider.launch.public')}</strong></div>
      </div> : null}

      {!loading && readiness && services.length === 0 && !formOpen ? <div className={styles.emptyState}>
        <div><strong>{t('provider.launch.firstServiceTitle')}</strong><p>{t('provider.launch.firstServiceBody')}</p></div>
        <Button type="button" onClick={() => setFormOpen(true)}>{t('provider.launch.create')}</Button>
      </div> : null}

      {!loading && services.length > 0 && !formOpen ? <div className={styles.topActions}>
        <Button type="button" variant="secondary" onClick={() => setFormOpen(true)}>{t('provider.launch.addAnother')}</Button>
        <Link href="/provider/services" className={styles.secondaryLink}>{t('provider.launch.manage')}</Link>
      </div> : null}

      {formOpen ? <form className={styles.form} onSubmit={createService}>
        <div className={styles.twoColumns}>
          <Input label={t('provider.launch.name')} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required maxLength={120} />
          <div className={styles.categoryChooser}>
            <Input label={t('provider.launch.category')Search} value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder={t('provider.launch.category')SearchPlaceholder} />
            <Select label={t('provider.launch.category')} value={draft.category_id} onChange={(event) => setDraft((current) => ({ ...current, category_id: event.target.value }))} required>
              <option value="">{t('provider.launch.category')Choose}</option>
              {categoryOptions.map((category) => <option value={category.id} key={category.id}>{categoryLabel(category)}</option>)}
            </Select>
            {categoryQuery.trim() && categoryMatches.length === 0 ? <p className={styles.help}>{t('provider.launch.category')NoMatches}</p> : null}
          </div>
        </div>
        <Textarea label={t('provider.launch.description')} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} required maxLength={1200} rows={3} />
        <div className={styles.twoColumns}>
          <Input label={t('provider.launch.price')} type="number" min={0} step="0.01" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} required />
          <Input label={t('provider.launch.duration')} type="number" min={1} step={1} value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} required />
        </div>
        <div className={styles.actions}><Button type="submit" loading={busy === 'create'}>{t('provider.launch.save')}</Button><Button type="button" variant="secondary" onClick={() => { setFormOpen(false); setDraft(emptyDraft); setCategoryQuery(''); }}>{t('provider.launch.cancel')}</Button></div>
      </form> : null}

      {readiness?.services.length ? <div className={styles.serviceRail}>
        {readiness.services.map((service) => {
          const latest = latestByService.get(service.id);
          const pending = latest?.status === 'pending';
          const canonicalCategory = selectableCategories.find((item) => normalized(item.name) === normalized(service.catalog_category));
          const blockedByIdentity = !identityReady;
          return <article className={styles.serviceCard} key={service.id}>
            <div className={styles.serviceHead}><div><small>{service.status}</small><h3>{service.name}</h3><p>{service.catalog_category || t('provider.launch.noCategory')}</p></div><Badge tone={service.status === 'active' ? 'success' : service.scope_enabled ? 'info' : pending ? 'warning' : 'neutral'}>{service.status === 'active' ? t('provider.launch.live') : service.scope_enabled ? t('provider.launch.approved') : pending ? t('provider.launch.pending') : t('provider.launch.draft')}</Badge></div>

            {!service.scope_enabled && !pending && canonicalCategory ? <div className={styles.inlineAction}>
              <Select label={t('provider.launch.location')} value={locationByService[service.id] ?? ''} onChange={(event) => setLocationByService((current) => ({ ...current, [service.id]: event.target.value }))} disabled={blockedByIdentity}>
                {preferredLocations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.type ? ` · ${location.type}` : ''}</option>)}
              </Select>
              <Button type="button" loading={busy === `approval:${service.id}`} disabled={blockedByIdentity || !locationByService[service.id]} onClick={() => void requestApproval(service)}>{t('provider.launch.approval')}</Button>
              {blockedByIdentity ? <p className={styles.help}>{t('provider.launch.blockedHelp')}</p> : null}
            </div> : null}

            {!service.scope_enabled && !pending && !canonicalCategory ? <div className={styles.inlineAction}><p className={styles.help}>{t('provider.launch.noCategory')}</p><Link href="/provider/services" className={styles.secondaryLink}>{t('provider.launch.manage')}</Link></div> : null}

            {pending && latest ? <div className={styles.inlineAction}><p className={styles.help}>{latest.review_note || t('provider.launch.reviewPending')}</p><Button type="button" variant="secondary" loading={busy === `withdraw:${latest.id}`} onClick={() => void withdraw(latest.id)}>{t('provider.launch.withdraw')}</Button></div> : null}

            {service.scope_enabled ? <div className={styles.scopeSummary}><span><small>{t('provider.launch.category')}</small><strong>{service.category_name || service.catalog_category || '—'}</strong></span><span><small>{t('provider.launch.location')}</small><strong>{service.location_name || '—'}</strong></span></div> : null}

            {service.scope_enabled && service.launch_ready && service.status !== 'active' ? <Button type="button" loading={busy === `activate:${service.id}`} onClick={() => void activate(service.id)}>{t('provider.launch.activate')}</Button> : null}
            {service.scope_enabled && !service.launch_ready ? <p className={styles.help}>{t('provider.launch.scopeApprovedHelp')}</p> : null}
          </article>;
        })}
      </div> : null}
    </Card>
  </section>;
}
