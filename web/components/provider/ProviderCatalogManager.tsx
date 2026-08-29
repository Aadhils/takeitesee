'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Alert, Badge, Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type CatalogStatus = 'draft' | 'active' | 'paused';
type CatalogItem = { id: string; name: string; description: string; category: string; price: number; duration: number; status: CatalogStatus };
type CatalogDraft = Omit<CatalogItem, 'id'>;
type ProviderServiceApiRecord = { id: string; name: string; description: string; category: string | null; base_price: number; duration_minutes: number; status: CatalogStatus };
type SetupReadiness = { verified: boolean; profile_complete: boolean; marketplace_live: boolean; services: { id: string; scope_enabled: boolean; launch_ready: boolean; category_name?: string | null; location_name?: string | null }[] };

const categories = ['Home services', 'Business services', 'Technology', 'Education', 'Wellness', 'Other'];
const cardInset: CSSProperties = { padding: '24px' };
const metaInset: CSSProperties = { padding: '14px 16px' };
const actionRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e7eaf0' };
const actionButtonStyle: CSSProperties = { minHeight: '42px', padding: '0 16px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' };
const outlinedActionStyle: CSSProperties = { ...actionButtonStyle, border: '1px solid #d8ddea', background: '#ffffff', color: '#4b36c8' };
const emptyDraft: CatalogDraft = { name: '', description: '', category: 'Home services', price: 0, duration: 60, status: 'draft' };

function statusTone(status: CatalogStatus): 'success' | 'warning' | 'neutral' { if (status === 'active') return 'success'; if (status === 'paused') return 'warning'; return 'neutral'; }
function mapApiItem(service: ProviderServiceApiRecord): CatalogItem { return { id: service.id, name: service.name, description: service.description, category: service.category || 'Other', price: Number(service.base_price), duration: Number(service.duration_minutes), status: service.status }; }

export function ProviderCatalogManager() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [readiness, setReadiness] = useState<SetupReadiness | null>(null);
  const [draft, setDraft] = useState<CatalogDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | CatalogStatus>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadServices = async () => {
    try {
      setLoading(true); setError('');
      const [serviceResponse, setupResponse] = await Promise.all([
        fetch('/api/provider/services', { cache: 'no-store' }),
        fetch('/api/provider/setup', { cache: 'no-store' }),
      ]);
      const servicePayload = await serviceResponse.json() as { services?: ProviderServiceApiRecord[]; error?: string };
      const setupPayload = await setupResponse.json() as { readiness?: SetupReadiness; error?: string };
      if (!serviceResponse.ok) throw new Error(servicePayload.error || 'Unable to load provider services.');
      if (!setupResponse.ok || !setupPayload.readiness) throw new Error(setupPayload.error || 'Unable to load launch readiness.');
      setItems((servicePayload.services ?? []).map(mapApiItem));
      setReadiness(setupPayload.readiness);
    } catch (cause) {
      setItems([]); setReadiness(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load provider services.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadServices(); }, []);

  const visibleItems = useMemo(() => items.filter((item) => filter === 'all' || item.status === filter), [items, filter]);
  const readyMap = useMemo(() => new Map((readiness?.services ?? []).map((service) => [service.id, service])), [readiness]);
  const activeCount = items.filter((item) => item.status === 'active').length;
  const draftCount = items.filter((item) => item.status === 'draft').length;
  const pausedCount = items.filter((item) => item.status === 'paused').length;
  const openAdd = () => { setEditingId(null); setDraft(emptyDraft); setFormOpen(true); setNotice(''); };
  const openEdit = (item: CatalogItem) => { setEditingId(item.id); setDraft({ name: item.name, description: item.description, category: item.category, price: item.price, duration: item.duration, status: item.status }); setFormOpen(true); setNotice(''); };
  const closeForm = () => { setEditingId(null); setDraft(emptyDraft); setFormOpen(false); };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.category || draft.price < 0 || draft.duration <= 0 || saving) return;
    setSaving(true); setNotice(''); setError('');
    try {
      const response = await fetch(editingId ? `/api/provider/services/${editingId}` : '/api/provider/services', {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name, description: draft.description, category: draft.category, duration_minutes: draft.duration, base_price: draft.price, currency: 'INR', status: draft.status }),
      });
      const payload = await response.json() as { service?: ProviderServiceApiRecord; error?: string };
      if (!response.ok || !payload.service) throw new Error(payload.error || 'Service could not be saved.');
      setNotice(editingId ? 'Service changes saved. Launch readiness has been recalculated.' : 'New draft service added. Continue in Provider Setup for category/location approval.');
      closeForm(); await loadServices();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Service could not be saved.'); }
    finally { setSaving(false); }
  };

  const setStatus = async (id: string, status: CatalogStatus) => {
    if (status === 'active' && !readyMap.get(id)?.launch_ready) { setError('This service is not launch-ready yet. Complete Provider Setup, verification, and platform category/location approval first.'); return; }
    setNotice(''); setError('');
    try {
      const response = await fetch(`/api/provider/services/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const payload = await response.json() as { service?: ProviderServiceApiRecord; error?: string };
      if (!response.ok || !payload.service) throw new Error(payload.error || 'Service status could not be updated.');
      setNotice(`Service moved to ${status}.`); await loadServices();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Service status could not be updated.'); }
  };

  return <LiveProviderShell active="/provider/services">
    <ProviderHeading eyebrow="Catalog" title="Services" description="Create drafts freely. Activation requires complete profile, verification, and platform-approved category/location scope." action={<Button type="button" onClick={openAdd}>Add service</Button>} />

    {readiness && !readiness.profile_complete ? <Alert title="Complete your provider profile" tone="warning">Profile readiness is required before launch approval. <Link href="/provider/profile">Complete profile →</Link></Alert> : readiness && !readiness.verified ? <Alert title="Verification required to publish" tone="warning">You can create drafts and request scope approval now, but activation stays locked until verification is approved. <Link href="/provider/verification">Open verification →</Link></Alert> : readiness ? <Alert title="Controlled publishing enabled" tone="success">Activation is enabled per service only after its platform category/location scope is approved. <Link href="/provider/setup">Open launch setup →</Link></Alert> : null}

    <Card className="mb-6 overflow-hidden"><div style={cardInset} className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><span className="eyebrow">Service catalog</span><h2 className="mt-2 break-words text-xl font-semibold">{loading ? 'Loading services' : error ? 'Catalog needs attention' : 'Catalog connected'}</h2><p className="mt-3 max-w-2xl break-words text-sm leading-6 text-slate-600">{error || notice || 'Your catalog is connected to production launch-readiness controls.'}</p></div><div className="grid w-full grid-cols-3 gap-2 text-center md:w-auto md:min-w-72"><div className="rounded-xl border" style={metaInset}><strong className="block text-lg">{activeCount}</strong><span className="text-xs text-slate-500">Active</span></div><div className="rounded-xl border" style={metaInset}><strong className="block text-lg">{draftCount}</strong><span className="text-xs text-slate-500">Draft</span></div><div className="rounded-xl border" style={metaInset}><strong className="block text-lg">{pausedCount}</strong><span className="text-xs text-slate-500">Paused</span></div></div></div>{error ? <div style={{ padding: '0 24px 24px' }}><Button type="button" variant="secondary" onClick={() => void loadServices()}>Retry</Button></div> : null}</Card>

    <div className="mb-5 max-w-xs"><Select label="Filter services" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | CatalogStatus)}><option value="all">All services</option><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option></Select></div>

    {formOpen ? <Card className="mb-6 overflow-hidden"><form onSubmit={saveDraft} style={cardInset} className="grid gap-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><span className="eyebrow">{editingId ? 'Edit service' : 'New service'}</span><h2 className="mt-2 text-2xl font-semibold">{editingId ? 'Update catalog details' : 'Add a service to your catalog'}</h2></div><Button type="button" variant="quiet" onClick={closeForm}>Close</Button></div><div className="grid gap-4 md:grid-cols-2"><Input label="Service name" value={draft.name} onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))} required /><Select label="Draft category" hint="Platform approval will replace this with the canonical launch category." value={draft.category} onChange={(event) => setDraft((c) => ({ ...c, category: event.target.value }))}>{categories.map((category) => <option key={category}>{category}</option>)}</Select><Input label="Price (INR)" type="number" min="0" value={draft.price} onChange={(event) => setDraft((c) => ({ ...c, price: Number(event.target.value) }))} required /><Input label="Duration (minutes)" type="number" min="15" step="15" value={draft.duration} onChange={(event) => setDraft((c) => ({ ...c, duration: Number(event.target.value) }))} required /></div><label className="grid gap-2 text-sm font-medium">About this service<textarea className="min-h-32 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" value={draft.description} onChange={(event) => setDraft((c) => ({ ...c, description: event.target.value }))} /></label><div style={actionRowStyle}><Button type="submit" style={actionButtonStyle} loading={saving}>{editingId ? 'Save changes' : 'Add service'}</Button><Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => setDraft((c) => ({ ...c, status: 'draft' }))}>Save as draft</Button></div></form></Card> : null}

    <div className="grid gap-5 lg:grid-cols-2">{visibleItems.map((item) => { const serviceReady = readyMap.get(item.id); return <Card key={item.id} className="min-w-0 overflow-hidden"><div style={cardInset} className="flex min-w-0 flex-col gap-5"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><span className="eyebrow">{item.category}</span><h2 className="mt-2 break-words text-xl font-semibold">{item.name}</h2></div><Badge tone={statusTone(item.status)}>{item.status[0].toUpperCase() + item.status.slice(1)}</Badge></div><p className="break-words text-sm leading-6 text-slate-600">{item.description || 'No description added yet.'}</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border" style={metaInset}><span className="block text-xs text-slate-500">Price</span><strong>INR {item.price.toLocaleString('en-IN')}</strong></div><div className="rounded-xl border" style={metaInset}><span className="block text-xs text-slate-500">Duration</span><strong>{item.duration} min</strong></div><div className="rounded-xl border" style={metaInset}><span className="block text-xs text-slate-500">Launch scope</span><strong>{serviceReady?.scope_enabled ? `${serviceReady.category_name} · ${serviceReady.location_name}` : 'Approval required'}</strong></div></div><div style={actionRowStyle}><Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => openEdit(item)}>Edit</Button>{item.status !== 'active' ? <Button type="button" style={actionButtonStyle} disabled={!serviceReady?.launch_ready} title={!serviceReady?.launch_ready ? 'Complete Provider Setup before activation' : undefined} onClick={() => void setStatus(item.id, 'active')}>Activate</Button> : null}{item.status === 'active' ? <Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => void setStatus(item.id, 'paused')}>Pause</Button> : null}{item.status !== 'draft' ? <Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => void setStatus(item.id, 'draft')}>Move to draft</Button> : null}{!serviceReady?.launch_ready && item.status !== 'active' ? <Link href="/provider/setup" className="text-link">Finish setup →</Link> : null}</div></div></Card>; })}</div>

    {!loading && !error && !visibleItems.length ? <Card><div style={cardInset} className="text-center"><h2 className="text-xl font-semibold">No services in this state</h2><p className="mt-2 text-sm text-slate-600">Change the filter or add a new service.</p></div></Card> : null}
  </LiveProviderShell>;
}
