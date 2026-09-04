'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { JobApplicationResumeSnapshot, type JobApplicationResumeSnapshotRow } from './JobApplicationResumeSnapshot';
import styles from './JobMarketplace.module.css';

type Job = { id: string; title: string };
type Application = {
  id: string;
  job_posting_id: string;
  professional_id: string;
  cover_note?: string | null;
  status: string;
  applied_at: string;
};
type Professional = { id: string; headline?: string | null; service_area?: string | null; verified: boolean };
type BusinessWorkspace = {
  mode: 'business';
  jobs: Job[];
  applications: Application[];
  professionals: Professional[];
  resume_snapshots: JobApplicationResumeSnapshotRow[];
};
type WorkspaceResponse = BusinessWorkspace | { mode: 'professional' } | { error?: string };

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function EmployerApplicantResumeReview() {
  const [workspace, setWorkspace] = useState<BusinessWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/provider/job-marketplace', { cache: 'no-store' });
      const payload = await response.json() as WorkspaceResponse;
      if (!response.ok) throw new Error('error' in payload && payload.error ? payload.error : 'Unable to load applicant resume snapshots.');
      setWorkspace('mode' in payload && payload.mode === 'business' ? payload : null);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load applicant resume snapshots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const jobsById = useMemo(() => new Map((workspace?.jobs ?? []).map((job) => [job.id, job])), [workspace]);
  const professionalsById = useMemo(() => new Map((workspace?.professionals ?? []).map((professional) => [professional.id, professional])), [workspace]);
  const snapshotsByApplication = useMemo(() => new Map((workspace?.resume_snapshots ?? []).map((row) => [row.job_application_id, row])), [workspace]);

  if (loading) return null;
  if (!workspace) return error ? <section className={styles.section}><div className={`${styles.alert} ${styles.error}`}>{error}</div></section> : null;
  if (!workspace.applications.length) return null;

  return <section className={styles.section} aria-label="Employer applicant resume review">
    <div className={styles.row}>
      <div>
        <h2>Applicant resume review</h2>
        <p className={styles.muted}>Review the career-only snapshot each Professional shared when applying. This record stays frozen even if the applicant later edits their private or public resume.</p>
      </div>
      <span className={styles.status}>{workspace.applications.length} application{workspace.applications.length === 1 ? '' : 's'}</span>
    </div>

    <div className={styles.section}>
      {workspace.applications.map((application) => {
        const job = jobsById.get(application.job_posting_id);
        const professional = professionalsById.get(application.professional_id);
        const snapshot = snapshotsByApplication.get(application.id);
        return <article className={styles.card} key={application.id}>
          <div className={styles.row}>
            <div>
              <Link href={`/professionals/${application.professional_id}`}><strong>{professional?.headline || snapshot?.snapshot?.profile?.headline || 'Professional applicant'}</strong></Link>
              <div className={styles.muted}>{job?.title || 'Job opportunity'}{professional?.service_area ? ` · ${professional.service_area}` : ''}</div>
              <div className={styles.muted}>Applied {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(application.applied_at))}</div>
            </div>
            <span className={styles.status}>{label(application.status)}</span>
          </div>
          {application.cover_note ? <div className={styles.applyPanel}><strong>Cover note</strong><p style={{ whiteSpace: 'pre-wrap' }}>{application.cover_note}</p></div> : null}
          <JobApplicationResumeSnapshot row={snapshot} />
        </article>;
      })}
    </div>
  </section>;
}
