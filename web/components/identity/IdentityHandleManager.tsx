'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '../ui/primitives';

type Props = {
  context: 'customer' | 'provider';
  locale?: string;
};

type HandlePayload = {
  context: 'customer' | 'provider';
  identity_type: 'customer' | 'professional' | 'business';
  handle: string | null;
  error?: string;
};

type SavePayload = {
  result?: {
    handle?: string;
    previous_handle?: string | null;
    identity_type?: string;
    changed?: boolean;
  };
  error?: string;
};

export default function IdentityHandleManager({ context, locale = 'en-IN' }: Props) {
  const tamil = locale.toLowerCase().startsWith('ta');
  const copy = useMemo(() => tamil ? {
    eyebrow: context === 'provider' ? 'Public provider identity' : 'Customer username',
    title: context === 'provider' ? 'உங்கள் public @handle' : 'உங்கள் @handle',
    intro: context === 'provider'
      ? 'உங்கள் Professional அல்லது Business profile-க்கு நினைவில் நிற்கும் TakeItEsee URL-ஐ அமைக்கவும். பழைய handle rename செய்தால் அது புதிய canonical handle-க்கு redirect ஆகும்.'
      : 'உங்கள் Customer identity-க்கு unique username reserve செய்யலாம். Customer public profile தற்போது publish செய்யப்படாது; உங்கள் private profile/media private-ஆகவே இருக்கும்.',
    label: 'Handle',
    hint: '3–30 characters. English letters, numbers, single hyphens. Spaces/underscores auto-normalize ஆகும்.',
    save: 'Handle save செய்யவும்',
    saving: 'Saving…',
    current: 'Current handle',
    notSet: 'இன்னும் handle அமைக்கப்படவில்லை',
    publicLink: 'Public profile link',
    copyLink: 'Link copy',
    copied: 'Copied',
    loading: 'Handle load ஆகிறது…',
    saved: 'Handle saved.',
    reserved: 'Customer public page தற்போது disabled; இந்த username மட்டும் reserve செய்யப்பட்டுள்ளது.',
  } : {
    eyebrow: context === 'provider' ? 'Public provider identity' : 'Customer username',
    title: context === 'provider' ? 'Your public @handle' : 'Your @handle',
    intro: context === 'provider'
      ? 'Choose a memorable TakeItEsee URL for your Professional or Business profile. If you rename it later, the old handle redirects to the new canonical handle.'
      : 'Reserve a unique username for your Customer identity. Customer public profiles are not published yet, so your private profile and media remain private.',
    label: 'Handle',
    hint: '3–30 characters. English letters, numbers and single hyphens. Spaces and underscores are normalized automatically.',
    save: 'Save handle',
    saving: 'Saving…',
    current: 'Current handle',
    notSet: 'No handle set yet',
    publicLink: 'Public profile link',
    copyLink: 'Copy link',
    copied: 'Copied',
    loading: 'Loading handle…',
    saved: 'Handle saved.',
    reserved: 'Customer public pages are currently disabled; this username is reserved only.',
  }, [context, tamil]);

  const [handle, setHandle] = useState<string | null>(null);
  const [input, setInput] = useState('');
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
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load handle.');
      setHandle(payload.handle);
      setInput(payload.handle ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load handle.');
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
      if (!response.ok) throw new Error(payload.error ?? 'Unable to save handle.');
      const nextHandle = String(payload.result?.handle ?? '').trim();
      setHandle(nextHandle || null);
      setInput(nextHandle);
      setNotice(copy.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save handle.');
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = context === 'provider' && handle ? `https://www.takeitesee.com/@${handle}` : null;

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

  return <Card>
    <div className="section-heading">
      <div><span className="eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2></div>
      {handle ? <Badge tone="success">@{handle}</Badge> : <Badge tone="neutral">{copy.notSet}</Badge>}
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
      </div> : <p className="summary-note">{copy.reserved}</p>}
    </div> : null}
  </Card>;
}
