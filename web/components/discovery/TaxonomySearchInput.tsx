'use client';

import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Input } from '../ui/primitives';
import styles from './TaxonomySearchInput.module.css';

type TaxonomyCategory = {
  code: string;
  name: string;
  group_name: string;
  aliases: string[];
};

type RankedSuggestion = TaxonomyCategory & {
  score: number;
  matched_alias: string;
};

type Props = {
  label: string;
  placeholder: string;
  value: string;
  locale: string;
  onChange: (value: string) => void;
};

const intentTokens = new Set([
  'near', 'nearby', 'nearest', 'closest', 'around', 'me', 'my',
  'available', 'now', 'service', 'services', 'provider', 'providers',
  'அருகில்', 'அருகிலுள்ள', 'அருகாமை', 'எனக்கு', 'இப்போது', 'சேவை', 'சேவைகள்',
  'கிடைக்கும்', 'கிடைக்கிறார்', 'கிடைக்கிறது',
]);

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function semanticNeedle(value: string) {
  return normalized(value)
    .split(' ')
    .filter((token) => token && !intentTokens.has(token))
    .join(' ');
}

function aliasValues(category: TaxonomyCategory) {
  return Array.isArray(category.aliases) ? category.aliases.map(normalized).filter(Boolean) : [];
}

function rankCategory(category: TaxonomyCategory, needle: string): RankedSuggestion | null {
  if (!needle || needle.length < 2) return null;

  const name = normalized(category.name);
  const group = normalized(category.group_name);
  const aliases = aliasValues(category);
  const allText = [name, group, ...aliases].join(' ');
  const tokens = needle.split(' ').filter(Boolean);
  if (!tokens.every((token) => allText.includes(token))) return null;

  let score = 40;
  let matchedAlias = '';

  if (name === needle) score = 320;
  else if (name.startsWith(needle)) score = 250;
  else if (name.includes(needle)) score = 180;

  const exactAlias = aliases.find((alias) => alias === needle);
  const prefixAlias = aliases.find((alias) => alias.startsWith(needle));
  const includeAlias = aliases.find((alias) => alias.includes(needle));
  if (exactAlias) {
    score = Math.max(score, 300);
    matchedAlias = category.aliases[aliases.indexOf(exactAlias)] || exactAlias;
  } else if (prefixAlias) {
    score = Math.max(score, 235);
    matchedAlias = category.aliases[aliases.indexOf(prefixAlias)] || prefixAlias;
  } else if (includeAlias) {
    score = Math.max(score, 165);
    matchedAlias = category.aliases[aliases.indexOf(includeAlias)] || includeAlias;
  }

  if (group === needle) score = Math.max(score, 130);
  else if (group.startsWith(needle)) score = Math.max(score, 100);
  else if (group.includes(needle)) score = Math.max(score, 75);

  return { ...category, score, matched_alias: matchedAlias };
}

export function TaxonomySearchInput({ label, placeholder, value, locale, onChange }: Props) {
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/marketplace/search-taxonomy', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { categories?: TaxonomyCategory[] };
        if (!cancelled && Array.isArray(payload.categories)) setTaxonomy(payload.categories);
      } catch {
        // Suggestions are optional. Normal marketplace text search remains available.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const needle = useMemo(() => semanticNeedle(value), [value]);
  const suggestions = useMemo(() => taxonomy
    .map((category) => rankCategory(category, needle))
    .filter((category): category is RankedSuggestion => Boolean(category))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 6), [needle, taxonomy]);

  const resolvedIntent = useMemo(() => {
    if (!needle) return null;
    return taxonomy.find((category) => {
      if (normalized(category.name) === needle) return true;
      return aliasValues(category).some((alias) => alias === needle);
    }) ?? null;
  }, [needle, taxonomy]);

  useEffect(() => setActiveIndex(-1), [needle]);

  const showSuggestions = focused && suggestions.length > 0;
  const listId = 'marketplace-search-suggestions';

  const applySuggestion = (suggestion: TaxonomyCategory) => {
    onChange(suggestion.name);
    setFocused(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      applySuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setFocused(false);
      setActiveIndex(-1);
    }
  };

  return <div className={styles.wrap}>
    <Input
      id="explore-service-search"
      label={label}
      placeholder={placeholder}
      value={value}
      autoComplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showSuggestions}
      aria-controls={showSuggestions ? listId : undefined}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value)}
    />

    {showSuggestions ? <div id={listId} className={styles.list} role="listbox" aria-label={locale === 'ta-IN' ? 'தேடல் பரிந்துரைகள்' : 'Search suggestions'}>
      <div className={styles.heading}>{locale === 'ta-IN' ? 'பொருந்தும் சேவை வகைகள்' : 'Matching service categories'}</div>
      {suggestions.map((suggestion, index) => <button
        id={`${listId}-${index}`}
        key={suggestion.code}
        type="button"
        role="option"
        aria-selected={index === activeIndex}
        className={`${styles.option} ${index === activeIndex ? styles.active : ''}`}
        onMouseDown={(event) => {
          event.preventDefault();
          applySuggestion(suggestion);
        }}
      >
        <span className={styles.optionText}><strong>{suggestion.name}</strong><small>{suggestion.group_name}</small></span>
        {suggestion.matched_alias && normalized(suggestion.matched_alias) !== normalized(suggestion.name)
          ? <span className={styles.alias}>{suggestion.matched_alias}</span>
          : null}
      </button>)}
    </div> : null}

    {resolvedIntent ? <p className={styles.intent} aria-live="polite">
      {locale === 'ta-IN' ? 'தேடல் பொருள்:' : 'Search intent:'} <strong>{resolvedIntent.name}</strong>
      {resolvedIntent.group_name ? ` · ${resolvedIntent.group_name}` : ''}
    </p> : null}
  </div>;
}
