'use client';

import { FormEvent, useMemo, useState } from 'react';
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

export default function HomepageSearchForm() {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');

  const voiceSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const voiceWindow = window as VoiceWindow;
    return Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const location = String(formData.get('location') ?? '').trim();
    const params = new URLSearchParams();

    if (query.trim()) params.set('q', query.trim());
    if (location) params.set('location', location);
    window.location.assign(params.toString() ? `/explore?${params.toString()}` : '/explore');
  };

  const startVoiceSearch = () => {
    if (!voiceSupported || listening) return;
    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = locale === 'ta-IN' ? 'ta-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setQuery(transcript);
        setVoiceStatus(locale === 'ta-IN' ? `குரல் தேடல்: ${transcript}` : `Voice search: ${transcript}`);
      }
    };
    recognition.onerror = () => {
      setVoiceStatus(locale === 'ta-IN' ? 'குரல் தேடலை பயன்படுத்த முடியவில்லை.' : 'Voice search could not be used.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    setVoiceStatus(locale === 'ta-IN' ? 'கேட்கிறோம்…' : 'Listening…');
    setListening(true);
    recognition.start();
  };

  return (
    <>
      <form className="search-panel hero-search-panel" action="/explore" onSubmit={handleSubmit}>
        <div className="search-field search-field-service">
          <span className="search-field-icon" aria-hidden="true">⌕</span>
          <Input label={t('home.searchNeed')} name="q" placeholder={t('home.searchNeed')} aria-label={t('home.searchNeedAria')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <button
            type="button"
            className="voice-search-button"
            aria-label={locale === 'ta-IN' ? 'குரல் மூலம் சேவை தேடவும்' : 'Search services by voice'}
            aria-pressed={listening}
            disabled={!voiceSupported}
            onClick={startVoiceSearch}
            title={voiceSupported ? (locale === 'ta-IN' ? 'குரல் தேடல்' : 'Voice search') : (locale === 'ta-IN' ? 'இந்த browser-ல் குரல் தேடல் கிடைக்கவில்லை' : 'Voice search is not available in this browser')}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        </div>
        <div className="search-field search-field-location"><span className="search-field-icon" aria-hidden="true">⌖</span><Input label={t('home.where')} name="location" placeholder={t('home.locationPlaceholder')} aria-label={t('home.locationAria')} /></div>
        <Button type="submit" className="hero-search-button">{t('home.search')}</Button>
      </form>
      {voiceStatus ? <p className="voice-search-status" role="status" aria-live="polite">{voiceStatus}</p> : null}
    </>
  );
}
