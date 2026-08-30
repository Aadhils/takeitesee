'use client';

import Link from 'next/link';
import HomepageSearchForm from './HomepageSearchForm';
import { useLanguage } from '../i18n/LanguageProvider';

const copy = {
  'en-IN': {
    eyebrow: 'A better way to find help',
    titleStart: 'Find the right service',
    titleMiddle: 'for the',
    titleAccent: 'next thing you need.',
    lede: 'Search the live marketplace, compare published services, and book with verified providers as the catalog grows.',
    trustAria: 'Marketplace information',
    verified: 'Verified providers',
    verifiedHelp: 'Live listings require verification',
    reviews: 'Published reviews',
    reviewsHelp: 'Ratings come from approved reviews',
    booking: 'Live booking data',
    bookingHelp: 'Availability is checked during booking',
    catalog: 'Growing catalog',
    catalogHelp: 'Only active services are shown',
    marketplace: 'Live marketplace',
    exploreTitle: 'Explore active services',
    exploreHelp: 'These shortcuts search the services currently published in the marketplace.',
    exploreAction: 'Explore services',
    browseAll: 'Browse live marketplace',
  },
  'ta-IN': {
    eyebrow: 'உதவியை கண்டுபிடிக்க ஒரு சிறந்த வழி',
    titleStart: 'உங்களுக்கு தேவையான சரியான சேவையை',
    titleMiddle: 'அடுத்த தேவைக்காக',
    titleAccent: 'கண்டுபிடியுங்கள்.',
    lede: 'நேரடி marketplace-ல் தேடி, வெளியிடப்பட்ட சேவைகளை ஒப்பிட்டு, சரிபார்க்கப்பட்ட சேவை வழங்குநர்களிடம் booking செய்யுங்கள்.',
    trustAria: 'Marketplace தகவல்',
    verified: 'சரிபார்க்கப்பட்ட வழங்குநர்கள்',
    verifiedHelp: 'நேரடி listing-களுக்கு verification அவசியம்',
    reviews: 'வெளியிடப்பட்ட reviews',
    reviewsHelp: 'Ratings அங்கீகரிக்கப்பட்ட reviews-லிருந்து வருகிறது',
    booking: 'நேரடி booking data',
    bookingHelp: 'Booking செய்யும் போது availability சரிபார்க்கப்படுகிறது',
    catalog: 'வளர்ந்து வரும் catalog',
    catalogHelp: 'Active services மட்டும் காட்டப்படுகின்றன',
    marketplace: 'நேரடி marketplace',
    exploreTitle: 'Active services-ஐ தேடுங்கள்',
    exploreHelp: 'இந்த shortcuts தற்போது marketplace-ல் வெளியிடப்பட்டுள்ள சேவைகளை தேடும்.',
    exploreAction: 'சேவைகளை பாருங்கள்',
    browseAll: 'முழு marketplace-ஐ பாருங்கள்',
  },
} as const;

const marketplacePaths = [
  {
    query: 'home', icon: '⌂',
    en: { title: 'Home services', description: 'Cleaning, inspection, repair, and practical help for your space.' },
    ta: { title: 'வீட்டு சேவைகள்', description: 'Cleaning, inspection, repair மற்றும் உங்கள் வீட்டிற்கான நடைமுறை உதவிகள்.' },
  },
  {
    query: 'business', icon: '▦',
    en: { title: 'Business services', description: 'Find support for business, operations, and professional needs.' },
    ta: { title: 'வணிக சேவைகள்', description: 'Business, operations மற்றும் professional தேவைகளுக்கான சேவைகளை கண்டுபிடியுங்கள்.' },
  },
  {
    query: 'technology', icon: '◇',
    en: { title: 'Tech & digital', description: 'Browse active technology and digital service listings.' },
    ta: { title: 'Tech & digital', description: 'Active technology மற்றும் digital service listing-களை பாருங்கள்.' },
  },
  {
    query: 'learning', icon: '↗',
    en: { title: 'Learning', description: 'Explore tutoring, coaching, and learning services when available.' },
    ta: { title: 'கற்றல்', description: 'Tutoring, coaching மற்றும் learning services கிடைக்கும் போது அவற்றை பாருங்கள்.' },
  },
  {
    query: '', icon: '✦',
    en: { title: 'All live services', description: 'See the full marketplace catalog currently published on takeitesee.' },
    ta: { title: 'அனைத்து நேரடி சேவைகள்', description: 'takeitesee-ல் தற்போது வெளியிடப்பட்டுள்ள முழு marketplace catalog-ஐ பாருங்கள்.' },
  },
] as const;

export default function LocalizedHomepage() {
  const { locale } = useLanguage();
  const t = copy[locale];
  const tamil = locale === 'ta-IN';

  return (
    <div className="home-page">
      <section className="hero-grid hero-centered">
        <div className="hero-copy hero-centered-copy">
          <div className="hero-logo-wrap">
            <img className="hero-logo" src="/official-takeitesee-logo.png" alt="takeitesee" />
          </div>
          <span className="hero-eyebrow">{t.eyebrow}</span>
          <h1>{t.titleStart}<br />{t.titleMiddle} <span className="text-accent">{t.titleAccent}</span></h1>
          <p className="hero-lede">{t.lede}</p>
          <HomepageSearchForm />
          <div className="hero-trust-row" aria-label={t.trustAria}>
            <span><b aria-hidden="true">✓</b><strong>{t.verified}</strong><small>{t.verifiedHelp}</small></span>
            <span><b aria-hidden="true">◷</b><strong>{t.reviews}</strong><small>{t.reviewsHelp}</small></span>
            <span><b aria-hidden="true">◇</b><strong>{t.booking}</strong><small>{t.bookingHelp}</small></span>
            <span><b aria-hidden="true">✦</b><strong>{t.catalog}</strong><small>{t.catalogHelp}</small></span>
          </div>
        </div>
      </section>

      <section className="section-block homepage-categories" aria-labelledby="category-heading">
        <div className="category-heading-centered"><span className="eyebrow">{t.marketplace}</span><h2 id="category-heading">{t.exploreTitle}</h2><p>{t.exploreHelp}</p></div>
        <div className="homepage-category-grid">
          {marketplacePaths.map((item, index) => {
            const href = item.query ? `/explore?q=${encodeURIComponent(item.query)}` : '/explore';
            const text = tamil ? item.ta : item.en;
            return <Link href={href} className={`homepage-category-card category-accent-${index + 1}`} key={item.query || 'all'}><span className="homepage-category-icon" aria-hidden="true">{item.icon}</span><strong>{text.title}</strong><p>{text.description}</p><span className="homepage-category-link">{t.exploreAction} <span aria-hidden="true">-&gt;</span></span></Link>;
          })}
        </div>
        <Link href="/explore" className="category-view-all">{t.browseAll} <span aria-hidden="true">-&gt;</span></Link>
      </section>
    </div>
  );
}
