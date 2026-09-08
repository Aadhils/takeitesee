'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ProviderLiveAvailabilityControl.module.css';

type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';

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

export default function ProviderLiveAvailabilityControl() {
  const [availability, setAvailability] = useState<ProviderLiveAvailability | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState<ProviderWorkMode | null>(null);
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

  const currentMode = availability?.effective_work_mode ?? 'offline';
  const currentOption = useMemo(
    () => MODES.find((item) => item.value === currentMode) ?? MODES[2],
    [currentMode],
  );

  const updateMode = async (nextMode: ProviderWorkMode) => {
    if (savingMode || nextMode === currentMode) return;
    setSavingMode(nextMode);
    setError('');
    try {
      const response = await fetch('/api/provider/live-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_mode: nextMode, mode_expires_at: null }),
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

      <div className={styles.modeGrid} role="group" aria-label="Choose live work status">
        {MODES.map((mode) => {
          const selected = currentMode === mode.value;
          const saving = savingMode === mode.value;
          return <button
            type="button"
            key={mode.value}
            className={`${styles.modeButton} ${selected ? styles.modeSelected : ''}`}
            aria-pressed={selected}
            disabled={Boolean(savingMode) || loading}
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
      <p className={styles.freshness}>Status stays as selected until you change it. Automatic expiry is supported by the foundation and can be added to the later “Available Now” UX.</p>
    </div> : null}

    <button
      type="button"
      className={styles.trigger}
      aria-expanded={expanded}
      aria-label={`Live work status: ${modeLabel(currentMode)}. Change status.`}
      onClick={() => setExpanded((value) => !value)}
    >
      <span className={`${styles.triggerDot} ${styles[`mode_${currentMode}`]}`} aria-hidden="true">{currentOption.symbol}</span>
      <span className={styles.triggerCopy}>
        <small>Live status</small>
        <strong>{loading ? 'Checking…' : modeLabel(currentMode)}</strong>
      </span>
      <span className={styles.chevron} aria-hidden="true">{expanded ? '×' : '⌃'}</span>
    </button>
  </aside>;
}
