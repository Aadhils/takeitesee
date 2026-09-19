'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProfessionalResumeExport.module.css';

type ProviderProfile = {
  provider_type: 'professional' | 'business';
  id: string;
  display_name: string;
  verified: boolean;
};

type CareerProfile = {
  career_headline?: string | null;
  career_summary?: string | null;
  preferred_location?: string | null;
  open_to_remote?: boolean | null;
  willing_to_relocate?: boolean | null;
  available_from?: string | null;
  notice_period_days?: number | null;
  availability_note?: string | null;
};

type Experience = {
  id: string;
  role_title: string;
  organization: string;
  employment_type: string;
  location?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current?: boolean | null;
  description?: string | null;
};

type Education = {
  id: string;
  institution: string;
  qualification: string;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
};

type Certification = {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  credential_id?: string | null;
  credential_url?: string | null;
};

type Skill = {
  id: string;
  name: string;
  proficiency?: string | null;
  years_experience?: number | null;
};

type Role = {
  id: string;
  title: string;
  active: boolean;
};

type ResumePayload = {
  career_profile?: CareerProfile | null;
  experiences?: Experience[];
  education?: Education[];
  certifications?: Certification[];
  skills?: Skill[];
  roles?: Role[];
  error?: string;
};

function label(value?: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';
}

function date(value: string | null | undefined, locale: string) {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function range(start: string | null | undefined, end: string | null | undefined, current: boolean | null | undefined, locale: string, presentLabel: string) {
  const from = date(start, locale);
  const to = current ? presentLabel : date(end, locale);
  return [from, to].filter(Boolean).join(' – ');
}

export default function ProfessionalResumeExport() {
  const { locale, t } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [resume, setResume] = useState<ResumePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch('/api/provider/profile', { cache: 'no-store' }),
      fetch('/api/provider/resume', { cache: 'no-store' }),
    ])
      .then(async ([profileResponse, resumeResponse]) => {
        const profileBody = await profileResponse.json() as { profile?: ProviderProfile; error?: string };
        const resumeBody = await resumeResponse.json() as ResumePayload;
        if (!profileResponse.ok || !profileBody.profile) throw new Error(profileBody.error ?? t('provider.resumeExport.unableToLoadProfessionalProfile'));
        if (profileBody.profile.provider_type !== 'professional') throw new Error(t('provider.resumeExport.switchToProfessionalProfileBeforeExportingAResume'));
        if (!resumeResponse.ok) throw new Error(resumeBody.error ?? t('provider.resumeExport.unableToLoadResumeData'));
        if (!cancelled) {
          setProfile(profileBody.profile);
          setResume(resumeBody);
        }
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t('provider.resumeExport.unableToLoadResumeExport')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t]);

  const availability = useMemo(() => {
    const career = resume?.career_profile;
    if (!career) return [] as string[];
    return [
      career.preferred_location ? `${t('provider.resumeExport.preferredLocation')}: ${career.preferred_location}` : '',
      career.open_to_remote ? t('provider.resumeExport.openToRemote') : '',
      career.willing_to_relocate ? t('provider.resumeExport.openToRelocation') : '',
      career.available_from ? `${t('provider.resumeExport.availableFrom')}: ${date(career.available_from, locale)}` : '',
      career.notice_period_days != null ? `${t('provider.resumeExport.noticePeriod')}: ${career.notice_period_days} ${t('provider.resumeExport.days')}` : '',
    ].filter((value): value is string => Boolean(value));
  }, [locale, resume?.career_profile, t]);

  const activeRoles = (resume?.roles ?? []).filter((role) => role.active);
  const hasResumeContent = Boolean(
    resume?.career_profile?.career_headline ||
    resume?.career_profile?.career_summary ||
    (resume?.experiences?.length ?? 0) ||
    (resume?.education?.length ?? 0) ||
    (resume?.certifications?.length ?? 0) ||
    (resume?.skills?.length ?? 0) ||
    activeRoles.length,
  );

  return <main className={styles.page}>
    <div className={styles.controls}>
      <Link className={styles.back} href="/provider/resume">← {t('provider.resumeExport.backToResumeCareer')}</Link>
      <button className={styles.printButton} type="button" disabled={!profile || !resume || !hasResumeContent} onClick={() => window.print()}>
        {t('provider.resumeExport.saveAsPdfPrint')}
      </button>
    </div>

    {loading ? <div className={styles.status}>{t('provider.resumeExport.preparingYourResume')}</div> : null}
    {error ? <div className={styles.status}>{error}</div> : null}
    {!loading && !error && !hasResumeContent ? <div className={styles.status}>{t('provider.resumeExport.addCareerDetailsBeforeExportingYourResume')}</div> : null}

    {!loading && !error && profile && resume && hasResumeContent ? <article className={styles.sheet} aria-label={t('provider.resumeExport.professionalResumeExport')}>
      <header className={styles.header}>
        <h1 className={styles.name}>{profile.display_name}</h1>
        {resume.career_profile?.career_headline ? <div className={styles.headline}>{resume.career_profile.career_headline}</div> : null}
        <div className={styles.meta}>
          {availability.map((item) => <span key={item}>{item}</span>)}
          {profile.verified ? <span>{t('provider.resumeExport.takeItEseeProfessionalProfileVerified')}</span> : null}
        </div>
      </header>

      {resume.career_profile?.career_summary ? <section className={styles.section}>
        <h2>{t('provider.resumeExport.professionalSummary')}</h2>
        <p className={styles.summary}>{resume.career_profile.career_summary}</p>
      </section> : null}

      {activeRoles.length ? <section className={styles.section}>
        <h2>{t('provider.resumeExport.professionalTalents')}</h2>
        <div className={styles.chips}>{activeRoles.map((role) => <span className={styles.chip} key={role.id}>{role.title}</span>)}</div>
      </section> : null}

      {resume.skills?.length ? <section className={styles.section}>
        <h2>{t('provider.resumeExport.skills')}</h2>
        <div className={styles.chips}>{resume.skills.map((skill) => <span className={styles.chip} key={skill.id}>
          {skill.name}{skill.proficiency ? ` · ${label(skill.proficiency)}` : ''}{skill.years_experience != null ? ` · ${skill.years_experience}${t('provider.resumeExport.yearsShort')}` : ''}
        </span>)}</div>
      </section> : null}

      {resume.experiences?.length ? <section className={styles.section}>
        <h2>{t('provider.resumeExport.experience')}</h2>
        {resume.experiences.map((item) => <div className={styles.item} key={item.id}>
          <div className={styles.itemTop}><span className={styles.itemTitle}>{item.role_title}</span><span className={styles.itemDate}>{range(item.start_date, item.end_date, item.is_current, locale, t('provider.resumeExport.present'))}</span></div>
          <div className={styles.itemSub}>{item.organization}{item.location ? ` · ${item.location}` : ''}{item.employment_type ? ` · ${label(item.employment_type)}` : ''}</div>
          {item.description ? <p className={styles.itemDescription}>{item.description}</p> : null}
        </div>)}
      </section> : null}

      {resume.education?.length ? <section className={styles.section}>
        <h2>{t('provider.resumeExport.education')}</h2>
        {resume.education.map((item) => <div className={styles.item} key={item.id}>
          <div className={styles.itemTop}><span className={styles.itemTitle}>{item.qualification}{item.field_of_study ? ` — ${item.field_of_study}` : ''}</span><span className={styles.itemDate}>{range(item.start_date, item.end_date, false, locale, t('provider.resumeExport.present'))}</span></div>
          <div className={styles.itemSub}>{item.institution}</div>
          {item.description ? <p className={styles.itemDescription}>{item.description}</p> : null}
        </div>)}
      </section> : null}

      {resume.certifications?.length ? <section className={styles.section}>
        <h2>{t('provider.resumeExport.certifications')}</h2>
        {resume.certifications.map((item) => <div className={styles.item} key={item.id}>
          <div className={styles.itemTop}><span className={styles.itemTitle}>{item.name}</span><span className={styles.itemDate}>{date(item.issue_date, locale)}</span></div>
          <div className={styles.itemSub}>{item.issuing_organization}{item.credential_id ? ` · ${t('provider.resumeExport.credentialIdPrefix')} ${item.credential_id}` : ''}</div>
          {item.credential_url ? <div className={styles.itemDescription}>{item.credential_url}</div> : null}
        </div>)}
      </section> : null}

      {resume.career_profile?.availability_note ? <section className={styles.section}>
        <h2>{t('provider.resumeExport.availabilityNote')}</h2>
        <p className={styles.summary}>{resume.career_profile.availability_note}</p>
      </section> : null}

      <footer className={styles.note}>{t('provider.resumeExport.selfReportedDisclaimer')}</footer>
    </article> : null}
  </main>;
}
