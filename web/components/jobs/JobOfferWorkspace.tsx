'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './JobMarketplace.module.css';

type Job = {
  id:string;
  title:string;
  employment_type:string;
  workplace_type:string;
  location?:string|null;
  salary_min_minor?:number|null;
  salary_max_minor?:number|null;
  salary_currency?:string|null;
  salary_period?:string|null;
  status:string;
};
type Application = { id:string; job_posting_id:string; professional_id:string; status:string; applied_at:string };
type Professional = { id:string; headline?:string|null; service_area?:string|null; verified:boolean };
type Offer = {
  id:string;
  job_application_id:string;
  offer_number:number;
  position_title:string;
  employment_type:string;
  workplace_type:string;
  location?:string|null;
  proposed_start_date?:string|null;
  compensation_minor?:number|null;
  compensation_currency:string;
  compensation_period?:string|null;
  response_deadline?:string|null;
  note?:string|null;
  status:'pending'|'accepted'|'declined'|'withdrawn';
  issued_at:string;
  responded_at?:string|null;
  withdrawn_at?:string|null;
};
type BusinessWorkspace = {
  mode:'business';
  business:{id:string;name:string;verified:boolean};
  jobs:Job[];
  applications:Application[];
  professionals:Professional[];
  offers:Offer[];
};
type ProfessionalWorkspace = {
  mode:'professional';
  professional:{id:string;headline?:string|null;verified:boolean};
  jobs:Job[];
  applications:Application[];
  offers:Offer[];
};
type Workspace = BusinessWorkspace | ProfessionalWorkspace;
type OfferForm = {
  position_title:string;
  employment_type:string;
  workplace_type:string;
  location:string;
  proposed_start_date:string;
  compensation_amount:string;
  compensation_currency:'INR'|'USD';
  compensation_period:'hour'|'day'|'month'|'year'|'project';
  response_deadline:string;
  note:string;
};

function label(value:string){ return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()); }
function localToday(){
  const now=new Date();
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60_000);
  return local.toISOString().slice(0,10);
}
function formForJob(job?:Job|null):OfferForm{
  const period=(job?.salary_period&&['hour','day','month','year','project'].includes(job.salary_period)?job.salary_period:'year') as OfferForm['compensation_period'];
  return {
    position_title:job?.title??'',
    employment_type:job?.employment_type??'full_time',
    workplace_type:job?.workplace_type??'onsite',
    location:job?.location??'',
    proposed_start_date:'',
    compensation_amount:'',
    compensation_currency:(job?.salary_currency==='USD'?'USD':'INR'),
    compensation_period:period,
    response_deadline:'',
    note:'',
  };
}
function money(offer:Offer){
  if(offer.compensation_minor==null) return null;
  const formatter=new Intl.NumberFormat('en-IN',{style:'currency',currency:offer.compensation_currency||'INR',maximumFractionDigits:2});
  return `${formatter.format(offer.compensation_minor/100)}${offer.compensation_period?` / ${label(offer.compensation_period).toLowerCase()}`:''}`;
}
function expired(offer:Offer){ return offer.response_deadline ? new Date(offer.response_deadline).getTime()<Date.now() : false; }

export function JobOfferWorkspace(){
  const { locale }=useIdentityWorkspaceTranslations();
  const ta=locale.toLowerCase().startsWith('ta');
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState<{tone:'error'|'success';text:string}|null>(null);
  const [forms,setForms]=useState<Record<string,OfferForm>>({});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/provider/job-offers',{cache:'no-store'});
      const payload=await response.json() as Workspace & {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to load employment offers.');
      setWorkspace(payload);
    }catch(error){
      setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to load employment offers.'});
    }finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ void load(); },[load]);

  const jobsById=useMemo(()=>new Map((workspace?.jobs??[]).map((job)=>[job.id,job])),[workspace]);
  const professionalsById=useMemo(()=>new Map((workspace?.mode==='business'?workspace.professionals:[]).map((profile)=>[profile.id,profile])),[workspace]);
  const offersByApplication=useMemo(()=>{
    const map=new Map<string,Offer[]>();
    for(const offer of workspace?.offers??[]){
      const rows=map.get(offer.job_application_id)??[];
      rows.push(offer);
      map.set(offer.job_application_id,rows);
    }
    for(const rows of map.values()) rows.sort((a,b)=>new Date(b.issued_at).getTime()-new Date(a.issued_at).getTime());
    return map;
  },[workspace]);

  function offerForm(applicationId:string,job?:Job|null){ return forms[applicationId]??formForJob(job); }
  function updateForm(applicationId:string,job:Job|undefined|null,patch:Partial<OfferForm>){
    setForms((current)=>({...current,[applicationId]:{...(current[applicationId]??formForJob(job)),...patch}}));
  }

  async function issueOffer(applicationId:string,job?:Job|null){
    const form=offerForm(applicationId,job);
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-offers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        application_id:applicationId,
        position_title:form.position_title,
        employment_type:form.employment_type,
        workplace_type:form.workplace_type,
        location:form.location,
        proposed_start_date:form.proposed_start_date,
        compensation_amount:form.compensation_amount,
        compensation_currency:form.compensation_currency,
        compensation_period:form.compensation_period,
        response_deadline:form.response_deadline,
        note:form.note,
      })});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to issue employment offer.');
      setForms((current)=>{const next={...current};delete next[applicationId];return next;});
      setMessage({tone:'success',text:ta?'Employment offer applicant-க்கு அனுப்பப்பட்டது.':'Employment offer sent to the applicant.'});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to issue employment offer.'});}
    finally{setSaving(false);}
  }

  async function mutateOffer(offerId:string,action:'respond'|'withdraw',status?:'accepted'|'declined'){
    setSaving(true);setMessage(null);
    try{
      const response=await fetch('/api/provider/job-offers',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({offer_id:offerId,action,status})});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error||'Unable to update employment offer.');
      setMessage({tone:'success',text:status==='accepted'?(ta?'Offer accept செய்யப்பட்டது. Application இப்போது Hired.':'Offer accepted. The application is now hired.'):status==='declined'?(ta?'Offer decline செய்யப்பட்டது.':'Offer declined.'):ta?'Pending offer withdraw செய்யப்பட்டது.':'Pending offer withdrawn.'});
      await load();
    }catch(error){setMessage({tone:'error',text:error instanceof Error?error.message:'Unable to update employment offer.'});}
    finally{setSaving(false);}
  }

  function offerSummary(offer:Offer){
    return <div className={styles.applyPanel} key={offer.id}>
      <div className={styles.row}><div><strong>Offer #{offer.offer_number} · {offer.position_title}</strong><div className={styles.muted}>Issued {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(offer.issued_at))}</div></div><span className={styles.status}>{expired(offer)&&offer.status==='pending'?'Expired':label(offer.status)}</span></div>
      <div className={styles.meta}><span className={styles.pill}>{label(offer.employment_type)}</span><span className={styles.pill}>{label(offer.workplace_type)}</span>{offer.location?<span className={styles.pill}>{offer.location}</span>:null}</div>
      {money(offer)?<strong>{money(offer)}</strong>:<span className={styles.muted}>{ta?'Compensation amount குறிப்பிடப்படவில்லை.':'Compensation amount not specified.'}</span>}
      {offer.proposed_start_date?<div>{ta?'Proposed start':'Proposed start'}: <strong>{new Date(`${offer.proposed_start_date}T00:00:00`).toLocaleDateString()}</strong></div>:null}
      {offer.response_deadline?<div className={styles.muted}>{ta?'Response deadline':'Response deadline'}: {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(offer.response_deadline))}</div>:null}
      {offer.note?<p>{offer.note}</p>:null}
    </div>;
  }

  if(loading&&!workspace) return <section className={styles.section}><h2>{ta?'Employment Offers':'Employment offers'}</h2><div className={styles.empty}>{ta?'Offers ஏற்றப்படுகிறது…':'Loading employment offers…'}</div></section>;
  if(!workspace) return <section className={styles.section}><h2>Employment offers</h2>{message?<div className={`${styles.alert} ${styles.error}`}>{message.text}</div>:null}</section>;

  if(workspace.mode==='professional'){
    const rows=workspace.applications.filter((application)=>(offersByApplication.get(application.id)?.length??0)>0);
    return <section className={styles.section}>
      <div><h2>{ta?'Employment Offers':'Employment offers'}</h2><p className={styles.muted}>{ta?'Employer அனுப்பிய terms-ஐ review செய்து Accept அல்லது Decline செய்யுங்கள். Accept செய்த பிறகே application Hired ஆகும்.':'Review employer-proposed terms and accept or decline. Your application becomes Hired only after you accept an offer.'}</p></div>
      <div className={styles.alert}>{ta?'இந்த compensation தகவல் employment term மட்டும். Salary/payroll transfer-ஐ TakeItEsee process செய்யாது.':'Compensation shown here is an employment term only. TakeItEsee does not process salary or payroll transfers through this offer flow.'}</div>
      {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}
      {!rows.length?<div className={styles.empty}>{ta?'இன்னும் employment offer இல்லை.':'No employment offers yet.'}</div>:rows.map((application)=>{const job=jobsById.get(application.job_posting_id);const offers=offersByApplication.get(application.id)??[];const pending=offers.find((offer)=>offer.status==='pending');return <article className={styles.card} key={application.id}>
        <div className={styles.row}><div><h3>{job?.title??'Job opportunity'}</h3><div className={styles.muted}>Application: {label(application.status)}</div></div>{pending?<span className={styles.status}>{expired(pending)?'Offer expired':'Decision required'}</span>:null}</div>
        {pending? <>
          {offerSummary(pending)}
          {expired(pending)?<div className={`${styles.alert} ${styles.error}`}>{ta?'இந்த offer deadline முடிந்துவிட்டது. Employer revised offer அனுப்ப வேண்டும்.':'This offer deadline has passed. The employer must withdraw it and issue revised terms.'}</div>:<div className={styles.actions}><button className={styles.button} disabled={saving} type="button" onClick={()=>void mutateOffer(pending.id,'respond','accepted')}>{ta?'Offer Accept':'Accept offer'}</button><button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void mutateOffer(pending.id,'respond','declined')}>{ta?'Offer Decline':'Decline offer'}</button></div>}
        </>:null}
        {offers.length>(pending?1:0)?<details><summary>{ta?'Offer history':'Offer history'} ({offers.length})</summary><div className={styles.section}>{offers.filter((offer)=>offer.id!==pending?.id).map(offerSummary)}</div></details>:null}
      </article>;})}
    </section>;
  }

  const rows=workspace.applications.filter((application)=>application.status==='interview'||application.status==='hired'||(offersByApplication.get(application.id)?.length??0)>0);
  return <section className={styles.section}>
    <div><h2>{ta?'Employment Offers':'Employment offers'}</h2><p className={styles.muted}>{ta?'Interview stage applicant-க்கு formal offer அனுப்புங்கள். Applicant Accept செய்த பிறகே Hired status finalize ஆகும்.':'Issue formal terms to an applicant in interview stage. Hired status is finalized only after applicant acceptance.'}</p></div>
    <div className={styles.alert}>{ta?'Offer compensation என்பது employment term மட்டும்; இது Cashfree/payment/payout/payroll activation அல்ல.':'Offer compensation is an employment term only; it does not activate Cashfree, payment, payout, settlement, or payroll processing.'}</div>
    {message?<div className={`${styles.alert} ${message.tone==='error'?styles.error:styles.success}`}>{message.text}</div>:null}
    {!rows.length?<div className={styles.empty}>{ta?'Offer செய்யக்கூடிய interview-stage applicant இன்னும் இல்லை.':'No interview-stage applicants are ready for an offer yet.'}</div>:rows.map((application)=>{const job=jobsById.get(application.job_posting_id);const profile=professionalsById.get(application.professional_id);const offers=offersByApplication.get(application.id)??[];const pending=offers.find((offer)=>offer.status==='pending');const form=offerForm(application.id,job);return <article className={styles.card} key={application.id}>
      <div className={styles.row}><div><h3>{profile?.headline||'Professional applicant'}</h3><div className={styles.muted}>{job?.title??'Job opportunity'} · Application {label(application.status)}</div></div>{pending?<span className={styles.status}>Offer pending</span>:application.status==='hired'?<span className={styles.status}>Hired</span>:null}</div>
      {pending?<><div className={styles.alert}>{ta?'Pending offer-ன் terms edit செய்ய முடியாது. Terms மாற்ற வேண்டுமெனில் Withdraw செய்து revised offer அனுப்புங்கள்.':'Issued terms are immutable. Withdraw the pending offer and issue a revised offer to change terms.'}</div>{offerSummary(pending)}<div className={styles.actions}><button className={`${styles.button} ${styles.danger}`} disabled={saving} type="button" onClick={()=>void mutateOffer(pending.id,'withdraw')}>{ta?'Offer Withdraw':'Withdraw offer'}</button></div></>:null}
      {application.status==='interview'&&!pending?<div className={styles.applyPanel}>
        <strong>{offers.length?ta?'Revised offer அனுப்பு':'Issue revised offer':ta?'Employment offer அனுப்பு':'Issue employment offer'}</strong>
        <div className={styles.formGrid}>
          <label className={`${styles.label} ${styles.wide}`}>Position title<input className={styles.input} value={form.position_title} maxLength={180} onChange={(e)=>updateForm(application.id,job,{position_title:e.target.value})}/></label>
          <label className={styles.label}>Employment<select className={styles.select} value={form.employment_type} onChange={(e)=>updateForm(application.id,job,{employment_type:e.target.value})}>{['full_time','part_time','contract','freelance','internship','temporary'].map((value)=><option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label className={styles.label}>Workplace<select className={styles.select} value={form.workplace_type} onChange={(e)=>updateForm(application.id,job,{workplace_type:e.target.value})}>{['onsite','remote','hybrid'].map((value)=><option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label className={styles.label}>Location<input className={styles.input} value={form.location} maxLength={300} onChange={(e)=>updateForm(application.id,job,{location:e.target.value})}/></label>
          <label className={styles.label}>Proposed start<input className={styles.input} type="date" min={localToday()} value={form.proposed_start_date} onChange={(e)=>updateForm(application.id,job,{proposed_start_date:e.target.value})}/></label>
          <label className={styles.label}>Compensation amount<input className={styles.input} type="number" min="0" step="0.01" value={form.compensation_amount} onChange={(e)=>updateForm(application.id,job,{compensation_amount:e.target.value})}/></label>
          <label className={styles.label}>Currency<select className={styles.select} value={form.compensation_currency} onChange={(e)=>updateForm(application.id,job,{compensation_currency:e.target.value as OfferForm['compensation_currency']})}><option value="INR">INR</option><option value="USD">USD</option></select></label>
          <label className={styles.label}>Compensation period<select className={styles.select} value={form.compensation_period} onChange={(e)=>updateForm(application.id,job,{compensation_period:e.target.value as OfferForm['compensation_period']})}>{['hour','day','month','year','project'].map((value)=><option key={value} value={value}>{label(value)}</option>)}</select></label>
          <label className={styles.label}>Response deadline<input className={styles.input} type="datetime-local" value={form.response_deadline} onChange={(e)=>updateForm(application.id,job,{response_deadline:e.target.value})}/></label>
          <label className={`${styles.label} ${styles.wide}`}>Offer note<textarea className={styles.textarea} maxLength={3000} value={form.note} onChange={(e)=>updateForm(application.id,job,{note:e.target.value})} placeholder={ta?'Role, joining expectation அல்லது வேறு non-sensitive terms.':'Role expectations, joining details, or other non-sensitive terms.'}/></label>
        </div>
        <div className={styles.actions}><button className={styles.button} disabled={saving||!form.position_title.trim()} type="button" onClick={()=>void issueOffer(application.id,job)}>{saving?'Sending…':offers.length?'Issue revised offer':'Issue offer'}</button></div>
      </div>:null}
      {offers.length?(<details><summary>{ta?'Offer history':'Offer history'} ({offers.length})</summary><div className={styles.section}>{offers.filter((offer)=>offer.id!==pending?.id).map(offerSummary)}</div></details>):null}
    </article>;})}
  </section>;
}
