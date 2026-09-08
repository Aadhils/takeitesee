'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

const MODES: ModeOption[] = [
  { value: 'available', label: 'Available', detail: 'Ready to take new work now.', symbol: '●' },
  { value: 'busy', label: 'Busy', detail: 'Working now, but still active.', symbol: '◐' },
  { value: 'offline', label: 'Offline', detail: 'Not taking live requests now.', symbol: '○' },
  { value: 'paused', label: 'Paused', detail: 'Temporarily pause new live work.', symbol: 'Ⅱ' },
];

function modeLabel(mode: ProviderWorkMode) {
  return MODES.find((item) => item.value === mode)?.label ?? 'Offline';
}

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
      if (!response.ok || !payload.availability) throw new Error(payload.error || 'Unable to load live work status.');
      setAvailability(payload.availability);
    } catch (loadError) {
      setAvailability(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load live work status.');
    } finally {
      setLoading(false);
    }
  }, []);

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
    () => MODES.find((item) => item.value === currentMode) ?? MODES[2],
    [currentMode],
  );
  const statusUnavailable = !loading && Boolean(error) && !availability;
  const visibleStatus = loading ? 'Checking…' : statusUnavailable ? 'Unavailable' : modeLabel(currentMode);
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
      if (!response.ok || !payload.availability) throw new Error(payload.error || 'Unable to update live work status.');
      setAvailability(payload.availability);
      setExpanded(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update live work status.');
    } finally {
      setSavingMode(null);
    }
  };

  return <aside className={styles.anchor} aria-label="Live work status">
    {expanded ? <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.eyebrow}>Live work status</span>
          <strong>Can you help customers now?</strong>
        </div>
        <button type="button" className={styles.closeButton} aria-label="Close live work status" onClick={() => setExpanded(false)}>×</button>
      </div>

      <p className={styles.boundaryCopy}>This status is separate from service schedules. For Businesses, it does not mean Shop Open/Closed.</p>

      <label style={{ display: 'grid', gap: '5px', marginTop: '12px', color: 'var(--color-ink-muted)', fontSize: '.72rem', fontWeight: 700 }}>
        Available / Busy duration
        <select
          value={durationMinutes}
          disabled={Boolean(savingMode) || loading || statusUnavailable}
          onChange={(event) => setDurationMinutes(Number(event.target.value) as LiveDurationMinutes)}
          style={{ minHeight: '38px', border: '1px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-surface)', color: 'var(--color-ink)', padding: '0 10px' }}
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
      </label>

      <div className={styles.modeGrid} role="group" aria-label="Choose live work status">
        {MODES.map((mode) => {
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
              <strong>{saving ? 'Updating…' : mode.label}</strong>
              <small>{mode.detail}</small>
            </span>
          </button>;
        })}
      </div>

      {error ? <div className={styles.error} role="alert">{error} <button type="button" onClick={() => void load()}>Retry</button></div> : null}
      <p className={styles.freshness}>{activeExpiryLabel ? `${modeLabel(currentMode)} until ${activeExpiryLabel}. ` : ''}Available and Busy automatically expire to Offline. Choose the live status again to extend it. Service schedules and Business Shop Open/Closed remain separate.</p>
      <ProviderLiveLocationControl />
    </div> : null}

    <button
      type="button"
      className={styles.trigger}
      aria-expanded={expanded}
      aria-label={`Live work status: ${visibleStatus}. Change status.`}
      onClick={() => setExpanded((value) => !value)}
    >
      <span className={`${styles.triggerDot} ${styles[`mode_${currentMode}`]}`} aria-hidden="true">{statusUnavailable ? '!' : currentOption.symbol}</span>
      <span className={styles.triggerCopy}>
        <small>Live status</small>
        <strong>{visibleStatus}</strong>
      </span>
      <span className={styles.chevron} aria-hidden="true">{expanded ? '×' : '⌃'}</span>
    </button>
  </aside>;
}
