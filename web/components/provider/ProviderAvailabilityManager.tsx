'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type Mode = 'always_available' | 'on_request' | 'scheduled';
type Service = { id: string; name: string; status: 'draft' | 'active' | 'paused' };
type WindowRow = { day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6; start_time: string; end_time: string };
type Blackout = { starts_at: string; ends_at: string; reason?: string };
type Availability = { service_id: string; mode: Mode; timezone: string; weekly_windows: WindowRow[]; blackout_periods: Blackout[] };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const sectionPad = { padding: '22px' };
const dayPad = { padding: '18px 20px' };

export function ProviderAvailabilityManager() {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState('');
  const [blackoutMessage, setBlackoutMessage] = useState('');
  const [blackoutDraft, setBlackoutDraft] = useState<Blackout>({ starts_at: '', ends_at: '', reason: '' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/provider/services', { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load provider services.');
        const mapped = (body.services ?? []).map((service: Record<string, unknown>) => ({ id: String(service.id), name: String(service.name), status: service.status as Service['status'] }));
        if (cancelled) return;
        setServices(mapped);
        setSelectedServiceId(mapped[0]?.id ?? '');
        setMessage(mapped.length ? t('availability.connected') : t('availability.noneConfigured'));
      } catch (error) {
        if (cancelled) return;
        setServices([]); setSelectedServiceId(''); setSaveState('error');
        setMessage(error instanceof Error ? error.message : 'Unable to load provider services.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setSaveState('idle'); setBlackoutMessage('');
    if (!selectedServiceId) { setAvailability(null); return () => { cancelled = true; }; }
    void (async () => {
      try {
        const response = await fetch(`/api/provider/services/${selectedServiceId}/availability`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load availability.');
        if (!cancelled) setAvailability(body.availability as Availability);
      } catch (error) {
        if (!cancelled) { setAvailability(null); setSaveState('error'); setMessage(error instanceof Error ? error.message : 'Unable to load availability.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedServiceId]);

  const selectedService = useMemo(() => services.find((service) => service.id === selectedServiceId), [services, selectedServiceId]);
  const windowsByDay = useMemo(() => {
    const groups = new Map<number, Array<{ row: WindowRow; index: number }>>();
    for (let day = 0; day < 7; day += 1) groups.set(day, []);
    (availability?.weekly_windows ?? []).forEach((row, index) => groups.get(row.day_of_week)?.push({ row, index }));
    return groups;
  }, [availability]);

  const markChanged = () => setSaveState('idle');
  const addWindow = (day: number) => { if (!availability) return; markChanged(); setAvailability({ ...availability, weekly_windows: [...availability.weekly_windows, { day_of_week: day as WindowRow['day_of_week'], start_time: '09:00', end_time: '17:00' }] }); };
  const updateWindow = (index: number, patch: Partial<WindowRow>) => { if (!availability) return; markChanged(); setAvailability({ ...availability, weekly_windows: availability.weekly_windows.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row) }); };
  const removeWindow = (index: number) => { if (!availability) return; markChanged(); setAvailability({ ...availability, weekly_windows: availability.weekly_windows.filter((_, currentIndex) => currentIndex !== index) }); };
  const updateBlackoutDraft = (patch: Partial<Blackout>) => { setBlackoutMessage(''); setBlackoutDraft((current) => ({ ...current, ...patch })); };

  const addBlackout = () => {
    if (!availability) return;
    if (!blackoutDraft.starts_at || !blackoutDraft.ends_at) { const msg = t('availability.chooseStartEnd'); setSaveState('error'); setMessage(msg); setBlackoutMessage(msg); return; }
    if (new Date(blackoutDraft.ends_at) <= new Date(blackoutDraft.starts_at)) { const msg = t('availability.endAfterStart'); setSaveState('error'); setMessage(msg); setBlackoutMessage(msg); return; }
    markChanged(); setBlackoutMessage('');
    setAvailability({ ...availability, blackout_periods: [...availability.blackout_periods, blackoutDraft] });
    setBlackoutDraft({ starts_at: '', ends_at: '', reason: '' });
    setMessage(t('availability.blackoutAdded'));
  };

  const save = async () => {
    if (!availability) return;
    setSaving(true); setSaveState('saving'); setMessage(t('availability.saving'));
    try {
      const response = await fetch(`/api/provider/services/${availability.service_id}/availability`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(availability) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save availability.');
      setAvailability(body.availability as Availability); setSaveState('saved'); setMessage(t('availability.saved'));
    } catch (error) { setSaveState('error'); setMessage(error instanceof Error ? error.message : 'Unable to save availability.'); }
    finally { setSaving(false); }
  };

  const serviceStatus = (status: Service['status']) => status === 'active' ? t('common.active') : status === 'paused' ? t('common.paused') : t('common.draft');
  const dayLabels = [t('day.0'), t('day.1'), t('day.2'), t('day.3'), t('day.4'), t('day.5'), t('day.6')];

  return <LiveProviderShell active="/provider/schedule">
    <ProviderHeading eyebrow={t('availability.eyebrow')} title={t('availability.title')} description={t('availability.intro')} action={<Button type="button" onClick={() => void save()} disabled={!availability || saving}>{saving ? t('common.saving') : saveState === 'saved' ? t('common.saved') : t('availability.save')}</Button>} />

    {message ? <div style={{ padding: '14px 16px', marginBottom: '20px' }} className={`rounded-xl border text-sm ${saveState === 'error' ? 'border-red-200 bg-red-50 text-red-700' : saveState === 'saved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`} role="status">{message}</div> : null}

    <Card className="mb-6 overflow-hidden"><div style={sectionPad} className="grid gap-5 md:grid-cols-2">
      <Select label={t('availability.service')} value={selectedServiceId} onChange={(event) => { setSelectedServiceId(event.target.value); markChanged(); }} disabled={loading || !services.length}>
        {!services.length ? <option value="">{loading ? t('availability.loadingServices') : t('availability.noServices')}</option> : null}
        {services.map((service) => <option value={service.id} key={service.id}>{service.name} · {serviceStatus(service.status)}</option>)}
      </Select>
      <Select label={t('availability.mode')} value={availability?.mode ?? 'on_request'} onChange={(event) => { if (!availability) return; markChanged(); setAvailability({ ...availability, mode: event.target.value as Mode }); }} disabled={!availability}>
        <option value="always_available">{t('availability.always')}</option><option value="on_request">{t('availability.onRequest')}</option><option value="scheduled">{t('availability.scheduled')}</option>
      </Select>
      <Input label={t('availability.timezone')} value={availability?.timezone ?? 'Asia/Kolkata'} onChange={(event) => { if (!availability) return; markChanged(); setAvailability({ ...availability, timezone: event.target.value }); }} disabled={!availability} />
      <div style={{ padding: '16px 18px' }} className="rounded-xl border"><span className="block text-xs text-slate-500">{t('availability.selectedService')}</span><strong className="mt-1 block break-words">{selectedService?.name ?? t('availability.chooseService')}</strong><span className="mt-1 block break-words text-sm leading-6 text-slate-500">{t('availability.perService')}</span></div>
    </div></Card>

    {availability?.mode === 'scheduled' ? <Card className="mb-6 overflow-hidden"><div style={sectionPad}>
      <div style={{ marginBottom: '18px' }}><span className="eyebrow">{t('availability.weekly')}</span><h2 className="mt-2 text-xl font-semibold">{t('availability.windows')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('availability.windowsHelp')}</p></div>
      <div className="grid gap-4">{dayLabels.map((day, dayIndex) => <div className="rounded-xl border overflow-hidden" style={dayPad} key={dayIndex}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><strong>{day}</strong><Button type="button" variant="secondary" onClick={() => addWindow(dayIndex)}>{t('availability.addWindow')}</Button></div>
        {(windowsByDay.get(dayIndex) ?? []).length ? <div className="grid gap-4">{(windowsByDay.get(dayIndex) ?? []).map(({ row, index }) => <div style={{ paddingTop: '4px' }} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={`${dayIndex}-${index}`}>
          <Input label={t('availability.start')} type="time" value={row.start_time.slice(0, 5)} onChange={(event) => updateWindow(index, { start_time: event.target.value })} />
          <Input label={t('availability.end')} type="time" value={row.end_time.slice(0, 5)} onChange={(event) => updateWindow(index, { end_time: event.target.value })} />
          <Button type="button" variant="quiet" onClick={() => removeWindow(index)}>{t('common.remove')}</Button>
        </div>)}</div> : <p className="text-sm leading-6 text-slate-500">{t('availability.unavailableDay')}</p>}
      </div>)}</div>
    </div></Card> : null}

    <Card className="overflow-hidden"><div style={sectionPad}>
      <div style={{ marginBottom: '18px' }}><span className="eyebrow">{t('availability.blockedPeriods')}</span><h2 className="mt-2 text-xl font-semibold">{t('availability.blackouts')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('availability.blackoutsHelp')}</p></div>
      <div className="grid gap-4 md:grid-cols-3"><Input label={t('availability.starts')} type="datetime-local" value={blackoutDraft.starts_at} onChange={(event) => updateBlackoutDraft({ starts_at: event.target.value })} /><Input label={t('availability.ends')} type="datetime-local" value={blackoutDraft.ends_at} onChange={(event) => updateBlackoutDraft({ ends_at: event.target.value })} /><Input label={t('availability.reason')} value={blackoutDraft.reason ?? ''} onChange={(event) => updateBlackoutDraft({ reason: event.target.value })} /></div>
      <div style={{ marginTop: '16px' }}><Button type="button" variant="secondary" onClick={addBlackout} disabled={!availability}>{t('availability.addBlackout')}</Button></div>
      {blackoutMessage ? <div style={{ marginTop: '12px', padding: '12px 14px' }} className="rounded-xl border border-red-200 bg-red-50 text-sm leading-6 text-red-700" role="alert" aria-live="polite">{blackoutMessage}</div> : null}
      {availability?.blackout_periods.length ? <div className="mt-5 grid gap-3">{availability.blackout_periods.map((item, index) => <div style={{ padding: '16px 18px' }} className="flex flex-col gap-3 rounded-xl border sm:flex-row sm:items-center sm:justify-between" key={`${item.starts_at}-${index}`}>
        <div className="min-w-0"><strong className="break-words">{new Date(item.starts_at).toLocaleString(locale)}</strong><span className="block break-words text-sm leading-6 text-slate-500">{t('availability.to')} {new Date(item.ends_at).toLocaleString(locale)} · {item.reason || t('availability.blocked')}</span></div>
        <Button type="button" variant="quiet" onClick={() => { if (!availability) return; markChanged(); setAvailability({ ...availability, blackout_periods: availability.blackout_periods.filter((_, currentIndex) => currentIndex !== index) }); }}>{t('common.remove')}</Button>
      </div>)}</div> : <p className="mt-5 text-sm text-slate-500">{t('availability.noBlocked')}</p>}
    </div></Card>
  </LiveProviderShell>;
}
