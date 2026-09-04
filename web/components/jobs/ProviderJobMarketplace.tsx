'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './JobMarketplace.module.css';

type Job = { id:string; title:string; description:string; employment_type:string; workplace_type:string; location?:string|null; required_skills?:string[]|null; openings:number; status:string; application_deadline?:string|null; salary_min_minor?:number|null; salary_max_minor?:number|null; salary_currency:string; salary_period?:string|null };
type Application = { id:string; job_posting_id:string; professional_id:string; cover_note?:string|null; status:string; applied_at:string };
type Professional = { id:string; headline?:string|null; service_area?:string|null; verified:boolean };
type Role = { id:string; title:string; active:boolean; open_to_full_time:boolean; open_to_part_time:boolean; open_to_contract:boolean; open_to_freelance:boolean };
type Conversation = { id:string; job_application_id:string; status:string; closed_reason?:string|null; last_message_at?:string|null };
type Interview = { id:string; job_application_id:string; starts_at:string; duration_minutes:number; timezone:string; mode:'in_person'|'phone'|'video'; location?:string|null; meeting_url?:string|null; note?:string|null; status:'scheduled'|'accepted'|'declined'|'cancelled'; created_at:string };
type InterviewEvent = { id:string; interview_id:string; job_application_id:string; event_type:string; starts_at:string; interview_status:string; created_at:string };
type Workspace =
  | { mode:'business'; business:{id:string;name:string;verified:boolean}; jobs:Job[]; applications:Application[]; professionals:Professional[]; conversations:Conversation[]; interviews:Interview[]; interview_events:InterviewEvent[] }
  | { mode:'professional'; professional:{id:string;headline?:string|null;verified:boolean}; roles:Role[]; applications:Application[]; jobs:Job[]; conversations:Conversation[]; interviews:Interview[]; interview_events:InterviewEvent[] };
type InterviewForm = { starts_at:string; duration_minutes:string; timezone:string; mode:'in_person'|'phone'|'video'; location:string; meeting_url:string; note:string };

function label(value:string){ return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()); }
function salary(job:Job){
  if(job.salary_min_minor==null&&job.salary_max_minor==null) return null;
  const f=new Intl.NumberFormat('en-IN',{style:'currency',currency:job.salary_currency||'INR',maximumFractionDigits:0});
  const min=job.salary_min_minor==null?'':f.format(job.salary_min_minor/100);
  const max=job.salary_max_minor==null?'':f.format(job.salary_max_minor/100);
  return `${min}${min&&max?' – ':''}${max}${job.salary_period?` / ${job.salary_period}`:''}`;
}
function localInputDate(value?:string|null){
  if(!value) return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60_000);
  return local.toISOString().slice(0,16);
}
function browserTimezone(){ return typeof Intl!=='undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata' : 'Asia/Kolkata'; }
function formFromInterview(interview?:Interview):InterviewForm{
  return { starts_at:localInputDate(interview?.starts_at),duration_minutes:String(interview?.duration_minutes??30),timezone:interview?.timezone||browserTimezone(),mode:interview?.mode||'video',location:interview?.location||'',meeting_url:interview?.meeting_url||'',note:interview?.note||'' };
}

export function ProviderJobMarketplace(){
  const { locale } = useIdentityWorkspaceTranslations();
  const ta=locale.toLowerCase().startsWith('ta');
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState<{tone:'error'|'success';text:string}|null>(null);
  const [saving,setSaving]=useState(false);
  const [interviewForms,setInterviewForms]=useState<Record<string,InterviewForm>>({});
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
  const conversationByApplication=useMemo(()=>new Map((workspace?.conversations??[]).map((conversation)=>[conversation.job_application_id,conversation])),[workspace]);
  const interviewsByApplication=useMemo(()=>{
    const map=new Map<string,Interview[]>();
    for(const interview of workspace?.interviews??[]){const rows=map.get(interview.job_application_id)??[];rows.push(interview);map.set(interview.job_application_id,rows);}
    return map;
  },[workspace]);
  const eventsByApplication=useMemo(()=>{
    const map=new Map<string,InterviewEvent[]>();
    for(const event of workspace?.interview_events??[]){const rows=map.get(event.job_application_id)??[];rows.push(event);map.set(event.job_application_id,rows);}
    return map;
  },[workspace]);

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

  async function interviewMutation(method:'POST'|'PATCH',body:Record<string,unknown>){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-interviews',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to update interview.');
      setMessage({tone:'success',text:ta?'Interview update வெற்றிகரமாக முடிந்தது.':'Interview updated.'});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to update interview.'});}
    finally{setSaving(false);}
  }

  function interviewForm(applicationId:string,latest?:Interview){ return interviewForms[applicationId]??formFromInterview(latest); }
  function updateInterviewForm(applicationId:string,latest:Interview|undefined,patchValue:Partial<InterviewForm>){
    setInterviewForms((current)=>({...current,[applicationId]:{...(current[applicationId]??formFromInterview(latest)),...patchValue}}));
  }
  async function saveInterview(applicationId:string,latest?:Interview){
    const value=interviewForm(applicationId,latest);
    const body={application_id:applicationId,starts_at:value.starts_at,duration_minutes:value.duration_minutes,timezone:value.timezone,mode:value.mode,location:value.location,meeting_url:value.meeting_url,note:value.note};
    if(latest&&latest.status!=='cancelled') await interviewMutation('PATCH',{action:'reschedule',interview_id:latest.id,...body});
    else await interviewMutation('POST',body);
  }

  if(loading&&!workspace) return <div className={styles.empty}>{ta?'Job workspace ஏற்றப்படுகிறது…':'Loading job workspace…'}</div>;
  if(!workspace) return <div className={styles.page}>{message?<div className={`${styles.alert} ${styles.error}`}>{message.text}</div>:null}</div>;

  if(workspace.mode==='professional') return <div className={styles.page}>
    <section className={styles.hero}><h1>{ta?'Jobs & Applications':'Jobs & applications'}</h1><p className={styles.muted}>{ta?'உங்கள் TakeItEsee Professional identity மூலம் job opportunities-க்கு apply செய்து application, private conversation மற்றும் interview status track செய்யுங்கள்.':'Use your TakeItEsee Professional identity to apply, message shortlisted employers privately, and track interview status.'}</p><div className={styles.actions}><Link className={styles.button} href="/jobs">Browse jobs</Link><Link className={`${styles.button} ${styles.secondary}`} href="/provider/resume">Resume & Career</Link></div></section>
    {!workspace.professional.verified?<div className={`${styles.alert} ${styles.error}`}>{ta?'Apply செய்ய Professional verification தேவை.':'Professional verification is required before applying.'}</div>:null}
    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}
    <section className={styles.section}><h2>{ta?'என் விண்ணப்பங்கள்':'My applications'}</h2>
      {!workspace.applications.length?<div className={styles.empty}>{ta?'இன்னும் job application இல்லை.':'No job applications yet.'}</div>:workspace.applications.map((application)=>{const job=jobsById.get(application.job_posting_id);const active=['submitted','shortlisted','interview'].includes(application.status);const conversation=conversationByApplication.get(application.id);const interviews=interviewsByApplication.get(application.id)??[];const events=eventsByApplication.get(application.id)??[];return <article className={styles.card} key={application.id}><div className={styles.row}><div><h3>{job?.title??'Job opportunity'}</h3><div className={styles.muted}>Applied {new Date(application.applied_at).toLocaleDateString()}</div></div><span className={styles.status}>{label(application.status)}</span></div>{job?<div className={styles.meta}><span className={styles.pill}>{label(job.employment_type)}</span><span className={styles.pill}>{label(job.workplace_type)}</span>{job.location?<span className={styles.pill}>{job.location}</span>:null}</div>:null}{application.cover_note?<p>{application.cover_note}</p>:null}<div className={styles.actions}>{conversation?<Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>{ta?'Private message':'Private message'}</Link>:null}{active?<button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void patch({action:'application_status',application_id:application.id,status:'withdrawn'})}>Withdraw</button>:null}</div>{interviews.length?<div className={styles.section}><strong>{ta?'Interviews':'Interviews'}</strong>{interviews.map((interview)=><div className={styles.applyPanel} key={interview.id}><div className={styles.row}><div><strong>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(interview.starts_at))}</strong><div className={styles.muted}>{label(interview.mode)} · {interview.duration_minutes} min · {interview.timezone}</div></div><span className={styles.status}>{label(interview.status)}</span></div>{interview.location?<div>{interview.location}</div>:null}{interview.meeting_url?<a href={interview.meeting_url} target="_blank" rel="noreferrer">Open secure meeting link</a>:null}{interview.note?<p>{interview.note}</p>:null}{interview.status==='scheduled'?<div className={styles.actions}><button className={styles.button} disabled={saving} onClick={()=>void interviewMutation('PATCH',{action:'respond',interview_id:interview.id,status:'accepted'})}>Accept</button><button className={`${styles.button} ${styles.danger}`} disabled={saving} onClick={()=>void interviewMutation('PATCH',{action:'respond',interview_id:interview.id,status:'declined'})}>Decline</button></div>:null}</div>)}</div>:null}{events.length?<details><summary>Interview history ({events.length})</summary><div className={styles.section}>{events.slice(0,8).map((event)=><div className={styles.muted} key={event.id}>{label(event.event_type)} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))}</div>)}</div></details>:null}</article>;})}
    </section>
  </div>;

  return <div className={styles.page}>
    <section className={styles.hero}><h1>{ta?'Employer Jobs':'Employer job workspace'}</h1><p className={styles.muted}>{ta?'உங்கள் verified Business identity மூலம் jobs publish செய்து applicants, private conversations மற்றும் interviews manage செய்யுங்கள்.':'Publish opportunities from your verified Business identity and manage applicants, private conversations, and interviews.'}</p>{!workspace.business.verified?<div className={`${styles.alert} ${styles.error}`}>Verify your business before publishing an open job.</div>:null}</section>
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

    <section className={styles.section}><h2>{ta?'Job Postings':'Job postings'}</h2>{!workspace.jobs.length?<div className={styles.empty}>No job postings yet.</div>:workspace.jobs.map((job)=>{const applicants=workspace.applications.filter((application)=>application.job_posting_id===job.id);return <article className={styles.card} key={job.id}><div className={styles.row}><div><h3>{job.title}</h3><div className={styles.muted}>{label(job.employment_type)} · {label(job.workplace_type)}{job.location?` · ${job.location}`:''}</div></div><span className={styles.status}>{label(job.status)}</span></div><p>{job.description}</p>{salary(job)?<strong>{salary(job)}</strong>:null}<div className={styles.actions}>{job.status!=='open'?<button className={styles.button} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'open'})}>Open</button>:<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'closed'})}>Close</button>}<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'filled'})}>Mark filled</button></div><div className={styles.section}><strong>{applicants.length} applicant{applicants.length===1?'':'s'}</strong>{applicants.map((application)=>{const profile=professionalsById.get(application.professional_id);const next=application.status==='submitted'?['shortlisted','interview','rejected']:application.status==='shortlisted'?['interview','rejected']:application.status==='interview'?['hired','rejected']:[];const conversation=conversationByApplication.get(application.id);const interviews=interviewsByApplication.get(application.id)??[];const latest=interviews[0];const events=eventsByApplication.get(application.id)??[];const interviewValue=interviewForm(application.id,latest);return <div className={styles.application} key={application.id}><div className={styles.row}><div><Link href={`/professionals/${application.professional_id}`}><strong>{profile?.headline||'Professional applicant'}</strong></Link><div className={styles.muted}>{profile?.service_area||''}</div></div><span className={styles.status}>{label(application.status)}</span></div>{application.cover_note?<p>{application.cover_note}</p>:null}<div className={styles.actions}>{conversation?<Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>Private message</Link>:null}{next.map((status)=><button className={`${styles.button} ${status==='rejected'?styles.danger:styles.secondary}`} disabled={saving} type="button" key={status} onClick={()=>void patch({action:'application_status',application_id:application.id,status})}>{label(status)}</button>)}</div>{application.status==='interview'?<div className={styles.applyPanel}><strong>{latest&&latest.status!=='cancelled'?'Interview schedule':'Schedule interview'}</strong>{latest?<div className={styles.muted}>Latest status: {label(latest.status)}</div>:null}<div className={styles.formGrid}><label className={styles.label}>Date & time<input className={styles.input} type="datetime-local" value={interviewValue.starts_at} onChange={(e)=>updateInterviewForm(application.id,latest,{starts_at:e.target.value})}/></label><label className={styles.label}>Duration (minutes)<input className={styles.input} type="number" min="15" max="240" value={interviewValue.duration_minutes} onChange={(e)=>updateInterviewForm(application.id,latest,{duration_minutes:e.target.value})}/></label><label className={styles.label}>Mode<select className={styles.select} value={interviewValue.mode} onChange={(e)=>updateInterviewForm(application.id,latest,{mode:e.target.value as InterviewForm['mode']})}>{['in_person','phone','video'].map((value)=><option value={value} key={value}>{label(value)}</option>)}</select></label><label className={styles.label}>Timezone<input className={styles.input} value={interviewValue.timezone} maxLength={64} onChange={(e)=>updateInterviewForm(application.id,latest,{timezone:e.target.value})}/></label><label className={styles.label}>Location<input className={styles.input} value={interviewValue.location} maxLength={300} onChange={(e)=>updateInterviewForm(application.id,latest,{location:e.target.value})}/></label><label className={styles.label}>HTTPS meeting link<input className={styles.input} type="url" value={interviewValue.meeting_url} maxLength={1000} onChange={(e)=>updateInterviewForm(application.id,latest,{meeting_url:e.target.value})}/></label><label className={`${styles.label} ${styles.wide}`}>Interview note<textarea className={styles.textarea} maxLength={2000} value={interviewValue.note} onChange={(e)=>updateInterviewForm(application.id,latest,{note:e.target.value})}/></label></div><div className={styles.actions}><button className={styles.button} disabled={saving||!interviewValue.starts_at} type="button" onClick={()=>void saveInterview(application.id,latest)}>{latest&&latest.status!=='cancelled'?'Reschedule':'Schedule interview'}</button>{latest&&latest.status!=='cancelled'?<button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void interviewMutation('PATCH',{action:'cancel',interview_id:latest.id})}>Cancel interview</button>:null}</div>{events.length?<details><summary>Interview history ({events.length})</summary><div className={styles.section}>{events.slice(0,8).map((event)=><div className={styles.muted} key={event.id}>{label(event.event_type)} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))}</div>)}</div></details>:null}</div>:null}</div>;})}</div></article>;})}</section>
  </div>;
}
