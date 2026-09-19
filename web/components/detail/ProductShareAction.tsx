'use client';

import { useRef, useState } from 'react';
import { Button } from '../ui/primitives';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';

type ShareStatus = 'idle' | 'shared' | 'copied' | 'error';

function fallbackCopy(value: string) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy command was not accepted.');
}

async function copyProductUrl(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  fallbackCopy(value);
}

export default function ProductShareAction({
  productId,
  productName,
  businessName,
}: {
  productId: string;
  productName: string;
  businessName: string;
}) {
  const { t } = usePublicProviderTranslations();
  const [status, setStatus] = useState<ShareStatus>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus('idle'), 3000);
  };

  const share = async () => {
    setStatus('idle');
    const url = new URL(`/products/${productId}`, window.location.origin).toString();
    const shareText = businessName
      ? t('publicProvider.productShare.byBusiness')
        .replace('{productName}', productName)
        .replace('{businessName}', businessName)
      : t('publicProvider.productShare.onPlatform').replace('{productName}', productName);
    const shareData = {
      title: productName,
      text: shareText,
      url,
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        setStatus('shared');
        scheduleReset();
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
      }
    }

    try {
      await copyProductUrl(url);
      setStatus('copied');
      scheduleReset();
    } catch {
      setStatus('error');
    }
  };

  const label = status === 'shared'
    ? t('publicProvider.productShare.shared')
    : status === 'copied'
      ? t('publicProvider.productShare.copied')
      : t('publicProvider.productShare.action');

  return <div style={{ display: 'grid', gap: '.45rem' }}>
    <Button type="button" variant="quiet" onClick={() => void share()}>{label}</Button>
    <span className="summary-note" aria-live="polite">
      {status === 'error' ? t('publicProvider.productShare.error') : ''}
    </span>
  </div>;
}
