'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const copy = useMemo(() => tamil ? {
    eyebrow: 'Public identity',
    title: 'உங்கள் @handle',
    intro: 'Professional / Business public profile-க்கு ஒரு short TakeItEsee username reserve செய்யுங்கள்.',
    label: 'Public handle',
    hint: '3–30 characters. English letters, numbers, hyphen மட்டும்.',
    save: 'Save handle',
    change: 'Change handle',
    cancel: 'Cancel',
    copy: 'Copy link',
    copied: 'Copied',
    current: 'Current',
    noHandle: 'Handle இன்னும் set செய்யவில்லை',
    live: 'Live',
    reserved: 'Reserved',
    liveHelp: 'Public profile live. இந்த link-ஐ share செய்யலாம்.',
    reservedHelp: 'Handle reserve ஆகியுள்ளது. Public readiness complete ஆனதும் இதே link live ஆகும்.',
    readiness: 'Public readiness',
    loading: 'Handle load ஆகிறது…',
    saved: 'Handle saved.',
  } : {
    eyebrow: 'Public identity',
    title: 'Your @handle',
    intro: 'Reserve one short TakeItEsee username for your Professional or Business public profile.',
    label: 'Public handle',
    hint: '3–30 characters. Use English letters, numbers and hyphens.',
    save: 'Save handle',
    change: 'Change handle',
    cancel: 'Cancel',
    copy: 'Copy link',
    copied: 'Copied',
    current: 'Current',
    noHandle: 'No handle set yet',
    live: 'Live',
    reserved: 'Reserved',
    liveHelp: 'Your public profile is live. This link can be shared.',
    reservedHelp: 'Your handle is reserved. This same link becomes live after public readiness is complete.',
    readiness: 'Public readiness',
    loading: 'Loading handle…',
    saved: 'Handle saved.',
  }, [tamil]);

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

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/identity-handle?context=provider', { cache: 'no-store' });
      const body = await response.json() as HandlePayload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load handle.');
      setHandle(body.handle);
      setInput(body.handle ?? '');
      setPublicReady(Boolean(body.public_profile_ready));
      setReadinessHref(body.readiness_href ?? null);
      if (!body.handle) setEditing(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load handle.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
      if (!response.ok) throw new Error(body.error ?? 'Unable to save handle.');
      const nextHandle = String(body.result?.handle ?? '').trim();
      setHandle(nextHandle || null);
      setInput(nextHandle);
      setPublicReady(Boolean(body.public_profile_ready));
      setReadinessHref(body.readiness_href ?? null);
      setEditing(false);
      setNotice(copy.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save handle.');
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

  return <section id="provider-handle" className={styles.center} aria-label="Provider public handle controls">
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <Badge tone={handle ? (publicReady ? 'success' : 'warning') : 'neutral'}>
          {handle ? `@${handle} · ${publicReady ? copy.live : copy.reserved}` : copy.noHandle}
        </Badge>
      </div>

      {loading ? <p>{copy.loading}</p> : <>
        {handle && !editing ? <div className={styles.summary}>
          <div className={styles.handleValue}><small>{copy.current}</small><strong>@{handle}</strong><span>{publicUrl}</span></div>
          <p>{publicReady ? copy.liveHelp : copy.reservedHelp}</p>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>{copy.change}</Button>
            {publicReady ? <Button type="button" variant="secondary" onClick={() => void copyLink()}>{copied ? copy.copied : copy.copy}</Button> : null}
            {!publicReady && readinessHref ? <Link href={readinessHref} className={styles.primaryLink}>{copy.readiness}</Link> : null}
          </div>
        </div> : null}

        {editing ? <form onSubmit={save} className={styles.form}>
          <Input
            label={copy.label}
            hint={copy.hint}
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
            <Button type="submit" loading={saving}>{copy.save}</Button>
            {handle ? <Button type="button" variant="secondary" onClick={() => { setEditing(false); setInput(handle); setError(''); }}>{copy.cancel}</Button> : null}
          </div>
        </form> : null}
      </>}

      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </Card>
  </section>;
}
