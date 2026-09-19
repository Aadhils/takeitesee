'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderLiveLocationControl.module.css';

type ShareMinutes = 15 | 30 | 60;

type ProviderLiveLocation = {
  provider_type: 'professional' | 'business';
  provider_id: string;
  matching_enabled: boolean;
  effective_matching_enabled: boolean;
  captured_at: string | null;
  expires_at: string | null;
  accuracy_meters: number | null;
  updated_at: string | null;
};

function formatExpiry(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}


export default function ProviderLiveLocationControl() {
  const { t } = useIdentityWorkspaceTranslations();
  const [location, setLocation] = useState<ProviderLiveLocation | null>(null);
  const [shareMinutes, setShareMinutes] = useState<ShareMinutes>(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const geolocationMessage = (error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) return t('provider.liveLocation.permissionDenied');
    if (error.code === error.POSITION_UNAVAILABLE) return t('provider.liveLocation.positionUnavailable');
    if (error.code === error.TIMEOUT) return t('provider.liveLocation.timeout');
    return error.message || t('provider.liveLocation.readFallback');
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/live-location', { cache: 'no-store' });
      const payload = await response.json() as { location?: ProviderLiveLocation; error?: string };
      if (!response.ok || !payload.location) throw new Error(payload.error || t('provider.liveLocation.loadFallback'));
      setLocation(payload.location);
    } catch (loadError) {
      setLocation(null);
      setError(loadError instanceof Error ? loadError.message : t('provider.liveLocation.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const active = Boolean(location?.effective_matching_enabled);
  const expiryText = useMemo(() => formatExpiry(location?.expires_at ?? null), [location?.expires_at]);

  const saveLocation = async (position: GeolocationPosition) => {
    const response = await fetch('/api/provider/live-location', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'share',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        share_minutes: shareMinutes,
      }),
    });
    const payload = await response.json() as { location?: ProviderLiveLocation; error?: string };
    if (!response.ok || !payload.location) throw new Error(payload.error || t('provider.liveLocation.shareFallback'));
    setLocation(payload.location);
  };

  const shareCurrentLocation = () => {
    if (saving) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(t('provider.liveLocation.unsupported'));
      return;
    }

    setSaving(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void saveLocation(position)
          .catch((saveError) => setError(saveError instanceof Error ? saveError.message : t('provider.liveLocation.shareFallback')))
          .finally(() => setSaving(false));
      },
      (positionError) => {
        setError(geolocationMessage(positionError));
        setSaving(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  const stopSharing = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/provider/live-location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const payload = await response.json() as { location?: ProviderLiveLocation; error?: string };
      if (!response.ok || !payload.location) throw new Error(payload.error || t('provider.liveLocation.stopFallback'));
      setLocation(payload.location);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('provider.liveLocation.stopFallback'));
    } finally {
      setSaving(false);
    }
  };

  return <section className={styles.section} aria-label={t('provider.liveLocation.ariaLabel')}>
    <div className={styles.header}>
      <div className={styles.headerCopy}>
        <span>{t('provider.liveLocation.eyebrow')}</span>
        <strong>{t('provider.liveLocation.title')}</strong>
      </div>
      <span className={`${styles.status} ${active ? styles.statusActive : ''}`}>
        {loading ? t('provider.liveLocation.checking') : active ? t('provider.liveLocation.sharing') : t('provider.liveLocation.notSharing')}
      </span>
    </div>

    <p className={styles.help}>
      {t('provider.liveLocation.help')}
    </p>

    {active ? <>
      <p className={styles.meta}>
        {t('provider.liveLocation.currentPrivate')}{expiryText ? ` ${t('provider.liveLocation.until')} ${expiryText}` : ''}.
        {location?.accuracy_meters != null ? ` ${t('provider.liveLocation.accuracy')} ${Math.round(location.accuracy_meters)} m.` : ''}
      </p>
      <button type="button" className={styles.stopButton} disabled={saving} onClick={() => void stopSharing()}>
        {saving ? t('provider.liveLocation.updating') : t('provider.liveLocation.stop')}
      </button>
    </> : <div className={styles.controls}>
      <label className={styles.selectWrap}>
        {t('provider.liveLocation.shareFor')}
        <select className={styles.select} value={shareMinutes} disabled={saving || loading} onChange={(event) => setShareMinutes(Number(event.target.value) as ShareMinutes)}>
          <option value={15}>15 {t('provider.live.minutes')}</option>
          <option value={30}>30 {t('provider.live.minutes')}</option>
          <option value={60}>60 {t('provider.live.minutes')}</option>
        </select>
      </label>
      <button type="button" className={styles.primaryButton} disabled={saving || loading} onClick={shareCurrentLocation}>
        {saving ? t('provider.liveLocation.getting') : t('provider.liveLocation.share')}
      </button>
    </div>}

    <p className={styles.meta}>{t('provider.liveLocation.privacy')}</p>
    {error ? <div className={styles.error} role="alert">{error}<button type="button" className={styles.retryButton} onClick={() => void load()}>{t('provider.liveLocation.retry')}</button></div> : null}
  </section>;
}
