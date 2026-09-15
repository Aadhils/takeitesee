'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Select } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderDashboardAvailabilityCenter.module.css';

type AvailabilityMode = 'always_available' | 'on_request' | 'scheduled';
type ServiceStatus = 'draft' | 'active' | 'paused';
type Service = { id: string; name: string; status: ServiceStatus };
type Availability = {
  service_id: string;
  mode: AvailabilityMode;
  timezone: string;
  weekly_windows: Array<{ day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6; start_time: string; end_time: string }>;
  blackout_periods: Array<{ starts_at: string; ends_at: string; reason?: string }>;
};

const MAX_DASHBOARD_SERVICES = 4;

export default function ProviderDashboardAvailabilityCenter() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const copy = useMemo(() => tamil ? {
    eyebrow: 'Booking availability',
    title: 'Service availability-ஐ Dashboard-லேயே கட்டுப்படுத்துங்கள்',
    intro: 'Simple availability mode-ஐ இங்கே மாற்றலாம். Weekly hours மற்றும் blackout periods போன்ற detailed schedule settings தனி schedule page-ல் பாதுகாப்பாக இருக்கும்.',
    noServices: 'முதலில் மேலே ஒரு service create செய்யுங்கள். அதன் booking availability இங்கே வரும்.',
    detailed: 'Detailed schedule',
    more: 'மேலும் services-ஐ schedule page-ல் manage செய்யுங்கள்',
    always: 'Always available',
    onRequest: 'On request',
    scheduled: 'Scheduled',
    scheduledNeedsHours: 'Scheduled — முதலில் hours set செய்யவும்',
    weekly: 'weekly window',
    weeklyPlural: 'weekly windows',
    blackout: 'blackout',
    blackoutPlural: 'blackouts',
    none: 'No detailed schedule yet',
    loading: 'Availability load ஆகிறது…',
    updating: 'Saving…',
    save: 'Save availability',
    saved: 'Availability saved.',
    retry: 'Retry',
  } : {
    eyebrow: 'Booking availability',
    title: 'Control service availability from this Dashboard',
    intro: 'Change the simple availability mode here. Detailed weekly hours and blackout periods stay in the dedicated schedule editor.',
    noServices: 'Create a service above first. Its booking availability will appear here.',
    detailed: 'Detailed schedule',
    more: 'Manage more services in the schedule page',
    always: 'Always available',
    onRequest: 'On request',
    scheduled: 'Scheduled',
    scheduledNeedsHours: 'Scheduled — set hours first',
    weekly: 'weekly window',
    weeklyPlural: 'weekly windows',
    blackout: 'blackout',
    blackoutPlural: 'blackouts',
    none: 'No detailed schedule yet',
    loading: 'Loading service availability…',
    updating: 'Saving…',
    save: 'Save availability',
    saved: 'Availability saved.',
    retry: 'Retry',
  }, [tamil]);

  const [services, setServices] = useState<Service[]>([]);
  const [availabilityByService, setAvailabilityByService] = useState<Record<string, Availability>>({});
  const [draftModeByService, setDraftModeByService] = useState<Record<string, AvailabilityMode>>({});
  const [loading, setLoading] = useState(true);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [noticeServiceId, setNoticeServiceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const serviceResponse = await fetch('/api/provider/services', { cache: 'no-store' });
      const serviceBody = await serviceResponse.json() as { services?: Service[]; error?: string };
      if (!serviceResponse.ok) throw new Error(serviceBody.error ?? 'Unable to load services.');
      const nextServices = serviceBody.services ?? [];
      setServices(nextServices);

      const visibleServices = nextServices.slice(0, MAX_DASHBOARD_SERVICES);
      const availabilityPairs = await Promise.all(visibleServices.map(async (service) => {
        const response = await fetch(`/api/provider/services/${service.id}/availability`, { cache: 'no-store' });
        const body = await response.json() as { availability?: Availability; error?: string };
        if (!response.ok || !body.availability) throw new Error(body.error ?? `Unable to load availability for ${service.name}.`);
        return [service.id, body.availability] as const;
      }));
      setAvailabilityByService(Object.fromEntries(availabilityPairs));
      setDraftModeByService(Object.fromEntries(availabilityPairs.map(([serviceId, availability]) => [serviceId, availability.mode])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load service availability.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveMode = async (service: Service) => {
    const current = availabilityByService[service.id];
    const mode = draftModeByService[service.id] ?? current?.mode;
    if (!current || !mode || savingServiceId) return;
    if (mode === 'scheduled' && current.weekly_windows.length === 0) return;

    setSavingServiceId(service.id);
    setNoticeServiceId(null);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/provider/services/${service.id}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          timezone: current.timezone,
          weekly_windows: current.weekly_windows,
          blackout_periods: current.blackout_periods,
        }),
      });
      const body = await response.json() as { availability?: Availability; error?: string };
      if (!response.ok || !body.availability) throw new Error(body.error ?? 'Unable to update availability.');
      setAvailabilityByService((existing) => ({ ...existing, [service.id]: body.availability as Availability }));
      setDraftModeByService((existing) => ({ ...existing, [service.id]: (body.availability as Availability).mode }));
      setNotice(copy.saved);
      setNoticeServiceId(service.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update availability.');
    } finally {
      setSavingServiceId(null);
    }
  };

  const visibleServices = services.slice(0, MAX_DASHBOARD_SERVICES);

  return <section id="provider-booking-availability" className={styles.center} aria-label="Provider booking availability controls">
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <Link href="/provider/schedule" className={styles.secondaryLink}>{copy.detailed}</Link>
      </div>

      {loading ? <p className={styles.status}>{copy.loading}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{copy.retry}</button></p> : null}

      {!loading && !services.length ? <p className={styles.empty}>{copy.noServices}</p> : null}

      {visibleServices.length ? <div className={styles.serviceGrid}>
        {visibleServices.map((service) => {
          const availability = availabilityByService[service.id];
          const saving = savingServiceId === service.id;
          const selectedMode = draftModeByService[service.id] ?? availability?.mode ?? 'on_request';
          const weeklyCount = availability?.weekly_windows.length ?? 0;
          const blackoutCount = availability?.blackout_periods.length ?? 0;
          const scheduleSummary = weeklyCount || blackoutCount
            ? `${weeklyCount} ${weeklyCount === 1 ? copy.weekly : copy.weeklyPlural} · ${blackoutCount} ${blackoutCount === 1 ? copy.blackout : copy.blackoutPlural}`
            : copy.none;
          return <article className={styles.serviceCard} key={service.id}>
            <div className={styles.serviceHead}>
              <div>
                <small>{service.status}</small>
                <h3>{service.name}</h3>
              </div>
              <span className={styles.modeBadge}>{availability ? modeLabel(availability.mode, copy) : '—'}</span>
            </div>

            {availability ? <>
              <div className={styles.modeControls}>
                <Select
                  label={copy.eyebrow}
                  value={selectedMode}
                  disabled={Boolean(savingServiceId)}
                  onChange={(event) => {
                    setNotice('');
                    setNoticeServiceId(null);
                    setDraftModeByService((existing) => ({ ...existing, [service.id]: event.target.value as AvailabilityMode }));
                  }}
                >
                  <option value="always_available">{copy.always}</option>
                  <option value="on_request">{copy.onRequest}</option>
                  <option value="scheduled" disabled={availability.weekly_windows.length === 0}>{availability.weekly_windows.length ? copy.scheduled : copy.scheduledNeedsHours}</option>
                </Select>
                <Button type="button" loading={saving} disabled={Boolean(savingServiceId)} onClick={() => void saveMode(service)}>{copy.save}</Button>
              </div>
              {notice && noticeServiceId === service.id ? <p className={styles.notice} role="status">{notice}</p> : null}
              <p className={styles.summary}>{saving ? copy.updating : scheduleSummary}</p>
            </> : <p className={styles.summary}>{copy.loading}</p>}
          </article>;
        })}
      </div> : null}

      {services.length > MAX_DASHBOARD_SERVICES ? <Link href="/provider/schedule" className={styles.moreLink}>{copy.more} →</Link> : null}
    </Card>
  </section>;
}

function modeLabel(mode: AvailabilityMode, copy: { always: string; onRequest: string; scheduled: string }) {
  if (mode === 'always_available') return copy.always;
  if (mode === 'scheduled') return copy.scheduled;
  return copy.onRequest;
}
