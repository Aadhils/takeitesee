'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type ReadinessService = { id: string; name: string; status: string; scope_enabled: boolean; application_id?: string | null; application_name?: string | null; category_id?: string | null; category_name?: string | null; location_id?: string | null; location_name?: string | null; launch_ready: boolean };
type Readiness = { profile_complete: boolean; verified: boolean; services_total: number; services_scoped: number; services_active: number; pending_launch_requests: number; first_service_created: boolean; first_service_scoped: boolean; marketplace_live: boolean; progress_percent: number; services: ReadinessService[] };
type LaunchOptions = { applications: { id: string; code: string; name: string }[]; categories: { id: string; application_id: string; code: string; name: string }[]; locations: { id: string; type: string; code: string; name: string; country_code?: string | null; timezone?: string | null }[] };
type LaunchRequest = { id: string; service_id: string; requested_application_id: string; requested_category_id: string; requested_location_id: string; status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn'; review_note?: string | null; reviewed_at?: string | null; created_at: string };

type SetupPayload = { readiness?: Readiness; options?: LaunchOptions; requests?: LaunchRequest[]; error?: string };

function requestTone(status: LaunchRequest['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending' || status === 'changes_requested') return 'warning' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'neutral' as const;
}

function LaunchRequestForm({ service, options, disabled, onSubmitted }: { service: ReadinessService; options: LaunchOptions; disabled: boolean; onSubmitted: () => Promise<void> }) {
  const firstApp = options.applications[0]?.id ?? '';
  const [applicationId, setApplicationId] = useState(firstApp);
  const categories = options.categories.filter((category) => category.application_id === applicationId);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const preferredLocations = options.locations.some((location) => location.type === 'city') ? options.locations.filter((location) => location.type === 'city') : options.locations;
  const [locationId, setLocationId] = useState(preferredLocations[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!categories.some((category) => category.id === categoryId)) setCategoryId(categories[0]?.id ?? ''); }, [applicationId, categoryId, categories]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || disabled || !applicationId || !categoryId || !locationId) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/provider/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_id: service.id, application_id: applicationId, category_id: categoryId, location_id: locationId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Launch request could not be submitted.');
      await onSubmitted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Launch request could not be submitted.'); }
    finally { setBusy(false); }
  };

  return <form onSubmit={submit} className="section-stack" style={{ marginTop: '1rem' }}>
    <Select label="Application" value={applicationId} onChange={(event) => setApplicationId(event.target.value)} disabled={disabled}>{options.applications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    <Select label="Platform category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={disabled}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    <Select label="Launch location" value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={disabled}>{preferredLocations.map((item) => <option key={item.id} value={item.id}>{item.name}{item.type ? ` · ${item.type}` : ''}</option>)}</Select>
    {error ? <p className="field-error" role="alert">{error}</p> : null}
    <Button type="submit" loading={busy} disabled={disabled || !categoryId || !locationId}>Request platform approval</Button>
  </form>;
}

export default function ProviderSetupManager() {
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
      if (!response.ok || !body.readiness || !body.options) throw new Error(body.error ?? 'Unable to load provider setup.');
      setReadiness(body.readiness); setOptions(body.options); setRequests(body.requests ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load provider setup.'); }
    finally { setLoading(false); }
  }, []);
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
      if (!response.ok) throw new Error(body.error ?? 'Unable to withdraw launch request.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to withdraw launch request.'); }
    finally { setBusyId(null); }
  };

  const steps = readiness ? [
    { label: 'Complete provider profile', done: readiness.profile_complete, href: '/provider/profile', detail: 'Name, description, and service area' },
    { label: 'Complete provider verification', done: readiness.verified, href: '/provider/verification', detail: 'Platform trust review' },
    { label: 'Create your first service', done: readiness.first_service_created, href: '/provider/services', detail: `${readiness.services_total} service${readiness.services_total === 1 ? '' : 's'} created` },
    { label: 'Approve category & location', done: readiness.first_service_scoped, href: '#service-launch', detail: `${readiness.services_scoped} service${readiness.services_scoped === 1 ? '' : 's'} scoped` },
    { label: 'Launch to marketplace', done: readiness.marketplace_live, href: '/provider/services', detail: `${readiness.services_active} active service${readiness.services_active === 1 ? '' : 's'}` },
  ] : [];

  return <LiveProviderShell active="/provider/setup">
    <ProviderHeading eyebrow="Launch readiness" title="Provider setup" description="Finish the production checklist, request platform category/location approval, and launch only when every gate is ready." />
    {loading ? <Card><p>Loading setup readiness…</p></Card> : null}
    {error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Reload</Button></Card> : null}

    {readiness ? <>
      <Card>
        <div className="section-heading"><div><span className="eyebrow">Onboarding progress</span><h2>{readiness.progress_percent}% ready</h2></div><Badge tone={readiness.marketplace_live ? 'success' : 'warning'}>{readiness.marketplace_live ? 'Marketplace live' : 'Setup in progress'}</Badge></div>
        <div style={{ height: 10, borderRadius: 999, background: '#e7eaf0', overflow: 'hidden', marginTop: 16 }}><div style={{ width: `${readiness.progress_percent}%`, height: '100%', background: 'currentColor' }} /></div>
      </Card>

      <div className="provider-profile-grid">
        {steps.map((step, index) => <Card className="provider-profile-card" key={step.label}>
          <div className="section-heading"><div><span className="eyebrow">Step {index + 1}</span><h2>{step.label}</h2></div><Badge tone={step.done ? 'success' : 'warning'}>{step.done ? 'Done' : 'Required'}</Badge></div>
          <p>{step.detail}</p><Link href={step.href} className="text-link">{step.done ? 'Review' : 'Continue'} →</Link>
        </Card>)}
      </div>

      <section id="service-launch" className="section-stack">
        <div><span className="eyebrow">Controlled launch</span><h2>Service category & location approval</h2><p>Platform approval creates the canonical ecosystem scope. Verification is not required to request scope, but your provider profile must be complete.</p></div>
        {!readiness.services.length ? <Card><EmptyState title="Create a service first">Add a draft service before requesting its platform category and launch location.</EmptyState><Link href="/provider/services" className="text-link">Create a service →</Link></Card> : null}
        {readiness.services.map((service) => {
          const latest = latestByService.get(service.id);
          const pending = latest?.status === 'pending';
          return <Card key={service.id}>
            <div className="section-heading"><div><span className="eyebrow">{service.status}</span><h2>{service.name}</h2></div><Badge tone={service.scope_enabled ? 'success' : pending ? 'warning' : 'neutral'}>{service.scope_enabled ? 'Scope approved' : pending ? 'Review pending' : 'Scope required'}</Badge></div>
            {service.scope_enabled ? <p><strong>{service.category_name}</strong> · {service.location_name} · {service.application_name}</p> : null}
            {latest && !service.scope_enabled ? <div><p>Latest request: <Badge tone={requestTone(latest.status)}>{latest.status.replaceAll('_',' ')}</Badge></p>{latest.review_note ? <p><strong>Platform note:</strong> {latest.review_note}</p> : null}</div> : null}
            {pending ? <Button type="button" variant="secondary" loading={busyId === latest!.id} onClick={() => void withdraw(latest!.id)}>Withdraw request</Button> : null}
            {!service.scope_enabled && !pending ? <LaunchRequestForm service={service} options={options} disabled={!readiness.profile_complete} onSubmitted={load} /> : null}
            {!readiness.profile_complete && !service.scope_enabled ? <p className="summary-note">Complete the provider profile before requesting launch approval.</p> : null}
            {service.scope_enabled && !readiness.verified ? <p className="summary-note">Scope is approved. Complete verification before activation.</p> : null}
            {service.launch_ready && service.status !== 'active' ? <p><Link href="/provider/services" className="text-link">All launch gates ready — activate this service →</Link></p> : null}
          </Card>;
        })}
      </section>
    </> : null}
  </LiveProviderShell>;
}
