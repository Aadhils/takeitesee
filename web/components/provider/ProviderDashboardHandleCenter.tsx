'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Input } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderDashboardHandleCenter.module.css';

type HandlePayload = {
  handle: string | null;
  public_profile_ready?: boolean;
  readiness_href?: string | null;
  error?: string;
};

type SavePayload = {
  result?: { handle?: string; previous_handle?: string | null };
  public_profile_ready?: boolean;
  readiness_href?: string | null;
  error?: string;
};

export default function ProviderDashboardHandleCenter() {
  const { t } = useIdentityWorkspaceTranslations();

  const [handle, setHandle] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [publicReady, setPublicReady] = useState(false);
  const [readinessHref, setReadinessHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/identity-handle?context=provider', { cache: 'no-store' });
      const body = await response.json() as HandlePayload;
      if (!response.ok) throw new Error(body.error ?? t('provider.handle.loadFallback'));
      setHandle(body.handle);
      setInput(body.handle ?? '');
      setPublicReady(Boolean(body.public_profile_ready));
      setReadinessHref(body.readiness_href ?? null);
      if (!body.handle) setEditing(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.handle.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/identity-handle?context=provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: input }),
      });
      const body = await response.json() as SavePayload;
      if (!response.ok) throw new Error(body.error ?? t('provider.handle.saveFallback'));
      const nextHandle = String(body.result?.handle ?? '').trim();
      setHandle(nextHandle || null);
      setInput(nextHandle);
      setPublicReady(Boolean(body.public_profile_ready));
      setReadinessHref(body.readiness_href ?? null);
      setEditing(false);
      setNotice(t('provider.handle.save')d);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.handle.saveFallback'));
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = handle ? `https://www.takeitesee.com/@${handle}` : null;
  const copyLink = async () => {
    if (!publicUrl || !publicReady) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return <section id="provider-handle" className={styles.center} aria-label={t('provider.handle.controlsLabel')}>
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t('provider.handle.eyebrow')}</span>
          <h2>{t('provider.handle.title')}</h2>
          <p>{t('provider.handle.intro')}</p>
        </div>
        <Badge tone={handle ? (publicReady ? 'success' : 'warning') : 'neutral'}>
          {handle ? `@${handle} · ${publicReady ? t('provider.handle.live') : t('provider.handle.reserved')}` : t('provider.handle.noHandle')}
        </Badge>
      </div>

      {loading ? <p>{t('provider.handle.loading')}</p> : <>
        {handle && !editing ? <div className={styles.summary}>
          <div className={styles.handleValue}><small>{t('provider.handle.current')}</small><strong>@{handle}</strong><span>{publicUrl}</span></div>
          <p>{publicReady ? t('provider.handle.live')Help : t('provider.handle.reserved')Help}</p>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>{t('provider.handle.change')}</Button>
            {publicReady ? <Button type="button" variant="secondary" onClick={() => void copyLink()}>{copied ? t('provider.handle.copied') : t('provider.handle.copyLink')}</Button> : null}
            {!publicReady && readinessHref ? <Link href={readinessHref} className={styles.primaryLink}>{t('provider.handle.readiness')}</Link> : null}
          </div>
        </div> : null}

        {editing ? <form onSubmit={save} className={styles.form}>
          <Input
            label={t('provider.handle.label')}
            hint={t('provider.handle.hint')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="your-name"
            minLength={3}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <div className={styles.actions}>
            <Button type="submit" loading={saving}>{t('provider.handle.save')}</Button>
            {handle ? <Button type="button" variant="secondary" onClick={() => { setEditing(false); setInput(handle); setError(''); }}>{t('provider.handle.cancel')}</Button> : null}
          </div>
        </form> : null}
      </>}

      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </Card>
  </section>;
}
