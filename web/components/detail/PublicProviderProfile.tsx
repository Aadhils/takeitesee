'use client';

import Link from 'next/link';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
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

type ProfessionalMedia = {
  id: string;
  media_type: 'image' | 'video';
  signed_url: string;
  caption: string;
  alt_text: string;
  role_title: string | null;
};

type ProfessionalCareer = {
  profile: {
    career_headline: string;
    career_summary: string;
    preferred_location: string;
    open_to_remote: boolean;
    willing_to_relocate: boolean;
    available_from: string | null;
    notice_period_days: number | null;
    availability_note: string;
  };
  experiences: Array<{
    id: string;
    role_title: string;
    organization: string;
    employment_type: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
    display_order: number;
  }>;
  education: Array<{
    id: string;
    institution: string;
    qualification: string;
    field_of_study: string | null;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
    display_order: number;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuing_organization: string;
    issue_date: string | null;
    expiry_date: string | null;
    credential_id: string | null;
    credential_url: string | null;
    display_order: number;
  }>;
  skills: Array<{
    id: string;
    name: string;
    proficiency: string | null;
    years_experience: number | null;
    display_order: number;
  }>;
};

function LocalizedBreadcrumbs({ kind }: { kind: ProviderKind }) {
  const { t } = usePublicProviderTranslations();
  return (
    <nav className="breadcrumbs" aria-label={t('publicProvider.hero.breadcrumb')}>
      <ol>
        <li><Link href="/explore">{t('publicProvider.hero.explore')}</Link><span className="breadcrumb-separator" aria-hidden="true">/</span></li>
        <li><span aria-current="page">{kind === 'business' ? t('publicProvider.hero.business') : t('publicProvider.hero.professional')}</span></li>
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
  media = [],
  career = null,
}: {
  kind: ProviderKind;
  provider: ProviderView;
  services: ProviderService[];
  roles?: ProfessionalRole[];
  media?: ProfessionalMedia[];
  career?: ProfessionalCareer | null;
}) {
  const { locale, t } = usePublicProviderTranslations();
  const displayName = provider.name || (kind === 'business' ? t('publicProvider.profile.verifiedBusiness') : t('publicProvider.profile.verifiedProfessional'));
  const initials = (provider.name || (kind === 'business' ? 'VB' : 'VP')).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const website = safeWebsite(provider.website_url);
  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };
  const careerDate = (value: string | null) => {
    if (!value) return t('publicProvider.profile.notSpecified');
    try { return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
    catch { return value; }
  };
  const careerType = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const opportunityLabels = (role: ProfessionalRole) => [
    role.service_bookings_enabled ? t('publicProvider.profile.serviceBookings') : null,
    role.freelance_enabled ? t('publicProvider.profile.freelance') : null,
    role.part_time_enabled ? t('publicProvider.profile.partTime') : null,
    role.full_time_enabled ? t('publicProvider.profile.fullTime') : null,
    role.contract_enabled ? t('publicProvider.profile.contract') : null,
  ].filter((label): label is string => Boolean(label));

  const openOpportunityTypes = Array.from(new Set(roles.flatMap(opportunityLabels)));
  const profileFallback = kind === 'business'
    ? t('publicProvider.hero.verifiedBusinessFallback')
    : t('publicProvider.hero.independentProfessionalFallback');
  const aboutFallback = kind === 'business'
    ? t('publicProvider.profile.businessAboutFallback')
    : t('publicProvider.profile.professionalAboutFallback');

  return (
    <div className="profile-page">
      <LocalizedBreadcrumbs kind={kind} />
      <section className="profile-hero">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{initials}</div>
        <div>
          <div className="detail-badges">
            <Badge tone="success">{t('publicProvider.hero.verifiedProfile')}</Badge>
            <Badge tone="info">{kind === 'business' ? t('publicProvider.hero.businessProvider') : t('publicProvider.hero.professionalProvider')}</Badge>
            {kind === 'professional' && roles.length > 1 ? <Badge tone="info">{t('publicProvider.profile.multiSkillProfessional')}</Badge> : null}
            {kind === 'professional' && career ? <Badge tone="success">{t('publicProvider.profile.publicCareerProfile')}</Badge> : null}
          </div>
          <h1>{displayName}</h1>
          <p className="profile-headline">{provider.description || profileFallback}</p>
          <p className="card-location">{provider.location || t('publicProvider.hero.serviceAreaBooking')}</p>
          {kind === 'professional' ? <div className={`profile-facts ${styles.heroFacts}`} aria-label={t('publicProvider.profile.professionalSummaryAria')}>
            <span><strong>{roles.length}</strong>{t('publicProvider.profile.publicTalents')}</span>
            <span><strong>{media.length}</strong>{t('publicProvider.profile.workSamples')}</span>
            <span><strong>{services.length}</strong>{t('publicProvider.profile.activeServices')}</span>
            <span><strong>{openOpportunityTypes.length}</strong>{t('publicProvider.profile.opportunityTypes')}</span>
          </div> : null}
        </div>
      </section>

      <div className="profile-layout">
        <main>
          <section className="detail-section">
            <span className="eyebrow">{kind === 'business' ? t('publicProvider.profile.businessProfile') : t('publicProvider.profile.profileSummary')}</span>
            <h2>{kind === 'business' ? (locale === 'ta-IN' ? `${displayName} ${t('publicProvider.profile.aboutBusiness')}` : `${t('publicProvider.profile.aboutBusiness')} ${displayName}`) : t('publicProvider.profile.aboutThisProfessional')}</h2>
            <p className="detail-copy">{provider.description || aboutFallback}</p>
          </section>

          {kind === 'professional' ? <section className="detail-section" aria-labelledby="professional-talents-heading">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t('publicProvider.profile.talentPortfolio')}</span>
                <h2 id="professional-talents-heading">{t('publicProvider.profile.professionalSkillsRoles')}</h2>
              </div>
              <Badge tone={roles.length ? 'success' : 'info'}>{`${roles.length} ${t('publicProvider.profile.publicSuffix')}`}</Badge>
            </div>
            <p className="detail-copy">{t('publicProvider.profile.talentsIntro')}</p>
            {roles.length ? <div className={styles.talentGrid}>
              {roles.map((role) => {
                const opportunities = opportunityLabels(role);
                return <Card className={styles.talentCard} key={role.id}>
                  <div className={styles.talentCardTop}>
                    <div>
                      <span className="eyebrow">{t('publicProvider.profile.professionalRole')}</span>
                      <h3>{role.title}</h3>
                    </div>
                    {role.experience_years !== null ? <Badge tone="info">{role.experience_years === 0
                      ? t('publicProvider.profile.newTalent')
                      : `${role.experience_years} ${t('publicProvider.profile.experienceSuffix')}`}</Badge> : null}
                  </div>
                  <p>{role.summary || t('publicProvider.profile.talentActiveFallback')}</p>
                  <div className={styles.opportunities} aria-label={t('publicProvider.profile.openOpportunityTypes')}>
                    {opportunities.length ? opportunities.map((label) => <Badge key={label} tone={label === t('publicProvider.profile.serviceBookings') ? 'success' : 'info'}>{label}</Badge>)
                      : <span className="empty-inline">{t('publicProvider.profile.noOpportunityOpen')}</span>}
                  </div>
                </Card>;
              })}
            </div> : <p className="empty-inline">{t('publicProvider.profile.noPublicTalents')}</p>}
          </section> : null}

          {kind === 'professional' && career ? <section className="detail-section" aria-labelledby="professional-career-heading">
            <div className="section-heading">
              <div><span className="eyebrow">{t('publicProvider.profile.careerProfile')}</span><h2 id="professional-career-heading">{career.profile.career_headline || t('publicProvider.profile.professionalResume')}</h2></div>
              <Badge tone="success">{t('publicProvider.profile.published')}</Badge>
            </div>
            {career.profile.career_summary ? <p className="detail-copy">{career.profile.career_summary}</p> : null}
            <div className={styles.careerSignals} aria-label={t('publicProvider.profile.careerAvailability')}>
              {career.profile.preferred_location ? <Badge tone="info">{t('publicProvider.profile.preferred')}: {career.profile.preferred_location}</Badge> : null}
              {career.profile.open_to_remote ? <Badge tone="success">{t('publicProvider.profile.remoteOpen')}</Badge> : null}
              {career.profile.willing_to_relocate ? <Badge tone="info">{t('publicProvider.profile.openToRelocate')}</Badge> : null}
              {career.profile.available_from ? <Badge tone="info">{t('publicProvider.profile.available')}: {careerDate(career.profile.available_from)}</Badge> : null}
              {career.profile.notice_period_days !== null ? <Badge tone="info">{career.profile.notice_period_days} {t('publicProvider.profile.dayNotice')}</Badge> : null}
            </div>
            {career.profile.availability_note ? <p className={styles.careerNote}>{career.profile.availability_note}</p> : null}

            {career.skills.length ? <div className={styles.careerBlock}>
              <h3>{t('publicProvider.profile.skills')}</h3>
              <div className={styles.careerSignals}>{career.skills.map((skill) => <Badge tone="info" key={skill.id}>{skill.name}{skill.proficiency ? ` · ${careerType(skill.proficiency)}` : ''}{skill.years_experience !== null ? ` · ${skill.years_experience} ${t('publicProvider.profile.yearShort')}` : ''}</Badge>)}</div>
            </div> : null}

            {career.experiences.length ? <div className={styles.careerBlock}>
              <h3>{t('publicProvider.profile.experience')}</h3>
              <div className={styles.careerTimeline}>{career.experiences.map((item) => <article className={styles.careerItem} key={item.id}>
                <div className={styles.careerItemTop}><div><strong>{item.role_title}</strong><span>{item.organization}{item.location ? ` · ${item.location}` : ''}</span></div><Badge tone={item.is_current ? 'success' : 'info'}>{item.is_current ? t('publicProvider.profile.current') : careerType(item.employment_type)}</Badge></div>
                <p>{careerDate(item.start_date)} — {item.is_current ? t('publicProvider.profile.present') : careerDate(item.end_date)}</p>
                {item.description ? <p>{item.description}</p> : null}
              </article>)}</div>
            </div> : null}

            {(career.education.length || career.certifications.length) ? <div className={styles.careerGrid}>
              {career.education.length ? <div className={styles.careerBlock}>
                <h3>{t('publicProvider.profile.education')}</h3>
                <div className={styles.careerTimeline}>{career.education.map((item) => <article className={styles.careerItem} key={item.id}><strong>{item.qualification}</strong><span>{item.institution}{item.field_of_study ? ` · ${item.field_of_study}` : ''}</span>{item.start_date || item.end_date ? <p>{careerDate(item.start_date)} — {careerDate(item.end_date)}</p> : null}{item.description ? <p>{item.description}</p> : null}</article>)}</div>
              </div> : null}
              {career.certifications.length ? <div className={styles.careerBlock}>
                <h3>{t('publicProvider.profile.certifications')}</h3>
                <div className={styles.careerTimeline}>{career.certifications.map((item) => {
                  const credential = safeWebsite(item.credential_url);
                  return <article className={styles.careerItem} key={item.id}><strong>{item.name}</strong><span>{item.issuing_organization}</span>{item.issue_date ? <p>{t('publicProvider.profile.issued')}: {careerDate(item.issue_date)}{item.expiry_date ? ` · ${t('publicProvider.profile.expires')}: ${careerDate(item.expiry_date)}` : ''}</p> : null}{item.credential_id ? <p>{t('publicProvider.profile.credential')}: {item.credential_id}</p> : null}{credential ? <a href={credential} target="_blank" rel="noreferrer">{t('publicProvider.profile.openCredential')}</a> : null}</article>;
                })}</div>
              </div> : null}
            </div> : null}

            <p className="summary-note">{t('publicProvider.profile.careerDisclaimer')}</p>
          </section> : null}

          {kind === 'professional' && media.length ? <section className="detail-section" aria-labelledby="professional-work-showcase-heading">
            <div className="section-heading">
              <div><span className="eyebrow">{t('publicProvider.profile.workShowcase')}</span><h2 id="professional-work-showcase-heading">{t('publicProvider.profile.previousWorkExperience')}</h2></div>
              <Badge tone="success">{`${media.length} ${t('publicProvider.profile.samplesSuffix')}`}</Badge>
            </div>
            <p className="detail-copy">{t('publicProvider.profile.mediaIntro')}</p>
            <div className={styles.mediaGrid}>
              {media.map((item) => <article className={styles.mediaCard} key={item.id}>
                <div className={styles.mediaPreview}>
                  {item.media_type === 'image'
                    ? <img src={item.signed_url} alt={item.alt_text || item.caption || t('publicProvider.profile.professionalWorkSample')} loading="lazy" />
                    : <video src={item.signed_url} controls preload="metadata" playsInline aria-label={item.caption || t('publicProvider.profile.professionalPortfolioVideo')} />}
                </div>
                <div className={styles.mediaBody}>
                  <div className="detail-badges"><Badge tone="info">{item.media_type === 'image' ? t('publicProvider.profile.photo') : t('publicProvider.profile.video')}</Badge>{item.role_title ? <Badge tone="success">{item.role_title}</Badge> : null}</div>
                  <h3>{item.caption || t('publicProvider.profile.professionalWorkSample')}</h3>
                </div>
              </article>)}
            </div>
          </section> : null}

          <section className="detail-section">
            <div className="section-heading">
              <div><span className="eyebrow">{t('publicProvider.profile.availableServices')}</span><h2>{t('publicProvider.profile.chooseService')}</h2></div>
              <Badge tone="info">{`${services.length} ${t('publicProvider.profile.listedSuffix')}`}</Badge>
            </div>
            <div className="profile-services">
              {services.length ? services.map((service) => (
                <Card className="profile-service" key={service.id}>
                  <div>
                    <h3>{service.name}</h3>
                    <p>{service.description || t('publicProvider.profile.serviceDetailsFallback')}</p>
                    <p>{service.duration_minutes ? `${service.duration_minutes} ${t('publicProvider.profile.minutes')} · ` : ''}{money(Number(service.base_price || 0), service.currency || 'INR')}</p>
                  </div>
                  <Link href={`/services/${service.id}`} className="button button-primary">{t('publicProvider.profile.viewService')}</Link>
                </Card>
              )) : <p className="empty-inline">{t('publicProvider.profile.noActiveServices')}</p>}
            </div>
          </section>
        </main>

        <aside className="profile-aside">
          {kind === 'professional' ? <Card className={styles.snapshotCard}>
            <span className="eyebrow">{t('publicProvider.profile.professionalSnapshot')}</span>
            <h2>{t('publicProvider.profile.oneVerifiedIdentity')}</h2>
            <dl className="review-details">
              <div><dt>{t('publicProvider.profile.publicTalents')}</dt><dd>{roles.length}</dd></div>
              <div><dt>{t('publicProvider.profile.workSamples')}</dt><dd>{media.length}</dd></div>
              <div><dt>{t('publicProvider.profile.careerProfile')}</dt><dd>{career ? t('publicProvider.profile.published') : t('publicProvider.profile.privateNotPublished')}</dd></div>
              <div><dt>{t('publicProvider.profile.activeServices')}</dt><dd>{services.length}</dd></div>
              <div><dt>{t('publicProvider.profile.serviceArea')}</dt><dd>{provider.location || t('publicProvider.profile.bookingDependent')}</dd></div>
            </dl>
            {openOpportunityTypes.length ? <div className={styles.opportunities}>
              {openOpportunityTypes.map((label) => <Badge key={label} tone="info">{label}</Badge>)}
            </div> : null}
            <p className="summary-note">{t('publicProvider.profile.snapshotDisclaimer')}</p>
          </Card> : null}
          <Card>
            <span className="eyebrow">{t('publicProvider.profile.providerDisclosure')}</span>
            <h2>{provider.legal_name}</h2>
            <dl className="review-details">
              <div><dt>{t('publicProvider.profile.principalAddress')}</dt><dd>{provider.principal_address}</dd></div>
              <div><dt>{t('publicProvider.profile.publicContact')}</dt><dd><a href={`mailto:${provider.public_contact_email}`}>{provider.public_contact_email}</a><br/><a href={`tel:${provider.public_contact_phone}`}>{provider.public_contact_phone}</a></dd></div>
              {website ? <div><dt>{t('publicProvider.profile.website')}</dt><dd><a href={website} target="_blank" rel="noreferrer">{t('publicProvider.profile.openProviderWebsite')}</a></dd></div> : null}
            </dl>
          </Card>
          <Card>
            <span className="eyebrow">{t('publicProvider.profile.consumerGrievance')}</span>
            <h2>{provider.grievance_officer_name}</h2>
            <p className="summary-note">{provider.grievance_officer_designation}</p>
            <p><a href={`mailto:${provider.grievance_email}`}>{provider.grievance_email}</a><br/><a href={`tel:${provider.grievance_phone}`}>{provider.grievance_phone}</a></p>
            <p className="summary-note">{t('publicProvider.profile.grievanceHelp')}</p>
          </Card>
          <Card>
            <span className="eyebrow">{t('publicProvider.profile.liveProvider')}</span>
            <h2>{kind === 'business' ? t('publicProvider.profile.verifiedBusiness') : t('publicProvider.profile.verifiedProfessional')}</h2>
            <p>{kind === 'business'
              ? t('publicProvider.profile.businessLiveHelp')
              : t('publicProvider.profile.professionalLiveHelp')}</p>
            <Link href="/explore" className="button button-secondary">{t('publicProvider.profile.exploreServices')}</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
