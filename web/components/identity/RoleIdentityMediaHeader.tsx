'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { ProviderReadinessSummary } from '../account/ProviderReadinessSummary';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import GlobalWorkspaceSwitcher from '../layout/GlobalWorkspaceSwitcher';
import styles from './RoleIdentityMediaHeader.module.css';

type IdentityContext = 'customer' | 'provider';
type IdentityScope = 'customer' | 'professional' | 'business';
type MediaKind = 'avatar' | 'banner';
type IdentityMedia = { scope: IdentityScope; entity_id: string; bucket: string; upload_prefix: string; avatar_url: string | null; banner_url: string | null; has_avatar: boolean; has_banner: boolean; };

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 6 * 1024 * 1024;

function extensionFor(file: File) { if (file.type === 'image/png') return 'png'; if (file.type === 'image/webp') return 'webp'; return 'jpg'; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'; }
export default function RoleIdentityMediaHeader({ context, displayName, subtitle, meta }: { context: IdentityContext; displayName: string; subtitle: string; meta?: string; }) {
  const { t } = useIdentityWorkspaceTranslations();
  const scopeLabel = (scope: IdentityScope) => {
    if (scope === 'business') return t('identity.media.scopeBusinessBrand');
    if (scope === 'professional') return t('identity.media.scopeProfessionalIdentity');
    return t('identity.media.scopePersonalAccount');
  };
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
        setLoading(true); setError('');
        const response = await fetch(endpoint, { cache: 'no-store' });
        const body = await response.json() as { identity?: IdentityMedia; error?: string };
        if (!response.ok || !body.identity) throw new Error(body.error ?? t('identity.media.loadFallback'));
        if (active) setIdentity(body.identity);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : t('identity.media.loadFallback')); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [endpoint, t]);

  const bannerClass = useMemo(() => {
    const scope = identity?.scope ?? (context === 'customer' ? 'customer' : 'professional');
    if (scope === 'business') return styles.bannerBusiness;
    if (scope === 'professional') return styles.bannerProfessional;
    return styles.bannerCustomer;
  }, [context, identity?.scope]);

  const chooseUpload = (kind: MediaKind) => {
    const guidance = kind === 'avatar'
      ? t('identity.media.avatarGuidance')
      : t('identity.media.bannerGuidance');
    if (!window.confirm(guidance)) return;
    if (kind === 'avatar') avatarInput.current?.click(); else bannerInput.current?.click();
  };

  const upload = async (kind: MediaKind, file: File | null) => {
    if (!file || !identity || working) return;
    if (!allowedTypes.has(file.type)) { setError(t('identity.media.invalidType')); return; }
    if (file.size <= 0 || file.size > maxBytes) { setError(t('identity.media.tooLarge')); return; }
    setWorking(kind); setError(''); setNotice('');
    const supabase = createSupabaseBrowserClient();
    const objectPath = `${identity.upload_prefix}/${kind}/${crypto.randomUUID()}.${extensionFor(file)}`;
    try {
      const { error: uploadError } = await supabase.storage.from(identity.bucket).upload(objectPath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, object_path: objectPath }) });
      const body = await response.json() as { identity?: IdentityMedia; error?: string };
      if (!response.ok || !body.identity) { await supabase.storage.from(identity.bucket).remove([objectPath]); throw new Error(body.error ?? t('identity.media.saveFallback')); }
      setIdentity(body.identity);
      setNotice(kind === 'avatar' ? t('identity.media.avatarUpdated') : t('identity.media.bannerUpdated'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('identity.media.uploadFallback')); }
    finally { setWorking(null); if (kind === 'avatar' && avatarInput.current) avatarInput.current.value = ''; if (kind === 'banner' && bannerInput.current) bannerInput.current.value = ''; }
  };

  const remove = async (kind: MediaKind) => {
    if (!identity || working) return;
    const confirmed = window.confirm(kind === 'avatar' ? t('identity.media.removeAvatarConfirm') : t('identity.media.removeBannerConfirm'));
    if (!confirmed) return;
    setWorking(kind); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
      const body = await response.json() as { identity?: IdentityMedia; error?: string };
      if (!response.ok || !body.identity) throw new Error(body.error ?? t('identity.media.removeSaveFallback'));
      setIdentity(body.identity);
      setNotice(kind === 'avatar' ? t('identity.media.avatarRemoved') : t('identity.media.bannerRemoved'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('identity.media.removeFallback')); }
    finally { setWorking(null); }
  };

  const hasAvatar = Boolean(identity?.has_avatar && identity.avatar_url);
  const hasBanner = Boolean(identity?.has_banner && identity.banner_url);
  const visibleMeta = context === 'customer' ? '' : meta;

  return <section className={`${styles.shell} ${context === 'customer' ? styles.customerShell : ''}`} aria-label={t('identity.media.sectionLabel')}>
    <div className={`${styles.banner} ${bannerClass}`}>
      {identity?.banner_url ? <img className={styles.bannerImage} src={identity.banner_url} alt="" /> : null}
      <div className={styles.bannerShade} />
      <div className={styles.bannerActions}>
        <button type="button" className={styles.mediaButton} disabled={loading || Boolean(working) || !identity} onClick={() => chooseUpload('banner')}>{working === 'banner' ? t('identity.media.uploading') : hasBanner ? t('identity.media.changeBanner') : t('identity.media.addBanner')}</button>
        {hasBanner ? <button type="button" className={styles.mediaButtonDanger} disabled={Boolean(working)} onClick={() => void remove('banner')}>{t('identity.media.remove')}</button> : null}
      </div>
    </div>
    <div className={styles.content}>
      <div className={styles.avatarWrap}>
        {identity?.avatar_url ? <img className={styles.avatar} src={identity.avatar_url} alt={t('identity.media.profileAlt').replace('{name}', displayName)} /> : <div className={styles.avatarFallback} aria-hidden="true">{initials(displayName)}</div>}
        <button type="button" className={styles.avatarEdit} disabled={loading || Boolean(working) || !identity} onClick={() => chooseUpload('avatar')} aria-label={hasAvatar ? t('identity.media.changeProfilePicture') : t('identity.media.addProfilePicture')}>{working === 'avatar' ? '…' : '✎'}</button>
      </div>
      <div className={styles.identity}>
        <div className={styles.identityTop}><h2>{displayName}</h2><span className={styles.scopePill}>{scopeLabel(identity?.scope ?? (context === 'customer' ? 'customer' : 'professional'))}</span></div>
        <p className={styles.subtitle}>{subtitle}</p>
        {visibleMeta ? <p className={styles.meta}>{visibleMeta}</p> : null}
      </div>
      <div className={styles.workspaceSwitch}>
        <GlobalWorkspaceSwitcher fallbackName={displayName} triggerVariant="identity" />
      </div>
      {hasAvatar ? <div className={styles.avatarControls}>
        <button type="button" className={styles.removeButton} disabled={Boolean(working)} onClick={() => void remove('avatar')}>{t('identity.media.removePhoto')}</button>
      </div> : null}
    </div>
    {context === 'provider' ? <ProviderReadinessSummary placement="provider" /> : null}
    {loading ? <p className={styles.status} role="status">{t('identity.media.loading')}</p> : null}
    {notice ? <p className={styles.status} role="status">{notice}</p> : null}
    {error ? <p className={`${styles.status} ${styles.error}`} role="alert">{error}</p> : null}
    <input ref={avatarInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload('avatar', event.target.files?.[0] ?? null)} />
    <input ref={bannerInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload('banner', event.target.files?.[0] ?? null)} />
  </section>;
}