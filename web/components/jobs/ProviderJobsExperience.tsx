'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './JobMarketplace.module.css';
import { EmployerHiringWorkspace } from './EmployerHiringWorkspace';
import { ProfessionalJobsWorkspace } from './ProfessionalJobsWorkspace';
import { SafeJobDeletionPanel } from './SafeJobDeletionPanel';

type ModeResponse={mode?:'business'|'professional';error?:string};

export function ProviderJobsExperience(){
  const { locale }=useIdentityWorkspaceTranslations();
  const ta=locale.toLowerCase().startsWith('ta');
  const [mode,setMode]=useState<'business'|'professional'|null>(null);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const response=await fetch('/api/provider/job-marketplace',{cache:'no-store'});
        const payload=await response.json() as ModeResponse;
        if(!response.ok) throw new Error(payload.error||'Unable to load jobs workspace.');
        if(payload.mode!=='business'&&payload.mode!=='professional') throw new Error('Jobs workspace is unavailable for this account.');
        if(active) setMode(payload.mode);
      }catch(cause){
        if(active) setError(cause instanceof Error?cause.message:'Unable to load jobs workspace.');
      }
    })();
    return ()=>{active=false;};
  },[]);

  if(error) return <div className={`${styles.alert} ${styles.error}`}>{error}</div>;
  if(!mode) return <div className={styles.empty}>Loading jobs workspace…</div>;
  if(mode==='business') return <>
    <section className={`${styles.card} ${styles.section}`}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>{ta?'Business · Employer':'Business · Employer'}</span>
          <h2>{ta?'Jobs post செய்து Professionals-ஐ hire செய்யுங்கள்':'Post jobs and hire Professionals'}</h2>
          <p className={styles.muted}>{ta?'உங்கள் Business account employer side ஆக செயல்படும். Jobs publish செய்து applicants review செய்யலாம், interviews schedule செய்து employment offers வழங்கலாம்.':'Your Business account is the employer side of TakeItEsee Jobs. Publish roles, review Professional applicants, schedule interviews and make employment offers.'}</p>
        </div>
        <Link className={`${styles.button} ${styles.secondary}`} href="/jobs">{ta?'Public jobs பார்க்க':'View public jobs'}</Link>
      </div>
    </section>
    <EmployerHiringWorkspace/>
    <section className={`${styles.card} ${styles.section}`}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Applicant discovery</span>
          <h2>Find applicants faster</h2>
          <p className={styles.muted}>Search and filter applicants across jobs, hiring stages and Professional verification without changing their application status.</p>
        </div>
        <Link className={styles.button} href="/provider/jobs/applicants">Open applicant finder</Link>
      </div>
    </section>
    <SafeJobDeletionPanel/>
  </>;
  return <ProfessionalJobsWorkspace/>;
}
