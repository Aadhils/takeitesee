'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSavedJobsTranslations, type SavedJobsKey } from '../i18n/SavedJobsTranslations';
import styles from './JobMarketplace.module.css';

type SavedJob = {
  job_posting_id: string;
  saved_at: string;
  available: boolean;
  job: null | {
    id: string;
    title: string;
    description: string;
    employment_type: string;
    workplace_type: string;
    location?: string | null;
    required_skills?: string[] | null;
    application_deadline?: string | null;
    business?: { id: string; name: string; verified: boolean; location?: string | null } | null;
  };
};

const labelKeys: Partial<Record<string, SavedJobsKey>> = {
  full_time: 'savedJobs.employment.fullTime',
  part_time: 'savedJobs.employment.partTime',
  contract: 'savedJobs.employment.contract',
  freelance: 'savedJobs.employment.freelance',
  internship: 'savedJobs.employment.internship',
  temporary: 'savedJobs.employment.temporary',
  onsite: 'savedJobs.workplace.onsite',
  remote: 'savedJobs.workplace.remote',
  hybrid: 'savedJobs.workplace.hybrid',
};

function localizedLabel(value: string, t: (key: SavedJobsKey) => string) {
  const key = labelKeys[value];
  return key ? t(key) : value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SavedJobsWorkspace() {
  const { locale, t } = useSavedJobsTranslations();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/provider/saved-jobs', { cache: 'no-store' });
      const payload = await response.json() as { saved_jobs?: SavedJob[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t('savedJobs.loadFallback'));
      setSavedJobs(payload.saved_jobs ?? []);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t('savedJobs.loadFallback') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(jobId: string) {
    setRemoving(jobId);
    setMessage(null);
    try {
      const response = await fetch('/api/provider/saved-jobs', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job_posting_id: jobId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('savedJobs.removeFallback'));
      setSavedJobs((current) => current.filter((item) => item.job_posting_id !== jobId));
      setMessage({ tone: 'success', text: t('savedJobs.removeSuccess') });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t('savedJobs.removeFallback') });
    } finally {
      setRemoving(null);
    }
  }

  return <section className={styles.section}>
    <div className={styles.sectionHeading}>
      <div>
        <span className={styles.eyebrow}>{t('savedJobs.eyebrow')}</span>
        <h2>{t('savedJobs.title')}</h2>
        <p className={styles.muted}>{t('savedJobs.intro')}</p>
      </div>
      <Link className={styles.button} href="/jobs">{t('savedJobs.browseJobs')}</Link>
    </div>

    {message ? <div className={`${styles.alert} ${message.tone === 'error' ? styles.error : styles.success}`}>{message.text}</div> : null}
    {loading ? <div className={styles.empty}>{t('savedJobs.loading')}</div> : null}
    {!loading && savedJobs.length === 0 ? <div className={`${styles.empty} ${styles.emptyState}`}>
      <span className={styles.emptyIcon}>☆</span>
      <strong>{t('savedJobs.empty.title')}</strong>
      <span>{t('savedJobs.empty.body')}</span>
      <Link className={styles.button} href="/jobs">{t('savedJobs.empty.cta')}</Link>
    </div> : null}

    {!loading && savedJobs.length ? <div className={styles.jobList}>{savedJobs.map((saved) => {
      if (!saved.available || !saved.job) return <article className={styles.jobCard} key={saved.job_posting_id}>
        <div className={styles.row}>
          <div><span className={styles.statusPill}>{t('savedJobs.unavailable.badge')}</span><h3>{t('savedJobs.unavailable.title')}</h3></div>
          <div className={styles.jobMetric}><span>{t('savedJobs.savedLabel')}</span><strong>{new Date(saved.saved_at).toLocaleDateString(locale)}</strong></div>
        </div>
        <p className={styles.muted}>{t('savedJobs.unavailable.body')}</p>
        <div className={styles.actions}><button className={`${styles.button} ${styles.secondary}`} type="button" disabled={removing === saved.job_posting_id} onClick={() => void remove(saved.job_posting_id)}>{removing === saved.job_posting_id ? t('savedJobs.removing') : t('savedJobs.removeSavedJob')}</button></div>
      </article>;

      const job = saved.job;
      return <article className={styles.jobCard} key={saved.job_posting_id}>
        <div className={styles.row}>
          <div><div className={styles.meta}><span className={styles.statusPill}>{t('savedJobs.savedLabel')}</span><span className={styles.pill}>{localizedLabel(job.employment_type, t)}</span><span className={styles.pill}>{localizedLabel(job.workplace_type, t)}</span></div><h3>{job.title}</h3><div className={styles.muted}>{job.business?.name ?? t('savedJobs.verifiedBusinessFallback')}</div></div>
          <div className={styles.jobMetric}><span>{ta ? 'Saved' : 'Saved'}</span><strong>{new Date(saved.saved_at).toLocaleDateString(locale)}</strong></div>
        </div>
        {job.location ? <div className={styles.jobFacts}><span>⌖ {job.location}</span></div> : null}
        <p>{job.description.length > 220 ? `${job.description.slice(0, 220)}…` : job.description}</p>
        {job.required_skills?.length ? <div className={styles.meta}>{job.required_skills.slice(0, 8).map((skill) => <span className={styles.pill} key={skill}>{skill}</span>)}</div> : null}
        {job.application_deadline ? <div className={styles.muted}>{t('savedJobs.applyBy')} {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString(locale)}</div> : null}
        <div className={styles.actions}>
          <Link className={styles.button} href={`/jobs#job-${job.id}`}>{t('savedJobs.viewApply')}</Link>
          <button className={`${styles.button} ${styles.secondary}`} type="button" disabled={removing === saved.job_posting_id} onClick={() => void remove(saved.job_posting_id)}>{removing === saved.job_posting_id ? t('savedJobs.removing') : t('savedJobs.remove')}</button>
        </div>
      </article>;
    })}</div> : null}
  </section>;
}
