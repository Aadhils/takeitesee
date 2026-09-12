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

export function CanonicalPublicCategoriesDirectory({ categories }: { categories: CategoryEntry[] | null }) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;

  if (categories === null) {
    return <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{text('Service taxonomy', 'சேவை வகைப்பாடு')}</span>
        <h1>{text('Browse TakeItEsee service categories.', 'TakeItEsee சேவை வகைகளை பார்க்கவும்.')}</h1>
      </section>
      <Alert title={text('Category directory temporarily unavailable', 'வகை அடைவு தற்காலிகமாக கிடைக்கவில்லை')} tone="warning">
        {text('The approved service taxonomy could not be loaded. Explore remains available for live marketplace search.', 'Approved service taxonomy-ஐ ஏற்ற முடியவில்லை. Live marketplace தேடலுக்கு Explore தொடர்ந்து கிடைக்கும்.')}
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
      <span className="eyebrow">{text('Service taxonomy', 'சேவை வகைப்பாடு')}</span>
      <h1>{text('Browse approved TakeItEsee service categories.', 'அங்கீகரிக்கப்பட்ட TakeItEsee சேவை வகைகளை பார்க்கவும்.')}</h1>
      <p>{text(
        'Approved specialties stay discoverable even before local supply goes live. Live counts show only active services from verified marketplace-ready providers.',
        'உள்ளூர் சேவைகள் இன்னும் live ஆகாதிருந்தாலும் அங்கீகரிக்கப்பட்ட சேவை வகைகளை இங்கே பார்க்கலாம். Live count-ல் verified marketplace-ready providers-ன் active services மட்டும் கணக்கிடப்படும்.',
      )}</p>
    </section>

    <div className="results-heading"><div><span className="eyebrow">{text('Canonical marketplace taxonomy', 'அங்கீகரிக்கப்பட்ட marketplace வகைப்பாடு')}</span><h2>{text(`${categories.length} approved specialties · ${liveCategoryCount} live now`, `${categories.length} அங்கீகரிக்கப்பட்ட சேவை வகைகள் · ${liveCategoryCount} இப்போது live`)}</h2></div></div>

    {Array.from(groups.entries()).map(([groupName, groupCategories]) => {
      const displayGroupName = localizedMarketplaceGroupLabel(groupName, locale);
      return <section className="section-stack" key={groupName}>
        <div><span className="eyebrow">{text('Service group', 'சேவை குழு')}</span><h2>{displayGroupName}</h2></div>
        <div className="service-grid">
          {groupCategories.map((category) => {
            const liveCount = category.service_count;
            const hasLiveSupply = typeof liveCount === 'number' && liveCount > 0;
            const displayName = localizedMarketplaceCategoryLabel(category, locale);
            const exploreHref = `/explore?category=${encodeURIComponent(category.slug)}`;
            return <Card className="discovery-card" key={category.code}>
              <div className="discovery-card-content">
                <div className="card-meta">
                  <Badge tone={hasLiveSupply ? 'success' : 'info'}>{hasLiveSupply ? text('Live category', 'Live வகை') : text('Approved category', 'அங்கீகரிக்கப்பட்ட வகை')}</Badge>
                  {liveCount === null
                    ? <Badge tone="neutral">{text('Live count unavailable', 'Live count கிடைக்கவில்லை')}</Badge>
                    : <Badge tone="neutral">{text(`${liveCount} active ${liveCount === 1 ? 'service' : 'services'}`, `${liveCount} active சேவைகள்`)}</Badge>}
                </div>
                <h2><Link href={exploreHref}>{displayName}</Link></h2>
                <p className="card-description">{hasLiveSupply
                  ? text(`Search verified Professionals and Businesses currently offering ${category.name}.`, `${displayName} வழங்கும் verified Professionals மற்றும் Businesses-ஐ தேடவும்.`)
                  : text('This approved specialty is ready for marketplace discovery. Matching verified Providers will appear automatically when active supply becomes available.', 'இந்த அங்கீகரிக்கப்பட்ட சேவை வகை marketplace discovery-க்கு தயாராக உள்ளது. Active supply கிடைக்கும் போது பொருந்தும் verified Providers தானாக தோன்றுவர்.')}</p>
                <div className="card-footer">
                  <span>{text('Professional + Business unified search', 'Professional + Business ஒருங்கிணைந்த தேடல்')}</span>
                  <Link href={exploreHref} className="button button-secondary">{text('Search category', 'வகையை தேட')}</Link>
                </div>
              </div>
            </Card>;
          })}
        </div>
      </section>;
    })}

    {!categories.length ? <Card>
      <h2>{text('No approved service categories are available yet.', 'இன்னும் அங்கீகரிக்கப்பட்ட சேவை வகைகள் இல்லை.')}</h2>
      <div className="button-row"><Link href="/explore" className="button button-primary">{text('Explore marketplace', 'Marketplace-ஐ பார்க்க')}</Link></div>
    </Card> : null}
  </div>;
}
