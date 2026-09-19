'use client';

import Link from 'next/link';
import HomepageSearchForm from './HomepageSearchForm';
import { useLanguage, type TranslationKey } from '../i18n/LanguageProvider';

const marketplacePaths: Array<{
  query: string;
  icon: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}> = [
  {
    query: 'home',
    icon: '⌂',
    titleKey: 'home.path.home.title',
    descriptionKey: 'home.path.home.description',
  },
  {
    query: 'business',
    icon: '▦',
    titleKey: 'home.path.business.title',
    descriptionKey: 'home.path.business.description',
  },
  {
    query: 'technology',
    icon: '◇',
    titleKey: 'home.path.technology.title',
    descriptionKey: 'home.path.technology.description',
  },
  {
    query: 'learning',
    icon: '↗',
    titleKey: 'home.path.learning.title',
    descriptionKey: 'home.path.learning.description',
  },
  {
    query: '',
    icon: '✦',
    titleKey: 'home.path.all.title',
    descriptionKey: 'home.path.all.description',
  },
];

export default function LocalizedHomepage() {
  const { t } = useLanguage();

  return (
    <div className="home-page">
      <section className="hero-grid hero-centered">
        <div className="hero-copy hero-centered-copy">
          <div className="hero-logo-wrap">
            <img className="hero-logo" src="/official-takeitesee-logo.png" alt="takeitesee" />
          </div>
          <p className="hero-brand-slogan"><strong>{t('home.sloganLead')}</strong> {t('home.sloganTail')}</p>
          <h1>{t('home.titleStart')}<br />{t('home.titleMiddle')} <span className="text-accent">{t('home.titleAccent')}</span></h1>
          <p className="hero-lede">{t('home.lede')}</p>
          <HomepageSearchForm />
          <div className="hero-trust-row" aria-label={t('home.trustAria')}>
            <span><b aria-hidden="true">✓</b><strong>{t('home.verified')}</strong><small>{t('home.verifiedHelp')}</small></span>
            <span><b aria-hidden="true">◷</b><strong>{t('home.reviews')}</strong><small>{t('home.reviewsHelp')}</small></span>
            <span><b aria-hidden="true">◇</b><strong>{t('home.booking')}</strong><small>{t('home.bookingHelp')}</small></span>
            <span><b aria-hidden="true">✦</b><strong>{t('home.catalog')}</strong><small>{t('home.catalogHelp')}</small></span>
          </div>
        </div>
      </section>

      <section className="section-block homepage-categories" aria-labelledby="category-heading">
        <div className="category-heading-centered"><span className="eyebrow">{t('home.marketplace')}</span><h2 id="category-heading">{t('home.exploreTitle')}</h2><p>{t('home.exploreHelp')}</p></div>
        <div className="homepage-category-grid">
          {marketplacePaths.map((item, index) => {
            const href = item.query ? `/explore?q=${encodeURIComponent(item.query)}` : '/explore';
            return <Link href={href} className={`homepage-category-card category-accent-${index + 1}`} key={item.query || 'all'}><span className="homepage-category-icon" aria-hidden="true">{item.icon}</span><strong>{t(item.titleKey)}</strong><p>{t(item.descriptionKey)}</p><span className="homepage-category-link">{t('home.exploreAction')} <span aria-hidden="true">-&gt;</span></span></Link>;
          })}
        </div>
        <Link href="/explore" className="category-view-all">{t('home.browseAll')} <span aria-hidden="true">-&gt;</span></Link>
      </section>
    </div>
  );
}
