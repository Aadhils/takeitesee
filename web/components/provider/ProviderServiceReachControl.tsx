'use client';

import { useCallback, useState } from 'react';
import styles from './ProviderServiceReachControl.module.css';

type FulfillmentMode = 'at_provider' | 'at_customer' | 'remote';
type LocationRole = 'service_site' | 'mobile_base';

type ReachRecord = {
  service_id: string;
  modes: Array<{ mode: FulfillmentMode; max_travel_distance_meters: number | null }>;
  locations: Array<{ role: LocationRole; is_set: boolean; label: string | null; updated_at: string | null }>;
};

type ModeDraft = Record<FulfillmentMode, boolean>;

const emptyModes: ModeDraft = { at_provider: false, at_customer: false, remote: false };

function geolocationMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission was not granted.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'Current location could not be determined.';
  if (error.code === error.TIMEOUT) return 'Location lookup timed out. Please try again.';
  return error.message || 'Unable to read current location.';
}

export default function ProviderServiceReachControl({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reach, setReach] = useState<ReachRecord | null>(null);
  const [modes, setModes] = useState<ModeDraft>(emptyModes);
  const [travelKm, setTravelKm] = useState('20');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const applyReach = useCallback((next: ReachRecord) => {
    const selected: ModeDraft = { ...emptyModes };
    for (const item of next.modes) selected[item.mode] = true;
    const customerMode = next.modes.find((item) => item.mode === 'at_customer');
    setModes(selected);
    setTravelKm(customerMode?.max_travel_distance_meters == null ? '20' : String(customerMode.max_travel_distance_meters / 1000));
    setReach(next);
    setLoaded(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/provider/services/${serviceId}/reach`, { cache: 'no-store' });
      const payload = await response.json() as { reach?: ReachRecord; error?: string };
      if (!response.ok || !payload.reach) throw new Error(payload.error || 'Unable to load service reach settings.');
      applyReach(payload.reach);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load service reach settings.');
    } finally {
      setLoading(false);
    }
  }, [applyReach, serviceId]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    setNotice('');
    if (next && !loaded && !loading) void load();
  };

  const saveModes = async () => {
    if (saving) return;
    const selected = (Object.keys(modes) as FulfillmentMode[]).filter((mode) => modes[mode]);
    if (!selected.length) {
      setError('Choose at least one way this service can be delivered.');
      return;
    }

    let maxTravelMeters: number | null = null;
    if (modes.at_customer) {
      if (travelKm.trim()) {
        const km = Number(travelKm);
        if (!Number.isFinite(km) || km < 0.1 || km > 500) {
          setError('Travel radius must be between 0.1 km and 500 km, or leave it blank for no configured limit.');
          return;
        }
        maxTravelMeters = Math.round(km * 1000);
      }
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/provider/services/${serviceId}/reach`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_modes',
          modes: selected.map((mode) => ({
            mode,
            max_travel_distance_meters: mode === 'at_customer' ? maxTravelMeters : null,
          })),
        }),
      });
      const payload = await response.json() as { reach?: ReachRecord; error?: string };
      if (!response.ok || !payload.reach) throw new Error(payload.error || 'Unable to save service reach settings.');
      applyReach(payload.reach);
      setNotice('Service reach settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save service reach settings.');
    } finally {
      setSaving(false);
    }
  };

  const updateLocation = async (role: LocationRole, position: GeolocationPosition) => {
    const response = await fetch(`/api/provider/services/${serviceId}/reach`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_location',
        role,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: role === 'service_site' ? `${serviceName} service site` : `${serviceName} mobile base`,
      }),
    });
    const payload = await response.json() as { reach?: ReachRecord; error?: string };
    if (!response.ok || !payload.reach) throw new Error(payload.error || 'Unable to save service location.');
    applyReach(payload.reach);
    setNotice(role === 'service_site' ? 'Fixed service location saved.' : 'Mobile service base saved.');
  };

  const captureLocation = (role: LocationRole) => {
    if (saving) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location capture is not supported by this browser.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void updateLocation(role, position)
          .catch((saveError) => setError(saveError instanceof Error ? saveError.message : 'Unable to save service location.'))
          .finally(() => setSaving(false));
      },
      (positionError) => {
        setError(geolocationMessage(positionError));
        setSaving(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  const removeLocation = async (role: LocationRole) => {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/provider/services/${serviceId}/reach`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_location', role }),
      });
      const payload = await response.json() as { reach?: ReachRecord; error?: string };
      if (!response.ok || !payload.reach) throw new Error(payload.error || 'Unable to remove service location.');
      applyReach(payload.reach);
      setNotice('Service location removed from nearby matching.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to remove service location.');
    } finally {
      setSaving(false);
    }
  };

  const site = reach?.locations.find((item) => item.role === 'service_site');
  const mobileBase = reach?.locations.find((item) => item.role === 'mobile_base');
  const selectedCount = Object.values(modes).filter(Boolean).length;

  return <div className={styles.wrap}>
    <button type="button" className={styles.toggle} onClick={toggleOpen} aria-expanded={open}>
      <span>Service reach &amp; precise location</span>
      <small>{open ? 'Close' : loaded ? `${selectedCount} mode${selectedCount === 1 ? '' : 's'}` : 'Configure'}</small>
    </button>

    {open ? <div className={styles.panel}>
      <p className={styles.intro}>Tell TakeItEsee how this service can actually reach a customer. Multiple modes are allowed. These settings are separate from your schedule and live Available/Busy state.</p>

      {loading ? <p className={styles.note}>Loading reach settings…</p> : <>
        <div className={styles.modeList}>
          <label className={styles.modeRow}>
            <input type="checkbox" checked={modes.at_provider} disabled={saving} onChange={(event) => setModes((current) => ({ ...current, at_provider: event.target.checked }))} />
            <span className={styles.modeCopy}><strong>Customers come to me</strong><span>Shop, clinic, office, workshop or another fixed service site.</span></span>
          </label>
          <label className={styles.modeRow}>
            <input type="checkbox" checked={modes.at_customer} disabled={saving} onChange={(event) => setModes((current) => ({ ...current, at_customer: event.target.checked }))} />
            <span className={styles.modeCopy}>
              <strong>I travel to the customer</strong>
              <span>Roadside help, electrician, ambulance, mobile mechanic and similar on-site service.</span>
              {modes.at_customer ? <span className={styles.distanceRow}><label>Travel radius (km)<input className={styles.distanceInput} type="number" min="0.1" max="500" step="0.1" value={travelKm} onChange={(event) => setTravelKm(event.target.value)} placeholder="No limit" /></label><span>Blank = no configured radius</span></span> : null}
            </span>
          </label>
          <label className={styles.modeRow}>
            <input type="checkbox" checked={modes.remote} disabled={saving} onChange={(event) => setModes((current) => ({ ...current, remote: event.target.checked }))} />
            <span className={styles.modeCopy}><strong>Remote</strong><span>Video, phone or online service; distance remains neutral.</span></span>
          </label>
        </div>

        <div className={styles.actions}><button type="button" className={styles.primary} disabled={saving} onClick={() => void saveModes()}>{saving ? 'Saving…' : 'Save service reach'}</button></div>

        <div className={styles.locationGrid}>
          <div className={styles.locationCard}>
            <strong>Fixed service site</strong>
            <span className={site?.is_set ? styles.statusSet : ''}>{site?.is_set ? 'Precise point set' : 'Not set'}</span>
            <span>Used for “Customers come to me” distance. Capture only when you are physically at the service site.</span>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={saving || !modes.at_provider} onClick={() => captureLocation('service_site')}>{site?.is_set ? 'Update current point' : 'Use current location'}</button>
              {site?.is_set ? <button type="button" className={styles.remove} disabled={saving} onClick={() => void removeLocation('service_site')}>Remove</button> : null}
            </div>
          </div>

          <div className={styles.locationCard}>
            <strong>Mobile service base</strong>
            <span className={mobileBase?.is_set ? styles.statusSet : ''}>{mobileBase?.is_set ? 'Fallback base set' : 'Optional'}</span>
            <span>Fallback origin for “I travel to the customer” when no valid live Provider location is being shared.</span>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={saving || !modes.at_customer} onClick={() => captureLocation('mobile_base')}>{mobileBase?.is_set ? 'Update current point' : 'Use current location'}</button>
              {mobileBase?.is_set ? <button type="button" className={styles.remove} disabled={saving} onClick={() => void removeLocation('mobile_base')}>Remove</button> : null}
            </div>
          </div>
        </div>

        <p className={styles.note}>Precise service points stay private. Marketplace customers receive derived distance/matching results, not your raw coordinates. For mobile matching, a valid shared live location takes priority over the mobile base.</p>
      </>}

      {notice ? <p className={styles.notice}>{notice}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div> : null}
  </div>;
}
