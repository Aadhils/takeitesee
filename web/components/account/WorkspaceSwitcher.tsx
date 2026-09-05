'use client';

import Link from 'next/link';
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
type AddableProfileOption = {
  id: 'professional' | 'business';
  label: string;
  display_name: string;
  description: string;
  target: string;
  pending: boolean;
};

type WorkspacePayload = {
  active?: WorkspaceKind;
  workspaces?: WorkspaceOption[];
  addable_profiles?: AddableProfileOption[];
  error?: string;
};

export function WorkspaceSwitcher({ currentWorkspace, compact = false }: { currentWorkspace?: WorkspaceKind; compact?: boolean }) {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [addableProfiles, setAddableProfiles] = useState<AddableProfileOption[]>([]);
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
        setAddableProfiles(payload.addable_profiles ?? []);
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
            {selected ? <span className={`${styles.badge} ${styles.activeBadge}`}>{tamil ? 'தற்போது' : 'Current'}</span> : workspace.verified ? <span className={styles.badge}>Verified</span> : null}
          </div>
          <div className={styles.description}>{workspace.description}</div>
          <button className={styles.button} type="button" disabled={selected || switching !== null} onClick={() => void switchWorkspace(workspace.id)}>
            {selected ? (tamil ? 'இந்த workspace-ல் உள்ளீர்கள்' : 'You are here') : switching === workspace.id ? (tamil ? 'மாற்றப்படுகிறது…' : 'Switching…') : (tamil ? 'இந்த workspace திற' : 'Open workspace')}
          </button>
        </article>;
      })}
    </div>

    {addableProfiles.length ? <div className={styles.addSection}>
      <div className={styles.subheading}>
        <h3>{tamil ? 'மற்றொரு provider profile சேர்க்கவும்' : 'Add another provider profile'}</h3>
        <p>{tamil ? 'புதிய account உருவாக்க வேண்டாம். இதே login-ல் இல்லாத Professional அல்லது Business profile-ஐ platform review மூலம் சேர்க்கலாம்.' : 'Do not create another account. Add the missing Professional or Business profile to this same login through platform review.'}</p>
      </div>
      <div className={styles.grid}>
        {addableProfiles.map((profile) => <article className={`${styles.card} ${styles.addCard}`} key={`add-${profile.id}`}>
          <div className={styles.row}>
            <div><div className={styles.role}>{profile.label}</div><div className={styles.name}>{profile.display_name}</div></div>
            <span className={`${styles.badge} ${profile.pending ? styles.pendingBadge : styles.availableBadge}`}>{profile.pending ? (tamil ? 'Review pending' : 'Pending review') : (tamil ? 'கிடைக்கிறது' : 'Available')}</span>
          </div>
          <div className={styles.description}>{profile.description}</div>
          <Link className={styles.button} href={profile.target}>
            {profile.pending ? (tamil ? 'Application நிலையை பார்க்க' : 'View application') : (tamil ? 'இந்த profile சேர்க்க' : 'Add this profile')}
          </Link>
        </article>)}
      </div>
    </div> : null}
  </section>;
}
