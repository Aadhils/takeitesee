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
    if (listening) return;

    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceSupported(false);
      setVoiceStatus(locale === 'ta-IN' ? 'இந்த browser-ல் குரல் தேடல் கிடைக்கவில்லை.' : 'Voice search is not available in this browser.');
      return;
    }

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
          setVoiceStatus(locale === 'ta-IN' ? `குரல் தேடல்: ${transcript}` : `Voice search: ${transcript}`);
          const location = formRef.current ? String(new FormData(formRef.current).get('location') ?? '') : '';
          navigateToExplore(transcript, location);
        }
      };
      recognition.onerror = () => {
        setVoiceStatus(locale === 'ta-IN' ? 'குரல் தேடலை பயன்படுத்த முடியவில்லை. Microphone permission-ஐ சரிபார்க்கவும்.' : 'Voice search could not be used. Check microphone permission.');
        setListening(false);
      };
      recognition.onend = () => setListening(false);
      setVoiceSupported(true);
      setVoiceStatus(locale === 'ta-IN' ? 'கேட்கிறோம்…' : 'Listening…');
      setListening(true);
      recognition.start();
    } catch {
      setVoiceStatus(locale === 'ta-IN' ? 'Microphone permission தேவை. Browser site settings-ல் microphone access-ஐ Allow செய்யவும்.' : 'Microphone permission is required. Allow microphone access in your browser site settings.');
      setListening(false);
    }
  };

  const voiceTitle = voiceSupported === false
    ? (locale === 'ta-IN' ? 'இந்த browser-ல் குரல் தேடல் கிடைக்கவில்லை' : 'Voice search is not available in this browser')
    : (locale === 'ta-IN' ? 'குரல் தேடல்' : 'Voice search');

  return (
    <>
      <form ref={formRef} className="search-panel hero-search-panel" action="/explore" onSubmit={handleSubmit}>
        <div className="search-field search-field-service">
          <span className="search-field-icon" aria-hidden="true">⌕</span>
          <Input label={t('home.searchNeed')} name="q" placeholder={t('home.searchNeed')} aria-label={t('home.searchNeedAria')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <button
            type="button"
            className="voice-search-button"
            aria-label={locale === 'ta-IN' ? 'குரல் மூலம் சேவை தேடவும்' : 'Search services by voice'}
            aria-pressed={listening}
            onClick={startVoiceSearch}
            title={voiceTitle}
          >
            <VoiceSearchIcon />
          </button>
        </div>
        <div className="search-field search-field-location"><span className="search-field-icon" aria-hidden="true">⌖</span><Input label={t('home.where')} name="location" placeholder={t('home.locationPlaceholder')} aria-label={t('home.locationAria')} /></div>
        <Button type="submit" className="hero-search-button">{t('home.search')}</Button>
      </form>
      {voiceStatus ? <p className="voice-search-status" role="status" aria-live="polite">{voiceStatus}</p> : null}
    </>
  );
}
