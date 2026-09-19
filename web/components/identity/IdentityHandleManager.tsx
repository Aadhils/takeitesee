'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Badge, Button, Card, Input } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type Props = {
  context: 'customer' | 'provider';
};

type HandlePayload = {
  context: 'customer' | 'provider';
  identity_type: 'customer' | 'professional' | 'business';
  handle: string | null;
  public_profile_ready?: boolean;
  readiness_href?: string | null;
  error?: string;
};

type SavePayload = {
  result?: {
    handle?: string;
    previous_handle?: string | null;
    identity_type?: string;
    changed?: boolean;
  };
  public_profile_ready?: boolean;
  readiness_href?: string | null;
  error?: string;
};

export default function IdentityHandleManager({ context }: Props) {
  const { t } = useIdentityWorkspaceTranslations();
  const copy = {
    eyebrow: t(context === 'provider' ? 'identity.handle.providerEyebrow' : 'identity.handle.customerEyebrow'),
    title: t(context === 'provider' ? 'identity.handle.providerTitle' : 'identity.handle.customerTitle'),
    intro: t(context === 'provider' ? 'identity.handle.providerIntro' : 'identity.handle.customerIntro'),
    label: t('identity.handle.label'),
    hint: t('identity.handle.hint'),
    save: t('identity.handle.save'),
    saving: t('identity.handle.saving'),
    current: t('identity.handle.current'),
    notSet: t('identity.handle.notSet'),
    publicLink: t('identity.handle.publicLink'),
    reservedLink: t('identity.handle.reservedLink'),
    copyLink: t('identity.handle.copyLink'),
    copied: t('identity.handle.copied'),
    loading: t('identity.handle.loading'),
    saved: t('identity.handle.saved'),
    savedLive: t('identity.handle.savedLive'),
    savedReserved: t('identity.handle.savedReserved'),
    reserved: t('identity.handle.customerReserved'),
    providerReservedTitle: t('identity.handle.providerReservedTitle'),
    providerReservedBody: t('identity.handle.providerReservedBody'),
    completeReadiness: t('identity.handle.completeReadiness'),
    live: t('identity.handle.live'),
    reservedBadge: t('identity.handle.reservedBadge'),
  };

  const [handle, setHandle] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [publicProfileReady, setPublicProfileReady] = useState(false);
  const [readinessHref, setReadinessHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/identity-handle?context=${context}`, { cache: 'no-store' });
      const payload = await response.json() as HandlePayload;
      if (!response.ok) throw new Error(payload.error ?? t('identity.handle.loadFallback'));
      setHandle(payload.handle);
      setInput(payload.handle ?? '');
      setPublicProfileReady(Boolean(payload.public_profile_ready));
      setReadinessHref(payload.readiness_href ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('identity.handle.loadFallback'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [context]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/identity-handle?context=${context}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: input }),
      });
      const payload = await response.json() as SavePayload;
      if (!response.ok) throw new Error(payload.error ?? t('identity.handle.saveFallback'));
      const nextHandle = String(payload.result?.handle ?? '').trim();
      const nextReady = Boolean(payload.public_profile_ready);
      setHandle(nextHandle || null);
      setInput(nextHandle);
      setPublicProfileReady(nextReady);
      setReadinessHref(payload.readiness_href ?? null);
      setNotice(context === 'provider'
        ? nextReady ? copy.savedLive : copy.savedReserved
        : copy.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('identity.handle.saveFallback'));
    } finally {
      setSaving(false);
    }
  };

  const reservedProviderUrl = context === 'provider' && handle ? `https://www.takeitesee.com/@${handle}` : null;
  const publicUrl = reservedProviderUrl && publicProfileReady ? reservedProviderUrl : null;

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const badge = handle
    ? context === 'provider'
      ? <Badge tone={publicProfileReady ? 'success' : 'warning'}>@{handle} · {publicProfileReady ? copy.live : copy.reservedBadge}</Badge>
      : <Badge tone="neutral">@{handle}</Badge>
    : <Badge tone="neutral">{copy.notSet}</Badge>;

  return <Card>
    <div className="section-heading">
      <div><span className="eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2></div>
      {badge}
    </div>
    <p>{copy.intro}</p>
    {loading ? <p>{copy.loading}</p> : <form onSubmit={save} className="section-stack">
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
      <div className="button-row"><Button type="submit" loading={saving}>{saving ? copy.saving : copy.save}</Button></div>
    </form>}
    {error ? <p className="field-error" role="alert">{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {handle ? <div className="section-stack">
      <p className="summary-note"><strong>{copy.current}:</strong> @{handle}</p>
      {publicUrl ? <div>
        <p className="summary-note"><strong>{copy.publicLink}:</strong> {publicUrl}</p>
        <div className="button-row"><Button type="button" variant="secondary" onClick={() => void copyPublicLink()}>{copied ? copy.copied : copy.copyLink}</Button></div>
      </div> : context === 'provider' && reservedProviderUrl ? <div className="section-stack">
        <p className="summary-note"><strong>{copy.reservedLink}:</strong> {reservedProviderUrl}</p>
        <div>
          <strong>{copy.providerReservedTitle}</strong>
          <p>{copy.providerReservedBody}</p>
        </div>
        {readinessHref ? <div className="button-row"><Link href={readinessHref} className="button button-primary">{copy.completeReadiness}</Link></div> : null}
      </div> : <p className="summary-note">{copy.reserved}</p>}
    </div> : null}
  </Card>;
}
