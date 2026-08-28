'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type Mode = 'always_available' | 'on_request' | 'scheduled';
type Service = { id: string; name: string; status: 'draft' | 'active' | 'paused' };
type WindowRow = { day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6; start_time: string; end_time: string };
type Blackout = { starts_at: string; ends_at: string; reason?: string };
type Availability = { service_id: string; mode: Mode; timezone: string; weekly_windows: WindowRow[]; blackout_periods: Blackout[] };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const sectionPad = { padding: '22px' };
const dayPad = { padding: '18px 20px' };

export function ProviderAvailabilityManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState('');
  const [blackoutDraft, setBlackoutDraft] = useState<Blackout>({ starts_at: '', ends_at: '', reason: '' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/provider/services', { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load provider services.');
        const mapped = (body.services ?? []).map((service: Record<string, unknown>) => ({
          id: String(service.id),
          name: String(service.name),
          status: service.status as Service['status'],
        }));
        if (cancelled) return;
        setServices(mapped);
        setSelectedServiceId(mapped[0]?.id ?? '');
        setMessage(mapped.length ? 'Live provider services connected.' : 'No provider services are configured yet.');
      } catch (error) {
        if (cancelled) return;
        setServices([]);
        setSelectedServiceId('');
        setSaveState('error');
        setMessage(error instanceof Error ? error.message : 'Unable to load provider services.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSaveState('idle');
    if (!selectedServiceId) {
      setAvailability(null);
      return () => { cancelled = true; };
    }

    void (async () => {
      try {
        const response = await fetch(`/api/provider/services/${selectedServiceId}/availability`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load availability.');
        if (!cancelled) setAvailability(body.availability as Availability);
      } catch (error) {
        if (!cancelled) {
          setAvailability(null);
          setSaveState('error');
          setMessage(error instanceof Error ? error.message : 'Unable to load availability.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedServiceId]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId),
    [services, selectedServiceId],
  );

  const windowsByDay = useMemo(() => {
    const groups = new Map<number, Array<{ row: WindowRow; index: number }>>();
    for (let day = 0; day < 7; day += 1) groups.set(day, []);
    (availability?.weekly_windows ?? []).forEach((row, index) => groups.get(row.day_of_week)?.push({ row, index }));
    return groups;
  }, [availability]);

  const markChanged = () => setSaveState('idle');

  const addWindow = (day: number) => {
    if (!availability) return;
    markChanged();
    setAvailability({
      ...availability,
      weekly_windows: [
        ...availability.weekly_windows,
        { day_of_week: day as WindowRow['day_of_week'], start_time: '09:00', end_time: '17:00' },
      ],
    });
  };

  const updateWindow = (index: number, patch: Partial<WindowRow>) => {
    if (!availability) return;
    markChanged();
    setAvailability({
      ...availability,
      weekly_windows: availability.weekly_windows.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row),
    });
  };

  const removeWindow = (index: number) => {
    if (!availability) return;
    markChanged();
    setAvailability({ ...availability, weekly_windows: availability.weekly_windows.filter((_, currentIndex) => currentIndex !== index) });
  };

  const addBlackout = () => {
    if (!availability) return;
    if (!blackoutDraft.starts_at || !blackoutDraft.ends_at) {
      setSaveState('error');
      setMessage('Choose both a start and end time for the blackout.');
      return;
    }
    if (new Date(blackoutDraft.ends_at) <= new Date(blackoutDraft.starts_at)) {
      setSaveState('error');
      setMessage('Blackout end time must be after the start time.');
      return;
    }
    markChanged();
    setAvailability({ ...availability, blackout_periods: [...availability.blackout_periods, blackoutDraft] });
    setBlackoutDraft({ starts_at: '', ends_at: '', reason: '' });
    setMessage('Blackout added. Click Save availability to persist it.');
  };

  const save = async () => {
    if (!availability) return;
    setSaving(true);
    setSaveState('saving');
    setMessage('Saving availability…');
    try {
      const response = await fetch(`/api/provider/services/${availability.service_id}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(availability),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save availability.');
      setAvailability(body.availability as Availability);
      setSaveState('saved');
      setMessage('✓ Availability saved successfully.');
    } catch (error) {
      setSaveState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save availability.');
    } finally {
      setSaving(false);
    }
  };

  return <LiveProviderShell active="/provider/schedule">
    <ProviderHeading
      eyebrow="Availability"
      title="Schedule"
      description="Set when each service can be booked, define weekly working windows, and block unavailable periods."
      action={<Button type="button" onClick={() => void save()} disabled={!availability || saving}>{saving ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save availability'}</Button>}
    />

    {message ? <div style={{ padding: '14px 16px', marginBottom: '20px' }} className={`rounded-xl border text-sm ${saveState === 'error' ? 'border-red-200 bg-red-50 text-red-700' : saveState === 'saved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`} role="status">{message}</div> : null}

    <Card className="mb-6 overflow-hidden"><div style={sectionPad} className="grid gap-5 md:grid-cols-2">
      <Select label="Service" value={selectedServiceId} onChange={(event) => { setSelectedServiceId(event.target.value); markChanged(); }} disabled={loading || !services.length}>
        {!services.length ? <option value="">{loading ? 'Loading services…' : 'No services available'}</option> : null}
        {services.map((service) => <option value={service.id} key={service.id}>{service.name} · {service.status}</option>)}
      </Select>
      <Select label="Availability mode" value={availability?.mode ?? 'on_request'} onChange={(event) => { if (!availability) return; markChanged(); setAvailability({ ...availability, mode: event.target.value as Mode }); }} disabled={!availability}>
        <option value="always_available">Always available</option>
        <option value="on_request">On request</option>
        <option value="scheduled">Scheduled hours</option>
      </Select>
      <Input label="Timezone" value={availability?.timezone ?? 'Asia/Kolkata'} onChange={(event) => { if (!availability) return; markChanged(); setAvailability({ ...availability, timezone: event.target.value }); }} disabled={!availability} />
      <div style={{ padding: '16px 18px' }} className="rounded-xl border">
        <span className="block text-xs text-slate-500">Selected service</span>
        <strong className="mt-1 block break-words">{selectedService?.name ?? 'Choose a service'}</strong>
        <span className="mt-1 block break-words text-sm leading-6 text-slate-500">Availability is saved separately for every service in this provider workspace.</span>
      </div>
    </div></Card>

    {availability?.mode === 'scheduled' ? <Card className="mb-6 overflow-hidden"><div style={sectionPad}>
      <div style={{ marginBottom: '18px' }}><span className="eyebrow">Weekly hours</span><h2 className="mt-2 text-xl font-semibold">Working windows</h2><p className="mt-2 text-sm leading-6 text-slate-600">Add one or more bookable time ranges for each day.</p></div>
      <div className="grid gap-4">{days.map((day, dayIndex) => <div className="rounded-xl border overflow-hidden" style={dayPad} key={day}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><strong>{day}</strong><Button type="button" variant="secondary" onClick={() => addWindow(dayIndex)}>Add window</Button></div>
        {(windowsByDay.get(dayIndex) ?? []).length ? <div className="grid gap-4">{(windowsByDay.get(dayIndex) ?? []).map(({ row, index }) => <div style={{ paddingTop: '4px' }} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={`${dayIndex}-${index}`}>
          <Input label="Start" type="time" value={row.start_time.slice(0, 5)} onChange={(event) => updateWindow(index, { start_time: event.target.value })} />
          <Input label="End" type="time" value={row.end_time.slice(0, 5)} onChange={(event) => updateWindow(index, { end_time: event.target.value })} />
          <Button type="button" variant="quiet" onClick={() => removeWindow(index)}>Remove</Button>
        </div>)}</div> : <p className="text-sm leading-6 text-slate-500">Unavailable on this day.</p>}
      </div>)}</div>
    </div></Card> : null}

    <Card className="overflow-hidden"><div style={sectionPad}>
      <div style={{ marginBottom: '18px' }}><span className="eyebrow">Blocked periods</span><h2 className="mt-2 text-xl font-semibold">Blackouts</h2><p className="mt-2 text-sm leading-6 text-slate-600">Block holidays, leave, or any period that should not accept bookings.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="Starts" type="datetime-local" value={blackoutDraft.starts_at} onChange={(event) => setBlackoutDraft((current) => ({ ...current, starts_at: event.target.value }))} />
        <Input label="Ends" type="datetime-local" value={blackoutDraft.ends_at} onChange={(event) => setBlackoutDraft((current) => ({ ...current, ends_at: event.target.value }))} />
        <Input label="Reason" value={blackoutDraft.reason ?? ''} onChange={(event) => setBlackoutDraft((current) => ({ ...current, reason: event.target.value }))} />
      </div>
      <div style={{ marginTop: '16px' }}><Button type="button" variant="secondary" onClick={addBlackout} disabled={!availability}>Add blackout</Button></div>
      {availability?.blackout_periods.length ? <div className="mt-5 grid gap-3">{availability.blackout_periods.map((item, index) => <div style={{ padding: '16px 18px' }} className="flex flex-col gap-3 rounded-xl border sm:flex-row sm:items-center sm:justify-between" key={`${item.starts_at}-${index}`}>
        <div className="min-w-0"><strong className="break-words">{new Date(item.starts_at).toLocaleString()}</strong><span className="block break-words text-sm leading-6 text-slate-500">to {new Date(item.ends_at).toLocaleString()} · {item.reason || 'Blocked'}</span></div>
        <Button type="button" variant="quiet" onClick={() => { if (!availability) return; markChanged(); setAvailability({ ...availability, blackout_periods: availability.blackout_periods.filter((_, currentIndex) => currentIndex !== index) }); }}>Remove</Button>
      </div>)}</div> : <p className="mt-5 text-sm text-slate-500">No blocked periods configured.</p>}
    </div></Card>
  </LiveProviderShell>;
}
