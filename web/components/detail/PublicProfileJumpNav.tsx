'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './PublicProfileJumpNav.module.css';

type ProfileKind = 'professional' | 'business';
type JumpItem = { id: string; en: string; ta: string; selector: string };

const professionalItems: JumpItem[] = [
  { id: 'about', en: 'About', ta: 'பற்றி', selector: '.profile-layout main .detail-section' },
  { id: 'talents', en: 'Talents', ta: 'திறன்கள்', selector: '#professional-talents-heading' },
  { id: 'career', en: 'Career', ta: 'Career', selector: '#professional-career-heading' },
  { id: 'work', en: 'Work', ta: 'வேலைகள்', selector: '#professional-work-showcase-heading' },
  { id: 'services', en: 'Services', ta: 'சேவைகள்', selector: '.profile-services' },
];

const businessItems: JumpItem[] = [
  { id: 'services', en: 'Services', ta: 'சேவைகள்', selector: '#business-storefront-heading' },
  { id: 'products', en: 'Products', ta: 'Products', selector: 'section[aria-label="Business products"]' },
  { id: 'about', en: 'About', ta: 'பற்றி', selector: '.profile-layout main .detail-section' },
];

function targetFor(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  return element.closest<HTMLElement>('section') ?? element;
}

export default function PublicProfileJumpNav({ kind }: { kind: ProfileKind }) {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const items = useMemo(() => kind === 'professional' ? professionalItems : businessItems, [kind]);
  const [available, setAvailable] = useState<Set<string>>(new Set());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAvailable(new Set(items.filter((item) => Boolean(targetFor(item.selector))).map((item) => item.id)));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  const visibleItems = items.filter((item) => available.has(item.id));
  if (!visibleItems.length) return null;

  return <nav className={styles.shell} aria-label={tamil ? 'Public profile விரைவு வழிசெலுத்தல்' : 'Public profile quick navigation'}>
    <div className={styles.rail}>
      {visibleItems.map((item) => <button
        type="button"
        className={styles.item}
        key={item.id}
        onClick={() => targetFor(item.selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      >
        {tamil ? item.ta : item.en}
      </button>)}
    </div>
  </nav>;
}
