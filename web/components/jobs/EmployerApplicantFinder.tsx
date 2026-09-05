'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
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

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalized(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase();
}

export function EmployerApplicantFinder() {
  const { locale } = useIdentityWorkspaceTranslations();
  const ta = locale.toLowerCase().startsWith('ta');
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
        if (!response.ok) throw new Error(payload.error || 'Unable to load applicants.');
        if (payload.mode !== 'business') throw new Error('Business hiring workspace is required to use Applicant Finder.');
        if (active) setWorkspace(payload as Workspace);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load applicants.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

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

  if (loading) return <div className={styles.empty}>{ta ? 'Applicants ஏற்றப்படுகின்றனர்…' : 'Loading applicants…'}</div>;
  if (error || !workspace) return <div className={`${styles.alert} ${styles.error}`}>{error || 'Applicant Finder is unavailable.'}</div>;

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <span className={styles.eyebrow}>{ta ? 'Employer discovery' : 'Employer discovery'}</span>
        <h1>{ta ? 'Applicant Finder' : 'Applicant finder'}</h1>
        <p className={styles.muted}>{ta ? 'Job, application stage, verification மற்றும் keyword மூலம் applicants-ஐ வேகமாக shortlist செய்யுங்கள்.' : 'Find the right applicants quickly by job, hiring stage, verification state and keyword.'}</p>
      </div>
      <div className={styles.heroActions}>
        <Link className={`${styles.button} ${styles.secondary}`} href="/provider/jobs">{ta ? 'Hiring workspace திரும்ப' : 'Back to hiring workspace'}</Link>
      </div>
    </section>

    {!workspace.applications.length ? <div className={`${styles.empty} ${styles.emptyState}`}>
      <span className={styles.emptyIcon}>◎</span>
      <strong>{ta ? 'Applicants இன்னும் இல்லை' : 'No applicants yet'}</strong>
      <span>{ta ? 'Applications வந்த பிறகு இந்த finder பயன்படுத்தலாம்.' : 'This finder becomes useful as applications arrive for your jobs.'}</span>
      <Link className={styles.button} href="/provider/jobs">{ta ? 'Hiring workspace பார்க்க' : 'Open hiring workspace'}</Link>
    </div> : <>
      <section className={`${styles.card} ${styles.section}`} aria-label="Applicant discovery filters">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Applicant discovery</span>
            <h2>{ta ? 'Candidates தேடுங்கள்' : 'Search candidates'}</h2>
            <p className={styles.muted}>{ta ? 'இந்த filters existing hiring data-ஐ மட்டும் organize செய்கின்றன; application status மாற்றாது.' : 'These controls only organize existing hiring data and do not change application status.'}</p>
          </div>
          <div className={styles.jobMetric}><strong>{filteredApplications.length}</strong><span>{ta ? `/ ${workspace.applications.length} applicants` : `of ${workspace.applications.length} applicants`}</span></div>
        </div>

        <div className={styles.formGrid}>
          <label className={`${styles.label} ${styles.wide}`}>Keyword<input className={styles.input} type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={ta ? 'Headline, location, job, cover note…' : 'Headline, location, job, cover note…'} /></label>
          <label className={styles.label}>Job<select className={styles.select} value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">{ta ? 'All jobs' : 'All jobs'}</option>{jobsWithApplicants.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
          <label className={styles.label}>Stage<select className={styles.select} value={stage} onChange={(event) => setStage(event.target.value)}><option value="">{ta ? 'All stages' : 'All stages'}</option>{stages.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label className={styles.label}>Professional<select className={styles.select} value={verification} onChange={(event) => setVerification(event.target.value as VerificationFilter)}><option value="">{ta ? 'All profiles' : 'All profiles'}</option><option value="verified">Verified</option><option value="unverified">Not verified</option></select></label>
          <label className={styles.label}>Sort<select className={styles.select} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="profile">Profile A–Z</option><option value="job">Job A–Z</option></select></label>
        </div>

        {hasFilters ? <div className={styles.row}><span className={styles.muted}>{ta ? `${filteredApplications.length} matching applicants` : `${filteredApplications.length} matching ${filteredApplications.length === 1 ? 'applicant' : 'applicants'}`}</span><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{ta ? 'Filters clear செய்ய' : 'Clear filters'}</button></div> : null}
      </section>

      {filteredApplications.length === 0 ? <div className={`${styles.empty} ${styles.emptyState}`}>
        <span className={styles.emptyIcon}>⌕</span>
        <strong>{ta ? 'Matching applicants இல்லை' : 'No applicants match these filters'}</strong>
        <span>{ta ? 'ஒரு filter-ஐ மாற்றி அல்லது clear செய்து மீண்டும் பாருங்கள்.' : 'Broaden or clear a filter to see more candidates.'}</span>
        <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{ta ? 'அனைத்து filters clear செய்ய' : 'Clear all filters'}</button>
      </div> : <div className={styles.jobList}>{filteredApplications.map((application) => {
        const job = jobsById.get(application.job_posting_id);
        const profile = professionalsById.get(application.professional_id);
        const conversation = conversationByApplication.get(application.id);
        return <article className={styles.jobCard} key={application.id}>
          <div className={styles.row}>
            <div>
              <div className={styles.meta}><span className={styles.statusPill}>{label(application.status)}</span><span className={styles.pill}>{profile?.verified ? 'Verified Professional' : 'Not verified'}</span>{job?.status ? <span className={styles.pill}>{label(job.status)} job</span> : null}</div>
              <Link href={`/professionals/${application.professional_id}`} className={styles.profileLink}><h3>{profile?.headline || 'Professional applicant'}</h3></Link>
              {profile?.service_area ? <div className={styles.muted}>⌖ {profile.service_area}</div> : null}
              <div className={styles.muted}>{job?.title ?? 'Job opportunity'} · Applied {new Date(application.applied_at).toLocaleDateString(locale)}</div>
            </div>
            <div className={styles.jobMetric}><span>{ta ? 'Stage' : 'Stage'}</span><strong>{label(application.status)}</strong></div>
          </div>
          {application.cover_note ? <p>{application.cover_note.length > 320 ? `${application.cover_note.slice(0, 320)}…` : application.cover_note}</p> : <p className={styles.muted}>{ta ? 'Cover note இல்லை.' : 'No cover note provided.'}</p>}
          <div className={styles.actions}>
            <Link className={styles.button} href={`/professionals/${application.professional_id}`}>{ta ? 'Profile பார்க்க' : 'View profile'}</Link>
            {conversation ? <Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>{ta ? 'Private Message' : 'Private message'}</Link> : null}
            <Link className={`${styles.button} ${styles.secondary}`} href="/provider/jobs">{ta ? 'Hiring actions' : 'Hiring actions'}</Link>
          </div>
        </article>;
      })}</div>}
    </>}
  </div>;
}
