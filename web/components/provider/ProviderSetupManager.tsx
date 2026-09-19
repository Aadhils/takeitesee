'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type TrustStatus = 'normal' | 'reverification_required' | 'suspended';
type ReadinessService = { id: string; name: string; status: string; catalog_category?: string | null; scope_enabled: boolean; application_id?: string | null; application_name?: string | null; category_id?: string | null; category_name?: string | null; location_id?: string | null; location_name?: string | null; launch_ready: boolean };
type Readiness = { profile_complete: boolean; verified: boolean; marketplace_disclosure_complete: boolean; trust_status: TrustStatus; trust_reason?: string | null; services_total: number; services_scoped: number; services_active: number; pending_launch_requests: number; first_service_created: boolean; first_service_scoped: boolean; marketplace_live: boolean; progress_percent: number; services: ReadinessService[] };
type LaunchCategory = { id: string; application_id: string; parent_id?: string | null; code: string; name: string };
type LaunchOptions = { applications: { id: string; code: string; name: string }[]; categories: LaunchCategory[]; locations: { id: string; type: string; code: string; name: string; country_code?: string | null; timezone?: string | null }[] };
type LaunchRequest = { id: string; service_id: string; requested_application_id: string; requested_category_id: string; requested_location_id: string; status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn'; review_note?: string | null; reviewed_at?: string | null; created_at: string };

type SetupPayload = { readiness?: Readiness; options?: LaunchOptions; requests?: LaunchRequest[]; error?: string };

function requestTone(status: LaunchRequest['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending' || status === 'changes_requested') return 'warning' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'neutral' as const;
}

function normalizedCategory(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function LaunchRequestForm({ service, options, disabled, onSubmitted }: { service: ReadinessService; options: LaunchOptions; disabled: boolean; onSubmitted: () => Promise<void> }) {
  const { t } = useRemainingWorkspaceTranslations();
  const childParentIds = useMemo(() => new Set(options.categories.map((category) => category.parent_id).filter(Boolean) as string[]), [options.categories]);
  const selectableCategories = useMemo(() => options.categories.filter((category) => !childParentIds.has(category.id)), [childParentIds, options.categories]);
  const canonicalCategory = useMemo(() => selectableCategories.find((category) => normalizedCategory(category.name) === normalizedCategory(service.catalog_category)), [selectableCategories, service.catalog_category]);
  const applicationId = canonicalCategory?.application_id ?? '';
  const categoryId = canonicalCategory?.id ?? '';
  const parentById = useMemo(() => new Map(options.categories.map((category) => [category.id, category])), [options.categories]);
  const categoryDisplay = canonicalCategory ? `${canonicalCategory.parent_id ? `${parentById.get(canonicalCategory.parent_id)?.name ?? t('setup.categoryFallback')} → ` : ''}${canonicalCategory.name}` : '';
  const preferredLocations = options.locations.some((location) => location.type === 'city') ? options.locations.filter((location) => location.type === 'city') : options.locations;
  const [locationId, setLocationId] = useState(preferredLocations[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!preferredLocations.some((location) => location.id === locationId)) setLocationId(preferredLocations[0]?.id ?? '');
  }, [locationId, preferredLocations]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || disabled || !applicationId || !categoryId || !locationId) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/provider/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_id: service.id, application_id: applicationId, category_id: categoryId, location_id: locationId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('setup.error.submit'));
      await onSubmitted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('setup.error.submit')); }
    finally { setBusy(false); }
  };

  if (!canonicalCategory) {
    return <div className="section-stack" style={{ marginTop: '1rem' }}>
      <Alert title={t('setup.form.categoryRequiredTitle')} tone="warning">{t('setup.form.categoryRequiredHelp')}</Alert>
      <Link href="/provider/services" className="text-link">{t('setup.form.chooseCategory')}</Link>
    </div>;
  }

  return <form onSubmit={submit} className="section-stack" style={{ marginTop: '1rem' }}>
    <Select label={t('setup.form.application')} value={applicationId} disabled><option value={applicationId}>{options.applications.find((item) => item.id === applicationId)?.name ?? 'TakeItEsee'}</option></Select>
    <Select label={t('setup.form.platformCategory')} value={categoryId} disabled><option value={categoryId}>{categoryDisplay}</option></Select>
    <p className="summary-note">{t('setup.form.categoryLockedHelp')}</p>
    <Select label={t('setup.form.launchLocation')} value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={disabled}>{preferredLocations.map((item) => <option key={item.id} value={item.id}>{item.name}{item.type ? ` · ${item.type}` : ''}</option>)}</Select>
    {error ? <p className="field-error" role="alert">{error}</p> : null}
    <Button type="submit" loading={busy} disabled={disabled || !categoryId || !locationId}>{t('setup.form.requestApproval')}</Button>
  </form>;
}

export default function ProviderSetupManager() {
  const { t } = useRemainingWorkspaceTranslations();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [options, setOptions] = useState<LaunchOptions>({ applications: [], categories: [], locations: [] });
  const [requests, setRequests] = useState<LaunchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const response = await fetch('/api/provider/setup', { cache: 'no-store' });
      const body = await response.json() as SetupPayload;
      if (!response.ok || !body.readiness || !body.options) throw new Error(body.error ?? t('setup.error.load'));
      setReadiness(body.readiness); setOptions(body.options); setRequests(body.requests ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('setup.error.load')); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const latestByService = useMemo(() => {
    const map = new Map<string, LaunchRequest>();
    for (const request of requests) if (!map.has(request.service_id)) map.set(request.service_id, request);
    return map;
  }, [requests]);

  const withdraw = async (requestId: string) => {
    if (busyId) return;
    setBusyId(requestId); setError('');
    try {
      const response = await fetch('/api/provider/setup', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: requestId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('setup.error.withdraw'));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('setup.error.withdraw')); }
    finally { setBusyId(null); }
  };

  const trustStatusLabel = (status: TrustStatus) => ({
    normal: t('setup.trust.normal'),
    reverification_required: t('setup.trust.reverificationRequired'),
    suspended: t('setup.trust.suspended'),
  }[status]);
  const requestStatusLabel = (status: LaunchRequest['status']) => ({
    pending: t('setup.request.pending'),
    approved: t('setup.request.approved'),
    changes_requested: t('setup.request.changesRequested'),
    rejected: t('setup.request.rejected'),
    withdrawn: t('setup.request.withdrawn'),
  }[status]);
  const serviceStatusLabel = (status: string) => ({
    active: t('common.active'),
    draft: t('common.draft'),
    paused: t('common.paused'),
  } as Record<string, string>)[status] ?? status.replaceAll('_', ' ');
  const serviceCount = (count: number, suffix: 'created' | 'scoped' | 'activeWithGates') =>
    `${count} ${t(count === 1 ? 'setup.count.service' : 'setup.count.services')} ${t(`setup.count.${suffix}` as 'setup.count.created' | 'setup.count.scoped' | 'setup.count.activeWithGates')}`;

  const steps = readiness ? [
    { label: t('setup.step.profile.label'), done: readiness.profile_complete, href: '/provider/profile', detail: t('setup.step.profile.detail') },
    { label: t('setup.step.verification.label'), done: readiness.verified, href: '/provider/verification', detail: t('setup.step.verification.detail') },
    { label: t('setup.step.disclosure.label'), done: readiness.marketplace_disclosure_complete, href: '/provider/verification', detail: t('setup.step.disclosure.detail') },
    { label: t('setup.step.trust.label'), done: readiness.trust_status === 'normal', href: '/provider/verification', detail: readiness.trust_status === 'normal' ? t('setup.step.trust.normal') : trustStatusLabel(readiness.trust_status) },
    { label: t('setup.step.service.label'), done: readiness.first_service_created, href: '/provider/services', detail: serviceCount(readiness.services_total, 'created') },
    { label: t('setup.step.scope.label'), done: readiness.first_service_scoped, href: '#service-launch', detail: serviceCount(readiness.services_scoped, 'scoped') },
    { label: t('setup.step.launch.label'), done: readiness.marketplace_live, href: '/provider/services', detail: serviceCount(readiness.services_active, 'activeWithGates') },
  ] : [];
  const effectiveProgress = steps.length ? Math.round((steps.filter((step) => step.done).length / steps.length) * 100) : 0;

  return <LiveProviderShell active="/provider/setup">
    <ProviderHeading eyebrow={t('setup.eyebrow')} title={t('setup.title')} description={t('setup.intro')} />
    {loading ? <Card><p>{t('setup.loading')}</p></Card> : null}
    {error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{t('setup.reload')}</Button></Card> : null}

    {readiness ? <>
      {readiness.trust_status === 'suspended' ? <Alert title={t('setup.alert.suspendedTitle')} tone="danger">{t('setup.alert.suspendedHelp')} {readiness.trust_reason || ''}</Alert> : null}
      {readiness.trust_status === 'reverification_required' ? <Alert title={t('setup.alert.reverifyTitle')} tone="warning">{t('setup.alert.reverifyHelp')} <Link href="/provider/verification">{t('setup.alert.openVerification')}</Link></Alert> : null}
      {!readiness.marketplace_disclosure_complete ? <Alert title={t('setup.alert.disclosureTitle')} tone="warning">{t('setup.alert.disclosureHelp')} <Link href="/provider/verification">{t('setup.alert.completeDisclosure')}</Link></Alert> : null}
      <Card>
        <div className="section-heading"><div><span className="eyebrow">{t('setup.progress.eyebrow')}</span><h2>{effectiveProgress}% {t('setup.progress.readySuffix')}</h2></div><Badge tone={readiness.marketplace_live ? 'success' : 'warning'}>{readiness.marketplace_live ? t('setup.progress.live') : t('setup.progress.inProgress')}</Badge></div>
        <div style={{ height: 10, borderRadius: 999, background: '#e7eaf0', overflow: 'hidden', marginTop: 16 }}><div style={{ width: `${effectiveProgress}%`, height: '100%', background: 'currentColor' }} /></div>
      </Card>

      <div className="provider-profile-grid">
        {steps.map((step, index) => <Card className="provider-profile-card" key={step.label}>
          <div className="section-heading"><div><span className="eyebrow">{t('setup.step.prefix')} {index + 1}</span><h2>{step.label}</h2></div><Badge tone={step.done ? 'success' : 'warning'}>{step.done ? t('setup.step.done') : t('setup.step.required')}</Badge></div>
          <p>{step.detail}</p><Link href={step.href} className="text-link">{step.done ? t('setup.step.review') : t('setup.step.continue')} →</Link>
        </Card>)}
      </div>

      <section id="service-launch" className="section-stack">
        <div><span className="eyebrow">{t('setup.launch.eyebrow')}</span><h2>{t('setup.launch.title')}</h2><p>{t('setup.launch.intro')}</p></div>
        {!readiness.services.length ? <Card><EmptyState title={t('setup.launch.createFirstTitle')}>{t('setup.launch.createFirstHelp')}</EmptyState><Link href="/provider/services" className="text-link">{t('setup.launch.createService')}</Link></Card> : null}
        {readiness.services.map((service) => {
          const latest = latestByService.get(service.id);
          const pending = latest?.status === 'pending';
          return <Card key={service.id}>
            <div className="section-heading"><div><span className="eyebrow">{serviceStatusLabel(service.status)}</span><h2>{service.name}</h2><p className="summary-note">{t('setup.launch.catalogCategory')}: <strong>{service.catalog_category || t('setup.launch.notSelected')}</strong></p></div><Badge tone={service.scope_enabled ? 'success' : pending ? 'warning' : 'neutral'}>{service.scope_enabled ? t('setup.launch.scopeApproved') : pending ? t('setup.launch.reviewPending') : t('setup.launch.scopeRequired')}</Badge></div>
            {service.scope_enabled ? <p><strong>{service.category_name}</strong> · {service.location_name} · {service.application_name}</p> : null}
            {latest && !service.scope_enabled ? <div><p>{t('setup.launch.latestRequest')}: <Badge tone={requestTone(latest.status)}>{requestStatusLabel(latest.status)}</Badge></p>{latest.review_note ? <p><strong>{t('setup.launch.platformNote')}</strong> {latest.review_note}</p> : null}</div> : null}
            {pending ? <Button type="button" variant="secondary" loading={busyId === latest!.id} onClick={() => void withdraw(latest!.id)}>{t('setup.launch.withdraw')}</Button> : null}
            {!service.scope_enabled && !pending ? <LaunchRequestForm service={service} options={options} disabled={!readiness.profile_complete} onSubmitted={load} /> : null}
            {!readiness.profile_complete && !service.scope_enabled ? <p className="summary-note">{t('setup.launch.profileFirst')}</p> : null}
            {service.scope_enabled && !readiness.verified ? <p className="summary-note">{t('setup.launch.verifyBeforeActivation')}</p> : null}
            {service.scope_enabled && readiness.verified && !readiness.marketplace_disclosure_complete ? <p className="summary-note">{t('setup.launch.disclosureBeforeActivation')}</p> : null}
            {service.scope_enabled && readiness.trust_status !== 'normal' ? <p className="summary-note">{t('setup.launch.trustBlocksActivation')}</p> : null}
            {service.launch_ready && service.status !== 'active' ? <p><Link href="/provider/services" className="text-link">{t('setup.launch.activateReady')}</Link></p> : null}
          </Card>;
        })}
      </section>
    </> : null}
  </LiveProviderShell>;
}
