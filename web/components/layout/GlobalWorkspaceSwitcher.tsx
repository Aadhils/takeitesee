'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './GlobalWorkspaceSwitcher.module.css';

type WorkspaceKind = 'customer' | 'professional' | 'business' | 'admin' | 'super_admin';
type WorkspaceOption = { id: WorkspaceKind; label: string; display_name: string; description: string; target: string; verified?: boolean };
type WorkspacePayload = { active?: WorkspaceKind; workspaces?: WorkspaceOption[]; error?: string };

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A';
}

function activeFromRoute(pathname: string, workspaces: WorkspaceOption[], fallback: WorkspaceKind) {
  if (pathname.startsWith('/provider')) return workspaces.find((workspace) => workspace.id === 'professional' || workspace.id === 'business')?.id ?? fallback;
  if (pathname.startsWith('/super-admin') && workspaces.some((workspace) => workspace.id === 'super_admin')) return 'super_admin';
  if (pathname.startsWith('/admin') && workspaces.some((workspace) => workspace.id === 'admin')) return 'admin';
  if (pathname.startsWith('/account')) return 'customer';
  return fallback;
}

export default function GlobalWorkspaceSwitcher({
  fallbackName,
  tamil,
  attentionCount = 0,
  attentionLabel,
}: {
  fallbackName: string;
  tamil: boolean;
  attentionCount?: number;
  attentionLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [active, setActive] = useState<WorkspaceKind>('customer');
  const [switching, setSwitching] = useState<WorkspaceKind | null>(null);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const response = await fetch('/api/account/workspaces', { cache: 'no-store' });
      const payload = await response.json() as WorkspacePayload;
      if (!response.ok) throw new Error(payload.error || 'Unable to load profiles.');
      const options = payload.workspaces ?? [];
      const fallbackActive = payload.active ?? 'customer';
      setWorkspaces(options);
      setActive(activeFromRoute(pathname, options, fallbackActive));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load profiles.');
    }
  };

  useEffect(() => { void load(); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    void load();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const closeOnOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOnOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOnOutside);
    };
  }, [open, pathname]);

  const current = useMemo(() => workspaces.find((workspace) => workspace.id === active), [active, workspaces]);
  const triggerName = current?.display_name || fallbackName;
  const triggerRole = current?.label || (tamil ? 'வாடிக்கையாளர்' : 'Customer');

  async function switchWorkspace(workspace: WorkspaceKind) {
    if (workspace === active || switching) return;
    setSwitching(workspace);
    setError('');
    try {
      const response = await fetch('/api/account/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace }),
      });
      const payload = await response.json() as { redirect?: string; error?: string };
      if (!response.ok || !payload.redirect) throw new Error(payload.error || 'Unable to switch profile.');
      window.location.assign(payload.redirect);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to switch profile.');
      setSwitching(null);
    }
  }

  return <div className={styles.root} ref={rootRef}>
    <button
      type="button"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
    >
      <span className={styles.triggerAvatar} aria-hidden="true">{initials(triggerName)}</span>
      <span className={styles.triggerText}>
        <strong>{triggerName}</strong>
        <small>{triggerRole}</small>
      </span>
      <span className={styles.chevron} aria-hidden="true">⌄</span>
      {attentionCount > 0 ? <span className={styles.attention} aria-label={attentionLabel}>{attentionCount > 99 ? '99+' : attentionCount}</span> : null}
    </button>

    {open ? <>
      <button type="button" className={styles.backdrop} aria-label={tamil ? 'Profile switcher மூடு' : 'Close profile switcher'} onClick={() => setOpen(false)} />
      <section className={styles.panel} role="dialog" aria-modal="false" aria-label={tamil ? 'Profile மாற்று' : 'Switch profile'}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.heading}>
          <div><span>TAKEITESEE ACCOUNT</span><h2>{tamil ? 'Profile மாற்று' : 'Switch profile'}</h2></div>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={tamil ? 'மூடு' : 'Close'}>×</button>
        </div>

        <div className={styles.list}>
          {workspaces.map((workspace) => {
            const selected = workspace.id === active;
            return <button
              type="button"
              className={`${styles.workspace}${selected ? ` ${styles.workspaceCurrent}` : ''}`}
              key={workspace.id}
              disabled={selected || Boolean(switching)}
              onClick={() => void switchWorkspace(workspace.id)}
              aria-current={selected ? 'page' : undefined}
            >
              <span className={styles.avatar} aria-hidden="true">{initials(workspace.display_name)}</span>
              <span className={styles.workspaceText}><strong>{workspace.display_name}</strong><small>{workspace.label}{workspace.verified ? ` · ${tamil ? 'சரிபார்க்கப்பட்டது' : 'Verified'}` : ''}</small></span>
              <span className={styles.state}>{selected ? '✓' : switching === workspace.id ? '…' : '›'}</span>
            </button>;
          })}
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <Link className={styles.manage} href="/account" onClick={() => setOpen(false)}>{tamil ? 'Account & profiles நிர்வகிக்க' : 'Manage account & profiles'}</Link>
      </section>
    </> : null}
  </div>;
}
