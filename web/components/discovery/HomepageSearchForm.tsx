'use client';

import { FormEvent } from 'react';
import { Button, Input } from '../ui/primitives';

export default function HomepageSearchForm() {
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
      <div className="search-field search-field-service"><span className="search-field-icon" aria-hidden="true">⌕</span><Input label="What do you need help with?" name="q" placeholder="What do you need help with?" aria-label="Search for a service" /></div>
      <div className="search-field search-field-location"><span className="search-field-icon" aria-hidden="true">⌖</span><Input label="Where?" name="location" placeholder="City or neighbourhood" aria-label="Choose a location" /></div>
      <Button type="submit" className="hero-search-button">Search</Button>
    </form>
  );
}
