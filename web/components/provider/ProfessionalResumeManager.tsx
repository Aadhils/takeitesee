'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Input, Select, Textarea } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProfessionalResumeManager.module.css';

type CareerProfile = {
  professional_id: string;
  career_headline: string | null;
  career_summary: string | null;
  preferred_location: string | null;
  open_to_remote: boolean;
  willing_to_relocate: boolean;
  available_from: string | null;
  notice_period_days: number | null;
  availability_note: string | null;
  public_resume_enabled: boolean;
};

type Experience = {
  id: string;
  role_title: string;
  organization: string;
  employment_type: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  display_order: number;
};

type Education = {
  id: string;
  institution: string;
  qualification: string;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  display_order: number;
};

type Certification = {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  credential_url: string | null;
  display_order: number;
};

type Skill = {
  id: string;
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  years_experience: number | null;
  display_order: number;
};

type Role = {
  id: string;
  title: string;
  active: boolean;
  freelance_enabled: boolean;
  part_time_enabled: boolean;
  full_time_enabled: boolean;
  contract_enabled: boolean;
};

type ResumePayload = {
  verified: boolean;
  career_profile: CareerProfile | null;
  experiences: Experience[];
  education: Education[];
  certifications: Certification[];
  skills: Skill[];
  roles: Role[];
  error?: string;
};

const blankProfile = {
  career_headline: '', career_summary: '', preferred_location: '', open_to_remote: false,
  willing_to_relocate: false, available_from: '', notice_period_days: '', availability_note: '', public_resume_enabled: false,
};
const blankExperience = { role_title: '', organization: '', employment_type: 'full_time', location: '', start_date: '', end_date: '', is_current: false, description: '', display_order: '0' };
const blankEducation = { institution: '', qualification: '', field_of_study: '', start_date: '', end_date: '', description: '', display_order: '0' };
const blankCertification = { name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_id: '', credential_url: '', display_order: '0' };
const blankSkill = { name: '', proficiency: '', years_experience: '', display_order: '0' };

export default function ProfessionalResumeManager({ verified }: { verified: boolean }) {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const text = (en: string, ta: string) => tamil ? ta : en;
  const [data, setData] = useState<ResumePayload | null>(null);
  const [profileForm, setProfileForm] = useState(blankProfile);
  const [experienceForm, setExperienceForm] = useState(blankExperience);
  const [educationForm, setEducationForm] = useState(blankEducation);
  const [certificationForm, setCertificationForm] = useState(blankCertification);
  const [skillForm, setSkillForm] = useState(blankSkill);
  const [editExperienceId, setEditExperienceId] = useState<string | null>(null);
  const [editEducationId, setEditEducationId] = useState<string | null>(null);
  const [editCertificationId, setEditCertificationId] = useState<string | null>(null);
  const [editSkillId, setEditSkillId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/provider/resume', { cache: 'no-store' });
      const body = await response.json() as ResumePayload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load professional resume.');
      setData(body);
      const profile = body.career_profile;
      setProfileForm(profile ? {
        career_headline: profile.career_headline ?? '',
        career_summary: profile.career_summary ?? '',
        preferred_location: profile.preferred_location ?? '',
        open_to_remote: profile.open_to_remote,
        willing_to_relocate: profile.willing_to_relocate,
        available_from: profile.available_from ?? '',
        notice_period_days: profile.notice_period_days === null ? '' : String(profile.notice_period_days),
        availability_note: profile.availability_note ?? '',
        public_resume_enabled: profile.public_resume_enabled,
      } : blankProfile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load professional resume.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const opportunityModes = useMemo(() => {
    const activeRoles = (data?.roles ?? []).filter((role) => role.active);
    return [
      { key: 'freelance', label: text('Freelance', 'Freelance'), count: activeRoles.filter((role) => role.freelance_enabled).length },
      { key: 'part_time', label: text('Part-time', 'Part-time'), count: activeRoles.filter((role) => role.part_time_enabled).length },
      { key: 'full_time', label: text('Full-time', 'Full-time'), count: activeRoles.filter((role) => role.full_time_enabled).length },
      { key: 'contract', label: text('Contract', 'Contract'), count: activeRoles.filter((role) => role.contract_enabled).length },
    ].filter((item) => item.count > 0);
  }, [data?.roles, tamil]);

  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>, key: string) {
    setSaving(key);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/provider/resume', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Unable to update professional resume.');
      setNotice(text('Career profile updated.', 'Career profile update ஆகிவிட்டது.'));
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update professional resume.');
      return false;
    } finally {
      setSaving('');
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await send('PATCH', { section: 'profile', ...profileForm }, 'profile');
  }

  async function saveExperience(event: FormEvent) {
    event.preventDefault();
    const ok = await send(editExperienceId ? 'PATCH' : 'POST', { section: 'experience', ...(editExperienceId ? { id: editExperienceId } : {}), ...experienceForm }, 'experience');
    if (ok) { setExperienceForm(blankExperience); setEditExperienceId(null); }
  }

  async function saveEducation(event: FormEvent) {
    event.preventDefault();
    const ok = await send(editEducationId ? 'PATCH' : 'POST', { section: 'education', ...(editEducationId ? { id: editEducationId } : {}), ...educationForm }, 'education');
    if (ok) { setEducationForm(blankEducation); setEditEducationId(null); }
  }

  async function saveCertification(event: FormEvent) {
    event.preventDefault();
    const ok = await send(editCertificationId ? 'PATCH' : 'POST', { section: 'certification', ...(editCertificationId ? { id: editCertificationId } : {}), ...certificationForm }, 'certification');
    if (ok) { setCertificationForm(blankCertification); setEditCertificationId(null); }
  }

  async function saveSkill(event: FormEvent) {
    event.preventDefault();
    const ok = await send(editSkillId ? 'PATCH' : 'POST', { section: 'skill', ...(editSkillId ? { id: editSkillId } : {}), ...skillForm }, 'skill');
    if (ok) { setSkillForm(blankSkill); setEditSkillId(null); }
  }

  async function remove(section: 'experience' | 'education' | 'certification' | 'skill', id: string) {
    if (!window.confirm(text('Delete this resume item?', 'இந்த resume item-ஐ delete செய்ய வேண்டுமா?'))) return;
    await send('DELETE', { section, id }, `delete-${id}`);
  }

  function startExperience(item: Experience) {
    setEditExperienceId(item.id);
    setExperienceForm({ role_title: item.role_title, organization: item.organization, employment_type: item.employment_type, location: item.location ?? '', start_date: item.start_date, end_date: item.end_date ?? '', is_current: item.is_current, description: item.description ?? '', display_order: String(item.display_order) });
  }
  function startEducation(item: Education) {
    setEditEducationId(item.id);
    setEducationForm({ institution: item.institution, qualification: item.qualification, field_of_study: item.field_of_study ?? '', start_date: item.start_date ?? '', end_date: item.end_date ?? '', description: item.description ?? '', display_order: String(item.display_order) });
  }
  function startCertification(item: Certification) {
    setEditCertificationId(item.id);
    setCertificationForm({ name: item.name, issuing_organization: item.issuing_organization, issue_date: item.issue_date ?? '', expiry_date: item.expiry_date ?? '', credential_id: item.credential_id ?? '', credential_url: item.credential_url ?? '', display_order: String(item.display_order) });
  }
  function startSkill(item: Skill) {
    setEditSkillId(item.id);
    setSkillForm({ name: item.name, proficiency: item.proficiency ?? '', years_experience: item.years_experience === null ? '' : String(item.years_experience), display_order: String(item.display_order) });
  }

  function month(value: string | null) {
    if (!value) return text('Not specified', 'குறிப்பிடவில்லை');
    try { return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
    catch { return value; }
  }

  if (loading) return <Card><p>{text('Loading resume…', 'Resume load ஆகிறது…')}</p></Card>;
  if (!data) return <Alert tone="warning" title={text('Resume unavailable', 'Resume கிடைக்கவில்லை')}>{error || text('Unable to load career data.', 'Career data load செய்ய முடியவில்லை.')}</Alert>;

  const published = Boolean(data.career_profile?.public_resume_enabled);
  const totalItems = data.experiences.length + data.education.length + data.certifications.length + data.skills.length;

  return <div className={styles.stack}>
    {error ? <Alert tone="danger" title={text('Update failed', 'Update தோல்வி')}>{error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}

    <div className={styles.summaryGrid}>
      <Card className={styles.summaryCard}><span className="eyebrow">{text('Resume visibility', 'Resume visibility')}</span><strong>{published ? text('Public', 'Public') : text('Private draft', 'Private draft')}</strong><p>{published ? text('Visible on your verified public profile.', 'Verified public profile-ல் தெரியும்.') : text('Career data is owner-only while you build it.', 'Career data build செய்யும் வரை owner-only.')}</p></Card>
      <Card className={styles.summaryCard}><span className="eyebrow">{text('Structured items', 'Structured items')}</span><strong>{totalItems}</strong><p>{text('Skills, experience, education and certifications.', 'Skills, experience, education, certifications.')}</p></Card>
      <Card className={styles.summaryCard}><span className="eyebrow">{text('Career opportunity modes', 'Career opportunity modes')}</span><strong>{opportunityModes.length}</strong><p>{text('Driven by your active professional roles.', 'Active professional roles மூலம் control ஆகும்.')}</p></Card>
    </div>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}>
        <div><span className="eyebrow">{text('Career overview', 'Career overview')}</span><h2>{text('Resume headline & availability', 'Resume headline & availability')}</h2></div>
        <Badge tone={published ? 'success' : 'info'}>{published ? text('Public resume', 'Public resume') : text('Private draft', 'Private draft')}</Badge>
      </div>
      {!verified && profileForm.public_resume_enabled ? <Alert tone="warning" title={text('Verification required', 'Verification தேவை')}>{text('You can prepare the public toggle now, but career data will not be publicly readable until the master professional identity is verified.', 'Public toggle-ஐ இப்போது save செய்யலாம்; master professional identity verified ஆன பிறகே career data public-ஆ தெரியும்.')}</Alert> : null}
      <form className={styles.formStack} onSubmit={saveProfile}>
        <Input label={text('Career headline', 'Career headline')} maxLength={160} value={profileForm.career_headline} onChange={(e) => setProfileForm({ ...profileForm, career_headline: e.target.value })} placeholder={text('Example: Senior Web Developer · React · Node.js', 'உதா: Senior Web Developer · React · Node.js')} />
        <Textarea label={text('Professional summary', 'Professional summary')} maxLength={2400} rows={5} value={profileForm.career_summary} onChange={(e) => setProfileForm({ ...profileForm, career_summary: e.target.value })} hint={text('Describe your career focus, strengths and the kind of opportunities you want.', 'Career focus, strengths, நீங்கள் எதிர்பார்க்கும் opportunities பற்றி எழுதுங்கள்.')} />
        <div className={styles.twoCol}>
          <Input label={text('Preferred work location', 'Preferred work location')} maxLength={160} value={profileForm.preferred_location} onChange={(e) => setProfileForm({ ...profileForm, preferred_location: e.target.value })} />
          <Input label={text('Available from', 'Available from')} type="date" value={profileForm.available_from} onChange={(e) => setProfileForm({ ...profileForm, available_from: e.target.value })} />
          <Input label={text('Notice period (days)', 'Notice period (days)')} type="number" min={0} max={365} value={profileForm.notice_period_days} onChange={(e) => setProfileForm({ ...profileForm, notice_period_days: e.target.value })} />
        </div>
        <Textarea label={text('Availability note', 'Availability note')} maxLength={600} rows={3} value={profileForm.availability_note} onChange={(e) => setProfileForm({ ...profileForm, availability_note: e.target.value })} placeholder={text('Example: Available evenings for freelance work; 30-day notice for full-time roles.', 'உதா: Freelance work-க்கு evenings available; full-time role-க்கு 30-day notice.')} />
        <div className={styles.choiceGrid}>
          <Checkbox label={text('Open to remote work', 'Remote work-க்கு open')} checked={profileForm.open_to_remote} onChange={(e) => setProfileForm({ ...profileForm, open_to_remote: e.target.checked })} />
          <Checkbox label={text('Willing to relocate', 'Relocate செய்ய open')} checked={profileForm.willing_to_relocate} onChange={(e) => setProfileForm({ ...profileForm, willing_to_relocate: e.target.checked })} />
          <Checkbox label={text('Publish career profile publicly', 'Career profile-ஐ public-ஆ publish செய்')} description={text('Default is private. Public visibility still requires a verified professional identity.', 'Default private. Public visibility-க்கு verified professional identity அவசியம்.')} checked={profileForm.public_resume_enabled} onChange={(e) => setProfileForm({ ...profileForm, public_resume_enabled: e.target.checked })} />
        </div>
        <div className={styles.actions}><Button type="submit" loading={saving === 'profile'}>{text('Save career profile', 'Career profile save செய்')}</Button></div>
      </form>
      <div className={styles.opportunityBox}>
        <strong>{text('Opportunity modes from your professional roles', 'Professional roles-ல் இருந்து opportunity modes')}</strong>
        <div className={styles.badges}>{opportunityModes.length ? opportunityModes.map((item) => <Badge tone="info" key={item.key}>{item.label} · {item.count} {text('role', 'role')}</Badge>) : <span>{text('No active career opportunity modes yet. Configure them under Profile → Professional roles.', 'Career opportunity mode இன்னும் active இல்லை. Profile → Professional roles-ல் configure செய்யுங்கள்.')}</span>}</div>
      </div>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{text('Skills', 'Skills')}</span><h2>{text('Professional skill keywords', 'Professional skill keywords')}</h2></div><Badge tone="info">{data.skills.length}</Badge></div>
      {data.skills.length ? <div className={styles.itemGrid}>{data.skills.map((item) => <article className={styles.itemCard} key={item.id}><div><h3>{item.name}</h3><p>{item.proficiency ? `${item.proficiency} · ` : ''}{item.years_experience === null ? text('Experience not specified', 'Experience குறிப்பிடவில்லை') : `${item.years_experience} ${text('years', 'years')}`}</p></div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startSkill(item)}>{text('Edit', 'Edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('skill', item.id)}>{text('Delete', 'Delete')}</Button></div></article>)}</div> : <EmptyState title={text('Add your first skill', 'முதல் skill சேர்க்கவும்')}>{text('Add concise career skill keywords such as React, Driving, Electrical Maintenance or Teaching.', 'React, Driving, Electrical Maintenance, Teaching போன்ற career skill keywords சேர்க்கலாம்.')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveSkill}>
        <h3>{editSkillId ? text('Edit skill', 'Skill edit') : text('Add skill', 'Skill சேர்க்க')}</h3>
        <div className={styles.twoCol}><Input required label={text('Skill name', 'Skill name')} maxLength={120} value={skillForm.name} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })} /><Select label={text('Proficiency', 'Proficiency')} value={skillForm.proficiency} onChange={(e) => setSkillForm({ ...skillForm, proficiency: e.target.value })}><option value="">{text('Not specified', 'குறிப்பிடவில்லை')}</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></Select><Input label={text('Years of experience', 'Experience years')} type="number" min={0} max={80} value={skillForm.years_experience} onChange={(e) => setSkillForm({ ...skillForm, years_experience: e.target.value })} /><Input label={text('Display order', 'Display order')} type="number" min={0} max={9999} value={skillForm.display_order} onChange={(e) => setSkillForm({ ...skillForm, display_order: e.target.value })} /></div>
        <div className={styles.actions}><Button type="submit" loading={saving === 'skill'}>{editSkillId ? text('Update skill', 'Skill update') : text('Add skill', 'Skill சேர்க்க')}</Button>{editSkillId ? <Button type="button" variant="secondary" onClick={() => { setEditSkillId(null); setSkillForm(blankSkill); }}>{text('Cancel', 'Cancel')}</Button> : null}</div>
      </form>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{text('Experience', 'Experience')}</span><h2>{text('Work history', 'Work history')}</h2></div><Badge tone="info">{data.experiences.length}</Badge></div>
      {data.experiences.length ? <div className={styles.itemGrid}>{data.experiences.map((item) => <article className={styles.itemCard} key={item.id}><div><div className={styles.badges}><Badge tone={item.is_current ? 'success' : 'info'}>{item.is_current ? text('Current', 'Current') : item.employment_type.replaceAll('_', ' ')}</Badge></div><h3>{item.role_title}</h3><p><strong>{item.organization}</strong>{item.location ? ` · ${item.location}` : ''}</p><p>{month(item.start_date)} — {item.is_current ? text('Present', 'Present') : month(item.end_date)}</p>{item.description ? <p>{item.description}</p> : null}</div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startExperience(item)}>{text('Edit', 'Edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('experience', item.id)}>{text('Delete', 'Delete')}</Button></div></article>)}</div> : <EmptyState title={text('Add work experience', 'Work experience சேர்க்கவும்')}>{text('Record employment, freelance, contract, internship or self-employed experience.', 'Employment, freelance, contract, internship, self-employed experience சேர்க்கலாம்.')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveExperience}>
        <h3>{editExperienceId ? text('Edit experience', 'Experience edit') : text('Add experience', 'Experience சேர்க்க')}</h3>
        <div className={styles.twoCol}><Input required label={text('Role title', 'Role title')} maxLength={160} value={experienceForm.role_title} onChange={(e) => setExperienceForm({ ...experienceForm, role_title: e.target.value })} /><Input required label={text('Organization', 'Organization')} maxLength={180} value={experienceForm.organization} onChange={(e) => setExperienceForm({ ...experienceForm, organization: e.target.value })} /><Select label={text('Employment type', 'Employment type')} value={experienceForm.employment_type} onChange={(e) => setExperienceForm({ ...experienceForm, employment_type: e.target.value })}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="freelance">Freelance</option><option value="internship">Internship</option><option value="self_employed">Self-employed</option><option value="other">Other</option></Select><Input label={text('Location', 'Location')} maxLength={160} value={experienceForm.location} onChange={(e) => setExperienceForm({ ...experienceForm, location: e.target.value })} /><Input required label={text('Start date', 'Start date')} type="date" value={experienceForm.start_date} onChange={(e) => setExperienceForm({ ...experienceForm, start_date: e.target.value })} /><Input label={text('End date', 'End date')} type="date" disabled={experienceForm.is_current} value={experienceForm.end_date} onChange={(e) => setExperienceForm({ ...experienceForm, end_date: e.target.value })} /><Input label={text('Display order', 'Display order')} type="number" min={0} max={9999} value={experienceForm.display_order} onChange={(e) => setExperienceForm({ ...experienceForm, display_order: e.target.value })} /></div>
        <Checkbox label={text('I currently work here', 'இங்கு தற்போது வேலை செய்கிறேன்')} checked={experienceForm.is_current} onChange={(e) => setExperienceForm({ ...experienceForm, is_current: e.target.checked, end_date: e.target.checked ? '' : experienceForm.end_date })} />
        <Textarea label={text('Responsibilities / achievements', 'Responsibilities / achievements')} maxLength={2400} rows={4} value={experienceForm.description} onChange={(e) => setExperienceForm({ ...experienceForm, description: e.target.value })} />
        <div className={styles.actions}><Button type="submit" loading={saving === 'experience'}>{editExperienceId ? text('Update experience', 'Experience update') : text('Add experience', 'Experience சேர்க்க')}</Button>{editExperienceId ? <Button type="button" variant="secondary" onClick={() => { setEditExperienceId(null); setExperienceForm(blankExperience); }}>{text('Cancel', 'Cancel')}</Button> : null}</div>
      </form>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{text('Education', 'Education')}</span><h2>{text('Education history', 'Education history')}</h2></div><Badge tone="info">{data.education.length}</Badge></div>
      {data.education.length ? <div className={styles.itemGrid}>{data.education.map((item) => <article className={styles.itemCard} key={item.id}><div><h3>{item.qualification}</h3><p><strong>{item.institution}</strong>{item.field_of_study ? ` · ${item.field_of_study}` : ''}</p>{item.start_date || item.end_date ? <p>{month(item.start_date)} — {month(item.end_date)}</p> : null}{item.description ? <p>{item.description}</p> : null}</div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startEducation(item)}>{text('Edit', 'Edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('education', item.id)}>{text('Delete', 'Delete')}</Button></div></article>)}</div> : <EmptyState title={text('Add education', 'Education சேர்க்கவும்')}>{text('Add school, college, university, diploma or training qualifications.', 'School, college, university, diploma அல்லது training qualifications சேர்க்கலாம்.')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveEducation}>
        <h3>{editEducationId ? text('Edit education', 'Education edit') : text('Add education', 'Education சேர்க்க')}</h3>
        <div className={styles.twoCol}><Input required label={text('Institution', 'Institution')} maxLength={180} value={educationForm.institution} onChange={(e) => setEducationForm({ ...educationForm, institution: e.target.value })} /><Input required label={text('Qualification', 'Qualification')} maxLength={180} value={educationForm.qualification} onChange={(e) => setEducationForm({ ...educationForm, qualification: e.target.value })} /><Input label={text('Field of study', 'Field of study')} maxLength={180} value={educationForm.field_of_study} onChange={(e) => setEducationForm({ ...educationForm, field_of_study: e.target.value })} /><Input label={text('Start date', 'Start date')} type="date" value={educationForm.start_date} onChange={(e) => setEducationForm({ ...educationForm, start_date: e.target.value })} /><Input label={text('End date', 'End date')} type="date" value={educationForm.end_date} onChange={(e) => setEducationForm({ ...educationForm, end_date: e.target.value })} /><Input label={text('Display order', 'Display order')} type="number" min={0} max={9999} value={educationForm.display_order} onChange={(e) => setEducationForm({ ...educationForm, display_order: e.target.value })} /></div>
        <Textarea label={text('Education note', 'Education note')} maxLength={1600} rows={3} value={educationForm.description} onChange={(e) => setEducationForm({ ...educationForm, description: e.target.value })} />
        <div className={styles.actions}><Button type="submit" loading={saving === 'education'}>{editEducationId ? text('Update education', 'Education update') : text('Add education', 'Education சேர்க்க')}</Button>{editEducationId ? <Button type="button" variant="secondary" onClick={() => { setEditEducationId(null); setEducationForm(blankEducation); }}>{text('Cancel', 'Cancel')}</Button> : null}</div>
      </form>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{text('Certifications', 'Certifications')}</span><h2>{text('Credentials & certifications', 'Credentials & certifications')}</h2></div><Badge tone="info">{data.certifications.length}</Badge></div>
      {data.certifications.length ? <div className={styles.itemGrid}>{data.certifications.map((item) => <article className={styles.itemCard} key={item.id}><div><h3>{item.name}</h3><p><strong>{item.issuing_organization}</strong></p>{item.issue_date || item.expiry_date ? <p>{text('Issued', 'Issued')}: {month(item.issue_date)}{item.expiry_date ? ` · ${text('Expires', 'Expires')}: ${month(item.expiry_date)}` : ''}</p> : null}{item.credential_id ? <p>{text('Credential', 'Credential')}: {item.credential_id}</p> : null}{item.credential_url ? <p><a href={item.credential_url} target="_blank" rel="noreferrer">{text('Open credential', 'Credential திறக்க')}</a></p> : null}</div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startCertification(item)}>{text('Edit', 'Edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('certification', item.id)}>{text('Delete', 'Delete')}</Button></div></article>)}</div> : <EmptyState title={text('Add certification', 'Certification சேர்க்கவும்')}>{text('Add licenses, professional certificates or training credentials.', 'Licenses, professional certificates அல்லது training credentials சேர்க்கலாம்.')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveCertification}>
        <h3>{editCertificationId ? text('Edit certification', 'Certification edit') : text('Add certification', 'Certification சேர்க்க')}</h3>
        <div className={styles.twoCol}><Input required label={text('Certification name', 'Certification name')} maxLength={180} value={certificationForm.name} onChange={(e) => setCertificationForm({ ...certificationForm, name: e.target.value })} /><Input required label={text('Issuing organization', 'Issuing organization')} maxLength={180} value={certificationForm.issuing_organization} onChange={(e) => setCertificationForm({ ...certificationForm, issuing_organization: e.target.value })} /><Input label={text('Issue date', 'Issue date')} type="date" value={certificationForm.issue_date} onChange={(e) => setCertificationForm({ ...certificationForm, issue_date: e.target.value })} /><Input label={text('Expiry date', 'Expiry date')} type="date" value={certificationForm.expiry_date} onChange={(e) => setCertificationForm({ ...certificationForm, expiry_date: e.target.value })} /><Input label={text('Credential ID', 'Credential ID')} maxLength={180} value={certificationForm.credential_id} onChange={(e) => setCertificationForm({ ...certificationForm, credential_id: e.target.value })} /><Input label={text('Credential URL', 'Credential URL')} type="url" maxLength={1000} value={certificationForm.credential_url} onChange={(e) => setCertificationForm({ ...certificationForm, credential_url: e.target.value })} /><Input label={text('Display order', 'Display order')} type="number" min={0} max={9999} value={certificationForm.display_order} onChange={(e) => setCertificationForm({ ...certificationForm, display_order: e.target.value })} /></div>
        <div className={styles.actions}><Button type="submit" loading={saving === 'certification'}>{editCertificationId ? text('Update certification', 'Certification update') : text('Add certification', 'Certification சேர்க்க')}</Button>{editCertificationId ? <Button type="button" variant="secondary" onClick={() => { setEditCertificationId(null); setCertificationForm(blankCertification); }}>{text('Cancel', 'Cancel')}</Button> : null}</div>
      </form>
    </Card>
  </div>;
}
