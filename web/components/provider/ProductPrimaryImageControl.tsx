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
  const { t } = useIdentityWorkspaceTranslations();
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
        if (!response.ok || !payload.media) throw new Error(payload.error || t('provider.products.imageLoadFallback'));
        if (active) setMedia(payload.media);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t('provider.products.imageLoadFallback'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [endpoint, t]);

  const chooseImage = () => {
    if (!media || working) return;
    const confirmed = window.confirm(t('provider.products.imageChangeConfirm'));
    if (confirmed) fileInput.current?.click();
  };

  const upload = async (file: File | null) => {
    if (!file || !media || working) return;
    if (!allowedTypes.has(file.type)) {
      setError(t('provider.products.imageTypeError'));
      return;
    }
    if (file.size <= 0 || file.size > maxBytes) {
      setError(t('provider.products.imageSizeError'));
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
        throw new Error(payload.error || t('provider.products.imageSaveFallback'));
      }

      setMedia(payload.media);
      setNotice(`${t('provider.products.imageUpdatedPrefix')} ${payload.media.review_revision}${t('provider.products.imageUpdatedSuffix')}`);
      void onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.products.imageUploadFallback'));
    } finally {
      setWorking(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = async () => {
    if (!media?.has_image || working) return;
    const confirmed = window.confirm(t('provider.products.imageRemoveConfirm'));
    if (!confirmed) return;

    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      const payload = await response.json() as { media?: ProductMedia; error?: string };
      if (!response.ok || !payload.media) throw new Error(payload.error || t('provider.products.imageRemoveFallback'));
      setMedia(payload.media);
      setNotice(`${t('provider.products.imageRemovedPrefix')} ${payload.media.review_revision}.`);
      void onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.products.imageRemoveFallback'));
    } finally {
      setWorking(false);
    }
  };

  return <section aria-label={`${productName} ${t('provider.products.imageAriaSuffix')}`} style={{ display: 'grid', gap: '.7rem', padding: '.8rem', border: '1px solid var(--color-border)', borderRadius: '14px', background: 'var(--color-surface-subtle, #fafafa)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', flexWrap: 'wrap' }}>
      {media?.image_url ? <img
        src={media.image_url}
        alt={`${productName} ${t('provider.products.imageAltSuffix')}`}
        style={{ width: '92px', height: '92px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--color-border)' }}
      /> : <div aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: '92px', height: '92px', borderRadius: '12px', border: '1px dashed var(--color-border)', color: 'var(--color-ink-muted)', fontSize: '1.4rem' }}>▧</div>}
      <div style={{ display: 'grid', gap: '.45rem', minWidth: 'min(100%, 220px)', flex: '1 1 220px' }}>
        <div>
          <strong>{t('provider.products.imageTitle')}</strong>
          <p className="muted" style={{ margin: '.25rem 0 0' }}>{t('provider.products.imageHelp')}</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" disabled={loading || working || !media} loading={working} onClick={chooseImage}>
            {media?.has_image ? t('provider.products.imageChange') : t('provider.products.imageAdd')}
          </Button>
          {media?.has_image ? <Button type="button" variant="quiet" disabled={working} onClick={() => void remove()}>{t('provider.products.imageRemove')}</Button> : null}
        </div>
      </div>
    </div>
    {loading ? <p className="muted" style={{ margin: 0 }}>{t('provider.products.imageLoading')}</p> : null}
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
