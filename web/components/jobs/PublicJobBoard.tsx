'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './JobMarketplace.module.css';

type Job = {
  id: string;
  title: string;
  description: string;
  employment_type: string;
  workplace_type: string;
  location?: string | null;
  required_skills?: string[] | null;
  minimum_experience_years?: number | null;
  openings: number;
  salary_min_minor?: number | null;
  salary_max_minor?: number | null;
  salary_currency: string;
  salary_period?: string | null;
  application_deadline?: string | null;
  business?: { id: string; name: string; verified: boolean; location?: string | null } | null;
};

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function money(job: Job) {
  if (job.salary_min_minor == null && job.salary_max_minor == null) return null;
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: job.salary_currency || 'INR', maximumFractionDigits: 0 });
  const min = job.salary_min_minor == null ? null : formatter.format(job.salary_min_minor / 100);
  const max = job.salary_max_minor == null ? null : formatter.format(job.salary_max_minor / 100);
  return `${min ?? ''}${min && max ? ' – ' : ''}${max ?? ''}${job.salary_period ? ` / ${job.salary_period}` : ''}`;
}

export function PublicJobBoard() {
  const { locale } = useIdentityWorkspaceTranslations();
  const ta = locale.toLowerCase().startsWith('ta');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/jobs', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { jobs?: Job[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Unable to load jobs.');
        if (!cancelled) setJobs(payload.jobs ?? []);
      })
      .catch((error) => { if (!cancelled) setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to load jobs.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function apply() {
    if (!selectedJob) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/provider/job-marketplace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job_posting_id: selectedJob.id, cover_note: coverNote }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to apply.');
      setMessage({ tone: 'success', text: ta ? 'விண்ணப்பம் வெற்றிகரமாக அனுப்பப்பட்டது.' : 'Application submitted successfully.' });
      setSelectedJobId(null);
      setCoverNote('');
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to apply.' });
    } finally {
      setSubmitting(false);
    }
  }

  return <div className={styles.page}>
    <section className={styles.hero}>
      <h1>{ta ? 'வேலை வாய்ப்புகள்' : 'Job opportunities'}</h1>
      <p className={styles.muted}>{ta ? 'TakeItEsee verified business-கள் வெளியிடும் full-time, part-time, contract, freelance மற்றும் internship வாய்ப்புகள்.' : 'Explore full-time, part-time, contract, freelance and internship opportunities from verified TakeItEsee businesses.'}</p>
      <div className={styles.actions}><Link className={`${styles.button} ${styles.secondary}`} href="/provider/jobs">{ta ? 'என் விண்ணப்பங்கள்' : 'My applications'}</Link></div>
    </section>

    {message ? <div className={`${styles.alert} ${message.tone === 'error' ? styles.error : styles.success}`}>{message.text}</div> : null}
    {loading ? <div className={styles.empty}>{ta ? 'வேலை வாய்ப்புகள் ஏற்றப்படுகின்றன…' : 'Loading opportunities…'}</div> : null}
    {!loading && !jobs.length ? <div className={styles.empty}>{ta ? 'தற்போது open job வாய்ப்புகள் இல்லை.' : 'No open job opportunities right now.'}</div> : null}

    <section className={styles.grid}>
      {jobs.map((job) => <article className={styles.card} key={job.id}>
        <div className={styles.row}><div><h3>{job.title}</h3><div className={styles.muted}>{job.business?.name ?? 'Verified business'}</div></div>{job.business?.verified ? <span className={styles.pill}>Verified business</span> : null}</div>
        <div className={styles.meta}>
          <span className={styles.pill}>{label(job.employment_type)}</span>
          <span className={styles.pill}>{label(job.workplace_type)}</span>
          {job.location ? <span className={styles.pill}>{job.location}</span> : null}
          <span className={styles.pill}>{job.openings} {job.openings === 1 ? 'opening' : 'openings'}</span>
        </div>
        <p>{job.description.length > 260 ? `${job.description.slice(0, 260)}…` : job.description}</p>
        {job.required_skills?.length ? <div className={styles.meta}>{job.required_skills.map((skill) => <span className={styles.pill} key={skill}>{skill}</span>)}</div> : null}
        {job.minimum_experience_years != null ? <div className={styles.muted}>{job.minimum_experience_years}+ years experience preferred</div> : null}
        {money(job) ? <strong>{money(job)}</strong> : <span className={styles.muted}>{ta ? 'சம்பள விவரம் employer உடன்' : 'Compensation discussed with employer'}</span>}
        {job.application_deadline ? <div className={styles.muted}>Apply by {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString()}</div> : null}
        <div className={styles.actions}><button className={styles.button} type="button" onClick={() => { setSelectedJobId(job.id); setMessage(null); }}>{ta ? 'Apply' : 'Apply with TakeItEsee profile'}</button></div>
      </article>)}
    </section>

    {selectedJob ? <section className={styles.applyPanel} aria-label="Job application">
      <div className={styles.row}><div><strong>{selectedJob.title}</strong><div className={styles.muted}>{selectedJob.business?.name}</div></div><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => setSelectedJobId(null)}>Close</button></div>
      <label className={styles.label}>{ta ? 'Cover note (optional)' : 'Cover note (optional)'}<textarea className={styles.textarea} value={coverNote} maxLength={2400} onChange={(event) => setCoverNote(event.target.value)} placeholder={ta ? 'இந்த வேலைக்கு நீங்கள் ஏன் பொருத்தமானவர் என்பதை சுருக்கமாக எழுதுங்கள்.' : 'Briefly explain why you are a good fit for this opportunity.'} /></label>
      <div className={styles.alert}>{ta ? 'Apply செய்ய verified Professional profile தேவை. Resume & Career / Portfolio details employer-க்கு உங்கள் TakeItEsee profile வழியாக பார்க்க முடியும்.' : 'A verified Professional profile is required to apply. Your TakeItEsee professional profile remains the source for resume, career and portfolio information.'}</div>
      <div className={styles.actions}><button className={styles.button} type="button" disabled={submitting} onClick={() => void apply()}>{submitting ? 'Submitting…' : 'Submit application'}</button><Link className={`${styles.button} ${styles.secondary}`} href="/provider/resume">Review my resume</Link></div>
    </section> : null}
  </div>;
}
