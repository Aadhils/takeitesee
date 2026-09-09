'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Alert, Badge, Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import ProviderServiceReachControl from './ProviderServiceReachControl';
import { LiveProviderShell } from './LiveProviderShell';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type CatalogStatus = 'draft' | 'active' | 'paused';
type TrustStatus = 'normal' | 'reverification_required' | 'suspended';
type CatalogItem = { id: string; name: string; description: string; category: string; price: number; duration: number; status: CatalogStatus };
type CatalogDraft = { name: string; description: string; category_id: string; price: number; duration: number; status: CatalogStatus };
type ProviderServiceApiRecord = { id: string; name: string; description: string; category: string | null; base_price: number; duration_minutes: number; status: CatalogStatus };
type SetupReadiness = { verified: boolean; profile_complete: boolean; marketplace_live: boolean; trust_status: TrustStatus; trust_reason?: string | null; services: { id: string; scope_enabled: boolean; launch_ready: boolean; category_name?: string | null; location_name?: string | null }[] };
type PlatformCategory = { id: string; application_id: string; parent_id?: string | null; code: string; name: string };
type SetupOptions = { categories: PlatformCategory[] };

const cardInset: CSSProperties = { padding: '24px' };
const metaInset: CSSProperties = { padding: '14px 16px' };
const actionRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e7eaf0' };
const actionButtonStyle: CSSProperties = { minHeight: '42px', padding: '0 16px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' };
const outlinedActionStyle: CSSProperties = { ...actionButtonStyle, border: '1px solid #d8ddea', background: '#ffffff', color: '#4b36c8' };

function emptyDraft(categoryId = ''): CatalogDraft { return { name: '', description: '', category_id: categoryId, price: 0, duration: 60, status: 'draft' }; }
function statusTone(status: CatalogStatus): 'success' | 'warning' | 'neutral' { if (status === 'active') return 'success'; if (status === 'paused') return 'warning'; return 'neutral'; }
function mapApiItem(service: ProviderServiceApiRecord): CatalogItem { return { id: service.id, name: service.name, description: service.description, category: service.category || '', price: Number(service.base_price), duration: Number(service.duration_minutes), status: service.status }; }
function normalizedCategory(value: string | null | undefined) { return String(value ?? '').trim().toLocaleLowerCase(); }

export function ProviderCatalogManager() {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [readiness, setReadiness] = useState<SetupReadiness | null>(null);
  const [platformCategories, setPlatformCategories] = useState<PlatformCategory[]>([]);
  const [draft, setDraft] = useState<CatalogDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | CatalogStatus>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const parentById = useMemo(() => new Map(platformCategories.map((category) => [category.id, category])), [platformCategories]);
  const parentIds = useMemo(() => new Set(platformCategories.map((category) => category.parent_id).filter(Boolean) as string[]), [platformCategories]);
  const selectableCategories = useMemo(() => platformCategories.filter((category) => !parentIds.has(category.id)), [parentIds, platformCategories]);
  const categoryById = useMemo(() => new Map(selectableCategories.map((category) => [category.id, category])), [selectableCategories]);

  const categoryDisplay = (category: PlatformCategory) => category.parent_id
    ? `${parentById.get(category.parent_id)?.name ?? 'Category'} → ${category.name}`
    : category.name;

  const categoryDisplayByName = (name: string) => {
    const category = selectableCategories.find((item) => normalizedCategory(item.name) === normalizedCategory(name));
    return category ? categoryDisplay(category) : name || 'Category required';
  };

  const loadServices = async () => {
    try {
      setLoading(true); setError('');
      const [serviceResponse, setupResponse] = await Promise.all([fetch('/api/provider/services', { cache: 'no-store' }), fetch('/api/provider/setup', { cache: 'no-store' })]);
      const servicePayload = await serviceResponse.json() as { services?: ProviderServiceApiRecord[]; error?: string };
      const setupPayload = await setupResponse.json() as { readiness?: SetupReadiness; options?: SetupOptions; error?: string };
      if (!serviceResponse.ok) throw new Error(servicePayload.error || 'Unable to load provider services.');
      if (!setupResponse.ok || !setupPayload.readiness || !setupPayload.options) throw new Error(setupPayload.error || 'Unable to load launch readiness and platform categories.');
      setItems((servicePayload.services ?? []).map(mapApiItem));
      setReadiness(setupPayload.readiness);
      setPlatformCategories(setupPayload.options.categories ?? []);
    } catch (cause) {
      setItems([]); setReadiness(null); setPlatformCategories([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load provider services.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadServices(); }, []);

  const visibleItems = useMemo(() => items.filter((item) => filter === 'all' || item.status === filter), [items, filter]);
  const readyMap = useMemo(() => new Map((readiness?.services ?? []).map((service) => [service.id, service])), [readiness]);
  const activeCount = items.filter((item) => item.status === 'active').length;
  const draftCount = items.filter((item) => item.status === 'draft').length;
  const pausedCount = items.filter((item) => item.status === 'paused').length;

  const openAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft(selectableCategories[0]?.id ?? ''));
    setFormOpen(true);
    setNotice('');
  };

  const openEdit = (item: CatalogItem) => {
    const category = selectableCategories.find((candidate) => normalizedCategory(candidate.name) === normalizedCategory(item.category));
    setEditingId(item.id);
    setDraft({ name: item.name, description: item.description, category_id: category?.id ?? '', price: item.price, duration: item.duration, status: item.status });
    setFormOpen(true);
    setNotice(category ? '' : 'This service uses a legacy category. Choose an Admin-managed platform category before saving.');
  };

  const closeForm = () => {
    setEditingId(null);
    setDraft(emptyDraft(selectableCategories[0]?.id ?? ''));
    setFormOpen(false);
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const category = categoryById.get(draft.category_id);
    if (!draft.name.trim() || !category || draft.price < 0 || draft.duration <= 0 || saving) return;

    const editingItem = editingId ? items.find((item) => item.id === editingId) : null;
    const categoryChanged = Boolean(editingItem) && normalizedCategory(editingItem?.category) !== normalizedCategory(category.name);
    const nextStatus: CatalogStatus = editingItem?.status === 'active' && categoryChanged ? 'draft' : draft.status;

    setSaving(true); setNotice(''); setError('');
    try {
      const response = await fetch(editingId ? `/api/provider/services/${editingId}` : '/api/provider/services', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name, description: draft.description, category_id: category.id, duration_minutes: draft.duration, base_price: draft.price, currency: 'INR', status: nextStatus }),
      });
      const payload = await response.json() as { service?: ProviderServiceApiRecord; error?: string };
      if (!response.ok || !payload.service) throw new Error(payload.error || 'Service could not be saved.');
      setNotice(locale === 'ta-IN'
        ? (categoryChanged && editingItem?.status === 'active' ? 'Category மாற்றப்பட்டதால் service draft நிலைக்கு மாற்றப்பட்டது. புதிய category/location approval தேவை.' : editingId ? 'சேவை மாற்றங்கள் canonical category உடன் சேமிக்கப்பட்டன.' : 'புதிய draft service Admin category உடன் சேர்க்கப்பட்டது. Provider Setup-ல் location approval தொடரவும்.')
        : (categoryChanged && editingItem?.status === 'active' ? 'The category changed, so the service moved to draft and needs fresh category/location approval.' : editingId ? 'Service changes saved with the canonical platform category.' : 'New draft service added with an Admin-managed category. Continue in Provider Setup for location approval.'));
      closeForm(); await loadServices();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Service could not be saved.'); }
    finally { setSaving(false); }
  };

  const setStatus = async (id: string, status: CatalogStatus) => {
    if (status === 'active' && readiness?.trust_status !== 'normal') { setError(readiness?.trust_status === 'suspended' ? 'Provider suspension must be resolved before activation.' : 'Complete provider re-verification before activation.'); return; }
    if (status === 'active' && !readyMap.get(id)?.launch_ready) { setError('This service is not launch-ready yet. Complete Provider Setup, verification, trust review, and platform category/location approval first.'); return; }
    setNotice(''); setError('');
    try {
      const response = await fetch(`/api/provider/services/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const payload = await response.json() as { service?: ProviderServiceApiRecord; error?: string };
      if (!response.ok || !payload.service) throw new Error(payload.error || 'Service status could not be updated.');
      setNotice(locale === 'ta-IN' ? `சேவை ${statusLabel(status)} நிலைக்கு மாற்றப்பட்டது.` : `Service moved to ${status}.`); await loadServices();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Service status could not be updated.'); }
  };

  const statusLabel = (status: CatalogStatus) => status === 'active' ? t('common.active') : status === 'paused' ? t('common.paused') : t('common.draft');

  return <LiveProviderShell active="/provider/services">
    <ProviderHeading eyebrow={t('catalog.eyebrow')} title={t('catalog.title')} description={t('catalog.intro')} action={<Button type="button" onClick={openAdd} disabled={!selectableCategories.length}>{t('catalog.add')}</Button>} />

    {!loading && !selectableCategories.length ? <Alert title="Platform categories required" tone="warning">No selectable Admin-managed categories are active yet. <Link href="/provider/category-requests">Request the category you need →</Link></Alert> : null}
    {readiness?.trust_status === 'suspended' ? <Alert title={t('catalog.activationSuspended')} tone="danger">{t('catalog.activationSuspendedHelp')} {readiness.trust_reason || ''}</Alert> : readiness?.trust_status === 'reverification_required' ? <Alert title={t('catalog.reverification')} tone="warning">{t('catalog.reverificationHelp')} <Link href="/provider/verification">{t('catalog.openVerification')}</Link></Alert> : readiness && !readiness.profile_complete ? <Alert title={t('catalog.completeProfile')} tone="warning">{t('catalog.completeProfileHelp')} <Link href="/provider/profile">{t('catalog.completeProfileAction')}</Link></Alert> : readiness && !readiness.verified ? <Alert title={t('catalog.verificationRequired')} tone="warning">{t('catalog.verificationRequiredHelp')} <Link href="/provider/verification">{t('catalog.openVerification')}</Link></Alert> : readiness ? <Alert title="Admin-managed categories" tone="success">Providers choose a specific platform category here; Provider Setup keeps that same category locked through approval. <Link href="/provider/setup">{t('catalog.openSetup')}</Link></Alert> : null}

    <Card className="mb-6 overflow-hidden"><div style={cardInset} className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><span className="eyebrow">{t('catalog.serviceCatalog')}</span><h2 className="mt-2 break-words text-xl font-semibold">{loading ? t('catalog.loading') : error ? t('catalog.attention') : t('catalog.connected')}</h2><p className="mt-3 max-w-2xl break-words text-sm leading-6 text-slate-600">{error || notice || 'Categories come from the Super Admin registry instead of a hard-coded Provider list.'}</p></div><div className="grid w-full grid-cols-3 gap-2 text-center md:w-auto md:min-w-72"><div className="rounded-xl border" style={metaInset}><strong className="block text-lg">{activeCount}</strong><span className="text-xs text-slate-500">{t('common.active')}</span></div><div className="rounded-xl border" style={metaInset}><strong className="block text-lg">{draftCount}</strong><span className="text-xs text-slate-500">{t('common.draft')}</span></div><div className="rounded-xl border" style={metaInset}><strong className="block text-lg">{pausedCount}</strong><span className="text-xs text-slate-500">{t('common.paused')}</span></div></div></div>{error ? <div style={{ padding: '0 24px 24px' }}><Button type="button" variant="secondary" onClick={() => void loadServices()}>{t('common.retry')}</Button></div> : null}</Card>

    <div className="mb-5 max-w-xs"><Select label={t('catalog.filter')} value={filter} onChange={(event) => setFilter(event.target.value as 'all' | CatalogStatus)}><option value="all">{t('catalog.all')}</option><option value="active">{t('common.active')}</option><option value="draft">{t('common.draft')}</option><option value="paused">{t('common.paused')}</option></Select></div>

    {formOpen ? <Card className="mb-6 overflow-hidden"><form onSubmit={saveDraft} style={cardInset} className="grid gap-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><span className="eyebrow">{editingId ? t('catalog.editService') : t('catalog.newService')}</span><h2 className="mt-2 text-2xl font-semibold">{editingId ? t('catalog.updateDetails') : t('catalog.addToCatalog')}</h2></div><Button type="button" variant="quiet" onClick={closeForm}>{t('common.close')}</Button></div><div className="grid gap-4 md:grid-cols-2"><Input label={t('catalog.serviceName')} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required /><Select label="Platform category" hint="Choose the most specific Admin-managed category. Category groups are not selectable." value={draft.category_id} onChange={(event) => setDraft((current) => ({ ...current, category_id: event.target.value }))} required><option value="" disabled>Select a specific category</option>{selectableCategories.map((category) => <option value={category.id} key={category.id}>{categoryDisplay(category)}</option>)}</Select><Input label={t('catalog.price')} type="number" min="0" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: Number(event.target.value) }))} required /><Input label={t('catalog.duration')} type="number" min="15" step="15" value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: Number(event.target.value) }))} required /></div><label className="grid gap-2 text-sm font-medium">{t('catalog.about')}<textarea className="min-h-32 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label><div className="rounded-xl border border-dashed p-4 text-sm text-slate-600">Can’t find the right category? Do not create free-text labels. <Link href="/provider/category-requests" className="text-link">Request a category for Admin review →</Link></div><div style={actionRowStyle}><Button type="submit" style={actionButtonStyle} loading={saving} disabled={!draft.category_id}>{editingId ? t('catalog.saveChanges') : t('catalog.add')}</Button><Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => setDraft((current) => ({ ...current, status: 'draft' }))}>{t('catalog.saveDraft')}</Button></div></form></Card> : null}

    <div className="grid gap-5 lg:grid-cols-2">{visibleItems.map((item) => { const serviceReady = readyMap.get(item.id); return <Card key={item.id} className="min-w-0 overflow-hidden"><div style={cardInset} className="flex min-w-0 flex-col gap-5"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><span className="eyebrow">{categoryDisplayByName(item.category)}</span><h2 className="mt-2 break-words text-xl font-semibold">{item.name}</h2></div><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></div><p className="break-words text-sm leading-6 text-slate-600">{item.description || t('catalog.noDescription')}</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border" style={metaInset}><span className="block text-xs text-slate-500">{t('catalog.price')}</span><strong>INR {item.price.toLocaleString(locale)}</strong></div><div className="rounded-xl border" style={metaInset}><span className="block text-xs text-slate-500">{t('catalog.duration')}</span><strong>{item.duration} min</strong></div><div className="rounded-xl border" style={metaInset}><span className="block text-xs text-slate-500">{t('catalog.launchScope')}</span><strong>{serviceReady?.scope_enabled ? `${serviceReady.category_name} · ${serviceReady.location_name}` : t('catalog.approvalRequired')}</strong></div></div><ProviderServiceReachControl serviceId={item.id} serviceName={item.name} /><div style={actionRowStyle}><Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => openEdit(item)}>{t('common.edit')}</Button>{item.status !== 'active' ? <Button type="button" style={actionButtonStyle} disabled={!serviceReady?.launch_ready} title={!serviceReady?.launch_ready ? 'Complete Provider Setup and trust requirements before activation' : undefined} onClick={() => void setStatus(item.id, 'active')}>{t('catalog.activate')}</Button> : null}{item.status === 'active' ? <Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => void setStatus(item.id, 'paused')}>{t('catalog.pause')}</Button> : null}{item.status !== 'draft' ? <Button type="button" variant="secondary" style={outlinedActionStyle} onClick={() => void setStatus(item.id, 'draft')}>{t('catalog.moveDraft')}</Button> : null}{!serviceReady?.launch_ready && item.status !== 'active' ? <Link href="/provider/setup" className="text-link">{t('catalog.finishSetup')}</Link> : null}</div></div></Card>; })}</div>

    {!loading && !error && !visibleItems.length ? <Card><div style={cardInset} className="text-center"><h2 className="text-xl font-semibold">{t('catalog.noServicesState')}</h2><p className="mt-2 text-sm text-slate-600">{t('catalog.noServicesStateHelp')}</p></div></Card> : null}
  </LiveProviderShell>;
}
