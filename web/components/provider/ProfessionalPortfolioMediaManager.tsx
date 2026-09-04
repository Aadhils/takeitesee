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
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const text = (en: string, ta: string) => tamil ? ta : en;
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
      if (!response.ok) throw new Error(body.error ?? 'Unable to load portfolio media.');
      setMedia(body.media ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load portfolio media.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError(text('Upload a JPEG, PNG, WebP, MP4, or WebM file.', 'JPEG, PNG, WebP, MP4 அல்லது WebM file upload செய்யவும்.'));
      return;
    }
    const maxBytes = file.type.startsWith('image/') ? imageMaxBytes : videoMaxBytes;
    if (file.size <= 0 || file.size > maxBytes) {
      setError(file.type.startsWith('image/')
        ? text('Portfolio images must be 8 MB or smaller.', 'Portfolio image 8 MB அல்லது அதற்கு குறைவாக இருக்க வேண்டும்.')
        : text('Portfolio videos must be 25 MB or smaller.', 'Portfolio video 25 MB அல்லது அதற்கு குறைவாக இருக்க வேண்டும்.'));
      return;
    }
    if (caption.trim().length > 600 || altText.trim().length > 240) {
      setError(text('Caption or alt text is too long.', 'Caption அல்லது alt text நீளம் அதிகமாக உள்ளது.'));
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');
    const supabase = createSupabaseBrowserClient();
    let objectPath = '';
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error(authError?.message ?? 'Authentication required.');
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
        throw new Error(body.error ?? 'Portfolio media could not be registered.');
      }

      resetUpload();
      setNotice(text('Portfolio media uploaded.', 'Portfolio media upload செய்யப்பட்டது.'));
      await load();
    } catch (cause) {
      if (objectPath) await supabase.storage.from(BUCKET).remove([objectPath]);
      setError(cause instanceof Error ? cause.message : text('Unable to upload portfolio media.', 'Portfolio media upload செய்ய முடியவில்லை.'));
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
      if (!response.ok) throw new Error(body.error ?? 'Portfolio media could not be updated.');
      setEditingId(null);
      setNotice(text('Portfolio media updated.', 'Portfolio media update செய்யப்பட்டது.'));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Unable to update portfolio media.', 'Portfolio media update செய்ய முடியவில்லை.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: PortfolioMedia) => {
    if (removingId || !window.confirm(text('Delete this portfolio item?', 'இந்த portfolio item-ஐ delete செய்ய வேண்டுமா?'))) return;
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
      if (!response.ok) throw new Error(body.error ?? 'Portfolio media could not be deleted.');
      if (editingId === item.id) setEditingId(null);
      setNotice(text('Portfolio media deleted.', 'Portfolio media delete செய்யப்பட்டது.'));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Unable to delete portfolio media.', 'Portfolio media delete செய்ய முடியவில்லை.'));
    } finally {
      setRemovingId(null);
    }
  };

  return <Card className="provider-profile-card">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{text('Work showcase', 'Work showcase')}</span>
        <h2>{text('Portfolio photos & videos', 'Portfolio photos & videos')}</h2>
      </div>
      <div className="button-row">
        <Badge tone={verified ? 'success' : 'warning'}>{verified ? text('Verified public profile', 'Verified public profile') : text('Private until verified', 'Verification வரை private')}</Badge>
        <Badge tone="info">{media.length} {text('items', 'items')}</Badge>
      </div>
    </div>
    <p>{text(
      'Show real previous work, projects, service outcomes, demos, or professional experience. Media stays in a private bucket and only active items on a verified profile are signed for public viewing.',
      'முன்பு செய்த வேலை, projects, service results, demos அல்லது professional experience-ஐ photos/videos மூலம் காட்டலாம். Media private bucket-ல் இருக்கும்; verified profile-ன் active items மட்டும் public viewing-க்கு signed URL பெறும்.',
    )}</p>
    <p className="summary-note">{text(
      'This is portfolio presentation only. It does not change service-booking eligibility, job eligibility, verification, subscription priority, or search ranking.',
      'இது portfolio presentation மட்டும். Service booking eligibility, job eligibility, verification, subscription priority அல்லது search ranking மாற்றப்படாது.',
    )}</p>

    {error ? <Alert title={text('Portfolio attention', 'Portfolio கவனம்')} tone="warning">{error}</Alert> : null}
    {notice ? <Alert title={text('Portfolio updated', 'Portfolio update')} tone="success">{notice}</Alert> : null}

    <form onSubmit={upload} className="section-stack">
      <div>
        <strong>{text('Add a work sample', 'Work sample சேர்க்கவும்')}</strong>
        <p className="summary-note">{text('Images: JPEG/PNG/WebP up to 8 MB. Videos: MP4/WebM up to 25 MB.', 'Images: JPEG/PNG/WebP அதிகபட்சம் 8 MB. Videos: MP4/WebM அதிகபட்சம் 25 MB.')}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        disabled={uploading}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Select label={text('Related talent / role (optional)', 'Related talent / role (optional)')} value={roleId} onChange={(event) => setRoleId(event.target.value)}>
        <option value="">{text('General professional portfolio', 'General professional portfolio')}</option>
        {roles.map((role) => <option value={role.id} key={role.id}>{role.title}{role.active ? '' : ` · ${text('paused', 'paused')}`}</option>)}
      </Select>
      <Textarea label={text('Caption (optional)', 'Caption (optional)')} hint={text('Explain what the customer or employer is seeing.', 'இந்த photo/video-ல் என்ன work காட்டப்படுகிறது என்று சுருக்கமாக எழுதுங்கள்.')} value={caption} maxLength={600} rows={3} onChange={(event) => setCaption(event.target.value)} />
      <Input label={text('Accessible image description (optional)', 'Accessible image description (optional)')} hint={text('Useful for image accessibility. Video items may leave this blank.', 'Image accessibility-க்கு உதவும். Video என்றால் blank ஆக விடலாம்.')} value={altText} maxLength={240} onChange={(event) => setAltText(event.target.value)} />
      <Checkbox label={text('Show on my public professional profile', 'Public professional profile-ல் காட்டவும்')} description={text('Public presentation still requires the master professional profile to be verified.', 'Public presentation-க்கு master professional profile verified ஆக இருக்க வேண்டும்.')} checked={active} onChange={(event) => setActive(event.target.checked)} />
      <div className="button-row"><Button type="submit" loading={uploading} disabled={!file}>{text('Upload portfolio media', 'Portfolio media upload')}</Button>{file ? <Badge tone="info">{file.name}</Badge> : null}</div>
    </form>

    <div className={styles.gallery}>
      {loading ? <p>{text('Loading portfolio media…', 'Portfolio media load ஆகிறது…')}</p> : null}
      {!loading && media.length === 0 ? <p className="empty-inline">{text('No portfolio media has been added yet.', 'Portfolio media இன்னும் add செய்யப்படவில்லை.')}</p> : null}
      {media.map((item) => <article className={styles.item} key={item.id}>
        <div className={styles.preview}>
          {item.signed_url ? item.media_type === 'image'
            ? <img src={item.signed_url} alt={item.alt_text || item.caption || text('Professional work sample', 'Professional work sample')} />
            : <video src={item.signed_url} controls preload="metadata" aria-label={item.caption || text('Professional portfolio video', 'Professional portfolio video')} />
            : <div className={styles.unavailable}>{text('Preview unavailable', 'Preview கிடைக்கவில்லை')}</div>}
        </div>
        <div className={styles.body}>
          <div className="section-heading">
            <div><strong>{item.caption || item.original_filename}</strong><p className="summary-note">{item.media_type.toUpperCase()} · {sizeLabel(Number(item.size_bytes))}{item.professional_role_id ? ` · ${roleName.get(item.professional_role_id) ?? text('Role-linked', 'Role-linked')}` : ''}</p></div>
            <Badge tone={item.active ? 'success' : 'neutral'}>{item.active ? text('Public-ready', 'Public-ready') : text('Paused', 'Paused')}</Badge>
          </div>
          <div className="button-row"><Button type="button" variant="secondary" onClick={() => startEdit(item)} disabled={saving || removingId === item.id}>{text('Edit details', 'Details edit')}</Button><Button type="button" variant="danger" loading={removingId === item.id} onClick={() => void remove(item)}>{text('Delete', 'Delete')}</Button></div>

          {editingId === item.id ? <form onSubmit={saveEdit} className={styles.editor}>
            <Select label={text('Related talent / role', 'Related talent / role')} value={editForm.professional_role_id} onChange={(event) => setEditForm((current) => ({ ...current, professional_role_id: event.target.value }))}>
              <option value="">{text('General professional portfolio', 'General professional portfolio')}</option>
              {roles.map((role) => <option value={role.id} key={role.id}>{role.title}</option>)}
            </Select>
            <Textarea label={text('Caption', 'Caption')} value={editForm.caption} maxLength={600} rows={3} onChange={(event) => setEditForm((current) => ({ ...current, caption: event.target.value }))} />
            {item.media_type === 'image' ? <Input label={text('Accessible image description', 'Accessible image description')} value={editForm.alt_text} maxLength={240} onChange={(event) => setEditForm((current) => ({ ...current, alt_text: event.target.value }))} /> : null}
            <Input label={text('Display order', 'Display order')} type="number" min={0} max={9999} step={1} value={editForm.display_order} onChange={(event) => setEditForm((current) => ({ ...current, display_order: event.target.value }))} />
            <Checkbox label={text('Show on public profile', 'Public profile-ல் காட்டவும்')} checked={editForm.active} onChange={(event) => setEditForm((current) => ({ ...current, active: event.target.checked }))} />
            <div className="button-row"><Button type="submit" loading={saving}>{text('Save media details', 'Media details save')}</Button><Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>{text('Cancel', 'Cancel')}</Button></div>
          </form> : null}
        </div>
      </article>)}
    </div>
  </Card>;
}