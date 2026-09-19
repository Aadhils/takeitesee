'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProviderJobsTranslations, type ProviderJobsKey } from '../i18n/ProviderJobsTranslations';
import styles from './JobMarketplace.module.css';

type Job = { id: string; title: string; status: string };
type Application = { id: string; job_posting_id: string };
type Workspace = { mode?: 'business' | 'professional'; jobs?: Job[]; applications?: Application[]; error?: string };

const statusLabelKeys: Partial<Record<string, ProviderJobsKey>> = {
  draft: 'providerJobs.safeDeletion.status.draft',
  open: 'providerJobs.safeDeletion.status.open',
  closed: 'providerJobs.safeDeletion.status.closed',
  filled: 'providerJobs.safeDeletion.status.filled',
};

function fallbackLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function localizedStatus(value: string, t: (key: ProviderJobsKey) => string) {
  const key = statusLabelKeys[value];
  return key ? t(key) : fallbackLabel(value);
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function SafeJobDeletionPanel() {
  const { t } = useProviderJobsTranslations();
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
      if (!response.ok) throw new Error(payload.error || t('providerJobs.safeDeletion.loadFallback'));
      if (payload.mode !== 'business') throw new Error(t('providerJobs.safeDeletion.businessRequired'));
      setJobs(payload.jobs ?? []);
      setApplications(payload.applications ?? []);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t('providerJobs.safeDeletion.loadFallback') });
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      if (!response.ok) throw new Error(payload.error || t('providerJobs.safeDeletion.deleteFallback'));
      setConfirmId(null);
      setMessage({ tone: 'success', text: t('providerJobs.safeDeletion.deleteSuccess') });
      await load();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : t('providerJobs.safeDeletion.deleteFallback') });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return <section className={styles.section} aria-label={t('providerJobs.safeDeletion.aria')}>
    <div className={styles.sectionHeading}>
      <div>
        <span className={styles.eyebrow}>{t('providerJobs.safeDeletion.eyebrow')}</span>
        <h2>{t('providerJobs.safeDeletion.title')}</h2>
        <p className={styles.muted}>{t('providerJobs.safeDeletion.intro')}</p>
      </div>
    </div>

    {message ? <div className={`${styles.alert} ${message.tone === 'error' ? styles.error : styles.success}`} role="status">{message.text}</div> : null}
    {loading ? <div className={styles.empty}>{t('providerJobs.safeDeletion.loading')}</div> : null}

    {!loading && jobs.length > 0 && removableJobs.length === 0 ? <div className={styles.empty}>
      {t('providerJobs.safeDeletion.noneAvailable')}
    </div> : null}

    {!loading && removableJobs.length > 0 ? <div className={styles.jobList}>
      {removableJobs.map((job) => <article className={styles.jobCard} key={job.id}>
        <div className={styles.row}>
          <div>
            <div className={styles.meta}><span className={styles.pill}>{localizedStatus(job.status, t)}</span><span className={styles.pill}>{t('providerJobs.safeDeletion.zeroApplicants')}</span></div>
            <h3>{job.title}</h3>
            <p className={styles.muted}>{t('providerJobs.safeDeletion.noEvidence')}</p>
          </div>
        </div>

        {confirmId === job.id ? <div className={`${styles.alert} ${styles.error}`}>
          <strong>{t('providerJobs.safeDeletion.confirmTitle')}</strong>
          <p>{interpolate(t('providerJobs.safeDeletion.removeImmediately'), { title: job.title })}</p>
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.secondary}`} disabled={busyId === job.id} type="button" onClick={() => setConfirmId(null)}>{t('providerJobs.safeDeletion.cancel')}</button>
            <button className={`${styles.button} ${styles.danger}`} disabled={busyId === job.id} type="button" onClick={() => void deleteJob(job)}>{busyId === job.id ? t('providerJobs.safeDeletion.deleting') : t('providerJobs.safeDeletion.confirmDelete')}</button>
          </div>
        </div> : <div className={styles.actions}>
          <button className={`${styles.button} ${styles.danger}`} disabled={Boolean(busyId)} type="button" onClick={() => { setConfirmId(job.id); setMessage(null); }}>{t('providerJobs.safeDeletion.deleteJob')}</button>
        </div>}
      </article>)}
    </div> : null}
  </section>;
}
