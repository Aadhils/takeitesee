'use client';

import { useRef, useState } from 'react';
import { Button } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

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
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [status, setStatus] = useState<ShareStatus>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus('idle'), 3000);
  };

  const share = async () => {
    setStatus('idle');
    const url = new URL(`/products/${productId}`, window.location.origin).toString();
    const shareData = {
      title: productName,
      text: businessName ? `${productName} by ${businessName} on TakeItEsee` : `${productName} on TakeItEsee`,
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
    ? (tamil ? 'பகிரப்பட்டது ✓' : 'Shared ✓')
    : status === 'copied'
      ? (tamil ? 'இணைப்பு நகலெடுக்கப்பட்டது ✓' : 'Link copied ✓')
      : (tamil ? 'Product பகிர்' : 'Share product');

  return <div style={{ display: 'grid', gap: '.45rem' }}>
    <Button type="button" variant="quiet" onClick={() => void share()}>{label}</Button>
    <span className="summary-note" aria-live="polite">
      {status === 'error' ? (tamil ? 'இந்த browser-ல் share/copy செய்ய முடியவில்லை.' : 'This browser could not share or copy the product link.') : ''}
    </span>
  </div>;
}
