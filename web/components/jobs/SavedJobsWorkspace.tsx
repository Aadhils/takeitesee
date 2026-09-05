'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
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

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SavedJobsWorkspace() {
  const { locale } = useIdentityWorkspaceTranslations();
  const ta = locale.toLowerCase().startsWith('ta');
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/provider/saved-jobs', { cache: 'no-store' });
      const payload = await response.json() as { saved_jobs?: SavedJob[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load saved jobs.');
      setSavedJobs(payload.saved_jobs ?? []);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to load saved jobs.' });
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
      if (!response.ok) throw new Error(payload.error || 'Unable to remove saved job.');
      setSavedJobs((current) => current.filter((item) => item.job_posting_id !== jobId));
      setMessage({ tone: 'success', text: ta ? 'Saved job அகற்றப்பட்டது.' : 'Saved job removed.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to remove saved job.' });
    } finally {
      setRemoving(null);
    }
  }

  return <section className={styles.section}>
    <div className={styles.sectionHeading}>
      <div>
        <span className={styles.eyebrow}>Career shortlist</span>
        <h2>{ta ? 'Saved jobs' : 'Saved jobs'}</h2>
        <p className={styles.muted}>{ta ? 'Apply செய்யும் முன் விருப்பமான jobs-ஐ save செய்து இங்கே மீண்டும் பார்க்கலாம்.' : 'Keep interesting opportunities here and return when you are ready to apply.'}</p>
      </div>
      <Link className={styles.button} href="/jobs">{ta ? 'Jobs தேடுங்கள்' : 'Browse jobs'}</Link>
    </div>

    {message ? <div className={`${styles.alert} ${message.tone === 'error' ? styles.error : styles.success}`}>{message.text}</div> : null}
    {loading ? <div className={styles.empty}>{ta ? 'Saved jobs ஏற்றப்படுகின்றன…' : 'Loading saved jobs…'}</div> : null}
    {!loading && savedJobs.length === 0 ? <div className={`${styles.empty} ${styles.emptyState}`}>
      <span className={styles.emptyIcon}>☆</span>
      <strong>{ta ? 'Saved jobs இன்னும் இல்லை' : 'No saved jobs yet'}</strong>
      <span>{ta ? 'Public Jobs page-ல் விருப்பமான opportunity-ஐ Save job அழுத்தி இங்கே வைத்துக்கொள்ளலாம்.' : 'Use Save job on the public Jobs page to build a shortlist.'}</span>
      <Link className={styles.button} href="/jobs">{ta ? 'Jobs பார்க்க' : 'Explore jobs'}</Link>
    </div> : null}

    {!loading && savedJobs.length ? <div className={styles.jobList}>{savedJobs.map((saved) => {
      if (!saved.available || !saved.job) return <article className={styles.jobCard} key={saved.job_posting_id}>
        <div className={styles.row}>
          <div><span className={styles.statusPill}>Unavailable</span><h3>{ta ? 'இந்த saved job இப்போது available இல்லை' : 'This saved job is no longer available'}</h3></div>
          <div className={styles.jobMetric}><span>{ta ? 'Saved' : 'Saved'}</span><strong>{new Date(saved.saved_at).toLocaleDateString(locale)}</strong></div>
        </div>
        <p className={styles.muted}>{ta ? 'Job close, pause அல்லது expire ஆகியிருக்கலாம். உங்கள் shortlist record மட்டும் வைத்திருக்கிறது.' : 'The job may have closed, been paused, or expired. You can remove it from your shortlist.'}</p>
        <div className={styles.actions}><button className={`${styles.button} ${styles.secondary}`} type="button" disabled={removing === saved.job_posting_id} onClick={() => void remove(saved.job_posting_id)}>{removing === saved.job_posting_id ? 'Removing…' : (ta ? 'Saved list-லிருந்து அகற்று' : 'Remove saved job')}</button></div>
      </article>;

      const job = saved.job;
      return <article className={styles.jobCard} key={saved.job_posting_id}>
        <div className={styles.row}>
          <div><div className={styles.meta}><span className={styles.statusPill}>Saved</span><span className={styles.pill}>{label(job.employment_type)}</span><span className={styles.pill}>{label(job.workplace_type)}</span></div><h3>{job.title}</h3><div className={styles.muted}>{job.business?.name ?? 'Verified business'}</div></div>
          <div className={styles.jobMetric}><span>{ta ? 'Saved' : 'Saved'}</span><strong>{new Date(saved.saved_at).toLocaleDateString(locale)}</strong></div>
        </div>
        {job.location ? <div className={styles.jobFacts}><span>⌖ {job.location}</span></div> : null}
        <p>{job.description.length > 220 ? `${job.description.slice(0, 220)}…` : job.description}</p>
        {job.required_skills?.length ? <div className={styles.meta}>{job.required_skills.slice(0, 8).map((skill) => <span className={styles.pill} key={skill}>{skill}</span>)}</div> : null}
        {job.application_deadline ? <div className={styles.muted}>Apply by {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString(locale)}</div> : null}
        <div className={styles.actions}>
          <Link className={styles.button} href={`/jobs#job-${job.id}`}>{ta ? 'Job பார்த்து Apply செய்ய' : 'View & apply'}</Link>
          <button className={`${styles.button} ${styles.secondary}`} type="button" disabled={removing === saved.job_posting_id} onClick={() => void remove(saved.job_posting_id)}>{removing === saved.job_posting_id ? 'Removing…' : (ta ? 'Unsave' : 'Remove')}</button>
        </div>
      </article>;
    })}</div> : null}
  </section>;
}
