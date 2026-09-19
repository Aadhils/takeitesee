'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Input, Select, Textarea } from '../ui/primitives';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProfessionalPortfolioMediaManager.module.css';

type RoleOption = { id: string; title: string; active: boolean };
type PortfolioMedia = {
  id: string;
  professional_id: string;
  professional_role_id: string | null;
  media_type: 'image' | 'video';
  original_filename: string;
  mime_type: string;
  size_bytes: number | string;
  caption: string | null;
  alt_text: string | null;
  active: boolean;
  moderation_state: 'clear' | 'paused';
  moderation_updated_at: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  signed_url: string | null;
};

type EditForm = {
  professional_role_id: string;
  caption: string;
  alt_text: string;
  active: boolean;
  display_order: string;
};

const BUCKET = 'professional-portfolio-media';
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);
const imageMaxBytes = 8 * 1024 * 1024;
const videoMaxBytes = 25 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'video/mp4') return 'mp4';
  if (file.type === 'video/webm') return 'webm';
  return 'jpg';
}

function sizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ProfessionalPortfolioMediaManager({
  professionalId,
  roles,
  verified,
}: {
  professionalId: string;
  roles: RoleOption[];
  verified: boolean;
}) {
  const { t } = useIdentityWorkspaceTranslations();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [media, setMedia] = useState<PortfolioMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [roleId, setRoleId] = useState('');
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [active, setActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ professional_role_id: '', caption: '', alt_text: '', active: true, display_order: '0' });

  const roleName = useMemo(() => new Map(roles.map((role) => [role.id, role.title])), [roles]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/profile/media', { cache: 'no-store' });
      const body = await response.json() as { media?: PortfolioMedia[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.portfolioManager.unableToLoadPortfolioMedia'));
      setMedia(body.media ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.portfolioManager.unableToLoadPortfolioMedia'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const resetUpload = () => {
    setFile(null);
    setRoleId('');
    setCaption('');
    setAltText('');
    setActive(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || uploading) return;
    if (!allowedTypes.has(file.type)) {
      setError(t('provider.portfolioManager.uploadSupportedTypes'));
      return;
    }
    const maxBytes = file.type.startsWith('image/') ? imageMaxBytes : videoMaxBytes;
    if (file.size <= 0 || file.size > maxBytes) {
      setError(file.type.startsWith('image/')
        ? t('provider.portfolioManager.imageSizeLimit')
        : t('provider.portfolioManager.videoSizeLimit'));
      return;
    }
    if (caption.trim().length > 600 || altText.trim().length > 240) {
      setError(t('provider.portfolioManager.captionAltTooLong'));
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');
    const supabase = createSupabaseBrowserClient();
    let objectPath = '';
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error(authError?.message ?? t('provider.portfolioManager.authenticationRequired'));
      objectPath = `${authData.user.id}/${professionalId}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      const response = await fetch('/api/provider/profile/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object_path: objectPath,
          original_filename: file.name,
          professional_role_id: roleId || null,
          caption,
          alt_text: altText,
          active,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        await supabase.storage.from(BUCKET).remove([objectPath]);
        throw new Error(body.error ?? t('provider.portfolioManager.registrationFailed'));
      }

      resetUpload();
      setNotice(t('provider.portfolioManager.uploaded'));
      await load();
    } catch (cause) {
      if (objectPath) await supabase.storage.from(BUCKET).remove([objectPath]);
      setError(cause instanceof Error ? cause.message : t('provider.portfolioManager.unableToUpload'));
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (item: PortfolioMedia) => {
    setError('');
    setNotice('');
    setEditingId(item.id);
    setEditForm({
      professional_role_id: item.professional_role_id ?? '',
      caption: item.caption ?? '',
      alt_text: item.alt_text ?? '',
      active: item.active,
      display_order: String(item.display_order),
    });
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/provider/profile/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.portfolioManager.updateFailed'));
      setEditingId(null);
      setNotice(t('provider.portfolioManager.updated'));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.portfolioManager.unableToUpdate'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: PortfolioMedia) => {
    if (removingId || !window.confirm(t('provider.portfolioManager.deleteConfirm'))) return;
    setRemovingId(item.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/provider/profile/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.portfolioManager.deleteFailed'));
      if (editingId === item.id) setEditingId(null);
      setNotice(t('provider.portfolioManager.deleted'));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.portfolioManager.unableToDelete'));
    } finally {
      setRemovingId(null);
    }
  };

  return <Card className="provider-profile-card">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{t('provider.portfolioManager.workShowcase')}</span>
        <h2>{t('provider.portfolioManager.portfolioPhotosVideos')}</h2>
      </div>
      <div className="button-row">
        <Badge tone={verified ? 'success' : 'warning'}>{verified ? t('provider.portfolioManager.verifiedPublicProfile') : t('provider.portfolioManager.privateUntilVerified')}</Badge>
        <Badge tone="info">{media.length} {t('provider.portfolioManager.items')}</Badge>
      </div>
    </div>
    <p>{t('provider.portfolioManager.intro')}</p>
    <p className="summary-note">{t('provider.portfolioManager.presentationOnly')}</p>

    {error ? <Alert title={t('provider.portfolioManager.attention')} tone="warning">{error}</Alert> : null}
    {notice ? <Alert title={t('provider.portfolioManager.updatedTitle')} tone="success">{notice}</Alert> : null}

    <form onSubmit={upload} className="section-stack">
      <div>
        <strong>{t('provider.portfolioManager.addWorkSample')}</strong>
        <p className="summary-note">{t('provider.portfolioManager.fileLimits')}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        disabled={uploading}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Select label={t('provider.portfolioManager.relatedTalentOptional')} value={roleId} onChange={(event) => setRoleId(event.target.value)}>
        <option value="">{t('provider.portfolioManager.generalPortfolio')}</option>
        {roles.map((role) => <option value={role.id} key={role.id}>{role.title}{role.active ? '' : ` · ${t('provider.portfolioManager.pausedLower')}`}</option>)}
      </Select>
      <Textarea label={t('provider.portfolioManager.captionOptional')} hint={t('provider.portfolioManager.captionHint')} value={caption} maxLength={600} rows={3} onChange={(event) => setCaption(event.target.value)} />
      <Input label={t('provider.portfolioManager.altOptional')} hint={t('provider.portfolioManager.altHint')} value={altText} maxLength={240} onChange={(event) => setAltText(event.target.value)} />
      <Checkbox label={t('provider.portfolioManager.showOnMyPublicProfile')} description={t('provider.portfolioManager.publicRequiresVerified')} checked={active} onChange={(event) => setActive(event.target.checked)} />
      <div className="button-row"><Button type="submit" loading={uploading} disabled={!file}>{t('provider.portfolioManager.uploadMedia')}</Button>{file ? <Badge tone="info">{file.name}</Badge> : null}</div>
    </form>

    <div className={styles.gallery}>
      {loading ? <p>{t('provider.portfolioManager.loadingMedia')}</p> : null}
      {!loading && media.length === 0 ? <p className="empty-inline">{t('provider.portfolioManager.noMedia')}</p> : null}
      {media.map((item) => <article className={styles.item} key={item.id}>
        <div className={styles.preview}>
          {item.signed_url ? item.media_type === 'image'
            ? <img src={item.signed_url} alt={item.alt_text || item.caption || t('provider.portfolioManager.workSampleAlt')} />
            : <video src={item.signed_url} controls preload="metadata" aria-label={item.caption || t('provider.portfolioManager.videoLabel')} />
            : <div className={styles.unavailable}>{t('provider.portfolioManager.previewUnavailable')}</div>}
        </div>
        <div className={styles.body}>
          <div className="section-heading">
            <div><strong>{item.caption || item.original_filename}</strong><p className="summary-note">{item.media_type.toUpperCase()} · {sizeLabel(Number(item.size_bytes))}{item.professional_role_id ? ` · ${roleName.get(item.professional_role_id) ?? t('provider.portfolioManager.roleLinked')}` : ''}</p></div>
            <Badge tone={item.moderation_state === 'paused' ? 'warning' : item.active ? 'success' : 'neutral'}>{item.moderation_state === 'paused' ? t('provider.portfolioManager.adminPaused') : item.active ? t('provider.portfolioManager.publicReady') : t('provider.portfolioManager.paused')}</Badge>
          </div>
          {item.moderation_state === 'paused' ? <Alert title={t('provider.portfolioManager.hiddenByModeration')} tone="warning">{t('provider.portfolioManager.moderationBody')}</Alert> : null}
          <div className="button-row"><Button type="button" variant="secondary" onClick={() => startEdit(item)} disabled={saving || removingId === item.id}>{t('provider.portfolioManager.editDetails')}</Button><Button type="button" variant="danger" loading={removingId === item.id} onClick={() => void remove(item)}>{t('provider.portfolioManager.delete')}</Button></div>

          {editingId === item.id ? <form onSubmit={saveEdit} className={styles.editor}>
            <Select label={t('provider.portfolioManager.relatedTalent')} value={editForm.professional_role_id} onChange={(event) => setEditForm((current) => ({ ...current, professional_role_id: event.target.value }))}>
              <option value="">{t('provider.portfolioManager.generalPortfolio')}</option>
              {roles.map((role) => <option value={role.id} key={role.id}>{role.title}</option>)}
            </Select>
            <Textarea label={t('provider.portfolioManager.caption')} value={editForm.caption} maxLength={600} rows={3} onChange={(event) => setEditForm((current) => ({ ...current, caption: event.target.value }))} />
            {item.media_type === 'image' ? <Input label={t('provider.portfolioManager.alt')} value={editForm.alt_text} maxLength={240} onChange={(event) => setEditForm((current) => ({ ...current, alt_text: event.target.value }))} /> : null}
            <Input label={t('provider.portfolioManager.displayOrder')} type="number" min={0} max={9999} step={1} value={editForm.display_order} onChange={(event) => setEditForm((current) => ({ ...current, display_order: event.target.value }))} />
            {item.moderation_state === 'paused'
              ? <p className="summary-note">{t('provider.portfolioManager.publicLockedWhilePaused')}</p>
              : <Checkbox label={t('provider.portfolioManager.showOnPublicProfile')} checked={editForm.active} onChange={(event) => setEditForm((current) => ({ ...current, active: event.target.checked }))} />}
            <div className="button-row"><Button type="submit" loading={saving}>{t('provider.portfolioManager.saveDetails')}</Button><Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>{t('provider.portfolioManager.cancel')}</Button></div>
          </form> : null}
        </div>
      </article>)}
    </div>
  </Card>;
}