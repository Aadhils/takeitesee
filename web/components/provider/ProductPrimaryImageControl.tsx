'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { Alert, Button } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProductMedia = {
  bucket: string;
  upload_prefix: string;
  image_url: string | null;
  has_image: boolean;
  review_revision: number;
};

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 6 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export default function ProductPrimaryImageControl({
  productId,
  productName,
  onChanged,
}: {
  productId: string;
  productName: string;
  onChanged?: () => void | Promise<void>;
}) {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [media, setMedia] = useState<ProductMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const endpoint = `/api/provider/products/${encodeURIComponent(productId)}/media`;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(endpoint, { cache: 'no-store' });
        const payload = await response.json() as { media?: ProductMedia; error?: string };
        if (!response.ok || !payload.media) throw new Error(payload.error || 'Unable to load product image.');
        if (active) setMedia(payload.media);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load product image.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [endpoint]);

  const chooseImage = () => {
    if (!media || working) return;
    const confirmed = window.confirm(tamil
      ? 'Product primary image: JPEG, PNG அல்லது WebP · அதிகபட்சம் 6 MB. Image மாற்றினால் புதிய review revision உருவாகும். தொடரவா?'
      : 'Product primary image: JPEG, PNG, or WebP · max 6 MB. Changing the image creates a new review revision. Continue?');
    if (confirmed) fileInput.current?.click();
  };

  const upload = async (file: File | null) => {
    if (!file || !media || working) return;
    if (!allowedTypes.has(file.type)) {
      setError(tamil ? 'JPEG, PNG அல்லது WebP image மட்டும் upload செய்யவும்.' : 'Upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size <= 0 || file.size > maxBytes) {
      setError(tamil ? 'Image 6 MB அல்லது அதற்கு குறைவாக இருக்க வேண்டும்.' : 'Images must be 6 MB or smaller.');
      return;
    }

    setWorking(true);
    setError('');
    setNotice('');
    const supabase = createSupabaseBrowserClient();
    const objectPath = `${media.upload_prefix}/${crypto.randomUUID()}.${extensionFor(file)}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(media.bucket)
        .upload(objectPath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_path: objectPath }),
      });
      const payload = await response.json() as { media?: ProductMedia; error?: string };
      if (!response.ok || !payload.media) {
        await supabase.storage.from(media.bucket).remove([objectPath]);
        throw new Error(payload.error || 'Product image could not be saved.');
      }

      setMedia(payload.media);
      setNotice(tamil
        ? `Image update செய்யப்பட்டது. Current product revision ${payload.media.review_revision}; public launch approval மீண்டும் தேவைப்படலாம்.`
        : `Image updated. Current product revision is ${payload.media.review_revision}; public launch approval may be required again.`);
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to upload product image.');
    } finally {
      setWorking(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = async () => {
    if (!media?.has_image || working) return;
    const confirmed = window.confirm(tamil
      ? 'இந்த Product image-ஐ remove செய்யவா? இது புதிய review revision உருவாக்கும்.'
      : 'Remove this Product image? This creates a new review revision.');
    if (!confirmed) return;

    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      const payload = await response.json() as { media?: ProductMedia; error?: string };
      if (!response.ok || !payload.media) throw new Error(payload.error || 'Product image could not be removed.');
      setMedia(payload.media);
      setNotice(tamil
        ? `Image remove செய்யப்பட்டது. Current product revision ${payload.media.review_revision}.`
        : `Image removed. Current product revision is ${payload.media.review_revision}.`);
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove product image.');
    } finally {
      setWorking(false);
    }
  };

  return <section aria-label={`${productName} primary image`} style={{ display: 'grid', gap: '.7rem', padding: '.8rem', border: '1px solid var(--color-border)', borderRadius: '14px', background: 'var(--color-surface-subtle, #fafafa)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', flexWrap: 'wrap' }}>
      {media?.image_url ? <img
        src={media.image_url}
        alt={`${productName} primary product image`}
        style={{ width: '92px', height: '92px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--color-border)' }}
      /> : <div aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: '92px', height: '92px', borderRadius: '12px', border: '1px dashed var(--color-border)', color: 'var(--color-ink-muted)', fontSize: '1.4rem' }}>▧</div>}
      <div style={{ display: 'grid', gap: '.45rem', minWidth: 'min(100%, 220px)', flex: '1 1 220px' }}>
        <div>
          <strong>{tamil ? 'Primary Product image' : 'Primary product image'}</strong>
          <p className="muted" style={{ margin: '.25rem 0 0' }}>{tamil
            ? 'JPEG / PNG / WebP · max 6 MB. Image review-sensitive content.'
            : 'JPEG / PNG / WebP · max 6 MB. The image is review-sensitive content.'}</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" disabled={loading || working || !media} loading={working} onClick={chooseImage}>
            {media?.has_image ? (tamil ? 'Image மாற்று' : 'Change image') : (tamil ? 'Image சேர்' : 'Add image')}
          </Button>
          {media?.has_image ? <Button type="button" variant="quiet" disabled={working} onClick={() => void remove()}>{tamil ? 'Remove' : 'Remove'}</Button> : null}
        </div>
      </div>
    </div>
    {loading ? <p className="muted" style={{ margin: 0 }}>{tamil ? 'Product image load ஆகிறது…' : 'Loading product image…'}</p> : null}
    {error ? <Alert tone="danger">{error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}
    <input
      ref={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      style={{ display: 'none' }}
      onChange={(event) => void upload(event.target.files?.[0] ?? null)}
    />
  </section>;
}
