'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './JobMarketplace.module.css';

type Job = { id:string; title:string; description:string; employment_type:string; workplace_type:string; location?:string|null; required_skills?:string[]|null; openings:number; status:string; application_deadline?:string|null; salary_min_minor?:number|null; salary_max_minor?:number|null; salary_currency:string; salary_period?:string|null };
type Application = { id:string; job_posting_id:string; professional_id:string; cover_note?:string|null; status:string; applied_at:string };
type Professional = { id:string; headline?:string|null; service_area?:string|null; verified:boolean };
type Role = { id:string; title:string; active:boolean; open_to_full_time:boolean; open_to_part_time:boolean; open_to_contract:boolean; open_to_freelance:boolean };
type Workspace =
  | { mode:'business'; business:{id:string;name:string;verified:boolean}; jobs:Job[]; applications:Application[]; professionals:Professional[] }
  | { mode:'professional'; professional:{id:string;headline?:string|null;verified:boolean}; roles:Role[]; applications:Application[]; jobs:Job[] };

function label(value:string){ return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()); }
function salary(job:Job){
  if(job.salary_min_minor==null&&job.salary_max_minor==null) return null;
  const f=new Intl.NumberFormat('en-IN',{style:'currency',currency:job.salary_currency||'INR',maximumFractionDigits:0});
  const min=job.salary_min_minor==null?'':f.format(job.salary_min_minor/100);
  const max=job.salary_max_minor==null?'':f.format(job.salary_max_minor/100);
  return `${min}${min&&max?' – ':''}${max}${job.salary_period?` / ${job.salary_period}`:''}`;
}

export function ProviderJobMarketplace(){
  const { locale } = useIdentityWorkspaceTranslations();
  const ta=locale.toLowerCase().startsWith('ta');
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState<{tone:'error'|'success';text:string}|null>(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({title:'',description:'',employment_type:'full_time',workplace_type:'onsite',location:'',required_skills:'',minimum_experience_years:'',openings:'1',salary_min:'',salary_max:'',salary_period:'month',application_deadline:'',status:'draft'});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/provider/job-marketplace',{cache:'no-store'});
      const payload=await response.json() as Workspace & {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to load job workspace.');
      setWorkspace(payload);
    }catch(error){ setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to load job workspace.'}); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ void load(); },[load]);

  const jobsById=useMemo(()=>new Map((workspace?.jobs??[]).map((job)=>[job.id,job])),[workspace]);
  const professionalsById=useMemo(()=>new Map((workspace?.mode==='business'?workspace.professionals:[]).map((profile)=>[profile.id,profile])),[workspace]);

  async function createJob(){
    setSaving(true);setMessage(null);
    try{
      const majorToMinor=(value:string)=>value.trim()?Math.round(Number(value)*100):null;
      const response=await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        title:form.title,description:form.description,employment_type:form.employment_type,workplace_type:form.workplace_type,location:form.location,
        required_skills:form.required_skills.split(',').map((value)=>value.trim()).filter(Boolean),minimum_experience_years:form.minimum_experience_years,openings:form.openings,
        salary_min_minor:majorToMinor(form.salary_min),salary_max_minor:majorToMinor(form.salary_max),salary_currency:'INR',salary_period:form.salary_period||null,application_deadline:form.application_deadline,status:form.status,
      })});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to create job.');
      setForm({title:'',description:'',employment_type:'full_time',workplace_type:'onsite',location:'',required_skills:'',minimum_experience_years:'',openings:'1',salary_min:'',salary_max:'',salary_period:'month',application_deadline:'',status:'draft'});
      setMessage({tone:'success',text:ta?'Job posting உருவாக்கப்பட்டது.':'Job posting created.'});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to create job.'});}
    finally{setSaving(false);}
  }

  async function patch(body:Record<string,unknown>){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-marketplace',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to update.');
      setMessage({tone:'success',text:ta?'Update வெற்றிகரமாக முடிந்தது.':'Update completed.'});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to update.'});}
    finally{setSaving(false);}
  }

  if(loading&&!workspace) return <div className={styles.empty}>{ta?'Job workspace ஏற்றப்படுகிறது…':'Loading job workspace…'}</div>;
  if(!workspace) return <div className={styles.page}>{message?<div className={`${styles.alert} ${styles.error}`}>{message.text}</div>:null}</div>;

  if(workspace.mode==='professional') return <div className={styles.page}>
    <section className={styles.hero}><h1>{ta?'Jobs & Applications':'Jobs & applications'}</h1><p className={styles.muted}>{ta?'உங்கள் TakeItEsee Professional identity மூலம் job opportunities-க்கு apply செய்து application status track செய்யுங்கள்.':'Use your TakeItEsee Professional identity to apply for opportunities and track application status.'}</p><div className={styles.actions}><Link className={styles.button} href="/jobs">Browse jobs</Link><Link className={`${styles.button} ${styles.secondary}`} href="/provider/resume">Resume & Career</Link></div></section>
    {!workspace.professional.verified?<div className={`${styles.alert} ${styles.error}`}>{ta?'Apply செய்ய Professional verification தேவை.':'Professional verification is required before applying.'}</div>:null}
    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}
    <section className={styles.section}><h2>{ta?'என் விண்ணப்பங்கள்':'My applications'}</h2>
      {!workspace.applications.length?<div className={styles.empty}>{ta?'இன்னும் job application இல்லை.':'No job applications yet.'}</div>:workspace.applications.map((application)=>{const job=jobsById.get(application.job_posting_id);const active=['submitted','shortlisted','interview'].includes(application.status);return <article className={styles.card} key={application.id}><div className={styles.row}><div><h3>{job?.title??'Job opportunity'}</h3><div className={styles.muted}>Applied {new Date(application.applied_at).toLocaleDateString()}</div></div><span className={styles.status}>{label(application.status)}</span></div>{job?<div className={styles.meta}><span className={styles.pill}>{label(job.employment_type)}</span><span className={styles.pill}>{label(job.workplace_type)}</span>{job.location?<span className={styles.pill}>{job.location}</span>:null}</div>:null}{application.cover_note?<p>{application.cover_note}</p>:null}{active?<div className={styles.actions}><button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void patch({action:'application_status',application_id:application.id,status:'withdrawn'})}>Withdraw</button></div>:null}</article>;})}
    </section>
  </div>;

  return <div className={styles.page}>
    <section className={styles.hero}><h1>{ta?'Employer Jobs':'Employer job workspace'}</h1><p className={styles.muted}>{ta?'உங்கள் verified Business identity மூலம் jobs publish செய்து applicants manage செய்யுங்கள்.':'Publish opportunities from your existing verified Business identity and manage applicants.'}</p>{!workspace.business.verified?<div className={`${styles.alert} ${styles.error}`}>Verify your business before publishing an open job.</div>:null}</section>
    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}
    <section className={styles.card}><h2>{ta?'புதிய Job Post':'Create a job posting'}</h2><div className={styles.form}>
      <div className={styles.formGrid}>
        <label className={`${styles.label} ${styles.wide}`}>Job title<input className={styles.input} value={form.title} maxLength={180} onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
        <label className={`${styles.label} ${styles.wide}`}>Description<textarea className={styles.textarea} value={form.description} maxLength={5000} onChange={(e)=>setForm({...form,description:e.target.value})}/></label>
        <label className={styles.label}>Employment<select className={styles.select} value={form.employment_type} onChange={(e)=>setForm({...form,employment_type:e.target.value})}>{['full_time','part_time','contract','freelance','internship','temporary'].map((value)=><option value={value} key={value}>{label(value)}</option>)}</select></label>
        <label className={styles.label}>Workplace<select className={styles.select} value={form.workplace_type} onChange={(e)=>setForm({...form,workplace_type:e.target.value})}>{['onsite','remote','hybrid'].map((value)=><option value={value} key={value}>{label(value)}</option>)}</select></label>
        <label className={styles.label}>Location<input className={styles.input} value={form.location} maxLength={180} onChange={(e)=>setForm({...form,location:e.target.value})}/></label>
        <label className={styles.label}>Openings<input className={styles.input} type="number" min="1" max="500" value={form.openings} onChange={(e)=>setForm({...form,openings:e.target.value})}/></label>
        <label className={`${styles.label} ${styles.wide}`}>Required skills (comma separated)<input className={styles.input} value={form.required_skills} onChange={(e)=>setForm({...form,required_skills:e.target.value})}/></label>
        <label className={styles.label}>Min. experience years<input className={styles.input} type="number" min="0" max="50" value={form.minimum_experience_years} onChange={(e)=>setForm({...form,minimum_experience_years:e.target.value})}/></label>
        <label className={styles.label}>Application deadline<input className={styles.input} type="date" value={form.application_deadline} onChange={(e)=>setForm({...form,application_deadline:e.target.value})}/></label>
        <label className={styles.label}>Salary from (₹)<input className={styles.input} type="number" min="0" value={form.salary_min} onChange={(e)=>setForm({...form,salary_min:e.target.value})}/></label>
        <label className={styles.label}>Salary to (₹)<input className={styles.input} type="number" min="0" value={form.salary_max} onChange={(e)=>setForm({...form,salary_max:e.target.value})}/></label>
        <label className={styles.label}>Salary period<select className={styles.select} value={form.salary_period} onChange={(e)=>setForm({...form,salary_period:e.target.value})}>{['hour','day','month','year','project'].map((value)=><option value={value} key={value}>{label(value)}</option>)}</select></label>
        <label className={styles.label}>Initial status<select className={styles.select} value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="open">Open</option></select></label>
      </div><div className={styles.actions}><button className={styles.button} disabled={saving} type="button" onClick={()=>void createJob()}>{saving?'Saving…':'Create job'}</button></div>
    </div></section>

    <section className={styles.section}><h2>{ta?'Job Postings':'Job postings'}</h2>{!workspace.jobs.length?<div className={styles.empty}>No job postings yet.</div>:workspace.jobs.map((job)=>{const applicants=workspace.applications.filter((application)=>application.job_posting_id===job.id);return <article className={styles.card} key={job.id}><div className={styles.row}><div><h3>{job.title}</h3><div className={styles.muted}>{label(job.employment_type)} · {label(job.workplace_type)}{job.location?` · ${job.location}`:''}</div></div><span className={styles.status}>{label(job.status)}</span></div><p>{job.description}</p>{salary(job)?<strong>{salary(job)}</strong>:null}<div className={styles.actions}>{job.status!=='open'?<button className={styles.button} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'open'})}>Open</button>:<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'closed'})}>Close</button>}<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'filled'})}>Mark filled</button></div><div className={styles.section}><strong>{applicants.length} applicant{applicants.length===1?'':'s'}</strong>{applicants.map((application)=>{const profile=professionalsById.get(application.professional_id);const next=application.status==='submitted'?['shortlisted','interview','rejected']:application.status==='shortlisted'?['interview','rejected']:application.status==='interview'?['hired','rejected']:[];return <div className={styles.application} key={application.id}><div className={styles.row}><div><Link href={`/professionals/${application.professional_id}`}><strong>{profile?.headline||'Professional applicant'}</strong></Link><div className={styles.muted}>{profile?.service_area||''}</div></div><span className={styles.status}>{label(application.status)}</span></div>{application.cover_note?<p>{application.cover_note}</p>:null}{next.length?<div className={styles.actions}>{next.map((status)=><button className={`${styles.button} ${status==='rejected'?styles.danger:styles.secondary}`} disabled={saving} type="button" key={status} onClick={()=>void patch({action:'application_status',application_id:application.id,status})}>{label(status)}</button>)}</div>:null}</div>;})}</div></article>;})}</section>
  </div>;
}
