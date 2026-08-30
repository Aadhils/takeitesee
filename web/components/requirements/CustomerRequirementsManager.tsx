'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Select, Textarea } from '../ui/primitives';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type RequirementAction = Exclude<RequirementStatus, 'awarded'>;
type BudgetType = 'fixed' | 'range' | 'negotiable';
type ServiceMode = 'onsite' | 'remote' | 'either';
type Requirement = {
  id: string;
  reference: string;
  category_id: string;
  category_name: string;
  location_id: string;
  location_name: string;
  title: string;
  description: string;
  service_mode: ServiceMode;
  budget_type: BudgetType;
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: 'INR' | 'USD';
  needed_by: string | null;
  status: RequirementStatus;
  published_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
type Catalog = {
  categories: Array<{ id: string; name: string; code: string }>;
  locations: Array<{ id: string; name: string; code: string; timezone?: string | null }>;
};

function statusTone(status: RequirementStatus) {
  if (status === 'open') return 'success' as const;
  if (status === 'paused') return 'warning' as const;
  if (status === 'awarded') return 'info' as const;
  if (status === 'fulfilled') return 'success' as const;
  return 'neutral' as const;
}

function budgetLabel(row: Requirement) {
  if (row.budget_type === 'negotiable') return 'Budget negotiable';
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: row.currency, maximumFractionDigits: 0 });
  if (row.budget_type === 'fixed') return formatter.format((row.budget_min_minor ?? 0) / 100);
  return `${formatter.format((row.budget_min_minor ?? 0) / 100)} – ${formatter.format((row.budget_max_minor ?? 0) / 100)}`;
}

export default function CustomerRequirementsManager() {
  const [catalog, setCatalog] = useState<Catalog>({ categories: [], locations: [] });
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceMode, setServiceMode] = useState<ServiceMode>('onsite');
  const [budgetType, setBudgetType] = useState<BudgetType>('negotiable');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [neededBy, setNeededBy] = useState('');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [catalogResponse, requirementResponse] = await Promise.all([
        fetch('/api/requirements/catalog', { cache: 'no-store' }),
        fetch('/api/requirements', { cache: 'no-store' }),
      ]);
      const catalogPayload = await catalogResponse.json() as Catalog & { error?: string };
      const requirementPayload = await requirementResponse.json() as { requirements?: Requirement[]; error?: string };
      if (!catalogResponse.ok) throw new Error(catalogPayload.error || 'Requirement options could not be loaded.');
      if (!requirementResponse.ok) throw new Error(requirementPayload.error || 'Requirements could not be loaded.');
      setCatalog({ categories: catalogPayload.categories ?? [], locations: catalogPayload.locations ?? [] });
      setRequirements(requirementPayload.requirements ?? []);
      if (!categoryId && catalogPayload.categories?.[0]) setCategoryId(catalogPayload.categories[0].id);
      if (!locationId && catalogPayload.locations?.[0]) setLocationId(catalogPayload.locations[0].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Requirement workspace could not be loaded.');
    } finally { setLoading(false); }
  }, [categoryId, locationId]);

  useEffect(() => { void load(); }, [load]);

  const toMinor = (value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric * 100);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setServiceMode('onsite'); setBudgetType('negotiable');
    setBudgetMin(''); setBudgetMax(''); setCurrency('INR'); setNeededBy('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const minMinor = budgetType === 'negotiable' ? null : toMinor(budgetMin);
      const maxMinor = budgetType === 'negotiable' ? null : budgetType === 'fixed' ? minMinor : toMinor(budgetMax);
      if (budgetType !== 'negotiable' && minMinor == null) throw new Error('Enter a valid positive budget amount.');
      if (budgetType === 'range' && (maxMinor == null || maxMinor < (minMinor ?? 0))) throw new Error('Maximum budget must be at least the minimum budget.');

      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(), category_id: categoryId, location_id: locationId,
          title, description, service_mode: serviceMode, budget_type: budgetType,
          budget_min_minor: minMinor, budget_max_minor: maxMinor, currency, needed_by: neededBy || null,
        }),
      });
      const payload = await response.json() as { requirement?: Requirement; error?: string };
      if (!response.ok || !payload.requirement) throw new Error(payload.error || 'Requirement could not be posted.');
      setRequirements((current) => [payload.requirement!, ...current.filter((row) => row.id !== payload.requirement!.id)]);
      resetForm();
      setNotice(`Requirement ${payload.requirement.reference} is now open.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Requirement could not be posted.');
    } finally { setSubmitting(false); }
  };

  const updateStatus = async (requirementId: string, status: RequirementAction) => {
    if (actionId) return;
    setActionId(requirementId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const payload = await response.json() as { requirement?: { id: string; status: RequirementStatus; closed_at?: string | null; updated_at?: string }; error?: string };
      if (!response.ok || !payload.requirement) throw new Error(payload.error || 'Requirement status could not be updated.');
      setRequirements((current) => current.map((row) => row.id === requirementId ? { ...row, status: payload.requirement!.status, closed_at: payload.requirement!.closed_at ?? null, updated_at: payload.requirement!.updated_at ?? row.updated_at } : row));
      setNotice(`Requirement marked ${status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Requirement status could not be updated.');
    } finally { setActionId(''); }
  };

  return <div style={{ display: 'grid', gap: '1.25rem' }}>
    <section>
      <span className="eyebrow">Requirement marketplace</span>
      <h1>Post what you need</h1>
      <p className="detail-copy">Describe the service you need. Matching verified providers in your approved service category and city can send proposals while your requirement is open.</p>
    </section>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {notice ? <Card><p role="status">{notice}</p></Card> : null}

    <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">New requirement</span><h2>Tell us what service you need</h2></div><Badge tone="info">Customer post</Badge></div>
      <form onSubmit={submit} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <Select label="Service category" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={loading || !catalog.categories.length}>
          {catalog.categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select>
        <Select label="City" required value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={loading || !catalog.locations.length}>
          {catalog.locations.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select>
        <Input label="Requirement title" required minLength={8} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Need plumber for kitchen sink repair" />
        <Textarea label="Describe the work" required minLength={30} maxLength={3000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the problem, scope, access details and anything the provider should know." />
        <Select label="Service mode" value={serviceMode} onChange={(event) => setServiceMode(event.target.value as ServiceMode)}>
          <option value="onsite">On-site</option><option value="remote">Remote</option><option value="either">Either</option>
        </Select>
        <Select label="Budget preference" value={budgetType} onChange={(event) => setBudgetType(event.target.value as BudgetType)}>
          <option value="negotiable">Negotiable</option><option value="fixed">Fixed budget</option><option value="range">Budget range</option>
        </Select>
        {budgetType !== 'negotiable' ? <div style={{ display: 'grid', gridTemplateColumns: budgetType === 'range' ? '1fr 1fr' : '1fr', gap: '1rem' }}>
          <Input label={budgetType === 'fixed' ? 'Budget amount' : 'Minimum budget'} type="number" min="1" step="1" required value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} />
          {budgetType === 'range' ? <Input label="Maximum budget" type="number" min="1" step="1" required value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} /> : null}
        </div> : null}
        <Select label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as 'INR' | 'USD')}><option value="INR">INR</option><option value="USD">USD</option></Select>
        <Input label="Needed by (optional)" type="date" min={today} value={neededBy} onChange={(event) => setNeededBy(event.target.value)} />
        <Button type="submit" loading={submitting} disabled={loading || !categoryId || !locationId}>Post requirement</Button>
      </form>
    </Card>

    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">My requirements</span><h2>Manage your service requests</h2></div><Badge tone="neutral">{requirements.length}</Badge></div>
      {loading ? <Card><p>Loading requirements…</p></Card> : null}
      {!loading && requirements.length === 0 ? <Card><h3>No requirements yet</h3><p className="detail-copy">Post your first requirement above. Matching verified providers can respond with proposals when the requirement is open.</p></Card> : null}
      {requirements.map((row) => <Card key={row.id} className="policy-card">
        <div className="section-heading">
          <div><span className="eyebrow">{row.reference}</span><h3>{row.title}</h3></div>
          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
        </div>
        <p className="detail-copy">{row.description}</p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.75rem 0' }}>
          <Badge tone="neutral">{row.category_name || 'Service'}</Badge><Badge tone="neutral">{row.location_name || 'Location'}</Badge><Badge tone="neutral">{row.service_mode}</Badge><Badge tone="neutral">{budgetLabel(row)}</Badge>
          {row.needed_by ? <Badge tone="neutral">Needed by {row.needed_by}</Badge> : null}
        </div>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <Link className="button button-secondary" href={`/requirements/${encodeURIComponent(row.id)}`}>View details</Link>
          {row.status === 'open' ? <Button type="button" variant="quiet" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'paused')}>Pause proposals</Button> : null}
          {row.status === 'paused' ? <Button type="button" variant="secondary" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'open')}>Reopen proposals</Button> : null}
          {['open','paused','awarded'].includes(row.status) ? <Button type="button" variant="secondary" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'fulfilled')}>{row.status === 'awarded' ? 'Mark fulfilled after service' : 'Mark fulfilled'}</Button> : null}
          {['open','paused','awarded'].includes(row.status) ? <Button type="button" variant="danger" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'cancelled')}>Cancel</Button> : null}
        </div>
      </Card>)}
    </section>
  </div>;
}
