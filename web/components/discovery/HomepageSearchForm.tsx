'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button, Input } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
  results?: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoiceWindow = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function VoiceSearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.9" />
      <path d="M6.75 11.5a5.25 5.25 0 0 0 10.5 0M12 16.75V21M9.25 21h5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export default function HomepageSearchForm() {
  const { t, locale } = useLanguage();
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceActivating, setVoiceActivating] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('');

  useEffect(() => {
    const voiceWindow = window as VoiceWindow;
    setVoiceSupported(Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition));
  }, []);

  const navigateToExplore = (searchQuery: string, location: string) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (location.trim()) params.set('location', location.trim());
    window.location.assign(params.toString() ? `/explore?${params.toString()}` : '/explore');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const location = String(formData.get('location') ?? '');
    navigateToExplore(query, location);
  };

  const startVoiceSearch = async () => {
    if (listening || voiceActivating) return;

    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceSupported(false);
      setVoiceStatus(t('home.voice.unavailableStatus'));
      return;
    }

    setVoiceActivating(true);
    setVoiceStatus(t('home.voice.startingStatus'));

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }

      const recognition = new Recognition();
      recognition.lang = locale === 'ta-IN' ? 'ta-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setQuery(transcript);
          setVoiceStatus(`${t('home.voice.resultPrefix')}: ${transcript}`);
          const location = formRef.current ? String(new FormData(formRef.current).get('location') ?? '') : '';
          navigateToExplore(transcript, location);
        }
      };
      recognition.onerror = () => {
        setVoiceStatus(t('home.voice.errorStatus'));
        setVoiceActivating(false);
        setListening(false);
      };
      recognition.onend = () => {
        setVoiceActivating(false);
        setListening(false);
      };
      setVoiceSupported(true);
      recognition.start();
      setVoiceActivating(false);
      setVoiceStatus(t('home.voice.listeningStatus'));
      setListening(true);
    } catch {
      setVoiceStatus(t('home.voice.permissionStatus'));
      setVoiceActivating(false);
      setListening(false);
    }
  };

  const voiceState = listening ? 'listening' : voiceActivating ? 'starting' : 'idle';
  const voiceTitle = voiceSupported === false
    ? t('home.voice.unavailableTitle')
    : voiceActivating
      ? t('home.voice.startingTitle')
      : listening
        ? t('home.voice.listeningTitle')
        : t('home.voice.idleTitle');
  const voiceLabel = voiceActivating
    ? t('home.voice.startingTitle')
    : listening
      ? t('home.voice.listeningLabel')
      : t('home.voice.idleLabel');

  const voiceButton = (className: string) => (
    <button
      type="button"
      className={`voice-search-button ${className}`}
      data-voice-state={voiceState}
      aria-label={voiceLabel}
      aria-pressed={listening}
      aria-busy={voiceActivating || undefined}
      onClick={startVoiceSearch}
      title={voiceTitle}
    >
      <VoiceSearchIcon />
    </button>
  );

  return (
    <>
      <form ref={formRef} className="search-panel hero-search-panel" action="/explore" onSubmit={handleSubmit}>
        <div className="search-field search-field-service">
          <span className="search-field-icon" aria-hidden="true">⌕</span>
          <Input label={t('home.searchNeed')} name="q" placeholder={t('home.searchNeed')} aria-label={t('home.searchNeedAria')} value={query} onChange={(event) => setQuery(event.target.value)} />
          {voiceButton('voice-search-button-desktop')}
        </div>
        <div className="search-field search-field-location"><span className="search-field-icon" aria-hidden="true">⌖</span><Input label={t('home.where')} name="location" placeholder={t('home.locationPlaceholder')} aria-label={t('home.locationAria')} /></div>
        {voiceButton('voice-search-button-mobile')}
        <Button type="submit" className="hero-search-button">{t('home.search')}</Button>
      </form>
      {voiceStatus ? <p className="voice-search-status" role="status" aria-live="polite">{voiceStatus}</p> : null}
    </>
  );
}
