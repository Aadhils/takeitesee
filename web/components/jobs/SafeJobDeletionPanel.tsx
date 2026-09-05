'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './JobMarketplace.module.css';

type Job = { id: string; title: string; status: string };
type Application = { id: string; job_posting_id: string };
type Workspace = { mode?: 'business' | 'professional'; jobs?: Job[]; applications?: Application[]; error?: string };

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SafeJobDeletionPanel() {
  const { locale } = useIdentityWorkspaceTranslations();
  const ta = locale.toLowerCase().startsWith('ta');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/provider/job-marketplace', { cache: 'no-store' });
      const payload = await response.json() as Workspace;
      if (!response.ok) throw new Error(payload.error || 'Unable to load job deletion safety state.');
      if (payload.mode !== 'business') throw new Error('Business hiring workspace is required.');
      setJobs(payload.jobs ?? []);
      setApplications(payload.applications ?? []);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to load job deletion safety state.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const applicationCountByJob = useMemo(() => {
    const counts = new Map<string, number>();
    for (const application of applications) {
      counts.set(application.job_posting_id, (counts.get(application.job_posting_id) ?? 0) + 1);
    }
    return counts;
  }, [applications]);

  const removableJobs = useMemo(
    () => jobs.filter((job) => (applicationCountByJob.get(job.id) ?? 0) === 0),
    [jobs, applicationCountByJob],
  );

  async function deleteJob(job: Job) {
    if (busyId) return;
    setBusyId(job.id);
    setMessage(null);
    try {
      const response = await fetch('/api/jobs/delete', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job_id: job.id }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to delete job.');
      setConfirmId(null);
      setMessage({ tone: 'success', text: ta ? 'Job நிரந்தரமாக delete செய்யப்பட்டது.' : 'Job permanently deleted.' });
      await load();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to delete job.' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return <section className={styles.section} aria-label="Job deletion safety">
    <div className={styles.sectionHeading}>
      <div>
        <span className={styles.eyebrow}>{ta ? 'Destructive action safety' : 'Destructive action safety'}</span>
        <h2>{ta ? 'Job deletion' : 'Job deletion'}</h2>
        <p className={styles.muted}>{ta
          ? 'Application வராத job மட்டும் நிரந்தரமாக delete செய்யலாம். முதல் application வந்ததும் hiring evidence பாதுகாப்புக்காக deletion lock ஆகும்.'
          : 'Only jobs with zero applications can be permanently deleted. After the first application, deletion is locked to preserve hiring evidence.'}</p>
      </div>
    </div>

    {message ? <div className={`${styles.alert} ${message.tone === 'error' ? styles.error : styles.success}`} role="status">{message.text}</div> : null}
    {loading ? <div className={styles.empty}>{ta ? 'Deletion safety state ஏற்றப்படுகிறது…' : 'Loading deletion safety state…'}</div> : null}

    {!loading && jobs.length > 0 && removableJobs.length === 0 ? <div className={styles.empty}>
      {ta ? 'Delete செய்யக்கூடிய zero-application jobs இல்லை. Applications உள்ள jobs பாதுகாக்கப்படுகின்றன.' : 'No zero-application jobs are available to delete. Jobs with applications are preserved.'}
    </div> : null}

    {!loading && removableJobs.length > 0 ? <div className={styles.jobList}>
      {removableJobs.map((job) => <article className={styles.jobCard} key={job.id}>
        <div className={styles.row}>
          <div>
            <div className={styles.meta}><span className={styles.pill}>{label(job.status)}</span><span className={styles.pill}>0 applicants</span></div>
            <h3>{job.title}</h3>
            <p className={styles.muted}>{ta ? 'இந்த job-க்கு hiring evidence இல்லை; delete செய்தால் மீட்டெடுக்க முடியாது.' : 'This job has no hiring evidence yet. Permanent deletion cannot be undone.'}</p>
          </div>
        </div>

        {confirmId === job.id ? <div className={`${styles.alert} ${styles.error}`}>
          <strong>{ta ? 'இந்த job-ஐ நிரந்தரமாக delete செய்யவா?' : 'Permanently delete this job?'}</strong>
          <p>{ta ? `“${job.title}” உடனடியாக நீக்கப்படும்.` : `“${job.title}” will be removed immediately.`}</p>
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.secondary}`} disabled={busyId === job.id} type="button" onClick={() => setConfirmId(null)}>{ta ? 'Cancel' : 'Cancel'}</button>
            <button className={`${styles.button} ${styles.danger}`} disabled={busyId === job.id} type="button" onClick={() => void deleteJob(job)}>{busyId === job.id ? (ta ? 'Deleting…' : 'Deleting…') : (ta ? 'Confirm Delete' : 'Confirm delete')}</button>
          </div>
        </div> : <div className={styles.actions}>
          <button className={`${styles.button} ${styles.danger}`} disabled={Boolean(busyId)} type="button" onClick={() => { setConfirmId(job.id); setMessage(null); }}>{ta ? 'Delete Job' : 'Delete job'}</button>
        </div>}
      </article>)}
    </div> : null}
  </section>;
}
