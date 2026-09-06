'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './RoleIdentityMediaHeader.module.css';

type IdentityContext = 'customer' | 'provider';
type IdentityScope = 'customer' | 'professional' | 'business';
type MediaKind = 'avatar' | 'banner';
type IdentityMedia = {
  scope: IdentityScope;
  entity_id: string;
  upload_prefix: string;
  avatar_url: string | null;
  banner_url: string | null;
  has_avatar: boolean;
  has_banner: boolean;
};

const BUCKET = 'identity-media';
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 6 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function scopeLabel(scope: IdentityScope, tamil: boolean) {
  if (scope === 'business') return tamil ? 'Business பிராண்ட்' : 'Business brand';
  if (scope === 'professional') return tamil ? 'Professional அடையாளம்' : 'Professional identity';
  return tamil ? 'Personal account' : 'Personal account';
}

export default function RoleIdentityMediaHeader({
  context,
  displayName,
  subtitle,
  meta,
}: {
  context: IdentityContext;
  displayName: string;
  subtitle: string;
  meta?: string;
}) {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale === 'ta-IN';
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const bannerInput = useRef<HTMLInputElement | null>(null);
  const [identity, setIdentity] = useState<IdentityMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<MediaKind | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const endpoint = `/api/identity-media?context=${context}`;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(endpoint, { cache: 'no-store' });
        const body = await response.json() as { identity?: IdentityMedia; error?: string };
        if (!response.ok || !body.identity) throw new Error(body.error ?? 'Unable to load identity media.');
        if (active) setIdentity(body.identity);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load identity media.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [endpoint]);

  const bannerClass = useMemo(() => {
    const scope = identity?.scope ?? (context === 'customer' ? 'customer' : 'professional');
    if (scope === 'business') return styles.bannerBusiness;
    if (scope === 'professional') return styles.bannerProfessional;
    return styles.bannerCustomer;
  }, [context, identity?.scope]);

  const upload = async (kind: MediaKind, file: File | null) => {
    if (!file || !identity || working) return;
    if (!allowedTypes.has(file.type)) {
      setError(tamil ? 'JPEG, PNG அல்லது WebP image மட்டும் upload செய்யவும்.' : 'Upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size <= 0 || file.size > maxBytes) {
      setError(tamil ? 'Image 6 MB அல்லது அதற்கு குறைவாக இருக்க வேண்டும்.' : 'Images must be 6 MB or smaller.');
      return;
    }

    setWorking(kind);
    setError('');
    setNotice('');
    const supabase = createSupabaseBrowserClient();
    const objectPath = `${identity.upload_prefix}/${kind}/${crypto.randomUUID()}.${extensionFor(file)}`;

    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, object_path: objectPath }),
      });
      const body = await response.json() as { identity?: IdentityMedia; error?: string };
      if (!response.ok || !body.identity) {
        await supabase.storage.from(BUCKET).remove([objectPath]);
        throw new Error(body.error ?? 'Identity media could not be saved.');
      }
      setIdentity(body.identity);
      setNotice(kind === 'avatar'
        ? (tamil ? 'Profile picture update செய்யப்பட்டது.' : 'Profile picture updated.')
        : (tamil ? 'Background banner update செய்யப்பட்டது.' : 'Background banner updated.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (tamil ? 'Image upload செய்ய முடியவில்லை.' : 'Unable to upload image.'));
    } finally {
      setWorking(null);
      if (kind === 'avatar' && avatarInput.current) avatarInput.current.value = '';
      if (kind === 'banner' && bannerInput.current) bannerInput.current.value = '';
    }
  };

  const remove = async (kind: MediaKind) => {
    if (!identity || working) return;
    const confirmed = window.confirm(kind === 'avatar'
      ? (tamil ? 'Profile picture-ஐ remove செய்யவா?' : 'Remove this profile picture?')
      : (tamil ? 'Background banner-ஐ remove செய்யவா?' : 'Remove this background banner?'));
    if (!confirmed) return;

    setWorking(kind);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const body = await response.json() as { identity?: IdentityMedia; error?: string };
      if (!response.ok || !body.identity) throw new Error(body.error ?? 'Identity media could not be removed.');
      setIdentity(body.identity);
      setNotice(kind === 'avatar'
        ? (tamil ? 'Profile picture remove செய்யப்பட்டது.' : 'Profile picture removed.')
        : (tamil ? 'Background banner remove செய்யப்பட்டது.' : 'Background banner removed.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (tamil ? 'Image remove செய்ய முடியவில்லை.' : 'Unable to remove image.'));
    } finally {
      setWorking(null);
    }
  };

  const hasAvatar = Boolean(identity?.has_avatar && identity.avatar_url);
  const hasBanner = Boolean(identity?.has_banner && identity.banner_url);

  return <section className={styles.shell} aria-label={tamil ? 'Profile identity media' : 'Profile identity media'}>
    <div className={`${styles.banner} ${bannerClass}`}>
      {identity?.banner_url ? <img className={styles.bannerImage} src={identity.banner_url} alt="" /> : null}
      <div className={styles.bannerShade} />
      <div className={styles.bannerActions}>
        <button type="button" className={styles.mediaButton} disabled={loading || Boolean(working) || !identity} onClick={() => bannerInput.current?.click()}>
          {working === 'banner' ? (tamil ? 'Uploading…' : 'Uploading…') : hasBanner ? (tamil ? 'Banner மாற்று' : 'Change banner') : (tamil ? 'Banner சேர்' : 'Add banner')}
        </button>
        {hasBanner ? <button type="button" className={styles.mediaButtonDanger} disabled={Boolean(working)} onClick={() => void remove('banner')}>{tamil ? 'Remove' : 'Remove'}</button> : null}
      </div>
    </div>

    <div className={styles.content}>
      <div className={styles.avatarWrap}>
        {identity?.avatar_url
          ? <img className={styles.avatar} src={identity.avatar_url} alt={`${displayName} profile`} />
          : <div className={styles.avatarFallback} aria-hidden="true">{initials(displayName)}</div>}
        <button type="button" className={styles.avatarEdit} disabled={loading || Boolean(working) || !identity} onClick={() => avatarInput.current?.click()} aria-label={hasAvatar ? 'Change profile picture' : 'Add profile picture'}>
          {working === 'avatar' ? '…' : '✎'}
        </button>
      </div>

      <div className={styles.identity}>
        <div className={styles.identityTop}>
          <h2>{displayName}</h2>
          <span className={styles.scopePill}>{scopeLabel(identity?.scope ?? (context === 'customer' ? 'customer' : 'professional'), tamil)}</span>
        </div>
        <p className={styles.subtitle}>{subtitle}</p>
        {meta ? <p className={styles.meta}>{meta}</p> : null}
      </div>

      <div className={styles.avatarControls}>
        <button type="button" className={styles.secondaryButton} disabled={loading || Boolean(working) || !identity} onClick={() => avatarInput.current?.click()}>
          {hasAvatar ? (tamil ? 'Photo மாற்று' : 'Change photo') : (tamil ? 'Photo சேர்' : 'Add photo')}
        </button>
        {hasAvatar ? <button type="button" className={styles.removeButton} disabled={Boolean(working)} onClick={() => void remove('avatar')}>{tamil ? 'Photo remove' : 'Remove photo'}</button> : null}
      </div>

      <p className={styles.hint}>{tamil
        ? 'JPEG / PNG / WebP · அதிகபட்சம் 6 MB. Profile photo square image, banner wide image பயன்படுத்தினால் சிறந்த தோற்றம் கிடைக்கும்.'
        : 'JPEG / PNG / WebP · max 6 MB. A square profile photo and a wide banner give the best result.'}</p>
    </div>

    {loading ? <p className={styles.status} role="status">{tamil ? 'Profile media load ஆகிறது…' : 'Loading profile media…'}</p> : null}
    {notice ? <p className={styles.status} role="status">{notice}</p> : null}
    {error ? <p className={`${styles.status} ${styles.error}`} role="alert">{error}</p> : null}

    <input ref={avatarInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload('avatar', event.target.files?.[0] ?? null)} />
    <input ref={bannerInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload('banner', event.target.files?.[0] ?? null)} />
  </section>;
}
