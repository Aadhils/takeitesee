'use client';

import { useEffect, useState } from 'react';
import styles from './JobMarketplace.module.css';
import { EmployerHiringWorkspace } from './EmployerHiringWorkspace';
import { ProfessionalJobsWorkspace } from './ProfessionalJobsWorkspace';
import { SafeJobDeletionPanel } from './SafeJobDeletionPanel';

type ModeResponse={mode?:'business'|'professional';error?:string};

export function ProviderJobsExperience(){
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
  if(mode==='business') return <><EmployerHiringWorkspace/><SafeJobDeletionPanel/></>;
  return <ProfessionalJobsWorkspace/>;
}
