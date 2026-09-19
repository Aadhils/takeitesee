'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import ProviderLiveLocationControl from './ProviderLiveLocationControl';
import styles from './ProviderLiveAvailabilityControl.module.css';

type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type LiveDurationMinutes = 15 | 30 | 60;

type ProviderLiveAvailability = {
  provider_type: 'professional' | 'business';
  provider_id: string;
  work_mode: ProviderWorkMode;
  effective_work_mode: ProviderWorkMode;
  mode_expires_at: string | null;
  status_changed_at: string | null;
  updated_at: string | null;
};

type ModeOption = {
  value: ProviderWorkMode;
  label: string;
  detail: string;
  symbol: string;
};


function effectiveMode(availability: ProviderLiveAvailability | null): ProviderWorkMode {
  if (!availability) return 'offline';
  if (availability.work_mode === 'available' || availability.work_mode === 'busy') {
    if (!availability.mode_expires_at) return 'offline';
    const expiry = new Date(availability.mode_expires_at).getTime();
    if (Number.isNaN(expiry) || expiry <= Date.now()) return 'offline';
  }
  return availability.work_mode;
}

function expiryLabel(value: string | null) {
  if (!value) return '';
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(expiry);
}

export default function ProviderLiveAvailabilityControl() {
  const { t } = useIdentityWorkspaceTranslations();
  const modes = useMemo<ModeOption[]>(() => [
    { value: 'available', label: t('provider.live.available'), detail: t('provider.live.availableHelp'), symbol: '●' },
    { value: 'busy', label: t('provider.live.busy'), detail: t('provider.live.busyHelp'), symbol: '◐' },
    { value: 'offline', label: t('provider.live.offline'), detail: t('provider.live.offlineHelp'), symbol: '○' },
    { value: 'paused', label: t('provider.live.paused'), detail: t('provider.live.pausedHelp'), symbol: 'Ⅱ' },
  ], [t]);
  const [availability, setAvailability] = useState<ProviderLiveAvailability | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState<ProviderWorkMode | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<LiveDurationMinutes>(30);
  const [expiryTick, setExpiryTick] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/live-availability', { cache: 'no-store' });
      const payload = await response.json() as { availability?: ProviderLiveAvailability; error?: string };
      if (!response.ok || !payload.availability) throw new Error(payload.error || t('provider.live.loadFallback'));
      setAvailability(payload.availability);
    } catch (loadError) {
      setAvailability(null);
      setError(loadError instanceof Error ? loadError.message : t('provider.live.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!availability?.mode_expires_at || !['available', 'busy'].includes(availability.work_mode)) return;
    const expiry = new Date(availability.mode_expires_at).getTime();
    if (Number.isNaN(expiry)) return;
    const delay = Math.max(0, expiry - Date.now()) + 250;
    const timeout = window.setTimeout(() => setExpiryTick((value) => value + 1), Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [availability?.mode_expires_at, availability?.work_mode]);

  const currentMode = useMemo(() => effectiveMode(availability), [availability, expiryTick]);
  const currentOption = useMemo(
    () => modes.find((item) => item.value === currentMode) ?? modes[2],
    [currentMode, modes],
  );
  const statusUnavailable = !loading && Boolean(error) && !availability;
  const liveModeLabel = (mode: ProviderWorkMode) => modes.find((item) => item.value === mode)?.label ?? t('provider.live.offline');
  const visibleStatus = loading ? t('provider.live.checking') : statusUnavailable ? t('provider.live.unavailable') : liveModeLabel(currentMode);
  const activeExpiryLabel = currentMode === 'available' || currentMode === 'busy'
    ? expiryLabel(availability?.mode_expires_at ?? null)
    : '';

  const updateMode = async (nextMode: ProviderWorkMode) => {
    if (savingMode || statusUnavailable) return;
    setSavingMode(nextMode);
    setError('');
    try {
      const expiring = nextMode === 'available' || nextMode === 'busy';
      const modeExpiresAt = expiring
        ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        : null;
      const response = await fetch('/api/provider/live-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_mode: nextMode, mode_expires_at: modeExpiresAt }),
      });
      const payload = await response.json() as { availability?: ProviderLiveAvailability; error?: string };
      if (!response.ok || !payload.availability) throw new Error(payload.error || t('provider.live.updateFallback'));
      setAvailability(payload.availability);
      setExpanded(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('provider.live.updateFallback'));
    } finally {
      setSavingMode(null);
    }
  };

  return <aside className={styles.anchor} aria-label={t('provider.live.statusLabel')}>
    {expanded ? <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.eyebrow}>{t('provider.live.statusLabel')}</span>
          <strong>{t('provider.live.question')}</strong>
        </div>
        <button type="button" className={styles.closeButton} aria-label={t('provider.live.closeLabel')} onClick={() => setExpanded(false)}>×</button>
      </div>

      <p className={styles.boundaryCopy}>{t('provider.live.boundary')}</p>

      <label style={{ display: 'grid', gap: '5px', marginTop: '12px', color: 'var(--color-ink-muted)', fontSize: '.72rem', fontWeight: 700 }}>
        {t('provider.live.duration')}
        <select
          value={durationMinutes}
          disabled={Boolean(savingMode) || loading || statusUnavailable}
          onChange={(event) => setDurationMinutes(Number(event.target.value) as LiveDurationMinutes)}
          style={{ minHeight: '38px', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)', color: 'var(--color-ink)', padding: '0 10px' }}
        >
          <option value={15}>15 {t('provider.live.minutes')}</option>
          <option value={30}>30 {t('provider.live.minutes')}</option>
          <option value={60}>60 {t('provider.live.minutes')}</option>
        </select>
      </label>

      <div className={styles.modeGrid} role="group" aria-label={t('provider.live.chooseLabel')}>
        {modes.map((mode) => {
          const selected = !statusUnavailable && currentMode === mode.value;
          const saving = savingMode === mode.value;
          return <button
            type="button"
            key={mode.value}
            className={`${styles.modeButton} ${selected ? styles.modeSelected : ''}`}
            aria-pressed={selected}
            disabled={Boolean(savingMode) || loading || statusUnavailable}
            onClick={() => void updateMode(mode.value)}
          >
            <span className={`${styles.modeSymbol} ${styles[`mode_${mode.value}`]}`}>{mode.symbol}</span>
            <span className={styles.modeCopy}>
              <strong>{saving ? t('provider.live.updating') : mode.label}</strong>
              <small>{mode.detail}</small>
            </span>
          </button>;
        })}
      </div>

      {error ? <div className={styles.error} role="alert">{error} <button type="button" onClick={() => void load()}>{t('provider.live.retry')}</button></div> : null}
      <p className={styles.freshness}>{activeExpiryLabel ? `${liveModeLabel(currentMode)} ${t('provider.live.until')} ${activeExpiryLabel}. ` : ''}{t('provider.live.expiryHelp')}</p>
      <ProviderLiveLocationControl />
    </div> : null}

    <button
      type="button"
      className={styles.trigger}
      aria-expanded={expanded}
      aria-label={`${t('provider.live.statusLabel')}: ${visibleStatus}. ${t('provider.live.changeStatus')}`}
      onClick={() => setExpanded((value) => !value)}
    >
      <span className={`${styles.triggerDot} ${styles[`mode_${currentMode}`]}`} aria-hidden="true">{statusUnavailable ? '!' : currentOption.symbol}</span>
      <span className={styles.triggerCopy}>
        <small>{t('provider.live.triggerLabel')}</small>
        <strong>{visibleStatus}</strong>
      </span>
      <span className={styles.chevron} aria-hidden="true">{expanded ? '×' : '⌃'}</span>
    </button>
  </aside>;
}
