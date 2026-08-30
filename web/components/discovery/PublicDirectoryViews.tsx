'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Alert, Badge, Card } from '../ui/primitives';

type DirectoryEntry = {
  id: string;
  name: string;
  description: string;
  location: string;
  service_count: number;
  categories: string[];
  starting_price: number | null;
  currency: string;
};

type CategoryEntry = {
  name: string;
  slug: string;
  service_count: number;
};

function useDirectoryText() {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const money = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };
  return { locale, text, money };
}

export function PublicBusinessesDirectory({ businesses }: { businesses: DirectoryEntry[] | null }) {
  const { text, money } = useDirectoryText();

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{text('Business directory', 'வணிக அடைவு')}</span>
        <h1>{text('Verified local service businesses.', 'சரிபார்க்கப்பட்ட உள்ளூர் சேவை வணிகங்கள்.')}</h1>
        <p>{text(
          'Browse businesses that currently have at least one active service published on the TakeItEsee marketplace.',
          'TakeItEsee marketplace-ல் தற்போது குறைந்தது ஒரு active service வெளியிட்டுள்ள வணிகங்களை பார்க்கவும்.',
        )}</p>
      </section>

      {businesses === null ? (
        <Alert title={text('Business directory temporarily unavailable', 'வணிக அடைவு தற்காலிகமாக கிடைக்கவில்லை')} tone="warning">
          {text(
            'The live provider catalog could not be loaded. Explore remains the best place to browse currently published services.',
            'Live provider catalog-ஐ ஏற்ற முடியவில்லை. தற்போது வெளியிடப்பட்ட சேவைகளை பார்க்க Explore பயன்படுத்தவும்.',
          )}
        </Alert>
      ) : businesses.length ? (
        <>
          <div className="results-heading"><div><span className="eyebrow">{text('Live marketplace', 'Live marketplace')}</span><h2>{text(`${businesses.length} verified ${businesses.length === 1 ? 'business' : 'businesses'}`, `${businesses.length} சரிபார்க்கப்பட்ட வணிகங்கள்`)}</h2></div></div>
          <div className="service-grid">
            {businesses.map((business) => (
              <Card className="discovery-card business-card" key={business.id}>
                <div className="business-banner" aria-hidden="true"><span>{business.name.slice(0, 1).toUpperCase()}</span></div>
                <div className="discovery-card-content">
                  <div className="card-meta">
                    <Badge tone="success">{text('Verified business', 'சரிபார்க்கப்பட்ட வணிகம்')}</Badge>
                    <Badge tone="info">{text(`${business.service_count} active ${business.service_count === 1 ? 'service' : 'services'}`, `${business.service_count} active சேவைகள்`)}</Badge>
                  </div>
                  <h2><Link href={`/businesses/${business.id}`}>{business.name}</Link></h2>
                  <p className="card-description">{business.description || text('Verified business with active services on TakeItEsee.', 'TakeItEsee-ல் active சேவைகள் உள்ள சரிபார்க்கப்பட்ட வணிகம்.')}</p>
                  <p className="card-location"><span aria-hidden="true">⌖</span> {business.location || text('Service area shown on individual listings', 'ஒவ்வொரு listing-லும் service area காட்டப்படும்')}</p>
                  {business.categories.length ? <p className="card-specialty">{business.categories.slice(0, 3).join(' · ')}</p> : null}
                  <div className="card-footer">
                    <div>{business.starting_price !== null ? <span className="price">{text(`From ${money(business.starting_price, business.currency)}`, `${money(business.starting_price, business.currency)} முதல்`)}</span> : <span>{text('See service pricing', 'சேவை விலையை பார்க்கவும்')}</span>}</div>
                    <Link href={`/businesses/${business.id}`} className="button button-secondary">{text('View business', 'வணிகத்தை பார்க்க')}</Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <h2>{text('No verified businesses are publishing services right now.', 'இப்போது சரிபார்க்கப்பட்ட எந்த வணிகமும் சேவைகளை வெளியிடவில்லை.')}</h2>
          <p>{text(
            'New businesses will appear here automatically after verification and after at least one service becomes active.',
            'Verification முடிந்து குறைந்தது ஒரு சேவை active ஆனதும் புதிய வணிகங்கள் இங்கே தானாக தோன்றும்.',
          )}</p>
          <div className="button-row"><Link href="/explore" className="button button-primary">{text('Explore live services', 'Live சேவைகளை பார்க்க')}</Link></div>
        </Card>
      )}
    </div>
  );
}

export function PublicProfessionalsDirectory({ professionals }: { professionals: DirectoryEntry[] | null }) {
  const { text, money } = useDirectoryText();

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{text('Professional directory', 'நிபுணர் அடைவு')}</span>
        <h1>{text('Verified independent professionals.', 'சரிபார்க்கப்பட்ட சுயாதீன நிபுணர்கள்.')}</h1>
        <p>{text(
          'Browse professionals that currently have at least one active service published on the TakeItEsee marketplace.',
          'TakeItEsee marketplace-ல் தற்போது குறைந்தது ஒரு active service வெளியிட்டுள்ள நிபுணர்களை பார்க்கவும்.',
        )}</p>
      </section>

      {professionals === null ? (
        <Alert title={text('Professional directory temporarily unavailable', 'நிபுணர் அடைவு தற்காலிகமாக கிடைக்கவில்லை')} tone="warning">
          {text(
            'The live provider catalog could not be loaded. Explore remains the best place to browse currently published services.',
            'Live provider catalog-ஐ ஏற்ற முடியவில்லை. தற்போது வெளியிடப்பட்ட சேவைகளை பார்க்க Explore பயன்படுத்தவும்.',
          )}
        </Alert>
      ) : professionals.length ? (
        <>
          <div className="results-heading"><div><span className="eyebrow">{text('Live marketplace', 'Live marketplace')}</span><h2>{text(`${professionals.length} verified ${professionals.length === 1 ? 'professional' : 'professionals'}`, `${professionals.length} சரிபார்க்கப்பட்ட நிபுணர்கள்`)}</h2></div></div>
          <div className="service-grid">
            {professionals.map((professional) => (
              <Card className="discovery-card provider-card" key={professional.id}>
                <div className="provider-avatar" aria-hidden="true">{professional.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div className="discovery-card-content">
                  <div className="card-meta">
                    <Badge tone="success">{text('Verified professional', 'சரிபார்க்கப்பட்ட நிபுணர்')}</Badge>
                    <Badge tone="info">{text(`${professional.service_count} active ${professional.service_count === 1 ? 'service' : 'services'}`, `${professional.service_count} active சேவைகள்`)}</Badge>
                  </div>
                  <h2><Link href={`/professionals/${professional.id}`}>{professional.name}</Link></h2>
                  <p className="card-description">{professional.description || text('Verified professional with active services on TakeItEsee.', 'TakeItEsee-ல் active சேவைகள் உள்ள சரிபார்க்கப்பட்ட நிபுணர்.')}</p>
                  <p className="card-location"><span aria-hidden="true">⌖</span> {professional.location || text('Service area shown on individual listings', 'ஒவ்வொரு listing-லும் service area காட்டப்படும்')}</p>
                  {professional.categories.length ? <p className="card-specialty">{professional.categories.slice(0, 3).join(' · ')}</p> : null}
                  <div className="card-footer">
                    <div>{professional.starting_price !== null ? <span className="price">{text(`From ${money(professional.starting_price, professional.currency)}`, `${money(professional.starting_price, professional.currency)} முதல்`)}</span> : <span>{text('See service pricing', 'சேவை விலையை பார்க்கவும்')}</span>}</div>
                    <Link href={`/professionals/${professional.id}`} className="button button-secondary">{text('View profile', 'Profile-ஐ பார்க்க')}</Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <h2>{text('No verified professionals are publishing services right now.', 'இப்போது சரிபார்க்கப்பட்ட எந்த நிபுணரும் சேவைகளை வெளியிடவில்லை.')}</h2>
          <p>{text(
            'New professionals will appear here automatically after verification and after at least one service becomes active.',
            'Verification முடிந்து குறைந்தது ஒரு சேவை active ஆனதும் புதிய நிபுணர்கள் இங்கே தானாக தோன்றுவர்.',
          )}</p>
          <div className="button-row"><Link href="/explore" className="button button-primary">{text('Explore live services', 'Live சேவைகளை பார்க்க')}</Link></div>
        </Card>
      )}
    </div>
  );
}

export function PublicCategoriesDirectory({ categories }: { categories: CategoryEntry[] | null }) {
  const { text } = useDirectoryText();

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{text('Browse services', 'சேவைகளை பார்க்க')}</span>
        <h1>{text('Browse the categories that are live right now.', 'இப்போது live-ல் உள்ள வகைகளை பார்க்கவும்.')}</h1>
        <p>{text('Only categories with active services from verified providers appear here.', 'சரிபார்க்கப்பட்ட வழங்குநர்களின் active சேவைகள் உள்ள வகைகள் மட்டும் இங்கே தோன்றும்.')}</p>
      </section>

      {categories === null ? (
        <Alert title={text('Category directory temporarily unavailable', 'வகை அடைவு தற்காலிகமாக கிடைக்கவில்லை')} tone="warning">
          {text('The live catalog could not be loaded. You can still search the marketplace directly from Explore.', 'Live catalog-ஐ ஏற்ற முடியவில்லை. Explore மூலம் marketplace-ஐ நேரடியாக தேடலாம்.')}
        </Alert>
      ) : categories.length ? (
        <>
          <div className="results-heading"><div><span className="eyebrow">{text('Live catalog', 'Live catalog')}</span><h2>{text(`${categories.length} active ${categories.length === 1 ? 'category' : 'categories'}`, `${categories.length} active வகைகள்`)}</h2></div></div>
          <div className="service-grid">
            {categories.map((category) => (
              <Card className="discovery-card" key={category.slug}>
                <div className="discovery-card-content">
                  <div className="card-meta"><Badge tone="info">{text('Live category', 'Live வகை')}</Badge><Badge tone="neutral">{text(`${category.service_count} ${category.service_count === 1 ? 'service' : 'services'}`, `${category.service_count} சேவைகள்`)}</Badge></div>
                  <h2><Link href={`/explore?category=${encodeURIComponent(category.slug)}`}>{category.name}</Link></h2>
                  <p className="card-description">{text(`Browse verified providers currently publishing services in ${category.name}.`, `${category.name} வகையில் தற்போது சேவைகளை வெளியிடும் சரிபார்க்கப்பட்ட வழங்குநர்களை பார்க்கவும்.`)}</p>
                  <div className="card-footer"><span>{text('Filtered live marketplace', 'Filtered live marketplace')}</span><Link href={`/explore?category=${encodeURIComponent(category.slug)}`} className="button button-secondary">{text('Explore category', 'வகையை பார்க்க')}</Link></div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <h2>{text('No live service categories yet.', 'இன்னும் live service வகைகள் இல்லை.')}</h2>
          <p>{text('Categories will appear here automatically when verified providers publish active services.', 'சரிபார்க்கப்பட்ட வழங்குநர்கள் active சேவைகளை வெளியிட்டதும் வகைகள் இங்கே தானாக தோன்றும்.')}</p>
          <div className="button-row"><Link href="/requirements" className="button button-primary">{text('Post a requirement', 'தேவையை பதிவு செய்')}</Link><Link href="/explore" className="button button-secondary">{text('Explore marketplace', 'Marketplace-ஐ பார்க்க')}</Link></div>
        </Card>
      )}
    </div>
  );
}
