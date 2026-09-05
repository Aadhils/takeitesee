'use client';

import { useEffect, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './WorkspaceSwitcher.module.css';

type WorkspaceKind = 'customer' | 'professional' | 'business' | 'admin' | 'super_admin';
type WorkspaceOption = {
  id: WorkspaceKind;
  label: string;
  display_name: string;
  description: string;
  target: string;
  verified?: boolean;
};

type WorkspacePayload = { active?: WorkspaceKind; workspaces?: WorkspaceOption[]; error?: string };

export function WorkspaceSwitcher({ currentWorkspace, compact = false }: { currentWorkspace?: WorkspaceKind; compact?: boolean }) {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [active, setActive] = useState<WorkspaceKind | undefined>(currentWorkspace);
  const [switching, setSwitching] = useState<WorkspaceKind | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/account/workspaces', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as WorkspacePayload;
        if (!response.ok) throw new Error(payload.error || 'Unable to load workspaces.');
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setWorkspaces(payload.workspaces ?? []);
        setActive(currentWorkspace ?? payload.active);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load workspaces.'); });
    return () => { cancelled = true; };
  }, [currentWorkspace]);

  async function switchWorkspace(workspace: WorkspaceKind) {
    if (workspace === active) return;
    setSwitching(workspace);
    setError('');
    try {
      const response = await fetch('/api/account/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace }),
      });
      const payload = await response.json() as { redirect?: string; error?: string };
      if (!response.ok || !payload.redirect) throw new Error(payload.error || 'Unable to switch workspace.');
      window.location.assign(payload.redirect);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to switch workspace.');
      setSwitching(null);
    }
  }

  if (!workspaces.length && !error) return null;

  if (compact) {
    return <details className={styles.compact}>
      <summary>{tamil ? 'Profile மாற்று' : 'Switch profile'}</summary>
      <div className={styles.compactMenu}>
        {workspaces.map((workspace) => <button
          key={workspace.id}
          className={`${styles.compactButton} ${workspace.id === active ? styles.compactCurrent : ''}`}
          type="button"
          disabled={switching !== null || workspace.id === active}
          onClick={() => void switchWorkspace(workspace.id)}
        >
          {workspace.label} · {workspace.display_name}{workspace.id === active ? (tamil ? ' · தற்போது' : ' · Current') : ''}
        </button>)}
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
      </div>
    </details>;
  }

  return <section className={styles.section} id="workspaces" aria-labelledby="workspace-switcher-title">
    <div className={styles.heading}>
      <h2 id="workspace-switcher-title">{tamil ? 'என் Profiles & Workspaces' : 'My profiles & workspaces'}</h2>
      <p>{tamil ? 'ஒரே login-ல் Customer, Professional, Business மற்றும் உங்களுக்கு அனுமதி உள்ள platform workspace-கள் இடையே மாறுங்கள்.' : 'Use one login and switch between your Customer, Professional, Business and permitted platform workspaces.'}</p>
    </div>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    <div className={styles.grid}>
      {workspaces.map((workspace) => {
        const selected = workspace.id === active;
        return <article className={`${styles.card} ${selected ? styles.cardActive : ''}`} key={workspace.id}>
          <div className={styles.row}>
            <div><div className={styles.role}>{workspace.label}</div><div className={styles.name}>{workspace.display_name}</div></div>
            {selected ? <span className={`${styles.badge} ${styles.activeBadge}`}>{tamil ? 'தற்போது' : 'Current'}</span> : workspace.verified ? <span className={styles.badge}>{tamil ? 'Verified' : 'Verified'}</span> : null}
          </div>
          <div className={styles.description}>{workspace.description}</div>
          <button className={styles.button} type="button" disabled={selected || switching !== null} onClick={() => void switchWorkspace(workspace.id)}>
            {selected ? (tamil ? 'இந்த workspace-ல் உள்ளீர்கள்' : 'You are here') : switching === workspace.id ? (tamil ? 'மாற்றப்படுகிறது…' : 'Switching…') : (tamil ? 'இந்த workspace திற' : 'Open workspace')}
          </button>
        </article>;
      })}
    </div>
  </section>;
}
