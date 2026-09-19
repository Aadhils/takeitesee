'use client';

import { useCallback, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
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


export default function ProviderServiceReachControl({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  const { t } = useIdentityWorkspaceTranslations();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reach, setReach] = useState<ReachRecord | null>(null);
  const [modes, setModes] = useState<ModeDraft>(emptyModes);
  const [travelKm, setTravelKm] = useState('20');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const geolocationMessage = (error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) return t('provider.reach.permissionDenied');
    if (error.code === error.POSITION_UNAVAILABLE) return t('provider.reach.positionUnavailable');
    if (error.code === error.TIMEOUT) return t('provider.reach.locationTimeout');
    return error.message || t('provider.reach.locationReadFallback');
  };

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
      if (!response.ok || !payload.reach) throw new Error(payload.error || t('provider.reach.loadFallback'));
      applyReach(payload.reach);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('provider.reach.loadFallback'));
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
      setError(t('provider.reach.chooseMode'));
      return;
    }

    let maxTravelMeters: number | null = null;
    if (modes.at_customer) {
      if (travelKm.trim()) {
        const km = Number(travelKm);
        if (!Number.isFinite(km) || km < 0.1 || km > 500) {
          setError(t('provider.reach.radiusInvalid'));
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
      if (!response.ok || !payload.reach) throw new Error(payload.error || t('provider.reach.saveFallback'));
      applyReach(payload.reach);
      setNotice(t('provider.reach.saved'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('provider.reach.saveFallback'));
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
    if (!response.ok || !payload.reach) throw new Error(payload.error || t('provider.reach.locationSaveFallback'));
    applyReach(payload.reach);
    setNotice(role === 'service_site' ? t('provider.reach.fixedSaved') : t('provider.reach.mobileSaved'));
  };

  const captureLocation = (role: LocationRole) => {
    if (saving) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(t('provider.reach.locationUnsupported'));
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void updateLocation(role, position)
          .catch((saveError) => setError(saveError instanceof Error ? saveError.message : t('provider.reach.locationSaveFallback')))
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
      if (!response.ok || !payload.reach) throw new Error(payload.error || t('provider.reach.locationRemoveFallback'));
      applyReach(payload.reach);
      setNotice(t('provider.reach.locationRemoved'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('provider.reach.locationRemoveFallback'));
    } finally {
      setSaving(false);
    }
  };

  const site = reach?.locations.find((item) => item.role === 'service_site');
  const mobileBase = reach?.locations.find((item) => item.role === 'mobile_base');
  const selectedCount = Object.values(modes).filter(Boolean).length;

  return <div className={styles.wrap}>
    <button type="button" className={styles.toggle} onClick={toggleOpen} aria-expanded={open}>
      <span>{t('provider.reach.toggle')}</span>
      <small>{open ? t('provider.reach.close') : loaded ? `${selectedCount} ${selectedCount === 1 ? t('provider.reach.modeSingular') : t('provider.reach.modePlural')}` : t('provider.reach.configure')}</small>
    </button>

    {open ? <div className={styles.panel}>
      <p className={styles.intro}>{t('provider.reach.detailIntro')}</p>

      {loading ? <p className={styles.note}>{t('provider.reach.loadingSettings')}</p> : <>
        <div className={styles.modeList}>
          <label className={styles.modeRow}>
            <input type="checkbox" checked={modes.at_provider} disabled={saving} onChange={(event) => setModes((current) => ({ ...current, at_provider: event.target.checked }))} />
            <span className={styles.modeCopy}><strong>{t('provider.reach.customersCome')}</strong><span>{t('provider.reach.customersComeHelp')}</span></span>
          </label>
          <label className={styles.modeRow}>
            <input type="checkbox" checked={modes.at_customer} disabled={saving} onChange={(event) => setModes((current) => ({ ...current, at_customer: event.target.checked }))} />
            <span className={styles.modeCopy}>
              <strong>{t('provider.reach.travelToCustomer')}</strong>
              <span>{t('provider.reach.travelHelp')}</span>
              {modes.at_customer ? <span className={styles.distanceRow}><label>{t('provider.reach.travelRadius')}<input className={styles.distanceInput} type="number" min="0.1" max="500" step="0.1" value={travelKm} onChange={(event) => setTravelKm(event.target.value)} placeholder={t('provider.reach.noLimit')} /></label><span>{t('provider.reach.blankNoRadius')}</span></span> : null}
            </span>
          </label>
          <label className={styles.modeRow}>
            <input type="checkbox" checked={modes.remote} disabled={saving} onChange={(event) => setModes((current) => ({ ...current, remote: event.target.checked }))} />
            <span className={styles.modeCopy}><strong>{t('provider.reach.remote')}</strong><span>{t('provider.reach.remoteHelp')}</span></span>
          </label>
        </div>

        <div className={styles.actions}><button type="button" className={styles.primary} disabled={saving} onClick={() => void saveModes()}>{saving ? t('provider.reach.saving') : t('provider.reach.save')}</button></div>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <div className={styles.locationGrid}>
          <div className={styles.locationCard}>
            <strong>{t('provider.reach.fixedSite')}</strong>
            <span className={site?.is_set ? styles.statusSet : ''}>{site?.is_set ? t('provider.reach.preciseSet') : t('provider.reach.notSet')}</span>
            <span>{t('provider.reach.fixedSiteHelp')}</span>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={saving || !modes.at_provider} onClick={() => captureLocation('service_site')}>{site?.is_set ? t('provider.reach.updatePoint') : t('provider.reach.useCurrentLocation')}</button>
              {site?.is_set ? <button type="button" className={styles.remove} disabled={saving} onClick={() => void removeLocation('service_site')}>{t('provider.reach.remove')}</button> : null}
            </div>
          </div>

          <div className={styles.locationCard}>
            <strong>{t('provider.reach.mobileBase')}</strong>
            <span className={mobileBase?.is_set ? styles.statusSet : ''}>{mobileBase?.is_set ? t('provider.reach.fallbackBaseSet') : t('provider.reach.optional')}</span>
            <span>{t('provider.reach.mobileBaseHelp')}</span>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={saving || !modes.at_customer} onClick={() => captureLocation('mobile_base')}>{mobileBase?.is_set ? t('provider.reach.updatePoint') : t('provider.reach.useCurrentLocation')}</button>
              {mobileBase?.is_set ? <button type="button" className={styles.remove} disabled={saving} onClick={() => void removeLocation('mobile_base')}>{t('provider.reach.remove')}</button> : null}
            </div>
          </div>
        </div>

        <p className={styles.note}>{t('provider.reach.privacy')}</p>
      </>}
    </div> : null}
  </div>;
}
