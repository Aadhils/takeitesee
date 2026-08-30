'use client';

import Link from 'next/link';
import { useLanguage } from '../components/i18n/LanguageProvider';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLanguage();
  const ta = locale === 'ta-IN';

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{ta ? 'தற்காலிக பிழை' : 'Temporary error'}</span>
        <h1>{ta ? 'இந்த பக்கத்தை இப்போது ஏற்ற முடியவில்லை.' : 'This page could not be loaded right now.'}</h1>
        <p>{ta ? 'மீண்டும் முயற்சிக்கலாம். பிரச்சினை தொடர்ந்தால் முகப்புக்கு திரும்பி வேறு பகுதியை பயன்படுத்துங்கள்.' : 'You can try again. If the problem continues, return home and continue from another part of TakeItEsee.'}</p>
      </section>
      <div className="card support-cta">
        <div>
          <h2>{ta ? 'மீண்டும் முயற்சிக்க வேண்டுமா?' : 'Try the page again?'}</h2>
          <p>{ta ? 'மீண்டும் முயற்சி செய்வது இந்த பக்கத்தை புதிதாக ஏற்றும்.' : 'Retrying will request this page again without changing your account or booking data.'}</p>
        </div>
        <div className="account-actions">
          <button type="button" className="button button-primary" onClick={() => reset()}>{ta ? 'மீண்டும் முயற்சிக்கவும்' : 'Try again'}</button>
          <Link href="/" className="button button-secondary">{ta ? 'முகப்புக்கு செல்லுங்கள்' : 'Go home'}</Link>
        </div>
      </div>
    </div>
  );
}
