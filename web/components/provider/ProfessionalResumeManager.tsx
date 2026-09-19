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
  const { locale, t } = useIdentityWorkspaceTranslations();
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
      if (!response.ok) throw new Error(body.error ?? t('provider.resumeManager.loadFallback'));
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
      setError(cause instanceof Error ? cause.message : t('provider.resumeManager.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const opportunityModes = useMemo(() => {
    const activeRoles = (data?.roles ?? []).filter((role) => role.active);
    return [
      { key: 'freelance', label: t('provider.resumeManager.freelance'), count: activeRoles.filter((role) => role.freelance_enabled).length },
      { key: 'part_time', label: t('provider.resumeManager.partTime'), count: activeRoles.filter((role) => role.part_time_enabled).length },
      { key: 'full_time', label: t('provider.resumeManager.fullTime'), count: activeRoles.filter((role) => role.full_time_enabled).length },
      { key: 'contract', label: t('provider.resumeManager.contract'), count: activeRoles.filter((role) => role.contract_enabled).length },
    ].filter((item) => item.count > 0);
  }, [data?.roles, t]);

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
      if (!response.ok) throw new Error(result.error ?? t('provider.resumeManager.updateFallback'));
      setNotice(t('provider.resumeManager.careerProfileUpdated'));
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.resumeManager.updateFallback'));
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
    if (!window.confirm(t('provider.resumeManager.deleteThisResumeItem'))) return;
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
    if (!value) return t('provider.resumeManager.notSpecified');
    try { return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
    catch { return value; }
  }

  if (loading) return <Card><p>{t('provider.resumeManager.loadingResume')}</p></Card>;
  if (!data) return <Alert tone="warning" title={t('provider.resumeManager.resumeUnavailable')}>{error || t('provider.resumeManager.unableToLoadCareerData')}</Alert>;

  const published = Boolean(data.career_profile?.public_resume_enabled);
  const totalItems = data.experiences.length + data.education.length + data.certifications.length + data.skills.length;

  return <div className={styles.stack}>
    {error ? <Alert tone="danger" title={t('provider.resumeManager.updateFailed')}>{error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}

    <div className={styles.summaryGrid}>
      <Card className={styles.summaryCard}><span className="eyebrow">{t('provider.resumeManager.resumeVisibility')}</span><strong>{published ? t('provider.resumeManager.public') : t('provider.resumeManager.privateDraft')}</strong><p>{published ? t('provider.resumeManager.visibleOnYourVerifiedPublicProfile') : t('provider.resumeManager.careerDataIsOwnerOnlyWhileYouBuildIt')}</p></Card>
      <Card className={styles.summaryCard}><span className="eyebrow">{t('provider.resumeManager.structuredItems')}</span><strong>{totalItems}</strong><p>{t('provider.resumeManager.skillsExperienceEducationAndCertifications')}</p></Card>
      <Card className={styles.summaryCard}><span className="eyebrow">{t('provider.resumeManager.careerOpportunityModes')}</span><strong>{opportunityModes.length}</strong><p>{t('provider.resumeManager.drivenByYourActiveProfessionalRoles')}</p></Card>
    </div>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}>
        <div><span className="eyebrow">{t('provider.resumeManager.careerOverview')}</span><h2>{t('provider.resumeManager.resumeHeadlineAvailability')}</h2></div>
        <Badge tone={published ? 'success' : 'info'}>{published ? t('provider.resumeManager.publicResume') : t('provider.resumeManager.privateDraft')}</Badge>
      </div>
      {!verified && profileForm.public_resume_enabled ? <Alert tone="warning" title={t('provider.resumeManager.verificationRequired')}>{t('provider.resumeManager.youCanPrepareThePublicToggleNowButCareerDataWillNotBePubliclyReadableUntilTheMasterProfessionalIdentityIsVerified')}</Alert> : null}
      <form className={styles.formStack} onSubmit={saveProfile}>
        <Input label={t('provider.resumeManager.careerHeadline')} maxLength={160} value={profileForm.career_headline} onChange={(e) => setProfileForm({ ...profileForm, career_headline: e.target.value })} placeholder={t('provider.resumeManager.exampleSeniorWebDeveloperReactNodeJs')} />
        <Textarea label={t('provider.resumeManager.professionalSummary')} maxLength={2400} rows={5} value={profileForm.career_summary} onChange={(e) => setProfileForm({ ...profileForm, career_summary: e.target.value })} hint={t('provider.resumeManager.describeYourCareerFocusStrengthsAndTheKindOfOpportunitiesYouWant')} />
        <div className={styles.twoCol}>
          <Input label={t('provider.resumeManager.preferredWorkLocation')} maxLength={160} value={profileForm.preferred_location} onChange={(e) => setProfileForm({ ...profileForm, preferred_location: e.target.value })} />
          <Input label={t('provider.resumeManager.availableFrom')} type="date" value={profileForm.available_from} onChange={(e) => setProfileForm({ ...profileForm, available_from: e.target.value })} />
          <Input label={t('provider.resumeManager.noticePeriodDays')} type="number" min={0} max={365} value={profileForm.notice_period_days} onChange={(e) => setProfileForm({ ...profileForm, notice_period_days: e.target.value })} />
        </div>
        <Textarea label={t('provider.resumeManager.availabilityNote')} maxLength={600} rows={3} value={profileForm.availability_note} onChange={(e) => setProfileForm({ ...profileForm, availability_note: e.target.value })} placeholder={t('provider.resumeManager.exampleAvailableEveningsForFreelanceWork30DayNoticeForFullTimeRoles')} />
        <div className={styles.choiceGrid}>
          <Checkbox label={t('provider.resumeManager.openToRemoteWork')} checked={profileForm.open_to_remote} onChange={(e) => setProfileForm({ ...profileForm, open_to_remote: e.target.checked })} />
          <Checkbox label={t('provider.resumeManager.willingToRelocate')} checked={profileForm.willing_to_relocate} onChange={(e) => setProfileForm({ ...profileForm, willing_to_relocate: e.target.checked })} />
          <Checkbox label={t('provider.resumeManager.publishCareerProfilePublicly')} description={t('provider.resumeManager.defaultIsPrivatePublicVisibilityStillRequiresAVerifiedProfessionalIdentity')} checked={profileForm.public_resume_enabled} onChange={(e) => setProfileForm({ ...profileForm, public_resume_enabled: e.target.checked })} />
        </div>
        <div className={styles.actions}><Button type="submit" loading={saving === 'profile'}>{t('provider.resumeManager.saveCareerProfile')}</Button></div>
      </form>
      <div className={styles.opportunityBox}>
        <strong>{t('provider.resumeManager.opportunityModesFromYourProfessionalRoles')}</strong>
        <div className={styles.badges}>{opportunityModes.length ? opportunityModes.map((item) => <Badge tone="info" key={item.key}>{item.label} · {item.count} {t('provider.resumeManager.role')}</Badge>) : <span>{t('provider.resumeManager.noActiveCareerOpportunityModesYetConfigureThemUnderProfileProfessionalRoles')}</span>}</div>
      </div>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{t('provider.resumeManager.skills')}</span><h2>{t('provider.resumeManager.professionalSkillKeywords')}</h2></div><Badge tone="info">{data.skills.length}</Badge></div>
      {data.skills.length ? <div className={styles.itemGrid}>{data.skills.map((item) => <article className={styles.itemCard} key={item.id}><div><h3>{item.name}</h3><p>{item.proficiency ? `${item.proficiency} · ` : ''}{item.years_experience === null ? t('provider.resumeManager.experienceNotSpecified') : `${item.years_experience} ${t('provider.resumeManager.years')}`}</p></div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startSkill(item)}>{t('provider.resumeManager.edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('skill', item.id)}>{t('provider.resumeManager.delete')}</Button></div></article>)}</div> : <EmptyState title={t('provider.resumeManager.addYourFirstSkill')}>{t('provider.resumeManager.addConciseCareerSkillKeywordsSuchAsReactDrivingElectricalMaintenanceOrTeaching')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveSkill}>
        <h3>{editSkillId ? t('provider.resumeManager.editSkill') : t('provider.resumeManager.addSkill')}</h3>
        <div className={styles.twoCol}><Input required label={t('provider.resumeManager.skillName')} maxLength={120} value={skillForm.name} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })} /><Select label={t('provider.resumeManager.proficiency')} value={skillForm.proficiency} onChange={(e) => setSkillForm({ ...skillForm, proficiency: e.target.value })}><option value="">{t('provider.resumeManager.notSpecified')}</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></Select><Input label={t('provider.resumeManager.yearsOfExperience')} type="number" min={0} max={80} value={skillForm.years_experience} onChange={(e) => setSkillForm({ ...skillForm, years_experience: e.target.value })} /><Input label={t('provider.resumeManager.displayOrder')} type="number" min={0} max={9999} value={skillForm.display_order} onChange={(e) => setSkillForm({ ...skillForm, display_order: e.target.value })} /></div>
        <div className={styles.actions}><Button type="submit" loading={saving === 'skill'}>{editSkillId ? t('provider.resumeManager.updateSkill') : t('provider.resumeManager.addSkill')}</Button>{editSkillId ? <Button type="button" variant="secondary" onClick={() => { setEditSkillId(null); setSkillForm(blankSkill); }}>{t('provider.resumeManager.cancel')}</Button> : null}</div>
      </form>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{t('provider.resumeManager.experience')}</span><h2>{t('provider.resumeManager.workHistory')}</h2></div><Badge tone="info">{data.experiences.length}</Badge></div>
      {data.experiences.length ? <div className={styles.itemGrid}>{data.experiences.map((item) => <article className={styles.itemCard} key={item.id}><div><div className={styles.badges}><Badge tone={item.is_current ? 'success' : 'info'}>{item.is_current ? t('provider.resumeManager.current') : item.employment_type.replaceAll('_', ' ')}</Badge></div><h3>{item.role_title}</h3><p><strong>{item.organization}</strong>{item.location ? ` · ${item.location}` : ''}</p><p>{month(item.start_date)} — {item.is_current ? t('provider.resumeManager.present') : month(item.end_date)}</p>{item.description ? <p>{item.description}</p> : null}</div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startExperience(item)}>{t('provider.resumeManager.edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('experience', item.id)}>{t('provider.resumeManager.delete')}</Button></div></article>)}</div> : <EmptyState title={t('provider.resumeManager.addWorkExperience')}>{t('provider.resumeManager.recordEmploymentFreelanceContractInternshipOrSelfEmployedExperience')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveExperience}>
        <h3>{editExperienceId ? t('provider.resumeManager.editExperience') : t('provider.resumeManager.addExperience')}</h3>
        <div className={styles.twoCol}><Input required label={t('provider.resumeManager.roleTitle')} maxLength={160} value={experienceForm.role_title} onChange={(e) => setExperienceForm({ ...experienceForm, role_title: e.target.value })} /><Input required label={t('provider.resumeManager.organization')} maxLength={180} value={experienceForm.organization} onChange={(e) => setExperienceForm({ ...experienceForm, organization: e.target.value })} /><Select label={t('provider.resumeManager.employmentType')} value={experienceForm.employment_type} onChange={(e) => setExperienceForm({ ...experienceForm, employment_type: e.target.value })}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="freelance">Freelance</option><option value="internship">Internship</option><option value="self_employed">Self-employed</option><option value="other">Other</option></Select><Input label={t('provider.resumeManager.location')} maxLength={160} value={experienceForm.location} onChange={(e) => setExperienceForm({ ...experienceForm, location: e.target.value })} /><Input required label={t('provider.resumeManager.startDate')} type="date" value={experienceForm.start_date} onChange={(e) => setExperienceForm({ ...experienceForm, start_date: e.target.value })} /><Input label={t('provider.resumeManager.endDate')} type="date" disabled={experienceForm.is_current} value={experienceForm.end_date} onChange={(e) => setExperienceForm({ ...experienceForm, end_date: e.target.value })} /><Input label={t('provider.resumeManager.displayOrder')} type="number" min={0} max={9999} value={experienceForm.display_order} onChange={(e) => setExperienceForm({ ...experienceForm, display_order: e.target.value })} /></div>
        <Checkbox label={t('provider.resumeManager.iCurrentlyWorkHere')} checked={experienceForm.is_current} onChange={(e) => setExperienceForm({ ...experienceForm, is_current: e.target.checked, end_date: e.target.checked ? '' : experienceForm.end_date })} />
        <Textarea label={t('provider.resumeManager.responsibilitiesAchievements')} maxLength={2400} rows={4} value={experienceForm.description} onChange={(e) => setExperienceForm({ ...experienceForm, description: e.target.value })} />
        <div className={styles.actions}><Button type="submit" loading={saving === 'experience'}>{editExperienceId ? t('provider.resumeManager.updateExperience') : t('provider.resumeManager.addExperience')}</Button>{editExperienceId ? <Button type="button" variant="secondary" onClick={() => { setEditExperienceId(null); setExperienceForm(blankExperience); }}>{t('provider.resumeManager.cancel')}</Button> : null}</div>
      </form>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{t('provider.resumeManager.education')}</span><h2>{t('provider.resumeManager.educationHistory')}</h2></div><Badge tone="info">{data.education.length}</Badge></div>
      {data.education.length ? <div className={styles.itemGrid}>{data.education.map((item) => <article className={styles.itemCard} key={item.id}><div><h3>{item.qualification}</h3><p><strong>{item.institution}</strong>{item.field_of_study ? ` · ${item.field_of_study}` : ''}</p>{item.start_date || item.end_date ? <p>{month(item.start_date)} — {month(item.end_date)}</p> : null}{item.description ? <p>{item.description}</p> : null}</div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startEducation(item)}>{t('provider.resumeManager.edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('education', item.id)}>{t('provider.resumeManager.delete')}</Button></div></article>)}</div> : <EmptyState title={t('provider.resumeManager.addEducation')}>{t('provider.resumeManager.addSchoolCollegeUniversityDiplomaOrTrainingQualifications')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveEducation}>
        <h3>{editEducationId ? t('provider.resumeManager.editEducation') : t('provider.resumeManager.addEducation2')}</h3>
        <div className={styles.twoCol}><Input required label={t('provider.resumeManager.institution')} maxLength={180} value={educationForm.institution} onChange={(e) => setEducationForm({ ...educationForm, institution: e.target.value })} /><Input required label={t('provider.resumeManager.qualification')} maxLength={180} value={educationForm.qualification} onChange={(e) => setEducationForm({ ...educationForm, qualification: e.target.value })} /><Input label={t('provider.resumeManager.fieldOfStudy')} maxLength={180} value={educationForm.field_of_study} onChange={(e) => setEducationForm({ ...educationForm, field_of_study: e.target.value })} /><Input label={t('provider.resumeManager.startDate')} type="date" value={educationForm.start_date} onChange={(e) => setEducationForm({ ...educationForm, start_date: e.target.value })} /><Input label={t('provider.resumeManager.endDate')} type="date" value={educationForm.end_date} onChange={(e) => setEducationForm({ ...educationForm, end_date: e.target.value })} /><Input label={t('provider.resumeManager.displayOrder')} type="number" min={0} max={9999} value={educationForm.display_order} onChange={(e) => setEducationForm({ ...educationForm, display_order: e.target.value })} /></div>
        <Textarea label={t('provider.resumeManager.educationNote')} maxLength={1600} rows={3} value={educationForm.description} onChange={(e) => setEducationForm({ ...educationForm, description: e.target.value })} />
        <div className={styles.actions}><Button type="submit" loading={saving === 'education'}>{editEducationId ? t('provider.resumeManager.updateEducation') : t('provider.resumeManager.addEducation2')}</Button>{editEducationId ? <Button type="button" variant="secondary" onClick={() => { setEditEducationId(null); setEducationForm(blankEducation); }}>{t('provider.resumeManager.cancel')}</Button> : null}</div>
      </form>
    </Card>

    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeading}><div><span className="eyebrow">{t('provider.resumeManager.certifications')}</span><h2>{t('provider.resumeManager.credentialsCertifications')}</h2></div><Badge tone="info">{data.certifications.length}</Badge></div>
      {data.certifications.length ? <div className={styles.itemGrid}>{data.certifications.map((item) => <article className={styles.itemCard} key={item.id}><div><h3>{item.name}</h3><p><strong>{item.issuing_organization}</strong></p>{item.issue_date || item.expiry_date ? <p>{t('provider.resumeManager.issued')}: {month(item.issue_date)}{item.expiry_date ? ` · ${t('provider.resumeManager.expires')}: ${month(item.expiry_date)}` : ''}</p> : null}{item.credential_id ? <p>{t('provider.resumeManager.credential')}: {item.credential_id}</p> : null}{item.credential_url ? <p><a href={item.credential_url} target="_blank" rel="noreferrer">{t('provider.resumeManager.openCredential')}</a></p> : null}</div><div className={styles.itemActions}><Button type="button" variant="quiet" onClick={() => startCertification(item)}>{t('provider.resumeManager.edit')}</Button><Button type="button" variant="danger" loading={saving === `delete-${item.id}`} onClick={() => void remove('certification', item.id)}>{t('provider.resumeManager.delete')}</Button></div></article>)}</div> : <EmptyState title={t('provider.resumeManager.addCertification')}>{t('provider.resumeManager.addLicensesProfessionalCertificatesOrTrainingCredentials')}</EmptyState>}
      <form className={styles.inlineEditor} onSubmit={saveCertification}>
        <h3>{editCertificationId ? t('provider.resumeManager.editCertification') : t('provider.resumeManager.addCertification2')}</h3>
        <div className={styles.twoCol}><Input required label={t('provider.resumeManager.certificationName')} maxLength={180} value={certificationForm.name} onChange={(e) => setCertificationForm({ ...certificationForm, name: e.target.value })} /><Input required label={t('provider.resumeManager.issuingOrganization')} maxLength={180} value={certificationForm.issuing_organization} onChange={(e) => setCertificationForm({ ...certificationForm, issuing_organization: e.target.value })} /><Input label={t('provider.resumeManager.issueDate')} type="date" value={certificationForm.issue_date} onChange={(e) => setCertificationForm({ ...certificationForm, issue_date: e.target.value })} /><Input label={t('provider.resumeManager.expiryDate')} type="date" value={certificationForm.expiry_date} onChange={(e) => setCertificationForm({ ...certificationForm, expiry_date: e.target.value })} /><Input label={t('provider.resumeManager.credentialId')} maxLength={180} value={certificationForm.credential_id} onChange={(e) => setCertificationForm({ ...certificationForm, credential_id: e.target.value })} /><Input label={t('provider.resumeManager.credentialUrl')} type="url" maxLength={1000} value={certificationForm.credential_url} onChange={(e) => setCertificationForm({ ...certificationForm, credential_url: e.target.value })} /><Input label={t('provider.resumeManager.displayOrder')} type="number" min={0} max={9999} value={certificationForm.display_order} onChange={(e) => setCertificationForm({ ...certificationForm, display_order: e.target.value })} /></div>
        <div className={styles.actions}><Button type="submit" loading={saving === 'certification'}>{editCertificationId ? t('provider.resumeManager.updateCertification') : t('provider.resumeManager.addCertification2')}</Button>{editCertificationId ? <Button type="button" variant="secondary" onClick={() => { setEditCertificationId(null); setCertificationForm(blankCertification); }}>{t('provider.resumeManager.cancel')}</Button> : null}</div>
      </form>
    </Card>
  </div>;
}
