'use client';

import Link from 'next/link';
import { useLanguage } from '../components/i18n/LanguageProvider';

export default function NotFound() {
  const { locale } = useLanguage();
  const ta = locale === 'ta-IN';

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">404</span>
        <h1>{ta ? 'இந்த பக்கத்தை கண்டுபிடிக்க முடியவில்லை.' : 'We could not find this page.'}</h1>
        <p>{ta ? 'இணைப்பு மாறியிருக்கலாம் அல்லது இந்த பக்கம் இப்போது கிடைக்காமல் இருக்கலாம். முகப்புக்கு செல்லுங்கள் அல்லது நேரடி சேவைகளை தேடுங்கள்.' : 'The link may have changed or this page may no longer be available. Return home or continue with live service discovery.'}</p>
      </section>
      <div className="card support-cta">
        <div>
          <h2>{ta ? 'அடுத்து எங்கே செல்லலாம்?' : 'Where would you like to go next?'}</h2>
          <p>{ta ? 'சேவைகளை தேடலாம், முகப்புக்கு திரும்பலாம் அல்லது உதவி மையத்தை திறக்கலாம்.' : 'Browse services, return to the homepage, or open the Help Center.'}</p>
        </div>
        <div className="account-actions">
          <Link href="/" className="button button-primary">{ta ? 'முகப்பு' : 'Go home'}</Link>
          <Link href="/explore" className="button button-secondary">{ta ? 'சேவைகளை தேடுங்கள்' : 'Explore services'}</Link>
          <Link href="/help" className="button button-secondary">{ta ? 'உதவி மையம்' : 'Help Center'}</Link>
        </div>
      </div>
    </div>
  );
}
