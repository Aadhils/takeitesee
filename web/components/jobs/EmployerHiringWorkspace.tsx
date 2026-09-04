'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { EmployerApplicantResumeReview } from './EmployerApplicantResumeReview';
import { JobOfferWorkspace } from './JobOfferWorkspace';
import styles from './JobMarketplace.module.css';

type Job = { id:string; title:string; description:string; employment_type:string; workplace_type:string; location?:string|null; required_skills?:string[]|null; openings:number; status:string; application_deadline?:string|null; salary_min_minor?:number|null; salary_max_minor?:number|null; salary_currency:string; salary_period?:string|null };
type Application = { id:string; job_posting_id:string; professional_id:string; cover_note?:string|null; status:string; applied_at:string };
type Professional = { id:string; headline?:string|null; service_area?:string|null; verified:boolean };
type Conversation = { id:string; job_application_id:string; status:string; closed_reason?:string|null; last_message_at?:string|null };
type Interview = { id:string; job_application_id:string; starts_at:string; duration_minutes:number; timezone:string; mode:'in_person'|'phone'|'video'; location?:string|null; meeting_url?:string|null; note?:string|null; status:'scheduled'|'accepted'|'declined'|'cancelled'; created_at:string };
type InterviewEvent = { id:string; interview_id:string; job_application_id:string; event_type:string; starts_at:string; interview_status:string; created_at:string };
type Workspace = { mode:'business'; business:{id:string;name:string;verified:boolean}; jobs:Job[]; applications:Application[]; professionals:Professional[]; conversations:Conversation[]; interviews:Interview[]; interview_events:InterviewEvent[] };
type OfferWorkspace = { mode:string; offers?:Array<{id:string;status:string}> };
type InterviewForm = { starts_at:string; duration_minutes:string; timezone:string; mode:'in_person'|'phone'|'video'; location:string; meeting_url:string; note:string };
type Tab = 'jobs'|'applicants'|'interviews'|'offers';

function label(value:string){ return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()); }
function salary(job:Job){
  if(job.salary_min_minor==null&&job.salary_max_minor==null) return null;
  const formatter=new Intl.NumberFormat('en-IN',{style:'currency',currency:job.salary_currency||'INR',maximumFractionDigits:0});
  const min=job.salary_min_minor==null?'':formatter.format(job.salary_min_minor/100);
  const max=job.salary_max_minor==null?'':formatter.format(job.salary_max_minor/100);
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
  return {starts_at:localInputDate(interview?.starts_at),duration_minutes:String(interview?.duration_minutes??30),timezone:interview?.timezone||browserTimezone(),mode:interview?.mode||'video',location:interview?.location||'',meeting_url:interview?.meeting_url||'',note:interview?.note||''};
}

export function EmployerHiringWorkspace(){
  const { locale }=useIdentityWorkspaceTranslations();
  const ta=locale.toLowerCase().startsWith('ta');
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState<{tone:'error'|'success';text:string}|null>(null);
  const [activeTab,setActiveTab]=useState<Tab>('jobs');
  const [showCreate,setShowCreate]=useState(false);
  const [pendingOffers,setPendingOffers]=useState(0);
  const [interviewForms,setInterviewForms]=useState<Record<string,InterviewForm>>({});
  const [form,setForm]=useState({title:'',description:'',employment_type:'full_time',workplace_type:'onsite',location:'',required_skills:'',minimum_experience_years:'',openings:'1',salary_min:'',salary_max:'',salary_period:'month',application_deadline:''});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [workspaceResponse,offerResponse]=await Promise.all([
        fetch('/api/provider/job-marketplace',{cache:'no-store'}),
        fetch('/api/provider/job-offers',{cache:'no-store'}),
      ]);
      const payload=await workspaceResponse.json() as Workspace & {error?:string};
      if(!workspaceResponse.ok) throw new Error(payload.error||'Unable to load hiring workspace.');
      if(payload.mode!=='business') throw new Error('Business hiring workspace is unavailable for this account.');
      setWorkspace(payload);
      if(offerResponse.ok){
        const offers=await offerResponse.json() as OfferWorkspace;
        setPendingOffers((offers.offers??[]).filter((offer)=>offer.status==='pending').length);
      }
    }catch(error){
      setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to load hiring workspace.'});
    }finally{setLoading(false);}
  },[]);
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
  const skillPreview=form.required_skills.split(',').map((value)=>value.trim()).filter(Boolean).slice(0,8);

  async function createJob(status:'draft'|'open'){
    setSaving(true);setMessage(null);
    try{
      const majorToMinor=(value:string)=>value.trim()?Math.round(Number(value)*100):null;
      const response=await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        title:form.title,description:form.description,employment_type:form.employment_type,workplace_type:form.workplace_type,location:form.location,
        required_skills:form.required_skills.split(',').map((value)=>value.trim()).filter(Boolean),minimum_experience_years:form.minimum_experience_years,openings:form.openings,
        salary_min_minor:majorToMinor(form.salary_min),salary_max_minor:majorToMinor(form.salary_max),salary_currency:'INR',salary_period:form.salary_period||null,application_deadline:form.application_deadline,status,
      })});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to create job.');
      setForm({title:'',description:'',employment_type:'full_time',workplace_type:'onsite',location:'',required_skills:'',minimum_experience_years:'',openings:'1',salary_min:'',salary_max:'',salary_period:'month',application_deadline:''});
      setShowCreate(false);
      setMessage({tone:'success',text:status==='open'?(ta?'Job publish செய்யப்பட்டது.':'Job published successfully.'):(ta?'Job draft save செய்யப்பட்டது.':'Job saved as draft.')});
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

  if(loading&&!workspace) return <div className={styles.empty}>{ta?'Hiring workspace ஏற்றப்படுகிறது…':'Loading hiring workspace…'}</div>;
  if(!workspace) return <div className={styles.page}>{message?<div className={`${styles.alert} ${styles.error}`}>{message.text}</div>:null}</div>;

  const tabs:Array<{id:Tab;label:string;count:number}>=[
    {id:'jobs',label:ta?'Jobs':'Jobs',count:workspace.jobs.length},
    {id:'applicants',label:ta?'Applicants':'Applicants',count:applications},
    {id:'interviews',label:ta?'Interviews':'Interviews',count:upcomingInterviews},
    {id:'offers',label:ta?'Offers':'Offers',count:pendingOffers},
  ];

  return <div className={styles.page}>
    <section className={`${styles.hero} ${styles.hiringHero}`}>
      <div className={styles.heroMain}>
        <span className={styles.eyebrow}>{ta?'Employer workspace':'Employer workspace'}</span>
        <h1>{ta?'Hiring Workspace':'Hiring workspace'}</h1>
        <p className={styles.muted}>{ta?'Jobs publish செய்து applicants, interviews மற்றும் offers அனைத்தையும் ஒரே இடத்தில் manage செய்யுங்கள்.':'Manage jobs, applicants, interviews and employment offers from one focused workspace.'}</p>
      </div>
      <div className={styles.heroActions}>
        <Link className={`${styles.button} ${styles.secondary}`} href="/jobs">{ta?'Public Jobs பார்க்க':'View public jobs'}</Link>
        <button className={styles.button} type="button" onClick={()=>{setActiveTab('jobs');setShowCreate((value)=>!value);}}>{showCreate?(ta?'Form Close':'Close form'):(ta?'+ Job உருவாக்க':'+ Create job')}</button>
      </div>
      {!workspace.business.verified?<div className={`${styles.alert} ${styles.error}`}>{ta?'Open job publish செய்ய Business verification தேவை.':'Verify your business before publishing an open job.'}</div>:null}
    </section>

    <section className={styles.statsGrid} aria-label="Hiring overview">
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('jobs')}><span>{ta?'Open Jobs':'Open jobs'}</span><strong>{openJobs}</strong><small>{ta?'Live opportunities':'Live opportunities'}</small></button>
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('applicants')}><span>{ta?'Applicants':'Applicants'}</span><strong>{applications}</strong><small>{ta?'Across all jobs':'Across all jobs'}</small></button>
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('interviews')}><span>{ta?'Upcoming Interviews':'Upcoming interviews'}</span><strong>{upcomingInterviews}</strong><small>{ta?'Scheduled / accepted':'Scheduled / accepted'}</small></button>
      <button className={styles.statCard} type="button" onClick={()=>setActiveTab('offers')}><span>{ta?'Pending Offers':'Pending offers'}</span><strong>{pendingOffers}</strong><small>{ta?'Awaiting decision':'Awaiting decision'}</small></button>
    </section>

    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}

    <nav className={styles.workspaceTabs} aria-label="Hiring workspace sections">
      {tabs.map((tab)=><button key={tab.id} className={`${styles.tabButton} ${activeTab===tab.id?styles.tabActive:''}`} type="button" onClick={()=>setActiveTab(tab.id)}><span>{tab.label}</span><span className={styles.tabCount}>{tab.count}</span></button>)}
    </nav>

    {activeTab==='jobs'?<section className={styles.section}>
      {showCreate?<div className={`${styles.card} ${styles.createCard}`}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{ta?'New opportunity':'New opportunity'}</span><h2>{ta?'Create Job':'Create a job'}</h2><p className={styles.muted}>{ta?'தேவையான தகவலை மட்டும் கொடுத்து Draft save செய்யலாம் அல்லது உடனே Publish செய்யலாம்.':'Add the essentials, then save a draft or publish when you are ready.'}</p></div></div>
        <div className={styles.formSection}><h3>{ta?'Job Basics':'Job basics'}</h3><div className={styles.formGrid}>
          <label className={`${styles.label} ${styles.wide}`}>Job title<input className={styles.input} value={form.title} maxLength={180} placeholder="e.g. Front Office Executive" onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
          <label className={`${styles.label} ${styles.wide}`}>Description<textarea className={styles.textarea} value={form.description} maxLength={5000} placeholder="Describe the role, responsibilities and ideal candidate." onChange={(e)=>setForm({...form,description:e.target.value})}/></label>
          <label className={styles.label}>Employment<select className={styles.select} value={form.employment_type} onChange={(e)=>setForm({...form,employment_type:e.target.value})}>{['full_time','part_time','contract','freelance','internship','temporary'].map((value)=><option value={value} key={value}>{label(value)}</option>)}</select></label>
          <label className={styles.label}>Workplace<select className={styles.select} value={form.workplace_type} onChange={(e)=>setForm({...form,workplace_type:e.target.value})}>{['onsite','remote','hybrid'].map((value)=><option value={value} key={value}>{label(value)}</option>)}</select></label>
          <label className={styles.label}>Location<input className={styles.input} value={form.location} maxLength={180} placeholder="Trichy, Tamil Nadu" onChange={(e)=>setForm({...form,location:e.target.value})}/></label>
        </div></div>
        <div className={styles.formSection}><h3>{ta?'Requirements':'Requirements'}</h3><div className={styles.formGrid}>
          <label className={`${styles.label} ${styles.wide}`}>Required skills<input className={styles.input} value={form.required_skills} placeholder="Communication, Excel, Customer service" onChange={(e)=>setForm({...form,required_skills:e.target.value})}/>{skillPreview.length?<span className={styles.skillPreview}>{skillPreview.map((skill)=><span className={styles.pill} key={skill}>{skill}</span>)}</span>:<span className={styles.fieldHint}>Separate skills with commas.</span>}</label>
          <label className={styles.label}>Min. experience<input className={styles.input} type="number" min="0" max="50" value={form.minimum_experience_years} placeholder="0" onChange={(e)=>setForm({...form,minimum_experience_years:e.target.value})}/></label>
          <label className={styles.label}>Openings<input className={styles.input} type="number" min="1" max="500" value={form.openings} onChange={(e)=>setForm({...form,openings:e.target.value})}/></label>
          <label className={styles.label}>Application deadline<input className={styles.input} type="date" value={form.application_deadline} onChange={(e)=>setForm({...form,application_deadline:e.target.value})}/></label>
        </div></div>
        <div className={styles.formSection}><h3>{ta?'Compensation':'Compensation'}</h3><p className={styles.fieldHint}>{ta?'Salary தகவல் informational employment term மட்டும்.':'Salary information is an employment term only.'}</p><div className={styles.formGrid}>
          <label className={styles.label}>From (₹)<input className={styles.input} type="number" min="0" value={form.salary_min} placeholder="25000" onChange={(e)=>setForm({...form,salary_min:e.target.value})}/></label>
          <label className={styles.label}>To (₹)<input className={styles.input} type="number" min="0" value={form.salary_max} placeholder="35000" onChange={(e)=>setForm({...form,salary_max:e.target.value})}/></label>
          <label className={styles.label}>Period<select className={styles.select} value={form.salary_period} onChange={(e)=>setForm({...form,salary_period:e.target.value})}>{['hour','day','month','year','project'].map((value)=><option value={value} key={value}>{label(value)}</option>)}</select></label>
        </div></div>
        <div className={`${styles.actions} ${styles.formActions}`}><button className={`${styles.button} ${styles.secondary}`} disabled={saving||!form.title.trim()||!form.description.trim()} type="button" onClick={()=>void createJob('draft')}>{ta?'Draft Save':'Save draft'}</button><button className={styles.button} disabled={saving||!workspace.business.verified||!form.title.trim()||!form.description.trim()} type="button" onClick={()=>void createJob('open')}>{saving?(ta?'Saving…':'Saving…'):(ta?'Publish Job':'Publish job')}</button></div>
      </div>:null}

      <div className={styles.sectionHeading}><div><h2>{ta?'Job Postings':'Job postings'}</h2><p className={styles.muted}>{ta?'உங்கள் active, draft மற்றும் closed jobs அனைத்தையும் இங்கே manage செய்யலாம்.':'Manage active, draft and closed opportunities here.'}</p></div>{!showCreate?<button className={styles.button} type="button" onClick={()=>setShowCreate(true)}>+ {ta?'Create Job':'Create job'}</button>:null}</div>
      {!workspace.jobs.length?<div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>＋</span><strong>{ta?'முதல் Job உருவாக்குங்கள்':'Create your first job'}</strong><span>{ta?'Job publish செய்த பிறகு applicants இந்த workspace-ல் வரத் தொடங்குவார்கள்.':'Publish an opportunity and applicants will start appearing in this workspace.'}</span><button className={styles.button} type="button" onClick={()=>setShowCreate(true)}>{ta?'Create Job':'Create job'}</button></div>:<div className={styles.jobList}>{workspace.jobs.map((job)=>{const applicantsForJob=workspace.applications.filter((application)=>application.job_posting_id===job.id);return <article className={styles.jobCard} key={job.id}>
        <div className={styles.row}><div><div className={styles.meta}><span className={`${styles.statusPill} ${styles[`status_${job.status}`]??''}`}>{label(job.status)}</span><span className={styles.pill}>{label(job.employment_type)}</span><span className={styles.pill}>{label(job.workplace_type)}</span></div><h3>{job.title}</h3><p className={styles.muted}>{job.description}</p></div><div className={styles.jobMetric}><strong>{applicantsForJob.length}</strong><span>{ta?'Applicants':'Applicants'}</span></div></div>
        <div className={styles.jobFacts}>{job.location?<span>⌖ {job.location}</span>:null}{salary(job)?<span>₹ {salary(job)?.replace('₹','').trim()}</span>:null}<span>◉ {job.openings} {job.openings===1?'opening':'openings'}</span>{job.application_deadline?<span>⌛ {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString(locale)}</span>:null}</div>
        {job.required_skills?.length?<div className={styles.meta}>{job.required_skills.slice(0,8).map((skill)=><span className={styles.pill} key={skill}>{skill}</span>)}</div>:null}
        <div className={styles.actions}>{job.status!=='open'?<button className={styles.button} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'open'})}>{ta?'Publish / Reopen':'Publish / reopen'}</button>:<button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'closed'})}>{ta?'Close':'Close'}</button>}<button className={`${styles.button} ${styles.secondary}`} type="button" onClick={()=>setActiveTab('applicants')}>{ta?'Applicants பார்க்க':'View applicants'}</button><button className={`${styles.button} ${styles.secondary}`} disabled={saving} onClick={()=>void patch({action:'job_status',job_id:job.id,status:'filled'})}>{ta?'Filled':'Mark filled'}</button></div>
      </article>;})}</div>}
    </section>:null}

    {activeTab==='applicants'?<section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>{ta?'Applicants':'Applicants'}</h2><p className={styles.muted}>{ta?'Profile, application stage மற்றும் conversation context பார்த்து candidates manage செய்யுங்கள்.':'Review candidate context and move applicants through a clear hiring pipeline.'}</p></div></div>
      {!workspace.applications.length?<div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>◎</span><strong>{ta?'Applicants இன்னும் இல்லை':'No applicants yet'}</strong><span>{ta?'Open jobs publish ஆன பிறகு applications இங்கே வரும்.':'Applications will appear here when professionals apply to your open jobs.'}</span></div>:<div className={styles.jobList}>{workspace.applications.map((application)=>{const job=jobsById.get(application.job_posting_id);const profile=professionalsById.get(application.professional_id);const conversation=conversationByApplication.get(application.id);const next=application.status==='submitted'?['shortlisted','interview','rejected']:application.status==='shortlisted'?['interview','rejected']:application.status==='interview'?['rejected']:[];return <article className={styles.jobCard} key={application.id}>
        <div className={styles.row}><div><Link href={`/professionals/${application.professional_id}`} className={styles.profileLink}><strong>{profile?.headline||'Professional applicant'}</strong></Link><div className={styles.muted}>{profile?.service_area||''}</div><div className={styles.muted}>{job?.title??'Job opportunity'} · Applied {new Date(application.applied_at).toLocaleDateString(locale)}</div></div><span className={styles.statusPill}>{label(application.status)}</span></div>
        {application.cover_note?<p>{application.cover_note}</p>:null}
        <div className={styles.actions}>{conversation?<Link className={`${styles.button} ${styles.secondary}`} href={`/provider/messages?conversation=${conversation.id}`}>{ta?'Private Message':'Private message'}</Link>:null}{next.map((status)=><button className={`${styles.button} ${status==='rejected'?styles.danger:styles.secondary}`} disabled={saving} type="button" key={status} onClick={()=>void patch({action:'application_status',application_id:application.id,status})}>{label(status)}</button>)}</div>
      </article>;})}</div>}
      <EmployerApplicantResumeReview />
    </section>:null}

    {activeTab==='interviews'?<section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>{ta?'Interviews':'Interviews'}</h2><p className={styles.muted}>{ta?'Interview-stage applicants-ன் schedules மற்றும் history manage செய்யுங்கள்.':'Schedule, reschedule and review interview activity for interview-stage applicants.'}</p></div></div>
      {!workspace.applications.some((application)=>application.status==='interview')?<div className={`${styles.empty} ${styles.emptyState}`}><span className={styles.emptyIcon}>◷</span><strong>{ta?'Interview stage applicant இல்லை':'No interview-stage applicants'}</strong><span>{ta?'Applicant-ஐ Interview stage-க்கு move செய்த பிறகு scheduling tools இங்கே வரும்.':'Move an applicant to Interview and scheduling tools will appear here.'}</span></div>:<div className={styles.jobList}>{workspace.applications.filter((application)=>application.status==='interview').map((application)=>{const job=jobsById.get(application.job_posting_id);const profile=professionalsById.get(application.professional_id);const interviews=interviewsByApplication.get(application.id)??[];const latest=interviews[0];const events=eventsByApplication.get(application.id)??[];const value=interviewForm(application.id,latest);return <article className={styles.jobCard} key={application.id}>
        <div className={styles.row}><div><h3>{profile?.headline||'Professional applicant'}</h3><div className={styles.muted}>{job?.title??'Job opportunity'}</div></div>{latest?<span className={styles.statusPill}>{label(latest.status)}</span>:<span className={styles.statusPill}>Not scheduled</span>}</div>
        <div className={styles.formGrid}><label className={styles.label}>Date & time<input className={styles.input} type="datetime-local" value={value.starts_at} onChange={(e)=>updateInterviewForm(application.id,latest,{starts_at:e.target.value})}/></label><label className={styles.label}>Duration<input className={styles.input} type="number" min="15" max="240" value={value.duration_minutes} onChange={(e)=>updateInterviewForm(application.id,latest,{duration_minutes:e.target.value})}/></label><label className={styles.label}>Mode<select className={styles.select} value={value.mode} onChange={(e)=>updateInterviewForm(application.id,latest,{mode:e.target.value as InterviewForm['mode']})}>{['in_person','phone','video'].map((mode)=><option value={mode} key={mode}>{label(mode)}</option>)}</select></label><label className={styles.label}>Timezone<input className={styles.input} value={value.timezone} maxLength={64} onChange={(e)=>updateInterviewForm(application.id,latest,{timezone:e.target.value})}/></label><label className={styles.label}>Location<input className={styles.input} value={value.location} maxLength={300} onChange={(e)=>updateInterviewForm(application.id,latest,{location:e.target.value})}/></label><label className={styles.label}>HTTPS meeting link<input className={styles.input} type="url" value={value.meeting_url} maxLength={1000} onChange={(e)=>updateInterviewForm(application.id,latest,{meeting_url:e.target.value})}/></label><label className={`${styles.label} ${styles.wide}`}>Interview note<textarea className={styles.textarea} maxLength={2000} value={value.note} onChange={(e)=>updateInterviewForm(application.id,latest,{note:e.target.value})}/></label></div>
        <div className={styles.actions}><button className={styles.button} disabled={saving||!value.starts_at} type="button" onClick={()=>void saveInterview(application.id,latest)}>{latest&&latest.status!=='cancelled'?(ta?'Reschedule':'Reschedule'):(ta?'Schedule Interview':'Schedule interview')}</button>{latest&&latest.status!=='cancelled'?<button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void interviewMutation('PATCH',{action:'cancel',interview_id:latest.id})}>{ta?'Cancel Interview':'Cancel interview'}</button>:null}</div>
        {events.length?<details className={styles.history}><summary>{ta?'Interview history':'Interview history'} ({events.length})</summary><div className={styles.section}>{events.slice(0,8).map((event)=><div className={styles.muted} key={event.id}>{label(event.event_type)} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))}</div>)}</div></details>:null}
      </article>;})}</div>}
    </section>:null}

    {activeTab==='offers'?<section className={styles.section}><JobOfferWorkspace /></section>:null}
  </div>;
}
