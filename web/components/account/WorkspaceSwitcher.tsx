'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './WorkspaceSwitcher.module.css';

type WorkspaceKind = 'customer' | 'professional' | 'business' | 'admin' | 'super_admin';
type WorkspaceOption = { id: WorkspaceKind; label: string; display_name: string; description: string; target: string; verified?: boolean };
type AddableProfileOption = { id: 'professional' | 'business'; label: string; display_name: string; description: string; target: string; pending: boolean };
type WorkspacePayload = { active?: WorkspaceKind; workspaces?: WorkspaceOption[]; addable_profiles?: AddableProfileOption[]; error?: string };
type WorkspaceTranslator = ReturnType<typeof useIdentityWorkspaceTranslations>['t'];

function providerRoleSummary(kind: 'professional' | 'business', t: WorkspaceTranslator) {
  return kind === 'professional'
    ? t('workspace.switcher.professionalSummary')
    : t('workspace.switcher.businessSummary');
}

export function WorkspaceSwitcher({ currentWorkspace, compact = false }: { currentWorkspace?: WorkspaceKind; compact?: boolean }) {
  const { t } = useIdentityWorkspaceTranslations();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [addableProfiles, setAddableProfiles] = useState<AddableProfileOption[]>([]);
  const [active, setActive] = useState<WorkspaceKind | undefined>(currentWorkspace);
  const [switching, setSwitching] = useState<WorkspaceKind | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/account/workspaces', { cache: 'no-store' })
      .then(async (response) => { const payload = await response.json() as WorkspacePayload; if (!response.ok) throw new Error(payload.error || t('workspace.switcher.unableLoad')); return payload; })
      .then((payload) => { if (cancelled) return; setWorkspaces(payload.workspaces ?? []); setAddableProfiles(payload.addable_profiles ?? []); setActive(currentWorkspace ?? payload.active); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t('workspace.switcher.unableLoad')); });
    return () => { cancelled = true; };
  }, [currentWorkspace, t]);

  async function switchWorkspace(workspace: WorkspaceKind) {
    if (workspace === active) return;
    setSwitching(workspace); setError('');
    try {
      const response = await fetch('/api/account/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace }) });
      const payload = await response.json() as { redirect?: string; error?: string };
      if (!response.ok || !payload.redirect) throw new Error(payload.error || t('workspace.switcher.unableSwitch'));
      window.location.assign(payload.redirect);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('workspace.switcher.unableSwitch')); setSwitching(null); }
  }

  if (compact) return null;
  if (!workspaces.length && !error) return null;

  const providerWorkspace = workspaces.find((workspace) => workspace.id === 'professional' || workspace.id === 'business');
  const pendingProfile = addableProfiles.find((profile) => profile.pending);
  const choices = addableProfiles.filter((profile) => !profile.pending);

  return <section className={styles.section} id="workspaces" aria-labelledby="workspace-switcher-title">
    <div className={styles.heading}>
      <h2 id="workspace-switcher-title">{t('workspace.switcher.heading')}</h2>
      <p>{t('workspace.switcher.description')}</p>
    </div>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    <div className={styles.grid}>
      {workspaces.map((workspace) => { const selected = workspace.id === active; const roleSummary = workspace.id === 'professional' || workspace.id === 'business' ? providerRoleSummary(workspace.id, t) : null; return <article className={`${styles.card} ${selected ? styles.cardActive : ''}`} key={workspace.id}>
        <div className={styles.row}><div><div className={styles.role}>{workspace.label}</div><div className={styles.name}>{workspace.display_name}</div></div>{selected ? <span className={`${styles.badge} ${styles.activeBadge}`}>{t('workspace.switcher.current')}</span> : workspace.verified ? <span className={styles.badge}>{t('workspace.switcher.verified')}</span> : null}</div>
        {roleSummary ? <div className={styles.description}>{roleSummary}</div> : null}
        <div className={styles.description}>{workspace.description}</div>
        <button className={styles.button} type="button" disabled={selected || switching !== null} onClick={() => void switchWorkspace(workspace.id)}>{selected ? t('workspace.switcher.youAreHere') : switching === workspace.id ? t('workspace.switcher.switching') : t('workspace.switcher.openWorkspace')}</button>
      </article>; })}
    </div>

    {choices.length ? <div className={styles.addSection}>
      <div className={styles.subheading}>
        <h3>{t('workspace.switcher.startEarning')}</h3>
        <p>{t('workspace.switcher.chooseProviderIdentity')}</p>
      </div>
      <div className={styles.grid}>{choices.map((profile) => <article className={`${styles.card} ${styles.addCard}`} key={`add-${profile.id}`}>
        <div className={styles.row}><div><div className={styles.role}>{profile.label}</div><div className={styles.name}>{profile.display_name}</div></div><span className={`${styles.badge} ${styles.availableBadge}`}>{t('workspace.switcher.choose')}</span></div>
        <div className={styles.description}>{providerRoleSummary(profile.id, t)}</div>
        <div className={styles.description}>{profile.description}</div>
        <Link className={styles.button} href={profile.target}>{profile.id === 'professional' ? t('workspace.switcher.chooseProfessional') : t('workspace.switcher.chooseBusiness')}</Link>
      </article>)}</div>
    </div> : null}

    {pendingProfile ? <div className={styles.addSection}>
      <div className={styles.subheading}><h3>{t('workspace.switcher.reviewHeading')}</h3><p>{t('workspace.switcher.reviewBody').replace('{label}', pendingProfile.label)}</p></div>
      <div className={styles.grid}><article className={`${styles.card} ${styles.addCard}`}><div className={styles.row}><div><div className={styles.role}>{pendingProfile.label}</div><div className={styles.name}>{pendingProfile.display_name}</div></div><span className={`${styles.badge} ${styles.pendingBadge}`}>{t('workspace.switcher.reviewPending')}</span></div><div className={styles.description}>{providerRoleSummary(pendingProfile.id, t)}</div><div className={styles.description}>{pendingProfile.description}</div><Link className={styles.button} href={pendingProfile.target}>{t('workspace.switcher.viewApplication')}</Link></article></div>
    </div> : null}

    {providerWorkspace ? <div className={styles.finalityNote}>
      <span className={styles.finalityBadge}>{t('workspace.switcher.finalIdentity')}</span>
      <div><strong>{providerWorkspace.label}</strong><p>{t('workspace.switcher.finalBody').replace('{label}', providerWorkspace.label)}</p></div>
    </div> : null}
  </section>;
}
