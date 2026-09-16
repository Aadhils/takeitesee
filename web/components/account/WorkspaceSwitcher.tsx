'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './WorkspaceSwitcher.module.css';

type WorkspaceKind = 'customer' | 'professional' | 'business' | 'admin' | 'super_admin';
type WorkspaceOption = { id: WorkspaceKind; label: string; display_name: string; description: string; target: string; verified?: boolean };
type AddableProfileOption = { id: 'professional' | 'business'; label: string; display_name: string; description: string; target: string; pending: boolean };
type WorkspacePayload = { active?: WorkspaceKind; workspaces?: WorkspaceOption[]; addable_profiles?: AddableProfileOption[]; error?: string };

function providerRoleSummary(kind: 'professional' | 'business', tamil: boolean) {
  if (kind === 'professional') {
    return tamil
      ? 'Professional · தனிநபராக services வழங்குங்கள் + Job Seeker ஆக jobs தேடி, save செய்து, apply செய்து interviews மற்றும் offers-ஐ manage செய்யுங்கள்.'
      : 'Professional · Offer services independently + work as a job seeker: find, save and apply to jobs, then manage interviews and offers.';
  }
  return tamil
    ? 'Business · Business services நடத்துங்கள் + Employer ஆக jobs post செய்து, applicants review செய்து, interviews மற்றும் offers மூலம் hire செய்யுங்கள்.'
    : 'Business · Run your business services + work as an employer: post jobs, review applicants, schedule interviews and hire through offers.';
}

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
      .then(async (response) => { const payload = await response.json() as WorkspacePayload; if (!response.ok) throw new Error(payload.error || 'Unable to load workspaces.'); return payload; })
      .then((payload) => { if (cancelled) return; setWorkspaces(payload.workspaces ?? []); setAddableProfiles(payload.addable_profiles ?? []); setActive(currentWorkspace ?? payload.active); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load workspaces.'); });
    return () => { cancelled = true; };
  }, [currentWorkspace]);

  async function switchWorkspace(workspace: WorkspaceKind) {
    if (workspace === active) return;
    setSwitching(workspace); setError('');
    try {
      const response = await fetch('/api/account/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace }) });
      const payload = await response.json() as { redirect?: string; error?: string };
      if (!response.ok || !payload.redirect) throw new Error(payload.error || 'Unable to switch workspace.');
      window.location.assign(payload.redirect);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to switch workspace.'); setSwitching(null); }
  }

  if (!workspaces.length && !error) return null;

  const quickSwitch = workspaces.length > 1 ? <div className={`${styles.quickSwitch}${compact ? ` ${styles.quickSwitchCompact}` : ''}`} aria-label={tamil ? 'Workspace விரைவாக மாற்று' : 'Quick workspace switch'}>
    <div className={styles.quickSwitchLabel}>{tamil ? 'விரைவு மாற்றம்' : 'Quick switch'}</div>
    <div className={styles.quickSwitchOptions}>
      {workspaces.map((workspace) => {
        const selected = workspace.id === active;
        return <button
          key={`quick-${workspace.id}`}
          className={`${styles.quickSwitchButton} ${selected ? styles.quickSwitchCurrent : ''}`}
          type="button"
          disabled={switching !== null || selected}
          onClick={() => void switchWorkspace(workspace.id)}
          aria-current={selected ? 'page' : undefined}
        >
          <span className={styles.quickSwitchRole}>{workspace.label}</span>
          <span className={styles.quickSwitchName}>{workspace.display_name}</span>
          {selected ? <span className={styles.quickSwitchState}>{tamil ? 'தற்போது' : 'Current'}</span> : switching === workspace.id ? <span className={styles.quickSwitchState}>{tamil ? 'மாற்றப்படுகிறது…' : 'Switching…'}</span> : null}
        </button>;
      })}
    </div>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
  </div> : null;

  if (compact) return quickSwitch;

  const providerWorkspace = workspaces.find((workspace) => workspace.id === 'professional' || workspace.id === 'business');
  const pendingProfile = addableProfiles.find((profile) => profile.pending);
  const choices = addableProfiles.filter((profile) => !profile.pending);

  return <section className={styles.section} id="workspaces" aria-labelledby="workspace-switcher-title">
    {quickSwitch}
    <div className={styles.heading}>
      <h2 id="workspace-switcher-title">{tamil ? 'என் Profiles & Workspaces' : 'My profiles & workspaces'}</h2>
      <p>{tamil ? 'உங்கள் Customer workspace, நீங்கள் தேர்ந்தெடுத்த ஒரு Provider workspace மற்றும் அனுமதி உள்ள platform workspace-கள் இடையே மாறுங்கள்.' : 'Switch between your Customer workspace, your chosen Provider workspace and permitted platform workspaces.'}</p>
    </div>
    {error && !quickSwitch ? <div className={styles.error} role="alert">{error}</div> : null}
    <div className={styles.grid}>
      {workspaces.map((workspace) => { const selected = workspace.id === active; const roleSummary = workspace.id === 'professional' || workspace.id === 'business' ? providerRoleSummary(workspace.id, tamil) : null; return <article className={`${styles.card} ${selected ? styles.cardActive : ''}`} key={workspace.id}>
        <div className={styles.row}><div><div className={styles.role}>{workspace.label}</div><div className={styles.name}>{workspace.display_name}</div></div>{selected ? <span className={`${styles.badge} ${styles.activeBadge}`}>{tamil ? 'தற்போது' : 'Current'}</span> : workspace.verified ? <span className={styles.badge}>Verified</span> : null}</div>
        {roleSummary ? <div className={styles.description}>{roleSummary}</div> : null}
        <div className={styles.description}>{workspace.description}</div>
        <button className={styles.button} type="button" disabled={selected || switching !== null} onClick={() => void switchWorkspace(workspace.id)}>{selected ? (tamil ? 'இந்த workspace-ல் உள்ளீர்கள்' : 'You are here') : switching === workspace.id ? (tamil ? 'மாற்றப்படுகிறது…' : 'Switching…') : (tamil ? 'இந்த workspace திற' : 'Open workspace')}</button>
      </article>; })}
    </div>

    {choices.length ? <div className={styles.addSection}>
      <div className={styles.subheading}>
        <h3>{tamil ? 'TakeItEsee-ல் சம்பாதிக்க தொடங்குங்கள்' : 'Start earning on TakeItEsee'}</h3>
        <p>{tamil ? 'Professional அல்லது Business — ஒரு Provider identity மட்டும் தேர்வு செய்யுங்கள். Approval ஆன பிறகு அந்த Provider identity இந்த account-க்கு final.' : 'Choose one Provider identity: Professional or Business. After approval, that Provider identity is final for this account.'}</p>
      </div>
      <div className={styles.grid}>{choices.map((profile) => <article className={`${styles.card} ${styles.addCard}`} key={`add-${profile.id}`}>
        <div className={styles.row}><div><div className={styles.role}>{profile.label}</div><div className={styles.name}>{profile.display_name}</div></div><span className={`${styles.badge} ${styles.availableBadge}`}>{tamil ? 'தேர்வு செய்யலாம்' : 'Choose'}</span></div>
        <div className={styles.description}>{providerRoleSummary(profile.id, tamil)}</div>
        <div className={styles.description}>{profile.description}</div>
        <Link className={styles.button} href={profile.target}>{profile.id === 'professional' ? (tamil ? 'Professional தேர்வு செய்' : 'Choose Professional') : (tamil ? 'Business தேர்வு செய்' : 'Choose Business')}</Link>
      </article>)}</div>
    </div> : null}

    {pendingProfile ? <div className={styles.addSection}>
      <div className={styles.subheading}><h3>{tamil ? 'Provider application review-ல் உள்ளது' : 'Provider application under review'}</h3><p>{tamil ? `நீங்கள் ${pendingProfile.label} identity தேர்வு செய்துள்ளீர்கள். Review pending இருக்கும் வரை மற்ற provider type lock செய்யப்பட்டுள்ளது. Approval முன் தேர்வை மாற்ற வேண்டுமெனில் application-ஐ withdraw செய்யலாம்.` : `You selected the ${pendingProfile.label} identity. The other provider type is locked while review is pending. Withdraw before approval if you need to change your choice.`}</p></div>
      <div className={styles.grid}><article className={`${styles.card} ${styles.addCard}`}><div className={styles.row}><div><div className={styles.role}>{pendingProfile.label}</div><div className={styles.name}>{pendingProfile.display_name}</div></div><span className={`${styles.badge} ${styles.pendingBadge}`}>{tamil ? 'Review pending' : 'Pending review'}</span></div><div className={styles.description}>{providerRoleSummary(pendingProfile.id, tamil)}</div><div className={styles.description}>{pendingProfile.description}</div><Link className={styles.button} href={pendingProfile.target}>{tamil ? 'Application நிலையை பார்க்க' : 'View application'}</Link></article></div>
    </div> : null}

    {providerWorkspace ? <div className={styles.finalityNote}>
      <span className={styles.finalityBadge}>{tamil ? 'Final identity' : 'Final identity'}</span>
      <div><strong>{providerWorkspace.label}</strong><p>{tamil ? `இந்த account-ன் Provider identity ${providerWorkspace.label} ஆக final செய்யப்பட்டுள்ளது. Customer workspace தொடர்ந்து கிடைக்கும்.` : `This account's Provider identity is final as ${providerWorkspace.label}. Customer workspace remains available.`}</p></div>
    </div> : null}
  </section>;
}
