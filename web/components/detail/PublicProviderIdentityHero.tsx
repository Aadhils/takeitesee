'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge } from '../ui/primitives';
import styles from './PublicProviderIdentity.module.css';

type ProviderKind = 'professional' | 'business';

function initials(name: string, kind: ProviderKind) {
  const fallback = kind === 'business' ? 'VB' : 'VP';
  return (name || fallback).split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || fallback;
}

export default function PublicProviderIdentityHero({
  kind,
  displayName,
  description,
  location,
  avatarUrl,
  bannerUrl,
}: {
  kind: ProviderKind;
  displayName: string;
  description: string;
  location: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const fallbackDescription = kind === 'business'
    ? text('Verified business on TakeItEsee', 'TakeItEsee-ல் சரிபார்க்கப்பட்ட வணிகம்')
    : text('Independent professional on TakeItEsee', 'TakeItEsee-ல் சுயாதீன நிபுணர்');

  return <div className={styles.shell}>
    <nav className={styles.breadcrumbs} aria-label={text('Breadcrumb', 'வழிசெலுத்தல்')}>
      <ol>
        <li><Link href="/explore">{text('Explore', 'Explore')}</Link></li>
        <li aria-hidden="true">/</li>
        <li><span aria-current="page">{kind === 'business' ? text('Business', 'வணிகம்') : text('Professional', 'நிபுணர்')}</span></li>
      </ol>
    </nav>

    <section className={styles.hero} aria-label={text('Public provider identity', 'Public provider identity')}>
      <div className={`${styles.banner} ${kind === 'business' ? styles.businessBanner : styles.professionalBanner}`}>
        {bannerUrl ? <img className={styles.bannerImage} src={bannerUrl} alt="" /> : null}
        <div className={styles.bannerShade} />
      </div>
      <div className={styles.body}>
        <div className={styles.avatarWrap}>
          {avatarUrl
            ? <img className={styles.avatar} src={avatarUrl} alt={`${displayName} ${kind === 'business' ? 'business logo' : 'profile picture'}`} />
            : <div className={styles.avatarFallback} aria-hidden="true">{initials(displayName, kind)}</div>}
        </div>
        <div className={styles.identity}>
          <div className={styles.badges}>
            <Badge tone="success">{text('Verified profile', 'சரிபார்க்கப்பட்ட profile')}</Badge>
            <Badge tone="info">{kind === 'business' ? text('Business provider', 'வணிக வழங்குநர்') : text('Professional provider', 'நிபுணர் வழங்குநர்')}</Badge>
          </div>
          <h1>{displayName}</h1>
          <p className={styles.description}>{description || fallbackDescription}</p>
          <p className={styles.location}>{location || text('Service area confirmed during booking', 'Booking போது service area உறுதிசெய்யப்படும்')}</p>
        </div>
      </div>
    </section>
  </div>;
}
