'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
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

type SavedJobSummary = { job_posting_id: string };

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
function normalized(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase();
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
  const [keyword, setKeyword] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [workplaceType, setWorkplaceType] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [canSaveJobs, setCanSaveJobs] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const employmentTypes = useMemo(() => [...new Set(jobs.map((job) => job.employment_type).filter(Boolean))].sort(), [jobs]);
  const workplaceTypes = useMemo(() => [...new Set(jobs.map((job) => job.workplace_type).filter(Boolean))].sort(), [jobs]);
  const skills = useMemo(() => [...new Set(jobs.flatMap((job) => job.required_skills ?? []).map((skill) => skill.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [jobs]);
  const hasFilters = Boolean(keyword.trim() || employmentType || workplaceType || locationFilter.trim() || skillFilter);
  const filteredJobs = useMemo(() => {
    const keywordValue = normalized(keyword);
    const locationValue = normalized(locationFilter);
    const skillValue = normalized(skillFilter);
    return jobs.filter((job) => {
      if (employmentType && job.employment_type !== employmentType) return false;
      if (workplaceType && job.workplace_type !== workplaceType) return false;
      if (locationValue && !normalized(job.location).includes(locationValue) && !normalized(job.business?.location).includes(locationValue)) return false;
      if (skillValue && !(job.required_skills ?? []).some((skill) => normalized(skill) === skillValue)) return false;
      if (!keywordValue) return true;
      const haystack = [job.title, job.description, job.business?.name, job.location, job.business?.location, ...(job.required_skills ?? [])]
        .map((value) => normalized(value))
        .join(' ');
      return haystack.includes(keywordValue);
    });
  }, [jobs, keyword, employmentType, workplaceType, locationFilter, skillFilter]);

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

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/provider/saved-jobs', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as { saved_jobs?: SavedJobSummary[] };
        if (!cancelled) {
          setCanSaveJobs(true);
          setSavedJobIds((payload.saved_jobs ?? []).map((item) => item.job_posting_id));
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function clearFilters() {
    setKeyword('');
    setEmploymentType('');
    setWorkplaceType('');
    setLocationFilter('');
    setSkillFilter('');
  }

  async function toggleSaved(jobId: string) {
    const alreadySaved = savedJobIds.includes(jobId);
    setSavingJobId(jobId);
    setMessage(null);
    try {
      const response = await fetch('/api/provider/saved-jobs', {
        method: alreadySaved ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job_posting_id: jobId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || (alreadySaved ? 'Unable to remove saved job.' : 'Unable to save job.'));
      setSavedJobIds((current) => alreadySaved ? current.filter((id) => id !== jobId) : [...new Set([...current, jobId])]);
      setMessage({ tone: 'success', text: alreadySaved ? (ta ? 'Saved list-லிருந்து job அகற்றப்பட்டது.' : 'Job removed from saved jobs.') : (ta ? 'Job saved. Saved Jobs tab-ல் மீண்டும் பார்க்கலாம்.' : 'Job saved. You can find it in Saved jobs.') });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to update saved job.' });
    } finally {
      setSavingJobId(null);
    }
  }

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

    {!loading && jobs.length ? <section className={`${styles.card} ${styles.section}`} aria-label="Job discovery filters">
      <div className={styles.sectionHeading}>
        <div><span className={styles.eyebrow}>Job discovery</span><h2>{ta ? 'உங்களுக்கு பொருத்தமான jobs தேடுங்கள்' : 'Find the right opportunity'}</h2><p className={styles.muted}>{ta ? 'Keyword, job type, workplace, location மற்றும் skill மூலம் filter செய்யலாம்.' : 'Narrow open jobs by keyword, job type, workplace, location and skill.'}</p></div>
        <div className={styles.jobMetric}><strong>{filteredJobs.length}</strong><span>{ta ? `/ ${jobs.length} jobs` : `of ${jobs.length} jobs`}</span></div>
      </div>
      <div className={styles.formGrid}>
        <label className={`${styles.label} ${styles.wide}`}>Keyword<input className={styles.input} type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Title, company, skill…" /></label>
        <label className={styles.label}>Employment<select className={styles.select} value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}><option value="">{ta ? 'அனைத்தும்' : 'All types'}</option>{employmentTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
        <label className={styles.label}>Workplace<select className={styles.select} value={workplaceType} onChange={(event) => setWorkplaceType(event.target.value)}><option value="">{ta ? 'அனைத்தும்' : 'All workplaces'}</option>{workplaceTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
        <label className={styles.label}>Location<input className={styles.input} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder={ta ? 'City or area' : 'City or area'} /></label>
        <label className={styles.label}>Skill<select className={styles.select} value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)}><option value="">{ta ? 'அனைத்து skills' : 'All skills'}</option>{skills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select></label>
      </div>
      {hasFilters ? <div className={styles.row}><span className={styles.muted}>{ta ? `${filteredJobs.length} matching jobs` : `${filteredJobs.length} matching ${filteredJobs.length === 1 ? 'job' : 'jobs'}`}</span><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{ta ? 'Filters clear செய்ய' : 'Clear filters'}</button></div> : null}
    </section> : null}

    {!loading && jobs.length > 0 && filteredJobs.length === 0 ? <div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>⌕</span><strong>{ta ? 'Matching jobs இல்லை' : 'No jobs match these filters'}</strong><span>{ta ? 'ஒரு filter-ஐ மாற்றி அல்லது clear செய்து மீண்டும் பார்க்கவும்.' : 'Try broadening or clearing one of your filters.'}</span><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{ta ? 'அனைத்து filters clear செய்ய' : 'Clear all filters'}</button></div> : null}

    <section className={styles.grid}>
      {filteredJobs.map((job) => <article className={styles.card} id={`job-${job.id}`} key={job.id}>
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
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={() => { setSelectedJobId(job.id); setMessage(null); }}>{ta ? 'Apply' : 'Apply with TakeItEsee profile'}</button>
          {canSaveJobs ? <button className={`${styles.button} ${styles.secondary}`} type="button" aria-pressed={savedJobIds.includes(job.id)} disabled={savingJobId === job.id} onClick={() => void toggleSaved(job.id)}>{savingJobId === job.id ? 'Saving…' : savedJobIds.includes(job.id) ? (ta ? 'Saved ✓' : 'Saved ✓') : (ta ? 'Save job' : 'Save job')}</button> : null}
          <MarketplaceReportForm targetType="job_posting" targetId={job.id} label={ta ? 'Job report' : 'Report job'} />
        </div>
      </article>)}
    </section>

    {selectedJob ? <section className={styles.applyPanel} aria-label="Job application">
      <div className={styles.row}><div><strong>{selectedJob.title}</strong><div className={styles.muted}>{selectedJob.business?.name}</div></div><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => setSelectedJobId(null)}>Close</button></div>
      <label className={styles.label}>{ta ? 'Cover note (optional)' : 'Cover note (optional)'}<textarea className={styles.textarea} value={coverNote} maxLength={2400} onChange={(event) => setCoverNote(event.target.value)} placeholder={ta ? 'இந்த வேலைக்கு நீங்கள் ஏன் பொருத்தமானவர் என்பதை சுருக்கமாக எழுதுங்கள்.' : 'Briefly explain why you are a good fit for this opportunity.'} /></label>
      <div className={styles.alert}>{ta ? 'Apply செய்ததும், அந்த employer review செய்வதற்காக உங்கள் career/resume விவரங்களின் frozen snapshot உருவாகும். பின்னர் Resume & Career profile-ஐ edit செய்தாலும் அந்த application snapshot மாறாது. Contact, KYC/legal, grievance அல்லது finance data இதில் சேராது; உங்கள் public-resume setting-மும் மாற்றப்படாது.' : 'Submitting creates a frozen career-only resume snapshot for this employer to review. Later Resume & Career edits will not change that application record. Contact, KYC/legal, grievance and finance data are excluded, and your public-resume setting is not changed.'}</div>
      <div className={styles.actions}><button className={styles.button} type="button" disabled={submitting} onClick={() => void apply()}>{submitting ? 'Submitting…' : 'Submit application'}</button><Link className={`${styles.button} ${styles.secondary}`} href="/provider/resume">Review my resume</Link></div>
    </section> : null}
  </div>;
}
