'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';

type ProviderKind = 'business' | 'professional';

type ProviderView = {
  name: string;
  description: string;
  location: string;
};

type ProviderService = {
  id: string;
  name: string;
  description: string;
  base_price: number | string | null;
  currency: string | null;
  duration_minutes: number | null;
};

function LocalizedBreadcrumbs({ kind, text }: { kind: ProviderKind; text: (en: string, ta: string) => string }) {
  return (
    <nav className="breadcrumbs" aria-label={text('Breadcrumb', 'வழிசெலுத்தல்')}>
      <ol>
        <li><Link href="/explore">{text('Explore', 'Explore')}</Link><span className="breadcrumb-separator" aria-hidden="true">/</span></li>
        <li><span aria-current="page">{kind === 'business' ? text('Business', 'வணிகம்') : text('Professional', 'நிபுணர்')}</span></li>
      </ol>
    </nav>
  );
}

export default function PublicProviderProfile({ kind, provider, services }: { kind: ProviderKind; provider: ProviderView; services: ProviderService[] }) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const displayName = provider.name || (kind === 'business' ? text('Verified business', 'சரிபார்க்கப்பட்ட வணிகம்') : text('Verified professional', 'சரிபார்க்கப்பட்ட நிபுணர்'));
  const initials = (provider.name || (kind === 'business' ? 'VB' : 'VP')).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  const profileFallback = kind === 'business'
    ? text('Verified business on TakeItEsee', 'TakeItEsee-ல் சரிபார்க்கப்பட்ட வணிகம்')
    : text('Independent professional on TakeItEsee', 'TakeItEsee-ல் சுயாதீன நிபுணர்');
  const aboutFallback = kind === 'business'
    ? text('This verified business publishes live services through TakeItEsee.', 'இந்த சரிபார்க்கப்பட்ட வணிகம் TakeItEsee மூலம் live சேவைகளை வெளியிடுகிறது.')
    : text('This verified professional publishes live services through TakeItEsee.', 'இந்த சரிபார்க்கப்பட்ட நிபுணர் TakeItEsee மூலம் live சேவைகளை வெளியிடுகிறார்.');

  return (
    <div className="profile-page">
      <LocalizedBreadcrumbs kind={kind} text={text} />
      <section className="profile-hero">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{initials}</div>
        <div>
          <div className="detail-badges">
            <Badge tone="success">{text('Verified profile', 'சரிபார்க்கப்பட்ட profile')}</Badge>
            <Badge tone="info">{kind === 'business' ? text('Business provider', 'வணிக வழங்குநர்') : text('Professional provider', 'நிபுணர் வழங்குநர்')}</Badge>
          </div>
          <h1>{displayName}</h1>
          <p className="profile-headline">{provider.description || profileFallback}</p>
          <p className="card-location">{provider.location || text('Service area confirmed during booking', 'Booking போது service area உறுதிசெய்யப்படும்')}</p>
        </div>
      </section>

      <div className="profile-layout">
        <main>
          <section className="detail-section">
            <span className="eyebrow">{kind === 'business' ? text('Business profile', 'வணிக profile') : text('Profile summary', 'Profile சுருக்கம்')}</span>
            <h2>{kind === 'business' ? text(`About ${displayName}`, `${displayName} பற்றி`) : text('About this professional', 'இந்த நிபுணரை பற்றி')}</h2>
            <p className="detail-copy">{provider.description || aboutFallback}</p>
          </section>

          <section className="detail-section">
            <div className="section-heading">
              <div><span className="eyebrow">{text('Available services', 'கிடைக்கும் சேவைகள்')}</span><h2>{text('Choose a service', 'ஒரு சேவையை தேர்வு செய்')}</h2></div>
              <Badge tone="info">{text(`${services.length} listed`, `${services.length} பட்டியலிடப்பட்டுள்ளன`)}</Badge>
            </div>
            <div className="profile-services">
              {services.length ? services.map((service) => (
                <Card className="profile-service" key={service.id}>
                  <div>
                    <h3>{service.name}</h3>
                    <p>{service.description || text('Service details are available on the listing page.', 'சேவை விவரங்கள் listing page-ல் கிடைக்கும்.')}</p>
                    <p>{service.duration_minutes ? `${service.duration_minutes} ${text('minutes', 'நிமிடங்கள்')} · ` : ''}{money(Number(service.base_price || 0), service.currency || 'INR')}</p>
                  </div>
                  <Link href={`/services/${service.id}`} className="button button-primary">{text('View service', 'சேவையை பார்க்க')}</Link>
                </Card>
              )) : <p className="empty-inline">{text('No active services are currently published.', 'தற்போது active சேவைகள் வெளியிடப்படவில்லை.')}</p>}
            </div>
          </section>
        </main>

        <aside className="profile-aside">
          <Card>
            <span className="eyebrow">{text('Live provider', 'Live வழங்குநர்')}</span>
            <h2>{kind === 'business' ? text('Verified business', 'சரிபார்க்கப்பட்ட வணிகம்') : text('Verified professional', 'சரிபார்க்கப்பட்ட நிபுணர்')}</h2>
            <p>{kind === 'business'
              ? text('Only active, published services from this business are shown here.', 'இந்த வணிகத்தின் active, published சேவைகள் மட்டும் இங்கே காட்டப்படுகின்றன.')
              : text('Only active, published services from this provider are shown here.', 'இந்த வழங்குநரின் active, published சேவைகள் மட்டும் இங்கே காட்டப்படுகின்றன.')}</p>
            <Link href="/explore" className="button button-secondary">{text('Explore services', 'சேவைகளை பார்க்க')}</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
