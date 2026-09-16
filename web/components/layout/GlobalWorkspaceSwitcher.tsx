'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './GlobalWorkspaceSwitcher.module.css';

type WorkspaceKind = 'customer' | 'professional' | 'business' | 'admin' | 'super_admin';
type WorkspaceOption = { id: WorkspaceKind; label: string; display_name: string; description: string; target: string; verified?: boolean };
type WorkspacePayload = { active?: WorkspaceKind; workspaces?: WorkspaceOption[]; error?: string };
type TriggerVariant = 'full' | 'identity';

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
  triggerVariant = 'full',
}: {
  fallbackName: string;
  tamil: boolean;
  attentionCount?: number;
  attentionLabel?: string;
  triggerVariant?: TriggerVariant;
}) {
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [active, setActive] = useState<WorkspaceKind>('customer');
  const [switching, setSwitching] = useState<WorkspaceKind | null>(null);
  const [error, setError] = useState('');
  const [anchor, setAnchor] = useState({ top: 80, right: 16 });

  const load = useCallback(async () => {
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
  }, [pathname]);

  const updateAnchor = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      top: Math.max(12, rect.bottom + 10),
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    updateAnchor();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updateAnchor);
    window.visualViewport?.addEventListener('resize', updateAnchor);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updateAnchor);
      window.visualViewport?.removeEventListener('resize', updateAnchor);
    };
  }, [load, open, updateAnchor]);

  const current = useMemo(() => workspaces.find((workspace) => workspace.id === active), [active, workspaces]);
  const triggerName = current?.display_name || fallbackName;
  const triggerRole = current?.label || (tamil ? 'வாடிக்கையாளர்' : 'Customer');
  const switchLabel = tamil ? 'Profile மாற்று' : 'Switch profile';
  const hideFullTriggerOnIdentityHome = triggerVariant === 'full' && (pathname === '/account' || pathname === '/provider');

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

  const overlayStyle = {
    '--switcher-top': `${anchor.top}px`,
    '--switcher-right': `${anchor.right}px`,
  } as CSSProperties;

  const overlay = open && mounted ? createPortal(<>
    <button
      type="button"
      className={styles.backdrop}
      aria-label={tamil ? 'Profile switcher மூடு' : 'Close profile switcher'}
      onClick={() => setOpen(false)}
    />
    <section
      className={styles.panel}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label={switchLabel}
    >
      <div className={styles.sheetHandle} aria-hidden="true" />
      <div className={styles.heading}>
        <div><span>TAKEITESEE ACCOUNT</span><h2>{switchLabel}</h2></div>
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
  </>, document.body) : null;

  if (hideFullTriggerOnIdentityHome) return null;

  return <div className={`${styles.root}${triggerVariant === 'identity' ? ` ${styles.rootIdentity}` : ''}`}>
    <button
      ref={triggerRef}
      type="button"
      className={`${styles.trigger}${triggerVariant === 'identity' ? ` ${styles.triggerIdentity}` : ''}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={triggerVariant === 'identity' ? switchLabel : undefined}
      title={triggerVariant === 'identity' ? switchLabel : undefined}
      onClick={() => {
        updateAnchor();
        setOpen((value) => !value);
      }}
    >
      {triggerVariant === 'identity' ? <svg className={styles.identityChevron} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 9 5 5 5-5" /></svg> : <>
        <span className={styles.triggerAvatar} aria-hidden="true">{initials(triggerName)}</span>
        <span className={styles.triggerText}>
          <strong>{triggerName}</strong>
          <small>{triggerRole}</small>
        </span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </>}
      {attentionCount > 0 ? <span className={styles.attention} aria-label={attentionLabel}>{attentionCount > 99 ? '99+' : attentionCount}</span> : null}
    </button>
    {overlay}
  </div>;
}
