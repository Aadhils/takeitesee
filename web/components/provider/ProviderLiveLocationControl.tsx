'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

function geolocationMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission was not granted. Allow location access to share your current position for nearby matching.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your current location could not be determined.';
  if (error.code === error.TIMEOUT) return 'Location lookup timed out. Please try again.';
  return error.message || 'Unable to read your current location.';
}

export default function ProviderLiveLocationControl() {
  const [location, setLocation] = useState<ProviderLiveLocation | null>(null);
  const [shareMinutes, setShareMinutes] = useState<ShareMinutes>(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/live-location', { cache: 'no-store' });
      const payload = await response.json() as { location?: ProviderLiveLocation; error?: string };
      if (!response.ok || !payload.location) throw new Error(payload.error || 'Unable to load nearby-matching location status.');
      setLocation(payload.location);
    } catch (loadError) {
      setLocation(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load nearby-matching location status.');
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!response.ok || !payload.location) throw new Error(payload.error || 'Unable to share current location.');
    setLocation(payload.location);
  };

  const shareCurrentLocation = () => {
    if (saving) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location sharing is not supported by this browser.');
      return;
    }

    setSaving(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void saveLocation(position)
          .catch((saveError) => setError(saveError instanceof Error ? saveError.message : 'Unable to share current location.'))
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
      if (!response.ok || !payload.location) throw new Error(payload.error || 'Unable to stop location sharing.');
      setLocation(payload.location);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to stop location sharing.');
    } finally {
      setSaving(false);
    }
  };

  return <section className={styles.section} aria-label="Nearby matching location">
    <div className={styles.header}>
      <div className={styles.headerCopy}>
        <span>Nearby matching</span>
        <strong>Share current location</strong>
      </div>
      <span className={`${styles.status} ${active ? styles.statusActive : ''}`}>
        {loading ? 'Checking…' : active ? 'Sharing' : 'Not sharing'}
      </span>
    </div>

    <p className={styles.help}>
      Use this for mobile or on-the-go services so TakeItEsee can calculate useful distance. This is separate from Available / Busy and from Business Shop Open/Closed.
    </p>

    {active ? <>
      <p className={styles.meta}>
        Current point is private and used only for nearby matching{expiryText ? ` until ${expiryText}` : ''}.
        {location?.accuracy_meters != null ? ` Approx. accuracy ${Math.round(location.accuracy_meters)} m.` : ''}
      </p>
      <button type="button" className={styles.stopButton} disabled={saving} onClick={() => void stopSharing()}>
        {saving ? 'Updating…' : 'Stop sharing'}
      </button>
    </> : <div className={styles.controls}>
      <label className={styles.selectWrap}>
        Share for
        <select className={styles.select} value={shareMinutes} disabled={saving || loading} onChange={(event) => setShareMinutes(Number(event.target.value) as ShareMinutes)}>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
      </label>
      <button type="button" className={styles.primaryButton} disabled={saving || loading} onClick={shareCurrentLocation}>
        {saving ? 'Getting location…' : 'Share current location'}
      </button>
    </div>}

    <p className={styles.meta}>One-time browser capture only. TakeItEsee does not start continuous background tracking from this control. Fixed shop/clinic locations will be configured per service.</p>
    {error ? <div className={styles.error} role="alert">{error}<button type="button" className={styles.retryButton} onClick={() => void load()}>Retry</button></div> : null}
  </section>;
}
