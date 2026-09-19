'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
import styles from './PublicProfileJumpNav.module.css';

type ProfileKind = 'professional' | 'business';
type JumpKey =
  | 'publicProvider.jumpNav.about'
  | 'publicProvider.jumpNav.talents'
  | 'publicProvider.jumpNav.career'
  | 'publicProvider.jumpNav.work'
  | 'publicProvider.jumpNav.services'
  | 'publicProvider.jumpNav.products';
type JumpItem = { id: string; key: JumpKey; selector: string };
type ResolvedJumpItem = { item: JumpItem; target: HTMLElement };

const professionalItems: JumpItem[] = [
  { id: 'about', key: 'publicProvider.jumpNav.about', selector: '.profile-layout main .detail-section' },
  { id: 'talents', key: 'publicProvider.jumpNav.talents', selector: '#professional-talents-heading' },
  { id: 'career', key: 'publicProvider.jumpNav.career', selector: '#professional-career-heading' },
  { id: 'work', key: 'publicProvider.jumpNav.work', selector: '#professional-work-showcase-heading' },
  { id: 'services', key: 'publicProvider.jumpNav.services', selector: '.profile-services' },
];

const businessItems: JumpItem[] = [
  { id: 'services', key: 'publicProvider.jumpNav.services', selector: '#business-storefront-heading' },
  { id: 'products', key: 'publicProvider.jumpNav.products', selector: 'section[aria-label="Business products"]' },
  { id: 'about', key: 'publicProvider.jumpNav.about', selector: '.profile-layout main .detail-section' },
];

function targetFor(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  return element.closest<HTMLElement>('section') ?? element;
}

function activeOffset() {
  return window.matchMedia('(max-width: 700px)').matches ? 122 : 126;
}

export default function PublicProfileJumpNav({ kind }: { kind: ProfileKind }) {
  const { t } = usePublicProviderTranslations();
  const items = useMemo(() => kind === 'professional' ? professionalItems : businessItems, [kind]);
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    let disposed = false;
    let updateFrame = 0;
    let resolved: ResolvedJumpItem[] = [];

    const updateActive = () => {
      updateFrame = 0;
      if (disposed || !resolved.length) return;

      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
        setActiveId(resolved[resolved.length - 1].item.id);
        return;
      }

      const offset = activeOffset();
      let current = resolved[0];
      for (const candidate of resolved) {
        if (candidate.target.getBoundingClientRect().top <= offset) current = candidate;
        else break;
      }
      setActiveId(current.item.id);
    };

    const scheduleActiveUpdate = () => {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(updateActive);
    };

    const discoverFrame = window.requestAnimationFrame(() => {
      resolved = items.flatMap((item) => {
        const target = targetFor(item.selector);
        return target ? [{ item, target }] : [];
      });
      setAvailable(new Set(resolved.map(({ item }) => item.id)));
      setActiveId(resolved[0]?.item.id ?? null);
      scheduleActiveUpdate();
    });

    window.addEventListener('scroll', scheduleActiveUpdate, { passive: true });
    window.addEventListener('resize', scheduleActiveUpdate);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(discoverFrame);
      if (updateFrame) window.cancelAnimationFrame(updateFrame);
      window.removeEventListener('scroll', scheduleActiveUpdate);
      window.removeEventListener('resize', scheduleActiveUpdate);
    };
  }, [items]);

  useEffect(() => {
    if (!activeId) return;
    const rail = railRef.current;
    const activeItem = itemRefs.current[activeId];
    if (!rail || !activeItem) return;

    const edge = 8;
    const itemLeft = activeItem.offsetLeft;
    const itemRight = itemLeft + activeItem.offsetWidth;
    const visibleLeft = rail.scrollLeft + edge;
    const visibleRight = rail.scrollLeft + rail.clientWidth - edge;
    if (itemLeft < visibleLeft) rail.scrollTo({ left: Math.max(0, itemLeft - edge), behavior: 'smooth' });
    else if (itemRight > visibleRight) rail.scrollTo({ left: itemRight - rail.clientWidth + edge, behavior: 'smooth' });
  }, [activeId]);

  const visibleItems = items.filter((item) => available.has(item.id));
  if (!visibleItems.length) return null;

  return <nav className={styles.shell} aria-label={t('publicProvider.jumpNav.quickNavigation')}>
    <div className={styles.rail} ref={railRef}>
      {visibleItems.map((item) => <button
        type="button"
        className={`${styles.item} ${activeId === item.id ? styles.active : ''}`}
        aria-current={activeId === item.id ? 'location' : undefined}
        ref={(node) => { itemRefs.current[item.id] = node; }}
        key={item.id}
        onClick={() => {
          setActiveId(item.id);
          targetFor(item.selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        {t(item.key)}
      </button>)}
    </div>
  </nav>;
}
