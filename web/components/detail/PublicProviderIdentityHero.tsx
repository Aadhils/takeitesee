'use client';

import Link from 'next/link';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
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
  const { t } = usePublicProviderTranslations();
  const fallbackDescription = kind === 'business'
    ? t('publicProvider.hero.verifiedBusinessFallback')
    : t('publicProvider.hero.independentProfessionalFallback');

  return <div className={styles.shell}>
    <nav className={styles.breadcrumbs} aria-label={t('publicProvider.hero.breadcrumb')}>
      <ol>
        <li><Link href="/explore">{t('publicProvider.hero.explore')}</Link></li>
        <li aria-hidden="true">/</li>
        <li><span aria-current="page">{kind === 'business' ? t('publicProvider.hero.business') : t('publicProvider.hero.professional')}</span></li>
      </ol>
    </nav>

    <section className={styles.hero} aria-label={t('publicProvider.hero.identityAria')}>
      <div className={`${styles.banner} ${kind === 'business' ? styles.businessBanner : styles.professionalBanner}`}>
        {bannerUrl ? <img className={styles.bannerImage} src={bannerUrl} alt="" /> : null}
        <div className={styles.bannerShade} />
      </div>
      <div className={styles.body}>
        <div className={styles.avatarWrap}>
          {avatarUrl
            ? <img className={styles.avatar} src={avatarUrl} alt={`${displayName} ${kind === 'business' ? t('publicProvider.hero.businessLogoAlt') : t('publicProvider.hero.profilePictureAlt')}`} />
            : <div className={styles.avatarFallback} aria-hidden="true">{initials(displayName, kind)}</div>}
        </div>
        <div className={styles.identity}>
          <div className={styles.badges}>
            <Badge tone="success">{t('publicProvider.hero.verifiedProfile')}</Badge>
            <Badge tone="info">{kind === 'business' ? t('publicProvider.hero.businessProvider') : t('publicProvider.hero.professionalProvider')}</Badge>
          </div>
          <h1>{displayName}</h1>
          <p className={styles.description}>{description || fallbackDescription}</p>
          <p className={styles.location}>{location || t('publicProvider.hero.serviceAreaBooking')}</p>
        </div>
      </div>
    </section>
  </div>;
}
