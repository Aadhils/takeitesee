'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select } from '../ui/primitives';
import { ProviderHeading, ProviderShell } from './ProviderPresentation';

type Mode = 'always_available' | 'on_request' | 'scheduled';
type Service = { id: string; name: string; status: 'draft' | 'active' | 'paused' };
type WindowRow = { day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6; start_time: string; end_time: string };
type Blackout = { starts_at: string; ends_at: string; reason?: string };
type Availability = { service_id: string; mode: Mode; timezone: string; weekly_windows: WindowRow[]; blackout_periods: Blackout[] };

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const emptyAvailability = (serviceId: string): Availability => ({ service_id: serviceId, mode: 'on_request', timezone: 'Asia/Kolkata', weekly_windows: [], blackout_periods: [] });

export function ProviderAvailabilityManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [blackoutDraft, setBlackoutDraft] = useState<Blackout>({ starts_at: '', ends_at: '', reason: '' });

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/provider/services', { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load services.');
        const mapped = (body.services ?? []).map((service: Record<string, unknown>) => ({ id: String(service.id), name: String(service.name), status: service.status as Service['status'] }));
        setServices(mapped);
        if (mapped[0]) setSelectedServiceId(mapped[0].id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to load services.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedServiceId) { setAvailability(null); return; }
    void (async () => {
      setMessage('');
      try {
        const response = await fetch(`/api/provider/services/${selectedServiceId}/availability`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load availability.');
        setAvailability(body.availability as Availability);
      } catch (error) {
        setAvailability(emptyAvailability(selectedServiceId));
        setMessage(error instanceof Error ? error.message : 'Availability is not configured yet.');
      }
    })();
  }, [selectedServiceId]);

  const selectedService = useMemo(() => services.find((service) => service.id === selectedServiceId), [services, selectedServiceId]);
  const windowsByDay = useMemo(() => {
    const groups = new Map<number, WindowRow[]>();
    for (let day = 0; day < 7; day += 1) groups.set(day, []);
    for (const row of availability?.weekly_windows ?? []) groups.get(row.day_of_week)?.push(row);
    return groups;
  }, [availability]);

  const addWindow = (day: number) => {
    if (!availability) return;
    setAvailability({ ...availability, weekly_windows: [...availability.weekly_windows, { day_of_week: day as WindowRow['day_of_week'], start_time: '09:00', end_time: '17:00' }] });
  };
  const updateWindow = (index: number, patch: Partial<WindowRow>) => {
    if (!availability) return;
    setAvailability({ ...availability, weekly_windows: availability.weekly_windows.map((row, i) => i === index ? { ...row, ...patch } : row) });
  };
  const removeWindow = (index: number) => {
    if (!availability) return;
    setAvailability({ ...availability, weekly_windows: availability.weekly_windows.filter((_, i) => i !== index) });
  };
  const addBlackout = () => {
    if (!availability || !blackoutDraft.starts_at || !blackoutDraft.ends_at) return;
    setAvailability({ ...availability, blackout_periods: [...availability.blackout_periods, blackoutDraft] });
    setBlackoutDraft({ starts_at: '', ends_at: '', reason: '' });
  };
  const save = async () => {
    if (!availability) return;
    setSaving(true); setMessage('');
    try {
      const response = await fetch(`/api/provider/services/${availability.service_id}/availability`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(availability) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save availability.');
      setAvailability(body.availability as Availability);
      setMessage('Availability saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save availability.');
    } finally { setSaving(false); }
  };

  return <ProviderShell active="/provider/schedule">
    <ProviderHeading eyebrow="Availability" title="Schedule" description="Set when each service can be booked, define weekly working windows, and block unavailable periods." action={<Button type="button" onClick={save} disabled={!availability || saving}>{saving ? 'Saving…' : 'Save availability'}</Button>} />

    <Card className="mb-6"><div style={{ padding: 24 }} className="grid gap-5 md:grid-cols-2">
      <Select label="Service" value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} disabled={loading || !services.length}>
        {!services.length ? <option value="">{loading ? 'Loading services…' : 'No services available'}</option> : null}
        {services.map((service) => <option value={service.id} key={service.id}>{service.name} · {service.status}</option>)}
      </Select>
      <Select label="Availability mode" value={availability?.mode ?? 'on_request'} onChange={(event) => availability && setAvailability({ ...availability, mode: event.target.value as Mode })} disabled={!availability}>
        <option value="always_available">Always available</option><option value="on_request">On request</option><option value="scheduled">Scheduled hours</option>
      </Select>
      <Input label="Timezone" value={availability?.timezone ?? 'Asia/Kolkata'} onChange={(event) => availability && setAvailability({ ...availability, timezone: event.target.value })} disabled={!availability} />
      <div className="rounded-xl border p-4"><span className="block text-xs text-slate-500">Selected service</span><strong className="mt-1 block">{selectedService?.name ?? 'Choose a service'}</strong><span className="mt-1 block text-sm text-slate-500">Availability is saved separately for every service.</span></div>
    </div></Card>

    {availability?.mode === 'scheduled' ? <Card className="mb-6"><div style={{ padding: 24 }}><div className="mb-5"><span className="eyebrow">Weekly hours</span><h2 className="mt-2 text-xl font-semibold">Working windows</h2><p className="mt-2 text-sm text-slate-600">Add one or more bookable time ranges for each day.</p></div><div className="grid gap-4">{days.map((day, dayIndex) => <div className="rounded-xl border p-4" key={day}><div className="mb-3 flex items-center justify-between gap-3"><strong>{day}</strong><Button type="button" variant="secondary" onClick={() => addWindow(dayIndex)}>Add window</Button></div>{(windowsByDay.get(dayIndex) ?? []).length ? <div className="grid gap-3">{availability.weekly_windows.map((row, index) => row.day_of_week === dayIndex ? <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={`${dayIndex}-${index}`}><Input label="Start" type="time" value={row.start_time.slice(0, 5)} onChange={(event) => updateWindow(index, { start_time: event.target.value })} /><Input label="End" type="time" value={row.end_time.slice(0, 5)} onChange={(event) => updateWindow(index, { end_time: event.target.value })} /><Button type="button" variant="quiet" onClick={() => removeWindow(index)}>Remove</Button></div> : null)}</div> : <p className="text-sm text-slate-500">Unavailable on this day.</p>}</div>)}</div></div></Card> : null}

    <Card><div style={{ padding: 24 }}><div className="mb-5"><span className="eyebrow">Blocked periods</span><h2 className="mt-2 text-xl font-semibold">Blackouts</h2><p className="mt-2 text-sm text-slate-600">Block holidays, leave, or any period that should not accept bookings.</p></div><div className="grid gap-4 md:grid-cols-3"><Input label="Starts" type="datetime-local" value={blackoutDraft.starts_at} onChange={(event) => setBlackoutDraft((current) => ({ ...current, starts_at: event.target.value }))} /><Input label="Ends" type="datetime-local" value={blackoutDraft.ends_at} onChange={(event) => setBlackoutDraft((current) => ({ ...current, ends_at: event.target.value }))} /><Input label="Reason" value={blackoutDraft.reason ?? ''} onChange={(event) => setBlackoutDraft((current) => ({ ...current, reason: event.target.value }))} /></div><div className="mt-3"><Button type="button" variant="secondary" onClick={addBlackout}>Add blackout</Button></div>{availability?.blackout_periods.length ? <div className="mt-5 grid gap-3">{availability.blackout_periods.map((item, index) => <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" key={`${item.starts_at}-${index}`}><div><strong>{new Date(item.starts_at).toLocaleString()}</strong><span className="block text-sm text-slate-500">to {new Date(item.ends_at).toLocaleString()} · {item.reason || 'Blocked'}</span></div><Button type="button" variant="quiet" onClick={() => setAvailability({ ...availability, blackout_periods: availability.blackout_periods.filter((_, i) => i !== index) })}>Remove</Button></div>)}</div> : <p className="mt-5 text-sm text-slate-500">No blocked periods configured.</p>}</div></Card>

    {message ? <p className="provider-fixture-note mt-4">{message}</p> : null}
  </ProviderShell>;
}
