'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';

export default function LiveHelpCenter() {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;

  const topics = [
    {
      title: text('Find and book a service', 'சேவையை கண்டுபிடித்து booking செய்'),
      body: text('Use Explore to compare live services from verified businesses and professionals, then open a listing to choose a date and time.', 'சரிபார்க்கப்பட்ட வணிகங்கள் மற்றும் நிபுணர்களின் live சேவைகளை Explore மூலம் ஒப்பிட்டு, listing-ஐ திறந்து தேதி மற்றும் நேரத்தை தேர்வு செய்யவும்.'),
      href: '/explore',
      action: text('Explore services', 'சேவைகளை பார்க்க'),
    },
    {
      title: text('Manage a booking', 'Booking-ஐ நிர்வகி'),
      body: text('Open My bookings to review the current booking status, schedule, payment state, audit history and available booking actions.', 'தற்போதைய booking நிலை, அட்டவணை, payment நிலை, audit history மற்றும் கிடைக்கும் actions-ஐ பார்க்க My bookings-ஐ திறக்கவும்.'),
      href: '/bookings',
      action: text('Open my bookings', 'என் bookings-ஐ திற'),
    },
    {
      title: text('Get help with a booking', 'Booking உதவி பெற'),
      body: text('Open the booking detail. When the live support window and policy allow it, the Get help control lets the customer open a support case for that booking.', 'Booking detail-ஐ திறக்கவும். Live support window மற்றும் policy அனுமதிக்கும் போது, Get help control மூலம் அந்த booking-க்கு support case திறக்கலாம்.'),
      href: '/bookings',
      action: text('View booking support', 'Booking support-ஐ பார்க்க'),
    },
    {
      title: text('Account and profile', 'Account மற்றும் profile'),
      body: text('Use your account workspace to manage authenticated profile information, preferences and customer workspace access.', 'Authenticated profile தகவல், preferences மற்றும் customer workspace access-ஐ நிர்வகிக்க account workspace-ஐ பயன்படுத்தவும்.'),
      href: '/account',
      action: text('Open account', 'Account-ஐ திற'),
    },
    {
      title: text('Provider verification and trust', 'Provider verification மற்றும் trust'),
      body: text('Public marketplace pages show verified providers and active published services. Provider-authored names and descriptions remain exactly as supplied.', 'Public marketplace pages சரிபார்க்கப்பட்ட providers மற்றும் active published சேவைகளை காட்டும். Provider எழுதிய பெயர்கள் மற்றும் descriptions மாற்றமின்றி இருக்கும்.'),
      href: '/businesses',
      action: text('Browse providers', 'Providers-ஐ பார்க்க'),
    },
    {
      title: text('Safety and reporting', 'பாதுகாப்பு மற்றும் reporting'),
      body: text('Where reporting or blocking controls are available in marketplace interactions, use them to send a safety report for scoped admin review.', 'Marketplace interactions-ல் report அல்லது block controls கிடைக்கும் இடங்களில், scoped admin review-க்கு safety report அனுப்ப அவற்றை பயன்படுத்தவும்.'),
      href: '/messages',
      action: text('Open messages', 'Messages-ஐ திற'),
    },
  ];

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{text('Support', 'உதவி')}</span>
        <h1>{text('Help center', 'உதவி மையம்')}</h1>
        <p>{text('Practical guidance for finding services, managing bookings, using your account and opening booking-specific support when the live policy allows it.', 'சேவைகளை கண்டுபிடித்தல், bookings-ஐ நிர்வகித்தல், account பயன்படுத்துதல் மற்றும் live policy அனுமதிக்கும் போது booking-specific support பெறுவதற்கான வழிகாட்டுதல்.')}</p>
      </section>

      <div className="help-topic-grid">
        {topics.map((topic) => (
          <Card className="help-topic-card" key={topic.title}>
            <span className="help-topic-mark" aria-hidden="true">?</span>
            <h2>{topic.title}</h2>
            <p>{topic.body}</p>
            <Link href={topic.href} className="text-link">{topic.action}</Link>
          </Card>
        ))}
      </div>

      <Card className="faq-card">
        <span className="eyebrow">{text('Frequently asked', 'அடிக்கடி கேட்கப்படும்')}</span>
        <h2>{text('Common questions', 'பொதுவான கேள்விகள்')}</h2>
        <div className="faq-list">
          <details><summary>{text('How do I open a support case?', 'Support case எப்படி திறப்பது?')}</summary><p>{text('Open the relevant booking. If the booking is inside its support window and the live policy permits support, use Get help and submit the category, summary and optional details.', 'சம்பந்தப்பட்ட booking-ஐ திறக்கவும். அது support window-க்குள் இருந்து live policy அனுமதித்தால், Get help மூலம் category, summary மற்றும் optional details-ஐ submit செய்யவும்.')}</p></details>
          <details><summary>{text('Where can I see payment or refund status?', 'Payment அல்லது refund status எங்கே பார்க்கலாம்?')}</summary><p>{text('Open the booking detail. Booking, payment and applicable refund states are presented with the booking history; available payment choices are shown by the live booking flow.', 'Booking detail-ஐ திறக்கவும். Booking, payment மற்றும் பொருந்தும் refund நிலைகள் booking history-யுடன் காட்டப்படும்; கிடைக்கும் payment choices live booking flow-ல் காட்டப்படும்.')}</p></details>
          <details><summary>{text('Why is provider content not translated?', 'Provider content ஏன் translate செய்யப்படவில்லை?')}</summary><p>{text('Provider names, service descriptions, customer reviews and other authored marketplace content stay in their source language so TakeItEsee does not fabricate or alter user-authored meaning.', 'Provider பெயர்கள், service descriptions, customer reviews மற்றும் மற்ற authored marketplace content source language-லேயே இருக்கும்; இதனால் TakeItEsee பயனர் எழுதிய அர்த்தத்தை மாற்றாது.')}</p></details>
        </div>
      </Card>

      <Card className="support-cta">
        <div>
          <Badge tone="info">{text('Booking-specific support is live', 'Booking-specific support live-ல் உள்ளது')}</Badge>
          <h2>{text('Need help with an existing booking?', 'இருக்கும் booking-க்கு உதவி வேண்டுமா?')}</h2>
          <p>{text('Go to My bookings and open the relevant booking. Support availability follows that booking’s live support window and policy.', 'My bookings-க்கு சென்று சம்பந்தப்பட்ட booking-ஐ திறக்கவும். Support availability அந்த booking-ன் live support window மற்றும் policy-ஐ பின்பற்றும்.')}</p>
        </div>
        <Link href="/bookings" className="button button-primary">{text('Open my bookings', 'என் bookings-ஐ திற')}</Link>
      </Card>
    </div>
  );
}
