'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProviderJobsTranslations } from '../i18n/ProviderJobsTranslations';
import styles from './JobMarketplace.module.css';
import businessStyles from './BusinessEmployerJobsResponsive.module.css';
import { EmployerHiringWorkspace } from './EmployerHiringWorkspace';
import { HiringJourneyGuide } from './HiringJourneyGuide';
import { ProfessionalJobsWorkspace } from './ProfessionalJobsWorkspace';
import { SafeJobDeletionPanel } from './SafeJobDeletionPanel';

type ModeResponse={mode?:'business'|'professional';error?:string};

export function ProviderJobsExperience(){
  const { t }=useProviderJobsTranslations();
  const [mode,setMode]=useState<'business'|'professional'|null>(null);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const response=await fetch('/api/provider/job-marketplace',{cache:'no-store'});
        const payload=await response.json() as ModeResponse;
        if(!response.ok) throw new Error(payload.error||t('providerJobs.loadFallback'));
        if(payload.mode!=='business'&&payload.mode!=='professional') throw new Error(t('providerJobs.unavailable'));
        if(active) setMode(payload.mode);
      }catch(cause){
        if(active) setError(cause instanceof Error?cause.message:t('providerJobs.loadFallback'));
      }
    })();
    return ()=>{active=false;};
  },[t]);

  if(error) return <div className={`${styles.alert} ${styles.error}`}>{error}</div>;
  if(!mode) return <div className={styles.empty}>{t('providerJobs.loading')}</div>;
  if(mode==='business') return <div className={businessStyles.businessJobsJourney}>
    <section className={`${styles.card} ${styles.section}`}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>{t('providerJobs.business.eyebrow')}</span>
          <h2>{t('providerJobs.business.title')}</h2>
          <p className={styles.muted}>{t('providerJobs.business.intro')}</p>
        </div>
        <Link className={`${styles.button} ${styles.secondary}`} href="/jobs">{t('providerJobs.business.viewPublicJobs')}</Link>
      </div>
    </section>
    <HiringJourneyGuide role="business" />
    <EmployerHiringWorkspace/>
    <section className={`${styles.card} ${styles.section}`}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>{t('providerJobs.business.applicantDiscoveryEyebrow')}</span>
          <h2>{t('providerJobs.business.applicantDiscoveryTitle')}</h2>
          <p className={styles.muted}>{t('providerJobs.business.applicantDiscoveryIntro')}</p>
        </div>
        <Link className={styles.button} href="/provider/jobs/applicants">{t('providerJobs.business.openApplicantFinder')}</Link>
      </div>
    </section>
    <SafeJobDeletionPanel/>
  </div>;
  return <ProfessionalJobsWorkspace/>;
}
