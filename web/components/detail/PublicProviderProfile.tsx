'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';
import styles from './PublicProviderProfile.module.css';

type ProviderKind = 'business' | 'professional';

type ProviderView = {
  name: string;
  description: string;
  location: string;
  legal_name: string;
  principal_address: string;
  public_contact_email: string;
  public_contact_phone: string;
  website_url?: string | null;
  grievance_officer_name: string;
  grievance_officer_designation: string;
  grievance_email: string;
  grievance_phone: string;
};

type ProviderService = {
  id: string;
  name: string;
  description: string;
  base_price: number | string | null;
  currency: string | null;
  duration_minutes: number | null;
};

type ProfessionalRole = {
  id: string;
  title: string;
  summary: string;
  experience_years: number | null;
  service_bookings_enabled: boolean;
  freelance_enabled: boolean;
  part_time_enabled: boolean;
  full_time_enabled: boolean;
  contract_enabled: boolean;
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

function safeWebsite(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
}

export default function PublicProviderProfile({
  kind,
  provider,
  services,
  roles = [],
}: {
  kind: ProviderKind;
  provider: ProviderView;
  services: ProviderService[];
  roles?: ProfessionalRole[];
}) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const displayName = provider.name || (kind === 'business' ? text('Verified business', 'சரிபார்க்கப்பட்ட வணிகம்') : text('Verified professional', 'சரிபார்க்கப்பட்ட நிபுணர்'));
  const initials = (provider.name || (kind === 'business' ? 'VB' : 'VP')).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const website = safeWebsite(provider.website_url);
  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  const opportunityLabels = (role: ProfessionalRole) => [
    role.service_bookings_enabled ? text('Service bookings', 'Service booking') : null,
    role.freelance_enabled ? text('Freelance', 'Freelance') : null,
    role.part_time_enabled ? text('Part-time', 'Part-time') : null,
    role.full_time_enabled ? text('Full-time', 'Full-time') : null,
    role.contract_enabled ? text('Contract', 'Contract') : null,
  ].filter((label): label is string => Boolean(label));

  const openOpportunityTypes = Array.from(new Set(roles.flatMap(opportunityLabels)));
  const profileFallback = kind === 'business'
    ? text('Verified business on TakeItEsee', 'TakeItEsee-ல் சரிபார்க்கப்பட்ட வணிகம்')
    : text('Independent professional on TakeItEsee', 'TakeItEsee-ல் சுயாதீன நிபுணர்');
  const aboutFallback = kind === 'business'
    ? text('This verified business publishes live services through TakeItEsee.', 'இந்த சரிபார்க்கப்பட்ட வணிகம் TakeItEsee மூலம் live சேவைகளை வெளியிடுகிறது.')
    : text('This verified professional publishes live services and professional talents through one verified TakeItEsee identity.', 'இந்த சரிபார்க்கப்பட்ட நிபுணர் ஒரே verified TakeItEsee identity மூலம் live services மற்றும் professional talents-ஐ வெளியிடுகிறார்.');

  return (
    <div className="profile-page">
      <LocalizedBreadcrumbs kind={kind} text={text} />
      <section className="profile-hero">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{initials}</div>
        <div>
          <div className="detail-badges">
            <Badge tone="success">{text('Verified profile', 'சரிபார்க்கப்பட்ட profile')}</Badge>
            <Badge tone="info">{kind === 'business' ? text('Business provider', 'வணிக வழங்குநர்') : text('Professional provider', 'நிபுணர் வழங்குநர்')}</Badge>
            {kind === 'professional' && roles.length > 1 ? <Badge tone="info">{text('Multi-skill professional', 'Multi-skill professional')}</Badge> : null}
          </div>
          <h1>{displayName}</h1>
          <p className="profile-headline">{provider.description || profileFallback}</p>
          <p className="card-location">{provider.location || text('Service area confirmed during booking', 'Booking போது service area உறுதிசெய்யப்படும்')}</p>
          {kind === 'professional' ? <div className={`profile-facts ${styles.heroFacts}`} aria-label={text('Professional profile summary', 'Professional profile சுருக்கம்')}>
            <span><strong>{roles.length}</strong>{text('Public talents', 'Public talents')}</span>
            <span><strong>{services.length}</strong>{text('Active services', 'Active services')}</span>
            <span><strong>{openOpportunityTypes.length}</strong>{text('Opportunity types', 'Opportunity types')}</span>
          </div> : null}
        </div>
      </section>

      <div className="profile-layout">
        <main>
          <section className="detail-section">
            <span className="eyebrow">{kind === 'business' ? text('Business profile', 'வணிக profile') : text('Profile summary', 'Profile சுருக்கம்')}</span>
            <h2>{kind === 'business' ? text(`About ${displayName}`, `${displayName} பற்றி`) : text('About this professional', 'இந்த நிபுணரை பற்றி')}</h2>
            <p className="detail-copy">{provider.description || aboutFallback}</p>
          </section>

          {kind === 'professional' ? <section className="detail-section" aria-labelledby="professional-talents-heading">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{text('Talent portfolio', 'Talent portfolio')}</span>
                <h2 id="professional-talents-heading">{text('Professional skills & roles', 'Professional skills & roles')}</h2>
              </div>
              <Badge tone={roles.length ? 'success' : 'info'}>{text(`${roles.length} public`, `${roles.length} public`)}</Badge>
            </div>
            <p className="detail-copy">{text(
              'These active talents belong to the same verified professional identity. Availability can differ by role.',
              'இந்த active talents அனைத்தும் ஒரே verified professional identity-க்கு சொந்தமானவை. ஒவ்வொரு role-க்கும் availability வேறுபடலாம்.',
            )}</p>
            {roles.length ? <div className={styles.talentGrid}>
              {roles.map((role) => {
                const opportunities = opportunityLabels(role);
                return <Card className={styles.talentCard} key={role.id}>
                  <div className={styles.talentCardTop}>
                    <div>
                      <span className="eyebrow">{text('Professional role', 'Professional role')}</span>
                      <h3>{role.title}</h3>
                    </div>
                    {role.experience_years !== null ? <Badge tone="info">{role.experience_years === 0
                      ? text('New talent', 'New talent')
                      : text(`${role.experience_years} yr experience`, `${role.experience_years} வருட அனுபவம்`)}</Badge> : null}
                  </div>
                  <p>{role.summary || text('This professional has marked this talent as active on TakeItEsee.', 'இந்த talent-ஐ இந்த professional TakeItEsee-ல் active ஆக வைத்துள்ளார்.')}</p>
                  <div className={styles.opportunities} aria-label={text('Open opportunity types', 'Open opportunity types')}>
                    {opportunities.length ? opportunities.map((label) => <Badge key={label} tone={label === text('Service bookings', 'Service booking') ? 'success' : 'info'}>{label}</Badge>)
                      : <span className="empty-inline">{text('No opportunity type is currently marked open.', 'தற்போது எந்த opportunity type-மும் open ஆக mark செய்யப்படவில்லை.')}</span>}
                  </div>
                </Card>;
              })}
            </div> : <p className="empty-inline">{text('No public talents have been added yet.', 'Public talents இன்னும் add செய்யப்படவில்லை.')}</p>}
          </section> : null}

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
          {kind === 'professional' ? <Card className={styles.snapshotCard}>
            <span className="eyebrow">{text('Professional snapshot', 'Professional snapshot')}</span>
            <h2>{text('One verified identity', 'ஒரே verified identity')}</h2>
            <dl className="review-details">
              <div><dt>{text('Public talents', 'Public talents')}</dt><dd>{roles.length}</dd></div>
              <div><dt>{text('Active services', 'Active services')}</dt><dd>{services.length}</dd></div>
              <div><dt>{text('Service area', 'Service area')}</dt><dd>{provider.location || text('Booking dependent', 'Booking dependent')}</dd></div>
            </dl>
            {openOpportunityTypes.length ? <div className={styles.opportunities}>
              {openOpportunityTypes.map((label) => <Badge key={label} tone="info">{label}</Badge>)}
            </div> : null}
            <p className="summary-note">{text(
              'Talent cards are profile signals only. Booking and future career workflows keep their own eligibility and approval rules.',
              'Talent cards profile signal மட்டும். Booking மற்றும் future career workflows தங்களுடைய eligibility / approval rules-ஐ தனியாக வைத்திருக்கும்.',
            )}</p>
          </Card> : null}
          <Card>
            <span className="eyebrow">{text('Provider disclosure', 'Provider disclosure')}</span>
            <h2>{provider.legal_name}</h2>
            <dl className="review-details">
              <div><dt>{text('Principal address', 'முதன்மை முகவரி')}</dt><dd>{provider.principal_address}</dd></div>
              <div><dt>{text('Public contact', 'பொது தொடர்பு')}</dt><dd><a href={`mailto:${provider.public_contact_email}`}>{provider.public_contact_email}</a><br/><a href={`tel:${provider.public_contact_phone}`}>{provider.public_contact_phone}</a></dd></div>
              {website ? <div><dt>{text('Website', 'இணையதளம்')}</dt><dd><a href={website} target="_blank" rel="noreferrer">{text('Open provider website', 'Provider website திறக்க')}</a></dd></div> : null}
            </dl>
          </Card>
          <Card>
            <span className="eyebrow">{text('Consumer grievance', 'Consumer grievance')}</span>
            <h2>{provider.grievance_officer_name}</h2>
            <p className="summary-note">{provider.grievance_officer_designation}</p>
            <p><a href={`mailto:${provider.grievance_email}`}>{provider.grievance_email}</a><br/><a href={`tel:${provider.grievance_phone}`}>{provider.grievance_phone}</a></p>
            <p className="summary-note">{text('Use these provider contact details for service-related consumer grievances. You can also contact TakeItEsee support for platform assistance.', 'சேவை தொடர்பான consumer grievance-க்கு இந்த provider contact விவரங்களை பயன்படுத்தலாம். Platform உதவிக்கு TakeItEsee support-ஐயும் தொடர்புகொள்ளலாம்.')}</p>
          </Card>
          <Card>
            <span className="eyebrow">{text('Live provider', 'Live வழங்குநர்')}</span>
            <h2>{kind === 'business' ? text('Verified business', 'சரிபார்க்கப்பட்ட வணிகம்') : text('Verified professional', 'சரிபார்க்கப்பட்ட நிபுணர்')}</h2>
            <p>{kind === 'business'
              ? text('Only active, published services from this business are shown here.', 'இந்த வணிகத்தின் active, published சேவைகள் மட்டும் இங்கே காட்டப்படுகின்றன.')
              : text('Only active public talents and published services from this provider are shown here.', 'இந்த provider-ன் active public talents மற்றும் published services மட்டும் இங்கே காட்டப்படுகின்றன.')}</p>
            <Link href="/explore" className="button button-secondary">{text('Explore services', 'சேவைகளை பார்க்க')}</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
