'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEmployerHiringTranslations, type EmployerHiringKey } from '../i18n/EmployerHiringTranslations';
import { EmployerApplicantResumeReview } from './EmployerApplicantResumeReview';
import { JobOfferWorkspace } from './JobOfferWorkspace';
import styles from './JobMarketplace.module.css';

type Job = { id:string; title:string; description:string; employment_type:string; workplace_type:string; location?:string|null; required_skills?:string[]|null; minimum_experience_years?:number|null; openings:number; status:string; application_deadline?:string|null; salary_min_minor?:number|null; salary_max_minor?:number|null; salary_currency:string; salary_period?:string|null };
type Application = { id:string; job_posting_id:string; professional_id:string; cover_note?:string|null; status:string; applied_at:string };
type Professional = { id:string; headline?:string|null; service_area?:string|null; verified:boolean };
type Conversation = { id:string; job_application_id:string; status:string; closed_reason?:string|null; last_message_at?:string|null };
type Interview = { id:string; job_application_id:string; starts_at:string; duration_minutes:number; timezone:string; mode:'in_person'|'phone'|'video'; location?:string|null; meeting_url?:string|null; note?:string|null; status:'scheduled'|'accepted'|'declined'|'cancelled'; created_at:string };
type InterviewEvent = { id:string; interview_id:string; job_application_id:string; event_type:string; starts_at:string; interview_status:string; created_at:string };
type Workspace = { mode:'business'; business:{id:string;name:string;verified:boolean}; jobs:Job[]; applications:Application[]; professionals:Professional[]; conversations:Conversation[]; interviews:Interview[]; interview_events:InterviewEvent[] };
type OfferWorkspace = { mode:string; offers?:Array<{id:string;status:string}> };
type InterviewForm = { starts_at:string; duration_minutes:string; timezone:string; mode:'in_person'|'phone'|'video'; location:string; meeting_url:string; note:string };
type JobForm = { title:string; description:string; employment_type:string; workplace_type:string; location:string; required_skills:string; minimum_experience_years:string; openings:string; salary_min:string; salary_max:string; salary_currency:string; salary_period:string; application_deadline:string };
type Tab = 'jobs'|'applicants'|'interviews'|'offers';

function label(value:string){ return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()); }
const localizedLabelKeys:Partial<Record<string,EmployerHiringKey>>={
  full_time:'employerHiring.employment.fullTime',
  part_time:'employerHiring.employment.partTime',
  contract:'employerHiring.employment.contract',
  freelance:'employerHiring.employment.freelance',
  internship:'employerHiring.employment.internship',
  temporary:'employerHiring.employment.temporary',
  onsite:'employerHiring.workplace.onsite',
  remote:'employerHiring.workplace.remote',
  hybrid:'employerHiring.workplace.hybrid',
  hour:'employerHiring.period.hour',
  day:'employerHiring.period.day',
  month:'employerHiring.period.month',
  year:'employerHiring.period.year',
  project:'employerHiring.period.project',
  draft:'employerHiring.jobStatus.draft',
  open:'employerHiring.jobStatus.open',
  closed:'employerHiring.jobStatus.closed',
  filled:'employerHiring.jobStatus.filled',
  submitted:'employerHiring.applicationStatus.submitted',
  shortlisted:'employerHiring.applicationStatus.shortlisted',
  interview:'employerHiring.applicationStatus.interview',
  hired:'employerHiring.applicationStatus.hired',
  rejected:'employerHiring.applicationStatus.rejected',
  withdrawn:'employerHiring.applicationStatus.withdrawn',
  scheduled:'employerHiring.interviewStatus.scheduled',
  accepted:'employerHiring.interviewStatus.accepted',
  declined:'employerHiring.interviewStatus.declined',
  cancelled:'employerHiring.interviewStatus.cancelled',
  in_person:'employerHiring.interviewMode.inPerson',
  phone:'employerHiring.interviewMode.phone',
  video:'employerHiring.interviewMode.video',
  rescheduled:'employerHiring.interviewEvent.rescheduled',
};
function localizedLabel(value:string,t:(key:EmployerHiringKey)=>string){
  const key=localizedLabelKeys[value];
  return key?t(key):label(value);
}
function salary(job:Job){
  if(job.salary_min_minor==null&&job.salary_max_minor==null) return null;
  const formatter=new Intl.NumberFormat('en-IN',{style:'currency',currency:job.salary_currency||'INR',maximumFractionDigits:0});
  const min=job.salary_min_minor==null?'':formatter.format(job.salary_min_minor/100);
  const max=job.salary_max_minor==null?'':formatter.format(job.salary_max_minor/100);
  return `${min}${min&&max?' – ':''}${max}${job.salary_period?` / ${job.salary_period}`:''}`;
}
function emptyJobForm():JobForm{
  return {title:'',description:'',employment_type:'full_time',workplace_type:'onsite',location:'',required_skills:'',minimum_experience_years:'',openings:'1',salary_min:'',salary_max:'',salary_currency:'INR',salary_period:'month',application_deadline:''};
}
function jobFormFromJob(job:Job):JobForm{
  return {
    title:job.title,
    description:job.description,
    employment_type:job.employment_type,
    workplace_type:job.workplace_type,
    location:job.location||'',
    required_skills:(job.required_skills??[]).join(', '),
    minimum_experience_years:job.minimum_experience_years==null?'':String(job.minimum_experience_years),
    openings:String(job.openings),
    salary_min:job.salary_min_minor==null?'':String(job.salary_min_minor/100),
    salary_max:job.salary_max_minor==null?'':String(job.salary_max_minor/100),
    salary_currency:job.salary_currency||'INR',
    salary_period:job.salary_period||'month',
    application_deadline:job.application_deadline||'',
  };
}
function jobPayload(form:JobForm){
  const majorToMinor=(value:string)=>value.trim()?Math.round(Number(value)*100):null;
  return {
    title:form.title,
    description:form.description,
    employment_type:form.employment_type,
    workplace_type:form.workplace_type,
    location:form.location,
    required_skills:form.required_skills.split(',').map((value)=>value.trim()).filter(Boolean),
    minimum_experience_years:form.minimum_experience_years,
    openings:form.openings,
    salary_min_minor:majorToMinor(form.salary_min),
    salary_max_minor:majorToMinor(form.salary_max),
    salary_currency:form.salary_currency||'INR',
    salary_period:form.salary_period||null,
    application_deadline:form.application_deadline,
  };
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
  return {starts_at:localInputDate(interview?.starts_at),duration_minutes:String(interview?.duration_minutes??30),timezone:interview?.timezone||browserTimezone(),mode:interview?.mode||'video',location:interview?.location||'',meeting_url:interview?.meeting_url||'',note:interview?.note||''};
}

function JobTermsFields({value,onChange,t}:{value:JobForm;onChange:(patch:Partial<JobForm>)=>void;t:(key:EmployerHiringKey)=>string}){
  const skillPreview=value.required_skills.split(',').map((item)=>item.trim()).filter(Boolean).slice(0,8);
  return <>
    <div className={styles.formSection}><h3>{t('employerHiring.terms.basics')}</h3><div className={styles.formGrid}>
      <label className={`${styles.label} ${styles.wide}`}>{t('employerHiring.terms.title')}<input className={styles.input} value={value.title} maxLength={180} placeholder={t('employerHiring.terms.titlePlaceholder')} onChange={(e)=>onChange({title:e.target.value})}/></label>
      <label className={`${styles.label} ${styles.wide}`}>{t('employerHiring.terms.description')}<textarea className={styles.textarea} value={value.description} maxLength={5000} placeholder={t('employerHiring.terms.descriptionPlaceholder')} onChange={(e)=>onChange({description:e.target.value})}/></label>
      <label className={styles.label}>{t('employerHiring.terms.employment')}<select className={styles.select} value={value.employment_type} onChange={(e)=>onChange({employment_type:e.target.value})}>{['full_time','part_time','contract','freelance','internship','temporary'].map((item)=><option value={item} key={item}>{localizedLabel(item,t)}</option>)}</select></label>
      <label className={styles.label}>{t('employerHiring.terms.workplace')}<select className={styles.select} value={value.workplace_type} onChange={(e)=>onChange({workplace_type:e.target.value})}>{['onsite','remote','hybrid'].map((item)=><option value={item} key={item}>{localizedLabel(item,t)}</option>)}</select></label>
      <label className={styles.label}>{t('employerHiring.terms.location')}<input className={styles.input} value={value.location} maxLength={180} placeholder={t('employerHiring.terms.locationPlaceholder')} onChange={(e)=>onChange({location:e.target.value})}/></label>
    </div></div>
    <div className={styles.formSection}><h3>{t('employerHiring.terms.requirements')}</h3><div className={styles.formGrid}>
      <label className={`${styles.label} ${styles.wide}`}>{t('employerHiring.terms.requiredSkills')}<input className={styles.input} value={value.required_skills} placeholder={t('employerHiring.terms.skillsPlaceholder')} onChange={(e)=>onChange({required_skills:e.target.value})}/>{skillPreview.length?<span className={styles.skillPreview}>{skillPreview.map((skill)=><span className={styles.pill} key={skill}>{skill}</span>)}</span>:<span className={styles.fieldHint}>{t('employerHiring.terms.skillsHint')}</span>}</label>
      <label className={styles.label}>{t('employerHiring.terms.minExperience')}<input className={styles.input} type="number" min="0" max="50" value={value.minimum_experience_years} placeholder="0" onChange={(e)=>onChange({minimum_experience_years:e.target.value})}/></label>
      <label className={styles.label}>{t('employerHiring.terms.openings')}<input className={styles.input} type="number" min="1" max="500" value={value.openings} onChange={(e)=>onChange({openings:e.target.value})}/></label>
      <label className={styles.label}>{t('employerHiring.terms.deadline')}<input className={styles.input} type="date" value={value.application_deadline} onChange={(e)=>onChange({application_deadline:e.target.value})}/></label>
    </div></div>
    <div className={styles.formSection}><h3>{t('employerHiring.terms.compensation')}</h3><p className={styles.fieldHint}>{t('employerHiring.terms.compensationHint')}</p><div className={styles.formGrid}>
      <label className={styles.label}>{t('employerHiring.terms.from')} ({value.salary_currency})<input className={styles.input} type="number" min="0" value={value.salary_min} placeholder="25000" onChange={(e)=>onChange({salary_min:e.target.value})}/></label>
      <label className={styles.label}>{t('employerHiring.terms.to')} ({value.salary_currency})<input className={styles.input} type="number" min="0" value={value.salary_max} placeholder="35000" onChange={(e)=>onChange({salary_max:e.target.value})}/></label>
      <label className={styles.label}>{t('employerHiring.terms.period')}<select className={styles.select} value={value.salary_period} onChange={(e)=>onChange({salary_period:e.target.value})}>{['hour','day','month','year','project'].map((item)=><option value={item} key={item}>{localizedLabel(item,t)}</option>)}</select></label>
    </div></div>
  </>;
}

export function EmployerHiringWorkspace(){
  const { locale,t }=useEmployerHiringTranslations();
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState<{tone:'error'|'success';text:string}|null>(null);
  const [activeTab,setActiveTab]=useState<Tab>('jobs');
  const [showCreate,setShowCreate]=useState(false);
  const [editingJobId,setEditingJobId]=useState<string|null>(null);
  const [pendingOffers,setPendingOffers]=useState(0);
  const [interviewForms,setInterviewForms]=useState<Record<string,InterviewForm>>({});
  const [form,setForm]=useState<JobForm>(emptyJobForm);
  const [editForm,setEditForm]=useState<JobForm>(emptyJobForm);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [workspaceResponse,offerResponse]=await Promise.all([
        fetch('/api/provider/job-marketplace',{cache:'no-store'}),
        fetch('/api/provider/job-offers',{cache:'no-store'}),
      ]);
      const payload=await workspaceResponse.json() as Workspace & {error?:string};
      if(!workspaceResponse.ok) throw new Error(payload.error||t('employerHiring.loadFallback'));
      if(payload.mode!=='business') throw new Error(t('employerHiring.unavailable'));
      setWorkspace(payload);
      if(offerResponse.ok){
        const offers=await offerResponse.json() as OfferWorkspace;
        setPendingOffers((offers.offers??[]).filter((offer)=>offer.status==='pending').length);
      }
    }catch(error){
      setMessage({tone:'error',text:error instanceof Error?error.message:t('employerHiring.loadFallback')});
    }finally{setLoading(false);}
  },[t]);
  useEffect(()=>{void load();},[load]);

  const jobsById=useMemo(()=>new Map((workspace?.jobs??[]).map((job)=>[job.id,job])),[workspace]);
  const professionalsById=useMemo(()=>new Map((workspace?.professionals??[]).map((profile)=>[profile.id,profile])),[workspace]);
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

  const openJobs=workspace?.jobs.filter((job)=>job.status==='open').length??0;
  const applications=workspace?.applications.length??0;
  const upcomingInterviews=workspace?.interviews.filter((interview)=>['scheduled','accepted'].includes(interview.status)&&new Date(interview.starts_at).getTime()>=Date.now()).length??0;

  async function createJob(status:'draft'|'open'){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...jobPayload(form),status})});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||t('employerHiring.createFallback'));
      setForm(emptyJobForm());
      setShowCreate(false);
      setMessage({tone:'success',text:status==='open'?t('employerHiring.job.published'):t('employerHiring.job.draftSaved')});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:t('employerHiring.createFallback')});}
    finally{setSaving(false);}
  }

  async function saveJobEdit(jobId:string){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/jobs',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({job_id:jobId,...jobPayload(editForm)})});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||t('employerHiring.updateJobFallback'));
      setEditingJobId(null);
      setMessage({tone:'success',text:t('employerHiring.job.updated')});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:t('employerHiring.updateJobFallback')});}
    finally{setSaving(false);}
  }

  async function patch(body:Record<string,unknown>){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-marketplace',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||t('employerHiring.updateFallback'));
      setMessage({tone:'success',text:t('employerHiring.update.completed')});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:t('employerHiring.updateFallback')});}
    finally{setSaving(false);}
  }

  async function interviewMutation(method:'POST'|'PATCH',body:Record<string,unknown>){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-interviews',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||t('employerHiring.interviewFallback'));
      setMessage({tone:'success',text:t('employerHiring.interview.updated')});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:t('employerHiring.interviewFallback')});}
    finally{setSaving(false);}
  }

  function interviewForm(applicationId:string,latest?:Interview){return interviewForms[applicationId]??formFromInterview(latest);}
  function updateInterviewForm(applicationId:string,latest:Interview|undefined,patchValue:Partial<InterviewForm>){
    setInterviewForms((current)=>({...current,[applicationId]:{...(current[applicationId]??formFromInterview(latest)),...patchValue}}));
  }
  async function saveInterview(applicationId:string,latest?:Interview){
    const value=interviewForm(applicationId,latest);
    const body={application_id:applicationId,starts_at:value.starts_at,duration_minutes:value.duration_minutes,timezone:value.timezone,mode:value.mode,location:value.location,meeting_url:value.meeting_url,note:value.note};
    if(latest&&latest.status!=='cancelled') await interviewMutation('PATCH',{action:'reschedule',interview_id:latest.id,...body});
    else await interviewMutation('POST',body);
  }

  if(loading&&!workspace) return <div className={styles.empty}>{t('employerHiring.loading')}</div>;
  if(!workspace) return <div className={styles.page}>{message?<div className={`${styles.alert} ${styles.error}`}>{message.text}</div>:null}</div>;

  const tabs:Array<{id:Tab;label:string;count:number}>=[
    {id:'jobs',label:t('employerHiring.tabs.jobs'),count:workspace.jobs.length},
    {id:'applicants',label:t('employerHiring.tabs.applicants'),count:applications},
    {id:'interviews',label:t('employerHiring.tabs.interviews'),count:upcomingInterviews},
    {id:'offers',label:t('employerHiring.tabs.offers'),count:pendingOffers},
  ];

  return <div className={styles.page}>
    <section className={`${styles.hero} ${styles.hiringHero}`}>
      <div className={styles.heroMain}>
        <span className={styles.eyebrow}>{t('employerHiring.hero.eyebrow')}</span>
        <h1>{t('employerHiring.hero.title')}</h1>
        <p className={styles.muted}>{t('employerHiring.hero.intro')}</p>
      </div>
      <div className={styles.heroActions}>
        <Link className={`${styles.button} ${styles.secondary}`} href="/jobs">{t('employerHiring.hero.viewPublicJobs')}</Link>
        <button className={styles.button} type="button" onClick={()=>{setActiveTab('jobs');setEditingJobId(null);setShowCreate((value)=>!value);}}>{showCreate?t('employerHiring.hero.closeForm'):t('employerHiring.hero.createJob')}</button>
      </div>
      {!workspace.business.verified?<div className={`${styles.alert} ${styles.error}`}>{t('employerHiring.hero.verifyBusiness')}</div>:null}
    </section>

    <section className={styles.statsGrid} aria-label={t('employerHiring.overview.aria')}>
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('jobs')}><span>{t('employerHiring.overview.openJobs')}</span><strong>{openJobs}</strong><small>{t('employerHiring.overview.liveOpportunities')}</small></button>
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('applicants')}><span>{t('employerHiring.overview.applicants')}</span><strong>{applications}</strong><small>{t('employerHiring.overview.acrossAllJobs')}</small></button>
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('interviews')}><span>{t('employerHiring.overview.upcomingInterviews')}</span><strong>{upcomingInterviews}</strong><small>{t('employerHiring.overview.scheduledAccepted')}</small></button>
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('offers')}><span>{t('employerHiring.overview.pendingOffers')}</span><strong>{pendingOffers}</strong><small>{t('employerHiring.overview.awaitingDecision')}</small></button>
    </section>

    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}

    <nav className={styles.workspaceTabs} aria-label={t('employerHiring.tabs.aria')}>
      {tabs.map((tab)=><button key={tab.id} className={`${styles.tabButton} ${activeTab===tab.id?styles.tabActive:''}`} type="button" onClick={()=>setActiveTab(tab.id)}><span>{tab.label}</span><span className={styles.tabCount}>{tab.count}</span></button>)}
    </nav>

    {activeTab==='jobs'?<section className={styles.section}>
      {showCreate?<div className={`${styles.card} ${styles.createCard}`}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{t('employerHiring.create.eyebrow')}</span><h2>{t('employerHiring.create.title')}</h2><p className={styles.muted}>{t('employerHiring.create.intro')}</p></div></div>
        <JobTermsFields value={form} onChange={(value)=>setForm((current)=>({...current,...value}))} t={t}/>
        <div className={`${styles.actions} ${styles.formActions}`}><button className={`${styles.button} ${styles.secondary}`} disabled={saving||!form.title.trim()||!form.description.trim()} type="button" onClick={()=>void createJob('draft')}>{t('employerHiring.create.saveDraft')}</button><button className={styles.button} disabled={saving||!workspace.business.verified||!form.title.trim()||!form.description.trim()} type="button" onClick={()=>void createJob('open')}>{saving?t('employerHiring.common.saving'):t('employerHiring.create.publish')}</button></div>
      </div>:null}

      <div className={styles.sectionHeading}><div><h2>{t('employerHiring.jobs.title')}</h2><p className={styles.muted}>{t('employerHiring.jobs.intro')}</p></div>{!showCreate?<button className={styles.button} type="button" onClick={()=>{setEditingJobId(null);setShowCreate(true);}}>+ {t('employerHiring.jobs.create')}</button>:null}</div>
      {!workspace.jobs.length?<div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>＋</span><strong>{t('employerHiring.jobs.emptyTitle')}</strong><span>{t('employerHiring.jobs.emptyBody')}</span><button className={styles.button} type="button" onClick={()=>{setEditingJobId(null);setShowCreate(true);}}>{t('employerHiring.jobs.create')}</button></div>:<div className={styles.jobList}>{workspace.jobs.map((job)=>{const applicantsForJob=workspace.applications.filter((application)=>application.job_posting_id===job.id);const editable=applicantsForJob.length===0;return <article className={styles.jobCard} key={job.id}>
        <div className={styles.row}><div><div className={styles.meta}><span className={`${styles.statusPill} ${styles[`status_${job.status}`]??''}`}>{localizedLabel(job.status,t)}</span><span className={styles.pill}>{localizedLabel(job.employment_type,t)}</span><span className={styles.pill}>{localizedLabel(job.workplace_type,t)}</span></div><h3>{job.title}</h3><p className={styles.muted}>{job.description}</p></div><div className={styles.jobMetric}><strong>{applicantsForJob.length}</strong><span>{t('employerHiring.jobs.applicants')}</span></div></div>
        <div className={styles.jobFacts}>{job.location?<span>⌖ {job.location}</span>:null}{salary(job)?<span>₹ {salary(job)?.replace('₹','').trim()}</span>:null}<span>◉ {job.openings} {t(job.openings===1?'employerHiring.jobs.opening':'employerHiring.jobs.openings')}</span>{job.application_deadline?<span>⌛ {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString(locale)}</span>:null}</div>
        {job.required_skills?.length?<div className={styles.meta}>{job.required_skills.slice(0,8).map((skill)=><span className={styles.pill} key={skill}>{skill}</span>)}</div>:null}
        {!editable?<div className={styles.fieldHint}>{t('employerHiring.jobs.locked')}</div>:null}
        {editingJobId===job.id?<div className={styles.formSection}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{t('employerHiring.jobs.noApplicants')}</span><h3>{t('employerHiring.jobs.editTitle')}</h3><p className={styles.muted}>{t('employerHiring.jobs.editIntro')}</p></div></div>
          <JobTermsFields value={editForm} onChange={(value)=>setEditForm((current)=>({...current,...value}))} t={t}/>
          <div className={`${styles.actions} ${styles.formActions}`}><button className={`${styles.button} ${styles.secondary}`} disabled={saving} type="button" onClick={()=>setEditingJobId(null)}>{t('employerHiring.jobs.cancel')}</button><button className={styles.button} disabled={saving||!editForm.title.trim()||!editForm.description.trim()} type="button" onClick={()=>void saveJobEdit(job.id)}>{saving?t('employerHiring.common.saving'):t('employerHiring.jobs.saveChanges')}</button></div>
        </div>:null}
        <div className={styles.actions}>{editable?<button className={`${styles.button} ${styles.secondary}`} disabled={saving} type="button" onClick={()=>{setShowCreate(false);setEditingJobId(job.id);setEditForm(jobFormFromJob(job));setMessage(null);}}>{t('employerHiring.jobs.edit')}</button>:null}{job.status!=='open'?<button className={styles.button} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'open'})}>{t('employerHiring.jobs.publishReopen')}</button>:<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'closed'})}>{t('employerHiring.jobs.close')}</button>}<button className={`${styles.button} ${styles.secondary}`} type="button" onClick={()=>setActiveTab('applicants')}>{t('employerHiring.jobs.viewApplicants')}</button><button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'filled'})}>{t('employerHiring.jobs.markFilled')}</button></div>
      </article>;})}</div>}
    </section>:null}

    {activeTab==='applicants'?<section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>{t('employerHiring.applicants.title')}</h2><p className={styles.muted}>{t('employerHiring.applicants.intro')}</p></div></div>
      {!workspace.applications.length?<div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>◎</span><strong>{t('employerHiring.applicants.emptyTitle')}</strong><span>{t('employerHiring.applicants.emptyBody')}</span></div>:<div className={styles.jobList}>{workspace.applications.map((application)=>{const job=jobsById.get(application.job_posting_id);const profile=professionalsById.get(application.professional_id);const conversation=conversationByApplication.get(application.id);const next=application.status==='submitted'?['shortlisted','interview','rejected']:application.status==='shortlisted'?['interview','rejected']:application.status==='interview'?['rejected']:[];return <article className={styles.jobCard} key={application.id}>
        <div className={styles.row}><div><Link href={`/professionals/${application.professional_id}`} className={styles.profileLink}><strong>{profile?.headline||t('employerHiring.applicants.professionalFallback')}</strong></Link><div className={styles.muted}>{profile?.service_area||''}</div><div className={styles.muted}>{job?.title??t('employerHiring.applicants.jobFallback')} · {t('employerHiring.applicants.applied')} {new Date(application.applied_at).toLocaleDateString(locale)}</div></div><span className={styles.statusPill}>{localizedLabel(application.status,t)}</span></div>
        {application.cover_note?<p>{application.cover_note}</p>:null}
        <div className={styles.actions}>{conversation?<Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>{t('employerHiring.applicants.privateMessage')}</Link>:null}{next.map((status)=><button className={`${styles.button} ${status==='rejected'?styles.danger:styles.secondary}`} disabled={saving} type="button" key={status} onClick={()=>void patch({action:'application_status',application_id:application.id,status})}>{localizedLabel(status,t)}</button>)}</div>
      </article>;})}</div>}
      <EmployerApplicantResumeReview />
    </section>:null}

    {activeTab==='interviews'?<section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>{t('employerHiring.interviews.title')}</h2><p className={styles.muted}>{t('employerHiring.interviews.intro')}</p></div></div>
      {!workspace.applications.some((application)=>application.status==='interview')?<div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>◷</span><strong>{t('employerHiring.interviews.emptyTitle')}</strong><span>{t('employerHiring.interviews.emptyBody')}</span></div>:<div className={styles.jobList}>{workspace.applications.filter((application)=>application.status==='interview').map((application)=>{const job=jobsById.get(application.job_posting_id);const profile=professionalsById.get(application.professional_id);const interviews=interviewsByApplication.get(application.id)??[];const latest=interviews[0];const events=eventsByApplication.get(application.id)??[];const value=interviewForm(application.id,latest);return <article className={styles.jobCard} key={application.id}>
        <div className={styles.row}><div><h3>{profile?.headline||t('employerHiring.applicants.professionalFallback')}</h3><div className={styles.muted}>{job?.title??t('employerHiring.applicants.jobFallback')}</div></div>{latest?<span className={styles.statusPill}>{localizedLabel(latest.status,t)}</span>:<span className={styles.statusPill}>{t('employerHiring.interviews.notScheduled')}</span>}</div>
        <div className={styles.formGrid}><label className={styles.label}>{t('employerHiring.interviews.dateTime')}<input className={styles.input} type="datetime-local" value={value.starts_at} onChange={(e)=>updateInterviewForm(application.id,latest,{starts_at:e.target.value})}/></label><label className={styles.label}>{t('employerHiring.interviews.duration')}<input className={styles.input} type="number" min="15" max="240" value={value.duration_minutes} onChange={(e)=>updateInterviewForm(application.id,latest,{duration_minutes:e.target.value})}/></label><label className={styles.label}>{t('employerHiring.interviews.mode')}<select className={styles.select} value={value.mode} onChange={(e)=>updateInterviewForm(application.id,latest,{mode:e.target.value as InterviewForm['mode']})}>{['in_person','phone','video'].map((mode)=><option value={mode} key={mode}>{localizedLabel(mode,t)}</option>)}</select></label><label className={styles.label}>{t('employerHiring.interviews.timezone')}<input className={styles.input} value={value.timezone} maxLength={64} onChange={(e)=>updateInterviewForm(application.id,latest,{timezone:e.target.value})}/></label><label className={styles.label}>{t('employerHiring.interviews.location')}<input className={styles.input} value={value.location} maxLength={300} onChange={(e)=>updateInterviewForm(application.id,latest,{location:e.target.value})}/></label><label className={styles.label}>{t('employerHiring.interviews.meetingLink')}<input className={styles.input} type="url" value={value.meeting_url} maxLength={1000} onChange={(e)=>updateInterviewForm(application.id,latest,{meeting_url:e.target.value})}/></label><label className={`${styles.label} ${styles.wide}`}>{t('employerHiring.interviews.note')}<textarea className={styles.textarea} maxLength={2000} value={value.note} onChange={(e)=>updateInterviewForm(application.id,latest,{note:e.target.value})}/></label></div>
        <div className={styles.actions}><button className={styles.button} disabled={saving||!value.starts_at} type="button" onClick={()=>void saveInterview(application.id,latest)}>{latest&&latest.status!=='cancelled'?t('employerHiring.interviews.reschedule'):t('employerHiring.interviews.schedule')}</button>{latest&&latest.status!=='cancelled'?<button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void interviewMutation('PATCH',{action:'cancel',interview_id:latest.id})}>{t('employerHiring.interviews.cancel')}</button>:null}</div>
        {events.length?<details className={styles.history}><summary>{t('employerHiring.interviews.history')} ({events.length})</summary><div className={styles.section}>{events.slice(0,8).map((event)=><div className={styles.muted} key={event.id}>{localizedLabel(event.event_type,t)} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))}</div>)}</div></details>:null}
      </article>;})}</div>}
    </section>:null}

    {activeTab==='offers'?<section className={styles.section}><JobOfferWorkspace /></section>:null}
  </div>;
}
