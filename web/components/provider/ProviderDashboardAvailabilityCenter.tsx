'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
  const { t } = useIdentityWorkspaceTranslations();

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
      if (!serviceResponse.ok) throw new Error(serviceBody.error ?? t('provider.availability.loadServicesFallback'));
      const nextServices = serviceBody.services ?? [];
      setServices(nextServices);

      const visibleServices = nextServices.slice(0, MAX_DASHBOARD_SERVICES);
      const availabilityPairs = await Promise.all(visibleServices.map(async (service) => {
        const response = await fetch(`/api/provider/services/${service.id}/availability`, { cache: 'no-store' });
        const body = await response.json() as { availability?: Availability; error?: string };
        if (!response.ok || !body.availability) throw new Error(body.error ?? t('provider.availability.loadFallback'));
        return [service.id, body.availability] as const;
      }));
      setAvailabilityByService(Object.fromEntries(availabilityPairs));
      setDraftModeByService(Object.fromEntries(availabilityPairs.map(([serviceId, availability]) => [serviceId, availability.mode])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.availability.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      if (!response.ok || !body.availability) throw new Error(body.error ?? t('provider.availability.updateFallback'));
      setAvailabilityByService((existing) => ({ ...existing, [service.id]: body.availability as Availability }));
      setDraftModeByService((existing) => ({ ...existing, [service.id]: (body.availability as Availability).mode }));
      setNotice(t('provider.availability.saved'));
      setNoticeServiceId(service.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.availability.updateFallback'));
    } finally {
      setSavingServiceId(null);
    }
  };

  const visibleServices = services.slice(0, MAX_DASHBOARD_SERVICES);

  return <section id="provider-booking-availability" className={styles.center} aria-label={t('provider.availability.controlsLabel')}>
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t('provider.availability.eyebrow')}</span>
          <h2>{t('provider.availability.title')}</h2>
          <p>{t('provider.availability.intro')}</p>
        </div>
        <Link href="/provider/schedule" className={styles.secondaryLink}>{t('provider.availability.detailed')}</Link>
      </div>

      {loading ? <p className={styles.status}>{t('provider.availability.loading')}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{t('provider.availability.retry')}</button></p> : null}

      {!loading && !services.length ? <p className={styles.empty}>{t('provider.availability.noServices')}</p> : null}

      {visibleServices.length ? <div className={styles.serviceGrid}>
        {visibleServices.map((service) => {
          const availability = availabilityByService[service.id];
          const saving = savingServiceId === service.id;
          const selectedMode = draftModeByService[service.id] ?? availability?.mode ?? 'on_request';
          const weeklyCount = availability?.weekly_windows.length ?? 0;
          const blackoutCount = availability?.blackout_periods.length ?? 0;
          const scheduleSummary = weeklyCount || blackoutCount
            ? `${weeklyCount} ${weeklyCount === 1 ? t('provider.availability.weeklyWindow') : t('provider.availability.weeklyWindows')} · ${blackoutCount} ${blackoutCount === 1 ? t('provider.availability.blackout') : t('provider.availability.blackouts')}`
            : t('provider.availability.noDetailedSchedule');
          return <article className={styles.serviceCard} key={service.id}>
            <div className={styles.serviceHead}>
              <div>
                <small>{service.status === 'active' ? t('provider.identity.active') : service.status === 'paused' ? t('provider.identity.paused') : t('provider.availability.draft')}</small>
                <h3>{service.name}</h3>
              </div>
              <span className={styles.modeBadge}>{availability ? (availability.mode === 'always_available' ? t('provider.availability.always') : availability.mode === 'scheduled' ? t('provider.availability.scheduled') : t('provider.availability.onRequest')) : '—'}</span>
            </div>

            {availability ? <>
              <div className={styles.modeControls}>
                <Select
                  label={t('provider.availability.eyebrow')}
                  value={selectedMode}
                  disabled={Boolean(savingServiceId)}
                  onChange={(event) => {
                    setNotice('');
                    setNoticeServiceId(null);
                    setDraftModeByService((existing) => ({ ...existing, [service.id]: event.target.value as AvailabilityMode }));
                  }}
                >
                  <option value="always_available">{t('provider.availability.always')}</option>
                  <option value="on_request">{t('provider.availability.onRequest')}</option>
                  <option value="scheduled" disabled={availability.weekly_windows.length === 0}>{availability.weekly_windows.length ? t('provider.availability.scheduled') : t('provider.availability.scheduledNeedsHours')}</option>
                </Select>
                <Button type="button" loading={saving} disabled={Boolean(savingServiceId)} onClick={() => void saveMode(service)}>{t('provider.availability.save')}</Button>
              </div>
              {notice && noticeServiceId === service.id ? <p className={styles.notice} role="status">{notice}</p> : null}
              <p className={styles.summary}>{saving ? t('provider.availability.saving') : scheduleSummary}</p>
            </> : <p className={styles.summary}>{t('provider.availability.loading')}</p>}
          </article>;
        })}
      </div> : null}

      {services.length > MAX_DASHBOARD_SERVICES ? <Link href="/provider/schedule" className={styles.moreLink}>{t('provider.availability.more')} →</Link> : null}
    </Card>
  </section>;
}

