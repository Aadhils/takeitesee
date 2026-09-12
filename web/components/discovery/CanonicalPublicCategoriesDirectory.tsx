'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Alert, Badge, Card } from '../ui/primitives';
import {
  categoriesTranslation,
  formatCategoriesTranslation,
} from './categoriesLocalization';
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
  const liveCategoryCount = categories.filter((category) => (category.service_count ?? 0) > 0).length;

  return <div className="discovery-page">
    <section className="page-intro">
      <span className="eyebrow">{ct('eyebrow')}</span>
      <h1>{ct('title')}</h1>
      <p>{ct('subtitle')}</p>
    </section>

    <div className="results-heading"><div><span className="eyebrow">{ct('canonicalEyebrow')}</span><h2>{formatCategoriesTranslation(ct('summary'), { approved: categories.length, live: liveCategoryCount })}</h2></div></div>

    {Array.from(groups.entries()).map(([groupName, groupCategories]) => {
      const displayGroupName = localizedMarketplaceGroupLabel(groupName, locale);
      return <section className="section-stack" key={groupName}>
        <div><span className="eyebrow">{ct('serviceGroup')}</span><h2>{displayGroupName}</h2></div>
        <div className="service-grid">
          {groupCategories.map((category) => {
            const liveCount = category.service_count;
            const hasLiveSupply = typeof liveCount === 'number' && liveCount > 0;
            const displayName = localizedMarketplaceCategoryLabel(category, locale);
            const exploreHref = `/explore?category=${encodeURIComponent(category.slug)}`;
            const liveCountLabel = liveCount === null
              ? ct('liveCountUnavailable')
              : formatCategoriesTranslation(ct(liveCount === 1 ? 'activeServiceOne' : 'activeServiceMany'), { count: liveCount });
            const description = hasLiveSupply
              ? formatCategoriesTranslation(ct('liveDescription'), { category: displayName })
              : ct('approvedDescription');

            return <Card className="discovery-card" key={category.code}>
              <div className="discovery-card-content">
                <div className="card-meta">
                  <Badge tone={hasLiveSupply ? 'success' : 'info'}>{ct(hasLiveSupply ? 'liveCategory' : 'approvedCategory')}</Badge>
                  <Badge tone="neutral">{liveCountLabel}</Badge>
                </div>
                <h2><Link href={exploreHref}>{displayName}</Link></h2>
                <p className="card-description">{description}</p>
                <div className="card-footer">
                  <span>{ct('unifiedSearch')}</span>
                  <Link href={exploreHref} className="button button-secondary">{ct('searchCategory')}</Link>
                </div>
              </div>
            </Card>;
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
