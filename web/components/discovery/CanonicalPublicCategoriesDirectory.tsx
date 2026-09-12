'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Alert, Badge, Card } from '../ui/primitives';
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

function formatLocalized(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function CanonicalPublicCategoriesDirectory({ categories }: { categories: CategoryEntry[] | null }) {
  const { locale, t } = useLanguage();

  if (categories === null) {
    return <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{t('categories.eyebrow')}</span>
        <h1>{t('categories.unavailableTitle')}</h1>
      </section>
      <Alert title={t('categories.unavailableAlertTitle')} tone="warning">
        {t('categories.unavailableAlertBody')}
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
      <span className="eyebrow">{t('categories.eyebrow')}</span>
      <h1>{t('categories.title')}</h1>
      <p>{t('categories.subtitle')}</p>
    </section>

    <div className="results-heading"><div><span className="eyebrow">{t('categories.canonicalEyebrow')}</span><h2>{formatLocalized(t('categories.summary'), { approved: categories.length, live: liveCategoryCount })}</h2></div></div>

    {Array.from(groups.entries()).map(([groupName, groupCategories]) => {
      const displayGroupName = localizedMarketplaceGroupLabel(groupName, locale);
      return <section className="section-stack" key={groupName}>
        <div><span className="eyebrow">{t('categories.groupEyebrow')}</span><h2>{displayGroupName}</h2></div>
        <div className="service-grid">
          {groupCategories.map((category) => {
            const liveCount = category.service_count;
            const hasLiveSupply = typeof liveCount === 'number' && liveCount > 0;
            const displayName = localizedMarketplaceCategoryLabel(category, locale);
            const exploreHref = `/explore?category=${encodeURIComponent(category.slug)}`;
            return <Card className="discovery-card" key={category.code}>
              <div className="discovery-card-content">
                <div className="card-meta">
                  <Badge tone={hasLiveSupply ? 'success' : 'info'}>{t(hasLiveSupply ? 'categories.liveCategory' : 'categories.approvedCategory')}</Badge>
                  {liveCount === null
                    ? <Badge tone="neutral">{t('categories.liveCountUnavailable')}</Badge>
                    : <Badge tone="neutral">{formatLocalized(t(liveCount === 1 ? 'categories.activeServiceOne' : 'categories.activeServiceMany'), { count: liveCount })}</Badge>}
                </div>
                <h2><Link href={exploreHref}>{displayName}</Link></h2>
                <p className="card-description">{hasLiveSupply
                  ? formatLocalized(t('categories.liveDescription'), { category: displayName })
                  : t('categories.readyDescription')}</p>
                <div className="card-footer">
                  <span>{t('categories.unifiedSearch')}</span>
                  <Link href={exploreHref} className="button button-secondary">{t('categories.searchCategory')}</Link>
                </div>
              </div>
            </Card>;
          })}
        </div>
      </section>;
    })}

    {!categories.length ? <Card>
      <h2>{t('categories.emptyTitle')}</h2>
      <div className="button-row"><Link href="/explore" className="button button-primary">{t('categories.exploreMarketplace')}</Link></div>
    </Card> : null}
  </div>;
}
