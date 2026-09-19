'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProviderJobMarketplaceTranslations, type ProviderJobMarketplaceKey } from '../i18n/ProviderJobMarketplaceTranslations';
import { ApplicationWithdrawalControl } from './ApplicationWithdrawalControl';
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

function fallbackLabel(value:string){ return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()); }
const localizedLabelKeys:Partial<Record<string,ProviderJobMarketplaceKey>>={
  full_time:'providerJobMarketplace.employment.fullTime',
  part_time:'providerJobMarketplace.employment.partTime',
  contract:'providerJobMarketplace.employment.contract',
  freelance:'providerJobMarketplace.employment.freelance',
  internship:'providerJobMarketplace.employment.internship',
  temporary:'providerJobMarketplace.employment.temporary',
  onsite:'providerJobMarketplace.workplace.onsite',
  remote:'providerJobMarketplace.workplace.remote',
  hybrid:'providerJobMarketplace.workplace.hybrid',
  hour:'providerJobMarketplace.period.hour',
  day:'providerJobMarketplace.period.day',
  month:'providerJobMarketplace.period.month',
  year:'providerJobMarketplace.period.year',
  project:'providerJobMarketplace.period.project',
  draft:'providerJobMarketplace.jobStatus.draft',
  open:'providerJobMarketplace.jobStatus.open',
  closed:'providerJobMarketplace.jobStatus.closed',
  filled:'providerJobMarketplace.jobStatus.filled',
  submitted:'providerJobMarketplace.applicationStatus.submitted',
  shortlisted:'providerJobMarketplace.applicationStatus.shortlisted',
  interview:'providerJobMarketplace.applicationStatus.interview',
  hired:'providerJobMarketplace.applicationStatus.hired',
  rejected:'providerJobMarketplace.applicationStatus.rejected',
  withdrawn:'providerJobMarketplace.applicationStatus.withdrawn',
  scheduled:'providerJobMarketplace.interviewStatus.scheduled',
  accepted:'providerJobMarketplace.interviewStatus.accepted',
  declined:'providerJobMarketplace.interviewStatus.declined',
  cancelled:'providerJobMarketplace.interviewStatus.cancelled',
  in_person:'providerJobMarketplace.interviewMode.inPerson',
  phone:'providerJobMarketplace.interviewMode.phone',
  video:'providerJobMarketplace.interviewMode.video',
  rescheduled:'providerJobMarketplace.interviewEvent.rescheduled',
};
function localizedLabel(value:string,t:(key:ProviderJobMarketplaceKey)=>string){
  const key=localizedLabelKeys[value];
  return key?t(key):fallbackLabel(value);
}
function salary(job:Job,t:(key:ProviderJobMarketplaceKey)=>string){
  if(job.salary_min_minor==null&&job.salary_max_minor==null) return null;
  const f=new Intl.NumberFormat('en-IN',{style:'currency',currency:job.salary_currency||'INR',maximumFractionDigits:0});
  const min=job.salary_min_minor==null?'':f.format(job.salary_min_minor/100);
  const max=job.salary_max_minor==null?'':f.format(job.salary_max_minor/100);
  return `${min}${min&&max?' – ':''}${max}${job.salary_period?` / ${localizedLabel(job.salary_period,t)}`:''}`;
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
  const { locale,t } = useProviderJobMarketplaceTranslations();
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
      if(!response.ok) throw new Error(payload.error||t('providerJobMarketplace.loadFallback'));
      setWorkspace(payload);
    }catch(error){ setMessage({tone:'error',text:error instanceof Error?error.message:t('providerJobMarketplace.loadFallback')}); }
    finally{ setLoading(false); }
  },[t]);
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
      if(!response.ok) throw new Error(payload.error||t('providerJobMarketplace.createFallback'));
      setForm({title:'',description:'',employment_type:'full_time',workplace_type:'onsite',location:'',required_skills:'',minimum_experience_years:'',openings:'1',salary_min:'',salary_max:'',salary_period:'month',application_deadline:'',status:'draft'});
      setMessage({tone:'success',text:t('providerJobMarketplace.success.jobCreated')});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:t('providerJobMarketplace.createFallback')});}
    finally{setSaving(false);}
  }

  async function patch(body:Record<string,unknown>){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-marketplace',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||t('providerJobMarketplace.updateFallback'));
      setMessage({tone:'success',text:t('providerJobMarketplace.success.updated')});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:t('providerJobMarketplace.updateFallback')});}
    finally{setSaving(false);}
  }

  async function interviewMutation(method:'POST'|'PATCH',body:Record<string,unknown>){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-interviews',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||t('providerJobMarketplace.interviewFallback'));
      setMessage({tone:'success',text:t('providerJobMarketplace.success.interviewUpdated')});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:t('providerJobMarketplace.interviewFallback')});}
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

  if(loading&&!workspace) return <div className={styles.empty}>{t('providerJobMarketplace.loading')}</div>;
  if(!workspace) return <div className={styles.page}>{message?<div className={`${styles.alert} ${styles.error}`}>{message.text}</div>:null}</div>;

  if(workspace.mode==='professional') return <div className={styles.page}>
    <section className={styles.hero}><h1>{t('providerJobMarketplace.professional.title')}</h1><p className={styles.muted}>{t('providerJobMarketplace.professional.intro')}</p><div className={styles.actions}><Link className={styles.button} href="/jobs">{t('providerJobMarketplace.professional.browseJobs')}</Link><Link className={`${styles.button} ${styles.secondary}`} href="/provider/resume">{t('providerJobMarketplace.professional.resumeCareer')}</Link></div></section>
    {!workspace.professional.verified?<div className={`${styles.alert} ${styles.error}`}>{t('providerJobMarketplace.professional.verificationRequired')}</div>:null}
    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}
    <section className={styles.section}><h2>{t('providerJobMarketplace.professional.applicationsTitle')}</h2>
      {!workspace.applications.length?<div className={styles.empty}>{t('providerJobMarketplace.professional.noApplications')}</div>:workspace.applications.map((application)=>{const job=jobsById.get(application.job_posting_id);const active=['submitted','shortlisted','interview'].includes(application.status);const conversation=conversationByApplication.get(application.id);const interviews=interviewsByApplication.get(application.id)??[];const events=eventsByApplication.get(application.id)??[];return <article className={styles.card} key={application.id}><div className={styles.row}><div><h3>{job?.title??t('providerJobMarketplace.professional.jobFallback')}</h3><div className={styles.muted}>{t('providerJobMarketplace.professional.applied')} {new Date(application.applied_at).toLocaleDateString(locale)}</div></div><span className={styles.status}>{localizedLabel(application.status,t)}</span></div>{job?<div className={styles.meta}><span className={styles.pill}>{localizedLabel(job.employment_type,t)}</span><span className={styles.pill}>{localizedLabel(job.workplace_type,t)}</span>{job.location?<span className={styles.pill}>{job.location}</span>:null}</div>:null}{application.cover_note?<p>{application.cover_note}</p>:null}<div className={styles.actions}>{conversation?<Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>{t('providerJobMarketplace.professional.privateMessage')}</Link>:null}{active?<ApplicationWithdrawalControl applicationId={application.id} saving={saving} onConfirm={(applicationId)=>void patch({action:'application_status',application_id:applicationId,status:'withdrawn'})}/>:null}</div>{interviews.length?<div className={styles.section}><strong>{t('providerJobMarketplace.professional.interviews')}</strong>{interviews.map((interview)=><div className={styles.applyPanel} key={interview.id}><div className={styles.row}><div><strong>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(interview.starts_at))}</strong><div className={styles.muted}>{localizedLabel(interview.mode,t)} · {interview.duration_minutes} {t('providerJobMarketplace.professional.minutes')} · {interview.timezone}</div></div><span className={styles.status}>{localizedLabel(interview.status,t)}</span></div>{interview.location?<div>{interview.location}</div>:null}{interview.meeting_url?<a href={interview.meeting_url} target="_blank" rel="noreferrer">{t('providerJobMarketplace.professional.openMeeting')}</a>:null}{interview.note?<p>{interview.note}</p>:null}{interview.status==='scheduled'?<div className={styles.actions}><button className={styles.button} disabled={saving} onClick={()=>void interviewMutation('PATCH',{action:'respond',interview_id:interview.id,status:'accepted'})}>{t('providerJobMarketplace.professional.acceptInterview')}</button><button className={`${styles.button} ${styles.danger}`} disabled={saving} onClick={()=>void interviewMutation('PATCH',{action:'respond',interview_id:interview.id,status:'declined'})}>{t('providerJobMarketplace.professional.declineInterview')}</button></div>:null}</div>)}</div>:null}{events.length?<details><summary>{t('providerJobMarketplace.professional.interviewHistory')} ({events.length})</summary><div className={styles.section}>{events.slice(0,8).map((event)=><div className={styles.muted} key={event.id}>{localizedLabel(event.event_type,t)} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))}</div>)}</div></details>:null}</article>;})}
    </section>
  </div>;

  return <div className={styles.page}>
    <section className={styles.hero}><h1>{t('providerJobMarketplace.business.title')}</h1><p className={styles.muted}>{t('providerJobMarketplace.business.intro')}</p>{!workspace.business.verified?<div className={`${styles.alert} ${styles.error}`}>{t('providerJobMarketplace.business.verifyBeforePublish')}</div>:null}</section>
    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}
    <section className={styles.card}><h2>{t('providerJobMarketplace.business.createTitle')}</h2><div className={styles.form}>
      <div className={styles.formGrid}>
        <label className={`${styles.label} ${styles.wide}`}>{t('providerJobMarketplace.business.jobTitle')}<input className={styles.input} value={form.title} maxLength={180} onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
        <label className={`${styles.label} ${styles.wide}`}>{t('providerJobMarketplace.business.description')}<textarea className={styles.textarea} value={form.description} maxLength={5000} onChange={(e)=>setForm({...form,description:e.target.value})}/></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.employment')}<select className={styles.select} value={form.employment_type} onChange={(e)=>setForm({...form,employment_type:e.target.value})}>{['full_time','part_time','contract','freelance','internship','temporary'].map((value)=><option value={value} key={value}>{localizedLabel(value,t)}</option>)}</select></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.workplace')}<select className={styles.select} value={form.workplace_type} onChange={(e)=>setForm({...form,workplace_type:e.target.value})}>{['onsite','remote','hybrid'].map((value)=><option value={value} key={value}>{localizedLabel(value,t)}</option>)}</select></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.location')}<input className={styles.input} value={form.location} maxLength={180} onChange={(e)=>setForm({...form,location:e.target.value})}/></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.openings')}<input className={styles.input} type="number" min="1" max="500" value={form.openings} onChange={(e)=>setForm({...form,openings:e.target.value})}/></label>
        <label className={`${styles.label} ${styles.wide}`}>{t('providerJobMarketplace.business.requiredSkills')}<input className={styles.input} value={form.required_skills} onChange={(e)=>setForm({...form,required_skills:e.target.value})}/></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.minExperience')}<input className={styles.input} type="number" min="0" max="50" value={form.minimum_experience_years} onChange={(e)=>setForm({...form,minimum_experience_years:e.target.value})}/></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.deadline')}<input className={styles.input} type="date" value={form.application_deadline} onChange={(e)=>setForm({...form,application_deadline:e.target.value})}/></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.salaryFrom')} (₹)<input className={styles.input} type="number" min="0" value={form.salary_min} onChange={(e)=>setForm({...form,salary_min:e.target.value})}/></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.salaryTo')} (₹)<input className={styles.input} type="number" min="0" value={form.salary_max} onChange={(e)=>setForm({...form,salary_max:e.target.value})}/></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.salaryPeriod')}<select className={styles.select} value={form.salary_period} onChange={(e)=>setForm({...form,salary_period:e.target.value})}>{['hour','day','month','year','project'].map((value)=><option value={value} key={value}>{localizedLabel(value,t)}</option>)}</select></label>
        <label className={styles.label}>{t('providerJobMarketplace.business.initialStatus')}<select className={styles.select} value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="draft">{localizedLabel('draft',t)}</option><option value="open">{localizedLabel('open',t)}</option></select></label>
      </div><div className={styles.actions}><button className={styles.button} disabled={saving} type="button" onClick={()=>void createJob()}>{saving?t('providerJobMarketplace.business.saving'):t('providerJobMarketplace.business.createJob')}</button></div>
    </div></section>

    <section className={styles.section}><h2>{t('providerJobMarketplace.business.postingsTitle')}</h2>{!workspace.jobs.length?<div className={styles.empty}>{t('providerJobMarketplace.business.noPostings')}</div>:workspace.jobs.map((job)=>{const applicants=workspace.applications.filter((application)=>application.job_posting_id===job.id);return <article className={styles.card} key={job.id}><div className={styles.row}><div><h3>{job.title}</h3><div className={styles.muted}>{localizedLabel(job.employment_type,t)} · {localizedLabel(job.workplace_type,t)}{job.location?` · ${job.location}`:''}</div></div><span className={styles.status}>{localizedLabel(job.status,t)}</span></div><p>{job.description}</p>{salary(job,t)?<strong>{salary(job,t)}</strong>:null}<div className={styles.actions}>{job.status!=='open'?<button className={styles.button} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'open'})}>{t('providerJobMarketplace.business.open')}</button>:<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'closed'})}>{t('providerJobMarketplace.business.close')}</button>}<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'filled'})}>{t('providerJobMarketplace.business.markFilled')}</button></div><div className={styles.section}><strong>{applicants.length} {t(applicants.length===1?'providerJobMarketplace.business.applicant':'providerJobMarketplace.business.applicants')}</strong>{applicants.map((application)=>{const profile=professionalsById.get(application.professional_id);const next=application.status==='submitted'?['shortlisted','interview','rejected']:application.status==='shortlisted'?['interview','rejected']:application.status==='interview'?['rejected']:[];const conversation=conversationByApplication.get(application.id);const interviews=interviewsByApplication.get(application.id)??[];const latest=interviews[0];const events=eventsByApplication.get(application.id)??[];const interviewValue=interviewForm(application.id,latest);return <div className={styles.application} key={application.id}><div className={styles.row}><div><Link href={`/professionals/${application.professional_id}`}><strong>{profile?.headline||t('providerJobMarketplace.business.professionalFallback')}</strong></Link><div className={styles.muted}>{profile?.service_area||''}</div></div><span className={styles.status}>{localizedLabel(application.status,t)}</span></div>{application.cover_note?<p>{application.cover_note}</p>:null}<div className={styles.actions}>{conversation?<Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>{t('providerJobMarketplace.business.privateMessage')}</Link>:null}{next.map((status)=><button className={`${styles.button} ${status==='rejected'?styles.danger:styles.secondary}`} disabled={saving} type="button" key={status} onClick={()=>void patch({action:'application_status',application_id:application.id,status})}>{localizedLabel(status,t)}</button>)}</div>{application.status==='interview'?<div className={styles.applyPanel}><strong>{latest&&latest.status!=='cancelled'?t('providerJobMarketplace.business.interviewSchedule'):t('providerJobMarketplace.business.scheduleInterview')}</strong>{latest?<div className={styles.muted}>{t('providerJobMarketplace.business.latestStatus')}: {localizedLabel(latest.status,t)}</div>:null}<div className={styles.formGrid}><label className={styles.label}>{t('providerJobMarketplace.business.dateTime')}<input className={styles.input} type="datetime-local" value={interviewValue.starts_at} onChange={(e)=>updateInterviewForm(application.id,latest,{starts_at:e.target.value})}/></label><label className={styles.label}>{t('providerJobMarketplace.business.duration')}<input className={styles.input} type="number" min="15" max="240" value={interviewValue.duration_minutes} onChange={(e)=>updateInterviewForm(application.id,latest,{duration_minutes:e.target.value})}/></label><label className={styles.label}>{t('providerJobMarketplace.business.mode')}<select className={styles.select} value={interviewValue.mode} onChange={(e)=>updateInterviewForm(application.id,latest,{mode:e.target.value as InterviewForm['mode']})}>{['in_person','phone','video'].map((value)=><option value={value} key={value}>{localizedLabel(value,t)}</option>)}</select></label><label className={styles.label}>{t('providerJobMarketplace.business.timezone')}<input className={styles.input} value={interviewValue.timezone} maxLength={64} onChange={(e)=>updateInterviewForm(application.id,latest,{timezone:e.target.value})}/></label><label className={styles.label}>{t('providerJobMarketplace.business.location')}<input className={styles.input} value={interviewValue.location} maxLength={300} onChange={(e)=>updateInterviewForm(application.id,latest,{location:e.target.value})}/></label><label className={styles.label}>{t('providerJobMarketplace.business.meetingLink')}<input className={styles.input} type="url" value={interviewValue.meeting_url} maxLength={1000} onChange={(e)=>updateInterviewForm(application.id,latest,{meeting_url:e.target.value})}/></label><label className={`${styles.label} ${styles.wide}`}>{t('providerJobMarketplace.business.interviewNote')}<textarea className={styles.textarea} maxLength={2000} value={interviewValue.note} onChange={(e)=>updateInterviewForm(application.id,latest,{note:e.target.value})}/></label></div><div className={styles.actions}><button className={styles.button} disabled={saving||!interviewValue.starts_at} type="button" onClick={()=>void saveInterview(application.id,latest)}>{latest&&latest.status!=='cancelled'?t('providerJobMarketplace.business.reschedule'):t('providerJobMarketplace.business.scheduleInterview')}</button>{latest&&latest.status!=='cancelled'?<button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void interviewMutation('PATCH',{action:'cancel',interview_id:latest.id})}>{t('providerJobMarketplace.business.cancelInterview')}</button>:null}</div>{events.length?<details><summary>{t('providerJobMarketplace.business.interviewHistory')} ({events.length})</summary><div className={styles.section}>{events.slice(0,8).map((event)=><div className={styles.muted} key={event.id}>{localizedLabel(event.event_type,t)} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))}</div>)}</div></details>:null}</div>:null}</div>;})}</div></article>;})}</section>
  </div>;
}
