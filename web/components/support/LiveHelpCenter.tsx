'use client';

import Link from 'next/link';
import styles from '../account/CustomerReviewsHelpResponsive.module.css';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';

export default function LiveHelpCenter() {
  const { t } = useLanguage();

  const topics = [
    {
      title: t('help.topic.findBook.title'),
      body: t('help.topic.findBook.body'),
      href: '/explore',
      action: t('help.topic.findBook.action'),
    },
    {
      title: t('help.topic.manageBooking.title'),
      body: t('help.topic.manageBooking.body'),
      href: '/bookings',
      action: t('help.topic.manageBooking.action'),
    },
    {
      title: t('help.topic.bookingSupport.title'),
      body: t('help.topic.bookingSupport.body'),
      href: '/bookings',
      action: t('help.topic.bookingSupport.action'),
    },
    {
      title: t('help.topic.accountProfile.title'),
      body: t('help.topic.accountProfile.body'),
      href: '/account',
      action: t('help.topic.accountProfile.action'),
    },
    {
      title: t('help.topic.platformSupport.title'),
      body: t('help.topic.platformSupport.body'),
      href: '/account/support',
      action: t('help.topic.platformSupport.action'),
    },
    {
      title: t('help.topic.providerTrust.title'),
      body: t('help.topic.providerTrust.body'),
      href: '/businesses',
      action: t('help.topic.providerTrust.action'),
    },
    {
      title: t('help.topic.safetyReporting.title'),
      body: t('help.topic.safetyReporting.body'),
      href: '/messages',
      action: t('help.topic.safetyReporting.action'),
    },
  ];

  return <div className={styles.reviewsHelpJourney}>
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{t('help.eyebrow')}</span>
        <h1>{t('help.title')}</h1>
        <p>{t('help.intro')}</p>
      </section>

      <div className="help-topic-grid">
        {topics.map((topic) => <Card className="help-topic-card" key={topic.title}>
          <span className="help-topic-mark" aria-hidden="true">?</span>
          <h2>{topic.title}</h2>
          <p>{topic.body}</p>
          <Link href={topic.href} className="text-link">{topic.action}</Link>
        </Card>)}
      </div>

      <Card className="faq-card">
        <span className="eyebrow">{t('help.faq.eyebrow')}</span>
        <h2>{t('help.faq.title')}</h2>
        <div className="faq-list">
          <details>
            <summary>{t('help.faq.openCase.question')}</summary>
            <p>{t('help.faq.openCase.answer')}</p>
          </details>
          <details>
            <summary>{t('help.faq.privacy.question')}</summary>
            <p>{t('help.faq.privacy.answer')}</p>
          </details>
          <details>
            <summary>{t('help.faq.providerLanguage.question')}</summary>
            <p>{t('help.faq.providerLanguage.answer')}</p>
          </details>
        </div>
      </Card>

      <Card className="support-cta">
        <div>
          <Badge tone="info">{t('help.bookingCta.badge')}</Badge>
          <h2>{t('help.bookingCta.title')}</h2>
          <p>{t('help.bookingCta.body')}</p>
        </div>
        <Link href="/bookings" className="button button-primary">{t('help.bookingCta.action')}</Link>
      </Card>

      <Card className="support-cta">
        <div>
          <Badge tone="neutral">{t('help.platformCta.badge')}</Badge>
          <h2>{t('help.platformCta.title')}</h2>
          <p>{t('help.platformCta.body')}</p>
        </div>
        <div className="button-row">
          <Link href="/account/support" className="button button-primary">{t('help.platformCta.action')}</Link>
          <a href="mailto:uandv.com@gmail.com" className="button button-secondary">{t('help.platformCta.email')}</a>
          <Link href="/privacy" className="button button-secondary">{t('help.platformCta.privacy')}</Link>
        </div>
      </Card>
    </div>
  </div>;
}
