'use client';

import { useRef, useState } from 'react';
import { Button } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

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
    // Share the public URL the visitor is actually viewing. This keeps canonical
    // @handle routes intact instead of leaking the underlying UUID provider route.
    const url = new URL(window.location.href).toString();
    const fallbackName = kind === 'business' ? 'Verified business' : 'Verified professional';
    const name = providerName || fallbackName;
    const shareData = {
      title: `${name} | TakeItEsee`,
      text: kind === 'business'
        ? `${name} — verified business on TakeItEsee`
        : `${name} — verified professional on TakeItEsee`,
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
    ? (tamil ? 'பகிரப்பட்டது ✓' : 'Shared ✓')
    : status === 'copied'
      ? (tamil ? 'Profile இணைப்பு நகலெடுக்கப்பட்டது ✓' : 'Profile link copied ✓')
      : (tamil ? 'Profile-ஐ பகிர்' : 'Share profile');

  return <div style={{ display: 'grid', gap: '.45rem', justifyItems: 'end' }}>
    <Button type="button" variant="quiet" onClick={() => void share()}>{label}</Button>
    <span className="summary-note" aria-live="polite">
      {status === 'error' ? (tamil ? 'இந்த browser-ல் share/copy செய்ய முடியவில்லை.' : 'This browser could not share or copy the profile link.') : ''}
    </span>
  </div>;
}
