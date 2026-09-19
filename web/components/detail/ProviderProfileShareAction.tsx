'use client';

import { useRef, useState } from 'react';
import { Button } from '../ui/primitives';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';

type ShareStatus = 'idle' | 'shared' | 'copied' | 'error';
type ProviderKind = 'business' | 'professional';

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

async function copyProfileUrl(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  fallbackCopy(value);
}

export default function ProviderProfileShareAction(props: {
  providerId: string;
  providerName: string;
  kind: ProviderKind;
}) {
  const { providerName, kind } = props;
  const { t } = usePublicProviderTranslations();
  const [status, setStatus] = useState<ShareStatus>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus('idle'), 3000);
  };

  const share = async () => {
    setStatus('idle');
    // Share the public URL the visitor is actually viewing. This keeps canonical
    // @handle routes intact instead of leaking the underlying UUID provider route.
    const url = new URL(window.location.href).toString();
    const fallbackName = kind === 'business'
      ? t('publicProvider.profile.verifiedBusiness')
      : t('publicProvider.profile.verifiedProfessional');
    const name = providerName || fallbackName;
    const descriptor = kind === 'business'
      ? t('publicProvider.share.businessDescriptor')
      : t('publicProvider.share.professionalDescriptor');
    const shareData = {
      title: `${name} | TakeItEsee`,
      text: `${name} — ${descriptor}`,
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
      await copyProfileUrl(url);
      setStatus('copied');
      scheduleReset();
    } catch {
      setStatus('error');
    }
  };

  const label = status === 'shared'
    ? t('publicProvider.share.shared')
    : status === 'copied'
      ? t('publicProvider.share.copied')
      : t('publicProvider.share.action');

  return <div style={{ display: 'grid', gap: '.45rem', justifyItems: 'end' }}>
    <Button type="button" variant="quiet" onClick={() => void share()}>{label}</Button>
    <span className="summary-note" aria-live="polite">
      {status === 'error' ? t('publicProvider.share.error') : ''}
    </span>
  </div>;
}
