'use client';

import { FormEvent } from 'react';
import { Button, Input } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

export default function HomepageSearchForm() {
  const { t } = useLanguage();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get('q') ?? '').trim();
    const location = String(formData.get('location') ?? '').trim();
    const params = new URLSearchParams();

    if (query) params.set('q', query);
    if (location) params.set('location', location);
    window.location.assign(params.toString() ? `/explore?${params.toString()}` : '/explore');
  };

  return (
    <form className="search-panel hero-search-panel" action="/explore" onSubmit={handleSubmit}>
      <div className="search-field search-field-service"><span className="search-field-icon" aria-hidden="true">⌕</span><Input label={t('home.searchNeed')} name="q" placeholder={t('home.searchNeed')} aria-label={t('home.searchNeedAria')} /></div>
      <div className="search-field search-field-location"><span className="search-field-icon" aria-hidden="true">⌖</span><Input label={t('home.where')} name="location" placeholder={t('home.locationPlaceholder')} aria-label={t('home.locationAria')} /></div>
      <Button type="submit" className="hero-search-button">{t('home.search')}</Button>
    </form>
  );
}
