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
      body: text('Open My bookings to review the current booking status, schedule, audit history and available booking actions.', 'தற்போதைய booking நிலை, அட்டவணை, audit history மற்றும் கிடைக்கும் actions-ஐ பார்க்க My bookings-ஐ திறக்கவும்.'),
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
      title: text('Platform grievance and privacy', 'Platform grievance மற்றும் privacy'),
      body: text('For access, correction or deletion-review requests, use the private account privacy workflow. For a TakeItEsee platform grievance, the approved Grievance Officer contact is also shown below.', 'Access, correction அல்லது deletion-review request-க்கு private account privacy workflow-ஐ பயன்படுத்தவும். TakeItEsee platform grievance-க்கு approved Grievance Officer contact கீழே காட்டப்பட்டுள்ளது.'),
      href: '/account/privacy',
      action: text('Manage privacy requests', 'Privacy requests நிர்வகிக்க'),
    },
    {
      title: text('Provider verification and trust', 'Provider verification மற்றும் trust'),
      body: text('Public marketplace pages show eligible verified providers and active published services. Provider-authored names and descriptions remain exactly as supplied.', 'Public marketplace pages eligible verified providers மற்றும் active published சேவைகளை காட்டும். Provider எழுதிய பெயர்கள் மற்றும் descriptions மாற்றமின்றி இருக்கும்.'),
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
        <p>{text('Practical guidance for finding services, managing bookings, using your account, privacy requests and platform-level grievance support.', 'சேவைகளை கண்டுபிடித்தல், bookings-ஐ நிர்வகித்தல், account பயன்படுத்துதல், privacy requests மற்றும் platform-level grievance support பற்றிய வழிகாட்டுதல்.')}</p>
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
          <details><summary>{text('How do I request access, correction or deletion review?', 'Access, correction அல்லது deletion review எப்படி request செய்வது?')}</summary><p>{text('Sign in and open Account privacy. You can submit and track an access, correction or deletion-review request. A deletion request is reviewed and is not an immediate automatic deletion.', 'Sign in செய்து Account privacy-ஐ திறக்கவும். Access, correction அல்லது deletion-review request submit செய்து status track செய்யலாம். Deletion request உடனடி automatic deletion அல்ல; review செய்யப்படும்.')}</p></details>
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

      <Card className="support-cta">
        <div>
          <Badge tone="neutral">{text('Platform grievance', 'Platform grievance')}</Badge>
          <h2>{text('Need help beyond a booking?', 'Booking-க்கு அப்பாற்பட்ட உதவி வேண்டுமா?')}</h2>
          <p>{text('For a TakeItEsee platform grievance or privacy concern, contact Grievance Officer Aadhil at uandv.com@gmail.com. TakeItEsee is operated by UV MART Enterprises Private Limited. Requests are reviewed under applicable platform policy and legal timelines.', 'TakeItEsee platform grievance அல்லது privacy concern-க்கு Grievance Officer Aadhil-ஐ uandv.com@gmail.com மூலம் தொடர்பு கொள்ளவும். TakeItEsee-ஐ UV MART Enterprises Private Limited இயக்குகிறது. Requests applicable platform policy மற்றும் சட்ட காலவரம்புகளின்படி review செய்யப்படும்.')}</p>
        </div>
        <div className="button-row">
          <a href="mailto:uandv.com@gmail.com" className="button button-primary">{text('Email Grievance Officer', 'Grievance Officer-க்கு email')}</a>
          <Link href="/privacy" className="button button-secondary">{text('Privacy Policy', 'Privacy Policy')}</Link>
        </div>
      </Card>
    </div>
  );
}
