'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Alert, Card } from '../ui/primitives';
import {
  categoriesTranslation,
  formatCategoriesTranslation,
} from './categoriesLocalization';
import styles from './CanonicalPublicCategoriesDirectory.module.css';
import {
  localizedMarketplaceCategoryLabel,
  localizedMarketplaceGroupLabel,
} from './marketplaceTaxonomyPresentation';

type CategoryEntry = {
  code: string;
  name: string;
  slug: string;
  group_name: string;
  aliases: string[];
  service_count: number | null;
};

function categoryGroupId(groupName: string) {
  return `category-group-${groupName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

export function CanonicalPublicCategoriesDirectory({ categories }: { categories: CategoryEntry[] | null }) {
  const { locale } = useLanguage();
  const ct = (key: Parameters<typeof categoriesTranslation>[1]) => categoriesTranslation(locale, key);

  if (categories === null) {
    return <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{ct('eyebrow')}</span>
        <h1>{ct('unavailableTitle')}</h1>
      </section>
      <Alert title={ct('unavailableAlertTitle')} tone="warning">
        {ct('unavailableAlertBody')}
      </Alert>
    </div>;
  }

  const groups = new Map<string, CategoryEntry[]>();
  for (const category of categories) {
    const current = groups.get(category.group_name) ?? [];
    current.push(category);
    groups.set(category.group_name, current);
  }
  const groupEntries = Array.from(groups.entries());
  const liveCategoryCount = categories.filter((category) => (category.service_count ?? 0) > 0).length;

  return <div className="discovery-page">
    <section className="page-intro">
      <span className="eyebrow">{ct('eyebrow')}</span>
      <h1>{ct('title')}</h1>
      <p>{ct('subtitle')}</p>
    </section>

    <div className="results-heading"><div><span className="eyebrow">{ct('canonicalEyebrow')}</span><h2>{formatCategoriesTranslation(ct('summary'), { approved: categories.length, live: liveCategoryCount })}</h2></div></div>

    {groupEntries.length ? <nav className={styles.groupNav} aria-label={ct('serviceGroup')}>
      {groupEntries.map(([groupName]) => <a
        className={styles.groupNavLink}
        href={`#${categoryGroupId(groupName)}`}
        key={groupName}
      >
        {localizedMarketplaceGroupLabel(groupName, locale)}
      </a>)}
    </nav> : null}

    {groupEntries.map(([groupName, groupCategories]) => {
      const displayGroupName = localizedMarketplaceGroupLabel(groupName, locale);
      return <section className={styles.groupSection} id={categoryGroupId(groupName)} key={groupName}>
        <div className={styles.groupHeading}>
          <div><span className="eyebrow">{ct('serviceGroup')}</span><h2>{displayGroupName}</h2></div>
        </div>
        <div className={styles.categoryGrid}>
          {groupCategories.map((category) => {
            const liveCount = category.service_count;
            const hasLiveSupply = typeof liveCount === 'number' && liveCount > 0;
            const displayName = localizedMarketplaceCategoryLabel(category, locale);
            const exploreHref = `/explore?category=${encodeURIComponent(category.slug)}`;
            const liveCountLabel = liveCount === null
              ? ct('liveCountUnavailable')
              : formatCategoriesTranslation(ct(liveCount === 1 ? 'activeServiceOne' : 'activeServiceMany'), { count: liveCount });

            return <Link href={exploreHref} className={styles.categoryTile} key={category.code}>
              <span className={styles.categoryCopy}>
                <strong>{displayName}</strong>
                <span className={styles.countRow}>
                  <span className={`${styles.statusDot} ${hasLiveSupply ? styles.statusDotLive : ''}`} aria-hidden="true" />
                  <span>{liveCountLabel}</span>
                </span>
              </span>
              <svg className={styles.arrow} aria-hidden="true" viewBox="0 0 24 24">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>;
          })}
        </div>
      </section>;
    })}

    {!categories.length ? <Card>
      <h2>{ct('emptyTitle')}</h2>
      <div className="button-row"><Link href="/explore" className="button button-primary">{ct('exploreMarketplace')}</Link></div>
    </Card> : null}
  </div>;
}
