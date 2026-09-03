'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Select, Textarea } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type RequirementAction = Exclude<RequirementStatus, 'awarded'>;
type BudgetType = 'fixed' | 'range' | 'negotiable';
type ServiceMode = 'onsite' | 'remote' | 'either';
type SchedulePattern = 'one_time' | 'recurring';
type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';
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
  preferred_start_time: string | null;
  expected_duration_minutes: number | null;
  schedule_pattern: SchedulePattern;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number | null;
  recurrence_count: number | null;
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

export default function CustomerRequirementsManager() {
  const { locale, t, status } = useOperationalTranslations();
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
  const [preferredStartTime, setPreferredStartTime] = useState('');
  const [expectedDurationHours, setExpectedDurationHours] = useState('');
  const [schedulePattern, setSchedulePattern] = useState<SchedulePattern>('one_time');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceCount, setRecurrenceCount] = useState('4');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tamil = locale.toLowerCase().startsWith('ta');
  const preferredTimeLabel = tamil ? 'விருப்பமான தொடக்க நேரம் (விருப்பம்)' : 'Preferred start time (optional)';
  const durationLabel = tamil ? 'எதிர்பார்க்கப்படும் நேரம் — மணிநேரம் (விருப்பம்)' : 'Expected duration — hours (optional)';
  const timeBadgeLabel = tamil ? 'தொடக்க நேரம்' : 'Start';
  const durationBadgeLabel = tamil ? 'கால அளவு' : 'Duration';
  const scheduleLabel = tamil ? 'சேவை அட்டவணை' : 'Service schedule';
  const oneTimeLabel = tamil ? 'ஒருமுறை' : 'One-time';
  const recurringLabel = tamil ? 'மீண்டும் நடைபெறும்' : 'Recurring';
  const recurrenceFrequencyLabel = tamil ? 'மீளும் அடிக்கடி' : 'Repeat frequency';
  const intervalLabel = tamil ? 'ஒவ்வொரு' : 'Every';
  const occurrenceCountLabel = tamil ? 'மொத்த சேவை எண்ணிக்கை' : 'Number of occurrences';
  const recurrenceBadgeLabel = tamil ? 'மீளும் சேவை' : 'Recurring';

  const budgetLabel = (row: Requirement) => {
    if (row.budget_type === 'negotiable') return t('req.budgetNegotiable');
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: row.currency, maximumFractionDigits: 0 });
    if (row.budget_type === 'fixed') return formatter.format((row.budget_min_minor ?? 0) / 100);
    return `${formatter.format((row.budget_min_minor ?? 0) / 100)} – ${formatter.format((row.budget_max_minor ?? 0) / 100)}`;
  };
  const modeLabel = (value: ServiceMode) => value === 'onsite' ? t('req.onsite') : value === 'remote' ? t('req.remote') : t('req.either');
  const durationLabelFor = (minutes: number) => {
    if (minutes % 1440 === 0) return `${minutes / 1440} ${tamil ? 'நாள்' : minutes === 1440 ? 'day' : 'days'}`;
    if (minutes % 60 === 0) return `${minutes / 60} ${tamil ? 'மணி' : minutes === 60 ? 'hour' : 'hours'}`;
    return `${minutes} ${tamil ? 'நிமிடம்' : 'min'}`;
  };
  const frequencyLabel = (value: RecurrenceFrequency) => value === 'daily' ? (tamil ? 'தினமும்' : 'day') : value === 'weekly' ? (tamil ? 'வாரம்' : 'week') : (tamil ? 'மாதம்' : 'month');
  const recurrenceLabelFor = (row: Requirement) => {
    if (row.schedule_pattern !== 'recurring' || !row.recurrence_frequency || !row.recurrence_interval || !row.recurrence_count) return oneTimeLabel;
    const every = row.recurrence_interval === 1 ? frequencyLabel(row.recurrence_frequency) : `${row.recurrence_interval} ${frequencyLabel(row.recurrence_frequency)}${!tamil ? 's' : ''}`;
    return `${recurrenceBadgeLabel}: ${tamil ? 'ஒவ்வொரு' : 'every'} ${every} × ${row.recurrence_count}`;
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [catalogResponse, requirementResponse] = await Promise.all([
        fetch('/api/requirements/catalog', { cache: 'no-store' }),
        fetch('/api/requirements', { cache: 'no-store' }),
      ]);
      const catalogPayload = await catalogResponse.json() as Catalog & { error?: string };
      const requirementPayload = await requirementResponse.json() as { requirements?: Requirement[]; error?: string };
      if (!catalogResponse.ok) throw new Error(catalogPayload.error || 'Requirements could not be loaded.');
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
    setBudgetMin(''); setBudgetMax(''); setCurrency('INR'); setNeededBy(''); setPreferredStartTime(''); setExpectedDurationHours('');
    setSchedulePattern('one_time'); setRecurrenceFrequency('weekly'); setRecurrenceInterval('1'); setRecurrenceCount('4');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const minMinor = budgetType === 'negotiable' ? null : toMinor(budgetMin);
      const maxMinor = budgetType === 'negotiable' ? null : budgetType === 'fixed' ? minMinor : toMinor(budgetMax);
      if (budgetType !== 'negotiable' && minMinor == null) throw new Error(t('req.validBudget'));
      if (budgetType === 'range' && (maxMinor == null || maxMinor < (minMinor ?? 0))) throw new Error(t('req.validRange'));
      if (preferredStartTime && !neededBy) throw new Error(tamil ? 'தொடக்க நேரத்தை தேர்வு செய்தால் தேவைப்படும் தேதியையும் தேர்வு செய்யுங்கள்.' : 'Choose a needed-by date when you provide a preferred start time.');
      const durationHours = expectedDurationHours ? Number(expectedDurationHours) : null;
      if (durationHours != null && (!Number.isFinite(durationHours) || durationHours < 0.25 || durationHours > 168)) {
        throw new Error(tamil ? 'கால அளவு 0.25 முதல் 168 மணி நேரத்திற்குள் இருக்க வேண்டும்.' : 'Expected duration must be between 0.25 and 168 hours.');
      }
      const durationMinutes = durationHours == null ? null : Math.round(durationHours * 60);
      const interval = schedulePattern === 'recurring' ? Number(recurrenceInterval) : null;
      const count = schedulePattern === 'recurring' ? Number(recurrenceCount) : null;
      if (schedulePattern === 'recurring' && !neededBy) throw new Error(tamil ? 'மீளும் சேவைக்கு முதல் சேவை தேதியை தேர்வு செய்யுங்கள்.' : 'Choose the first service date for a recurring requirement.');
      if (schedulePattern === 'recurring' && (!Number.isInteger(interval) || interval! < 1 || interval! > 12)) throw new Error(tamil ? 'மீளும் இடைவெளி 1 முதல் 12 வரை இருக்க வேண்டும்.' : 'Repeat interval must be between 1 and 12.');
      if (schedulePattern === 'recurring' && (!Number.isInteger(count) || count! < 2 || count! > 365)) throw new Error(tamil ? 'சேவை எண்ணிக்கை 2 முதல் 365 வரை இருக்க வேண்டும்.' : 'Occurrence count must be between 2 and 365.');

      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(), category_id: categoryId, location_id: locationId,
          title, description, service_mode: serviceMode, budget_type: budgetType,
          budget_min_minor: minMinor, budget_max_minor: maxMinor, currency, needed_by: neededBy || null,
          preferred_start_time: preferredStartTime || null, expected_duration_minutes: durationMinutes,
          schedule_pattern: schedulePattern,
          recurrence_frequency: schedulePattern === 'recurring' ? recurrenceFrequency : null,
          recurrence_interval: interval,
          recurrence_count: count,
        }),
      });
      const payload = await response.json() as { requirement?: Requirement; error?: string };
      if (!response.ok || !payload.requirement) throw new Error(payload.error || t('req.postFailed'));
      setRequirements((current) => [payload.requirement!, ...current.filter((row) => row.id !== payload.requirement!.id)]);
      resetForm();
      setNotice(`${payload.requirement.reference} ${t('req.nowOpen')}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('req.postFailed'));
    } finally { setSubmitting(false); }
  };

  const updateStatus = async (requirementId: string, nextStatus: RequirementAction) => {
    if (actionId) return;
    setActionId(requirementId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json() as { requirement?: { id: string; status: RequirementStatus; closed_at?: string | null; updated_at?: string }; error?: string };
      if (!response.ok || !payload.requirement) throw new Error(payload.error || t('req.updateFailedFallback'));
      setRequirements((current) => current.map((row) => row.id === requirementId ? { ...row, status: payload.requirement!.status, closed_at: payload.requirement!.closed_at ?? null, updated_at: payload.requirement!.updated_at ?? row.updated_at } : row));
      setNotice(`${t('req.marked')}: ${status(nextStatus)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('req.updateFailedFallback'));
    } finally { setActionId(''); }
  };

  return <div style={{ display: 'grid', gap: '1.25rem' }}>
    <section>
      <span className="eyebrow">{t('req.marketplace')}</span>
      <h1>{t('req.postNeed')}</h1>
      <p className="detail-copy">{t('req.intro')}</p>
    </section>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {notice ? <Card><p role="status">{notice}</p></Card> : null}

    <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">{t('req.new')}</span><h2>{t('req.tell')}</h2></div><Badge tone="info">{t('req.customerPost')}</Badge></div>
      <form onSubmit={submit} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <Select label={t('req.serviceCategory')} required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={loading || !catalog.categories.length}>
          {catalog.categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select>
        <Select label={t('req.city')} required value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={loading || !catalog.locations.length}>
          {catalog.locations.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select>
        <Input label={t('req.title')} required minLength={8} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('req.titlePlaceholder')} />
        <Textarea label={t('req.describe')} required minLength={30} maxLength={3000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('req.describePlaceholder')} />
        <Select label={t('req.serviceMode')} value={serviceMode} onChange={(event) => setServiceMode(event.target.value as ServiceMode)}>
          <option value="onsite">{t('req.onsite')}</option><option value="remote">{t('req.remote')}</option><option value="either">{t('req.either')}</option>
        </Select>
        <Select label={t('req.budgetPreference')} value={budgetType} onChange={(event) => setBudgetType(event.target.value as BudgetType)}>
          <option value="negotiable">{t('req.negotiable')}</option><option value="fixed">{t('req.fixedBudget')}</option><option value="range">{t('req.budgetRange')}</option>
        </Select>
        {budgetType !== 'negotiable' ? <div style={{ display: 'grid', gridTemplateColumns: budgetType === 'range' ? '1fr 1fr' : '1fr', gap: '1rem' }}>
          <Input label={budgetType === 'fixed' ? t('req.budgetAmount') : t('req.minimumBudget')} type="number" min="1" step="1" required value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} />
          {budgetType === 'range' ? <Input label={t('req.maximumBudget')} type="number" min="1" step="1" required value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} /> : null}
        </div> : null}
        <Select label={t('req.currency')} value={currency} onChange={(event) => setCurrency(event.target.value as 'INR' | 'USD')}><option value="INR">INR</option><option value="USD">USD</option></Select>
        <Select label={scheduleLabel} value={schedulePattern} onChange={(event) => setSchedulePattern(event.target.value as SchedulePattern)}>
          <option value="one_time">{oneTimeLabel}</option><option value="recurring">{recurringLabel}</option>
        </Select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <Input label={schedulePattern === 'recurring' ? (tamil ? 'முதல் சேவை தேதி' : 'First service date') : t('req.neededOptional')} type="date" min={today} required={schedulePattern === 'recurring'} value={neededBy} onChange={(event) => { setNeededBy(event.target.value); if (!event.target.value) setPreferredStartTime(''); }} />
          <Input label={preferredTimeLabel} type="time" value={preferredStartTime} onChange={(event) => setPreferredStartTime(event.target.value)} disabled={!neededBy} />
          <Input label={durationLabel} type="number" min="0.25" max="168" step="0.25" value={expectedDurationHours} onChange={(event) => setExpectedDurationHours(event.target.value)} placeholder="10" />
        </div>
        {schedulePattern === 'recurring' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <Select label={recurrenceFrequencyLabel} value={recurrenceFrequency} onChange={(event) => setRecurrenceFrequency(event.target.value as RecurrenceFrequency)}>
            <option value="daily">{tamil ? 'தினசரி' : 'Daily'}</option><option value="weekly">{tamil ? 'வாரந்தோறும்' : 'Weekly'}</option><option value="monthly">{tamil ? 'மாதந்தோறும்' : 'Monthly'}</option>
          </Select>
          <Input label={intervalLabel} type="number" min="1" max="12" step="1" required value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} />
          <Input label={occurrenceCountLabel} type="number" min="2" max="365" step="1" required value={recurrenceCount} onChange={(event) => setRecurrenceCount(event.target.value)} />
        </div> : null}
        <Button type="submit" loading={submitting} disabled={loading || !categoryId || !locationId}>{t('req.post')}</Button>
      </form>
    </Card>

    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">{t('req.my')}</span><h2>{t('req.manage')}</h2></div><Badge tone="neutral">{requirements.length}</Badge></div>
      {loading ? <Card><p>{t('req.loading')}</p></Card> : null}
      {!loading && requirements.length === 0 ? <Card><h3>{t('req.none')}</h3><p className="detail-copy">{t('req.noneHelp')}</p></Card> : null}
      {requirements.map((row) => <Card key={row.id} className="policy-card">
        <div className="section-heading">
          <div><span className="eyebrow">{row.reference}</span><h3>{row.title}</h3></div>
          <Badge tone={statusTone(row.status)}>{status(row.status)}</Badge>
        </div>
        <p className="detail-copy">{row.description}</p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.75rem 0' }}>
          <Badge tone="neutral">{row.category_name || t('common.service')}</Badge><Badge tone="neutral">{row.location_name || t('common.location')}</Badge><Badge tone="neutral">{modeLabel(row.service_mode)}</Badge><Badge tone="neutral">{budgetLabel(row)}</Badge>
          {row.needed_by ? <Badge tone="neutral">{t('common.neededBy')} {row.needed_by}</Badge> : null}
          {row.preferred_start_time ? <Badge tone="neutral">{timeBadgeLabel} {row.preferred_start_time.slice(0, 5)}</Badge> : null}
          {row.expected_duration_minutes ? <Badge tone="neutral">{durationBadgeLabel} {durationLabelFor(row.expected_duration_minutes)}</Badge> : null}
          <Badge tone={row.schedule_pattern === 'recurring' ? 'info' : 'neutral'}>{recurrenceLabelFor(row)}</Badge>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <Link className="button button-secondary" href={`/requirements/${encodeURIComponent(row.id)}`}>{t('req.viewDetails')}</Link>
          {row.status === 'open' ? <Button type="button" variant="quiet" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'paused')}>{t('req.pause')}</Button> : null}
          {row.status === 'paused' ? <Button type="button" variant="secondary" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'open')}>{t('req.reopen')}</Button> : null}
          {['open','paused'].includes(row.status) ? <Button type="button" variant="secondary" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'fulfilled')}>{t('req.markFulfilled')}</Button> : null}
          {row.status === 'awarded' ? <span className="summary-note">{t('req.awardedHelp')}</span> : null}
          {['open','paused','awarded'].includes(row.status) ? <Button type="button" variant="danger" disabled={actionId === row.id} onClick={() => void updateStatus(row.id, 'cancelled')}>{t('common.cancel')}</Button> : null}
        </div>
      </Card>)}
    </section>
  </div>;
}