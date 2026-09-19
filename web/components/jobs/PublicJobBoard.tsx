'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
import { usePublicJobBoardTranslations, type PublicJobBoardKey } from '../i18n/PublicJobBoardTranslations';
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
function marketplaceLabel(value: string, t: (key: PublicJobBoardKey) => string) {
  const key = ({
    full_time: 'publicJobBoard.employment.fullTime',
    part_time: 'publicJobBoard.employment.partTime',
    contract: 'publicJobBoard.employment.contract',
    freelance: 'publicJobBoard.employment.freelance',
    internship: 'publicJobBoard.employment.internship',
    temporary: 'publicJobBoard.employment.temporary',
    onsite: 'publicJobBoard.workplace.onsite',
    remote: 'publicJobBoard.workplace.remote',
    hybrid: 'publicJobBoard.workplace.hybrid',
  } as const)[value as 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship' | 'temporary' | 'onsite' | 'remote' | 'hybrid'];
  return key ? t(key) : label(value);
}

export function PublicJobBoard() {
  const { t } = usePublicJobBoardTranslations();
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
      if (!response.ok) throw new Error(payload.error || (alreadySaved ? t('publicJobBoard.saved.removeFallback') : t('publicJobBoard.saved.saveFallback')));
      setSavedJobIds((current) => alreadySaved ? current.filter((id) => id !== jobId) : [...new Set([...current, jobId])]);
      setMessage({ tone: 'success', text: alreadySaved ? t('publicJobBoard.saved.removed') : t('publicJobBoard.saved.saved') });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t('publicJobBoard.saved.updateFallback') });
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
      if (!response.ok) throw new Error(payload.error || t('publicJobBoard.application.fallback'));
      setMessage({ tone: 'success', text: t('publicJobBoard.application.success') });
      setSelectedJobId(null);
      setCoverNote('');
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t('publicJobBoard.application.fallback') });
    } finally {
      setSubmitting(false);
    }
  }

  return <div className={styles.page}>
    <section className={styles.hero}>
      <span className={styles.eyebrow}>{t('publicJobBoard.hero.eyebrow')}</span>
      <h1>{t('publicJobBoard.hero.title')}</h1>
      <p className={styles.muted}>{t('publicJobBoard.hero.intro')}</p>
      <div className={styles.actions}>
        <Link className={styles.button} href="#open-jobs">{t('publicJobBoard.hero.findJobs')}</Link>
        <Link className={`${styles.button} ${styles.secondary}`} href="/provider/jobs/applications">{t('publicJobBoard.hero.myApplications')}</Link>
        <Link className={`${styles.button} ${styles.secondary}`} href="/provider/jobs">{t('publicJobBoard.hero.postJob')}</Link>
      </div>
    </section>

    {message ? <div className={`${styles.alert} ${message.tone === 'error' ? styles.error : styles.success}`}>{message.text}</div> : null}
    {loading ? <div className={styles.empty}>{t('publicJobBoard.loading')}</div> : null}
    {!loading && !jobs.length ? <div className={styles.empty}>{t('publicJobBoard.empty')}</div> : null}

    {!loading && jobs.length ? <section className={`${styles.card} ${styles.section}`} aria-label={t('publicJobBoard.discovery.aria')}>
      <div className={styles.sectionHeading}>
        <div><span className={styles.eyebrow}>{t('publicJobBoard.discovery.eyebrow')}</span><h2>{t('publicJobBoard.discovery.title')}</h2><p className={styles.muted}>{t('publicJobBoard.discovery.intro')}</p></div>
        <div className={styles.jobMetric}><strong>{filteredJobs.length}</strong><span>{t('publicJobBoard.discovery.of')} {jobs.length} {t('publicJobBoard.discovery.jobs')}</span></div>
      </div>
      <div className={styles.formGrid}>
        <label className={`${styles.label} ${styles.wide}`}>{t('publicJobBoard.filter.keyword')}<input className={styles.input} type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t('publicJobBoard.filter.keywordPlaceholder')} /></label>
        <label className={styles.label}>{t('publicJobBoard.filter.employment')}<select className={styles.select} value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}><option value="">{t('publicJobBoard.filter.allTypes')}</option>{employmentTypes.map((type) => <option key={type} value={type}>{marketplaceLabel(type, t)}</option>)}</select></label>
        <label className={styles.label}>{t('publicJobBoard.filter.workplace')}<select className={styles.select} value={workplaceType} onChange={(event) => setWorkplaceType(event.target.value)}><option value="">{t('publicJobBoard.filter.allWorkplaces')}</option>{workplaceTypes.map((type) => <option key={type} value={type}>{marketplaceLabel(type, t)}</option>)}</select></label>
        <label className={styles.label}>{t('publicJobBoard.filter.location')}<input className={styles.input} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder={t('publicJobBoard.filter.locationPlaceholder')} /></label>
        <label className={styles.label}>{t('publicJobBoard.filter.skill')}<select className={styles.select} value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)}><option value="">{t('publicJobBoard.filter.allSkills')}</option>{skills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select></label>
      </div>
      {hasFilters ? <div className={styles.row}><span className={styles.muted}>{filteredJobs.length} {t(filteredJobs.length === 1 ? 'publicJobBoard.filter.matchingJob' : 'publicJobBoard.filter.matchingJobs')}</span><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{t('publicJobBoard.filter.clear')}</button></div> : null}
    </section> : null}

    {!loading && jobs.length > 0 && filteredJobs.length === 0 ? <div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>⌕</span><strong>{t('publicJobBoard.filter.noMatches')}</strong><span>{t('publicJobBoard.filter.noMatchesHelp')}</span><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={clearFilters}>{t('publicJobBoard.filter.clearAll')}</button></div> : null}

    <section className={styles.grid} id="open-jobs">
      {filteredJobs.map((job) => <article className={styles.card} id={`job-${job.id}`} key={job.id}>
        <div className={styles.row}><div><h3>{job.title}</h3><div className={styles.muted}>{job.business?.name ?? t('publicJobBoard.business.verifiedFallback')}</div></div>{job.business?.verified ? <span className={styles.pill}>{t('publicJobBoard.business.verifiedBadge')}</span> : null}</div>
        <div className={styles.meta}>
          <span className={styles.pill}>{marketplaceLabel(job.employment_type, t)}</span>
          <span className={styles.pill}>{marketplaceLabel(job.workplace_type, t)}</span>
          {job.location ? <span className={styles.pill}>{job.location}</span> : null}
          <span className={styles.pill}>{job.openings} {t(job.openings === 1 ? 'publicJobBoard.job.opening' : 'publicJobBoard.job.openings')}</span>
        </div>
        <p>{job.description.length > 260 ? `${job.description.slice(0, 260)}…` : job.description}</p>
        {job.required_skills?.length ? <div className={styles.meta}>{job.required_skills.map((skill) => <span className={styles.pill} key={skill}>{skill}</span>)}</div> : null}
        {job.minimum_experience_years != null ? <div className={styles.muted}>{job.minimum_experience_years}+ {t('publicJobBoard.job.experiencePreferred')}</div> : null}
        {money(job) ? <strong>{money(job)}</strong> : <span className={styles.muted}>{t('publicJobBoard.job.compensation')}</span>}
        {job.application_deadline ? <div className={styles.muted}>{t('publicJobBoard.job.applyBy')} {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString()}</div> : null}
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={() => { setSelectedJobId(job.id); setMessage(null); }}>{t('publicJobBoard.action.apply')}</button>
          {canSaveJobs ? <button className={`${styles.button} ${styles.secondary}`} type="button" aria-pressed={savedJobIds.includes(job.id)} disabled={savingJobId === job.id} onClick={() => void toggleSaved(job.id)}>{savingJobId === job.id ? t('publicJobBoard.action.saving') : savedJobIds.includes(job.id) ? t('publicJobBoard.action.saved') : t('publicJobBoard.action.save')}</button> : null}
          <MarketplaceReportForm targetType="job_posting" targetId={job.id} label={t('publicJobBoard.action.report')} />
        </div>
      </article>)}
    </section>

    {selectedJob ? <section className={styles.applyPanel} aria-label={t('publicJobBoard.application.aria')}>
      <div className={styles.row}><div><strong>{selectedJob.title}</strong><div className={styles.muted}>{selectedJob.business?.name}</div></div><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => setSelectedJobId(null)}>{t('publicJobBoard.application.close')}</button></div>
      <label className={styles.label}>{t('publicJobBoard.application.coverNote')}<textarea className={styles.textarea} value={coverNote} maxLength={2400} onChange={(event) => setCoverNote(event.target.value)} placeholder={t('publicJobBoard.application.coverPlaceholder')} /></label>
      <div className={styles.alert}>{t('publicJobBoard.application.snapshotNotice')}</div>
      <div className={styles.actions}><button className={styles.button} type="button" disabled={submitting} onClick={() => void apply()}>{submitting ? t('publicJobBoard.application.submitting') : t('publicJobBoard.application.submit')}</button><Link className={`${styles.button} ${styles.secondary}`} href="/provider/resume">{t('publicJobBoard.application.reviewResume')}</Link></div>
    </section> : null}
  </div>;
}
