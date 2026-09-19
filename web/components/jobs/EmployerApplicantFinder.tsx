'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useProviderJobsTranslations, type ProviderJobsKey } from '../i18n/ProviderJobsTranslations';
import styles from './JobMarketplace.module.css';

type Job = { id: string; title: string; status: string };
type Application = {
  id: string;
  job_posting_id: string;
  professional_id: string;
  cover_note?: string | null;
  status: string;
  applied_at: string;
};
type Professional = {
  id: string;
  headline?: string | null;
  service_area?: string | null;
  verified: boolean;
};
type Conversation = { id: string; job_application_id: string };
type Workspace = {
  mode: 'business';
  business: { id: string; name: string; verified: boolean };
  jobs: Job[];
  applications: Application[];
  professionals: Professional[];
  conversations: Conversation[];
};
type SortMode = 'newest' | 'oldest' | 'profile' | 'job';
type VerificationFilter = '' | 'verified' | 'unverified';

const localizedLabelKeys: Partial<Record<string, ProviderJobsKey>> = {
  submitted: 'providerJobs.applicantFinder.status.submitted',
  shortlisted: 'providerJobs.applicantFinder.status.shortlisted',
  interview: 'providerJobs.applicantFinder.status.interview',
  hired: 'providerJobs.applicantFinder.status.hired',
  rejected: 'providerJobs.applicantFinder.status.rejected',
  withdrawn: 'providerJobs.applicantFinder.status.withdrawn',
  draft: 'providerJobs.applicantFinder.jobStatus.draft',
  open: 'providerJobs.applicantFinder.jobStatus.open',
  closed: 'providerJobs.applicantFinder.jobStatus.closed',
  filled: 'providerJobs.applicantFinder.jobStatus.filled',
};

function fallbackLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function localizedLabel(value: string, t: (key: ProviderJobsKey) => string) {
  const key = localizedLabelKeys[value];
  return key ? t(key) : fallbackLabel(value);
}

function normalized(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase();
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function EmployerApplicantFinder() {
  const { locale, t } = useProviderJobsTranslations();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [jobId, setJobId] = useState('');
  const [stage, setStage] = useState('');
  const [verification, setVerification] = useState<VerificationFilter>('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/provider/job-marketplace', { cache: 'no-store' });
        const payload = await response.json() as (Workspace & { error?: string }) | { mode?: string; error?: string };
        if (!response.ok) throw new Error(payload.error || t('providerJobs.applicantFinder.loadFallback'));
        if (payload.mode !== 'business') throw new Error(t('providerJobs.applicantFinder.businessRequired'));
        if (active) setWorkspace(payload as Workspace);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t('providerJobs.applicantFinder.loadFallback'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [t]);

  const jobsById = useMemo(() => new Map((workspace?.jobs ?? []).map((job) => [job.id, job])), [workspace]);
  const professionalsById = useMemo(() => new Map((workspace?.professionals ?? []).map((profile) => [profile.id, profile])), [workspace]);
  const conversationByApplication = useMemo(() => new Map((workspace?.conversations ?? []).map((conversation) => [conversation.job_application_id, conversation])), [workspace]);
  const stages = useMemo(() => [...new Set((workspace?.applications ?? []).map((application) => application.status).filter(Boolean))].sort(), [workspace]);
  const jobsWithApplicants = useMemo(() => {
    if (!workspace) return [];
    const appliedJobIds = new Set(workspace.applications.map((application) => application.job_posting_id));
    return workspace.jobs.filter((job) => appliedJobIds.has(job.id)).sort((a, b) => a.title.localeCompare(b.title));
  }, [workspace]);

  const filteredApplications = useMemo(() => {
    if (!workspace) return [];
    const keywordValue = normalized(keyword);
    const rows = workspace.applications.filter((application) => {
      const job = jobsById.get(application.job_posting_id);
      const profile = professionalsById.get(application.professional_id);
      if (jobId && application.job_posting_id !== jobId) return false;
      if (stage && application.status !== stage) return false;
      if (verification === 'verified' && profile?.verified !== true) return false;
      if (verification === 'unverified' && profile?.verified === true) return false;
      if (!keywordValue) return true;
      const haystack = [profile?.headline, profile?.service_area, job?.title, application.cover_note, application.status]
        .map((value) => normalized(value))
        .join(' ');
      return haystack.includes(keywordValue);
    });

    return rows.sort((a, b) => {
      if (sortMode === 'oldest') return new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime();
      if (sortMode === 'profile') {
        const aProfile = professionalsById.get(a.professional_id)?.headline ?? 'Professional applicant';
        const bProfile = professionalsById.get(b.professional_id)?.headline ?? 'Professional applicant';
        return aProfile.localeCompare(bProfile);
      }
      if (sortMode === 'job') {
        const aJob = jobsById.get(a.job_posting_id)?.title ?? '';
        const bJob = jobsById.get(b.job_posting_id)?.title ?? '';
        return aJob.localeCompare(bJob) || (new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());
      }
      return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime();
    });
  }, [workspace, keyword, jobId, stage, verification, sortMode, jobsById, professionalsById]);

  const hasFilters = Boolean(keyword.trim() || jobId || stage || verification || sortMode !== 'newest');
  function clearFilters() {
    setKeyword('');
    setJobId('');
    setStage('');
    setVerification('');
    setSortMode('newest');
  }

  if (loading) return <div className={styles.empty}>{t('providerJobs.applicantFinder.loading')}</div>;
  if (error || !workspace) return <div className={`${styles.alert} ${styles.error}`}>{error || t('providerJobs.applicantFinder.unavailable')}</div>;

  const totalLabel = interpolate(t('providerJobs.applicantFinder.applicantsOf'), { total: workspace.applications.length });
  const matchingLabel = interpolate(
    t(filteredApplications.length === 1 ? 'providerJobs.applicantFinder.matchingOne' : 'providerJobs.applicantFinder.matchingMany'),
    { count: filteredApplications.length },
  );

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <span className={styles.eyebrow}>{t('providerJobs.applicantFinder.heroEyebrow')}</span>
        <h1>{t('providerJobs.applicantFinder.title')}</h1>
        <p className={styles.muted}>{t('providerJobs.applicantFinder.intro')}</p>
      </div>
      <div className={styles.heroActions}>
        <Link className={`${styles.button} ${styles.secondary}`} href="/provider/jobs">{t('providerJobs.applicantFinder.back')}</Link>
      </div>
    </section>

    {!workspace.applications.length ? <div className={`${styles.empty} ${styles.emptyState}`}>
      <span className={styles.emptyIcon}>◎</span>
      <strong>{t('providerJobs.applicantFinder.emptyTitle')}</strong>
      <span>{t('providerJobs.applicantFinder.emptyBody')}</span>
      <Link className={styles.button} href="/provider/jobs">{t('providerJobs.applicantFinder.openHiring')}</Link>
    </div> : <>
      <section className={`${styles.card} ${styles.section}`} aria-label={t('providerJobs.applicantFinder.filtersAria')}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>{t('providerJobs.applicantFinder.filtersEyebrow')}</span>
            <h2>{t('providerJobs.applicantFinder.filtersTitle')}</h2>
            <p className={styles.muted}>{t('providerJobs.applicantFinder.filtersBody')}</p>
          </div>
          <div className={styles.jobMetric}><strong>{filteredApplications.length}</strong><span>{totalLabel}</span></div>
        </div>

        <div className={styles.formGrid}>
          <label className={`${styles.label} ${styles.wide}`}>{t('providerJobs.applicantFinder.keyword')}<input className={styles.input} type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t('providerJobs.applicantFinder.keywordPlaceholder')} /></label>
          <label className={styles.label}>{t('providerJobs.applicantFinder.job')}<select className={styles.select} value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">{t('providerJobs.applicantFinder.allJobs')}</option>{jobsWithApplicants.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
          <label className={styles.label}>{t('providerJobs.applicantFinder.stage')}<select className={styles.select} value={stage} onChange={(event) => setStage(event.target.value)}><option value="">{t('providerJobs.applicantFinder.allStages')}</option>{stages.map((value) => <option key={value} value={value}>{localizedLabel(value, t)}</option>)}</select></label>
          <label className={styles.label}>{t('providerJobs.applicantFinder.professional')}<select className={styles.select} value={verification} onChange={(event) => setVerification(event.target.value as VerificationFilter)}><option value="">{t('providerJobs.applicantFinder.allProfiles')}</option><option value="verified">{t('providerJobs.applicantFinder.verified')}</option><option value="unverified">{t('providerJobs.applicantFinder.notVerified')}</option></select></label>
          <label className={styles.label}>{t('providerJobs.applicantFinder.sort')}<select className={styles.select} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="newest">{t('providerJobs.applicantFinder.sortNewest')}</option><option value="oldest">{t('providerJobs.applicantFinder.sortOldest')}</option><option value="profile">{t('providerJobs.applicantFinder.sortProfile')}</option><option value="job">{t('providerJobs.applicantFinder.sortJob')}</option></select></label>
        </div>

        {hasFilters ? <div className={styles.row}><span className={styles.muted}>{matchingLabel}</span><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{t('providerJobs.applicantFinder.clearFilters')}</button></div> : null}
      </section>

      {filteredApplications.length === 0 ? <div className={`${styles.empty} ${styles.emptyState}`}>
        <span className={styles.emptyIcon}>⌕</span>
        <strong>{t('providerJobs.applicantFinder.noMatchTitle')}</strong>
        <span>{t('providerJobs.applicantFinder.noMatchBody')}</span>
        <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{t('providerJobs.applicantFinder.clearAll')}</button>
      </div> : <div className={styles.jobList}>{filteredApplications.map((application) => {
        const job = jobsById.get(application.job_posting_id);
        const profile = professionalsById.get(application.professional_id);
        const conversation = conversationByApplication.get(application.id);
        return <article className={styles.jobCard} key={application.id}>
          <div className={styles.row}>
            <div>
              <div className={styles.meta}><span className={styles.statusPill}>{localizedLabel(application.status, t)}</span><span className={styles.pill}>{profile?.verified ? t('providerJobs.applicantFinder.verifiedProfessional') : t('providerJobs.applicantFinder.notVerified')}</span>{job?.status ? <span className={styles.pill}>{localizedLabel(job.status, t)} {t('providerJobs.applicantFinder.jobSuffix')}</span> : null}</div>
              <Link href={`/professionals/${application.professional_id}`} className={styles.profileLink}><h3>{profile?.headline || t('providerJobs.applicantFinder.professionalFallback')}</h3></Link>
              {profile?.service_area ? <div className={styles.muted}>⌖ {profile.service_area}</div> : null}
              <div className={styles.muted}>{job?.title ?? t('providerJobs.applicantFinder.jobFallback')} · {t('providerJobs.applicantFinder.applied')} {new Date(application.applied_at).toLocaleDateString(locale)}</div>
            </div>
            <div className={styles.jobMetric}><span>{t('providerJobs.applicantFinder.stageMetric')}</span><strong>{localizedLabel(application.status, t)}</strong></div>
          </div>
          {application.cover_note ? <p>{application.cover_note.length > 320 ? `${application.cover_note.slice(0, 320)}…` : application.cover_note}</p> : <p className={styles.muted}>{t('providerJobs.applicantFinder.noCoverNote')}</p>}
          <div className={styles.actions}>
            <Link className={styles.button} href={`/professionals/${application.professional_id}`}>{t('providerJobs.applicantFinder.viewProfile')}</Link>
            {conversation ? <Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>{t('providerJobs.applicantFinder.privateMessage')}</Link> : null}
            <Link className={`${styles.button} ${styles.secondary}`} href="/provider/jobs">{t('providerJobs.applicantFinder.hiringActions')}</Link>
          </div>
        </article>;
      })}</div>}
    </>}
  </div>;
}
