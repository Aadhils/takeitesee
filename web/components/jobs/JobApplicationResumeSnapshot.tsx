'use client';

type SnapshotRole = {
  title?: string | null;
  summary?: string | null;
  experience_years?: number | null;
};

type SnapshotCareer = {
  career_headline?: string | null;
  career_summary?: string | null;
  preferred_location?: string | null;
  open_to_remote?: boolean;
  willing_to_relocate?: boolean;
  available_from?: string | null;
  notice_period_days?: number | null;
  availability_note?: string | null;
};

type SnapshotSkill = { id?: string; name?: string; proficiency?: string | null; years_experience?: number | null };
type SnapshotExperience = { id?: string; role_title?: string; organization?: string; employment_type?: string; location?: string | null; start_date?: string; end_date?: string | null; is_current?: boolean; description?: string | null };
type SnapshotEducation = { id?: string; institution?: string; qualification?: string; field_of_study?: string | null; start_date?: string | null; end_date?: string | null; description?: string | null };
type SnapshotCertification = { id?: string; name?: string; issuing_organization?: string; issue_date?: string | null; expiry_date?: string | null; credential_id?: string | null; credential_url?: string | null };

type SnapshotPayload = {
  profile?: { headline?: string | null; service_area?: string | null; verified?: boolean };
  selected_role?: SnapshotRole | null;
  career?: SnapshotCareer | null;
  skills?: SnapshotSkill[];
  experiences?: SnapshotExperience[];
  education?: SnapshotEducation[];
  certifications?: SnapshotCertification[];
};

export type JobApplicationResumeSnapshotRow = {
  job_application_id: string;
  professional_id: string;
  snapshot_version: number;
  snapshot: SnapshotPayload;
  captured_at: string;
};

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { year: 'numeric', month: 'short' }).format(date);
}

export function JobApplicationResumeSnapshot({ row, tamil = false }: { row?: JobApplicationResumeSnapshotRow; tamil?: boolean }) {
  if (!row) return <div style={{ marginTop: '.75rem', fontSize: '.9rem', opacity: .72 }}>{tamil ? 'இந்த application-க்கு resume snapshot கிடைக்கவில்லை.' : 'No application resume snapshot is available.'}</div>;
  const data = row.snapshot ?? {};
  const career = data.career;
  const role = data.selected_role;
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const experiences = Array.isArray(data.experiences) ? data.experiences : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const certifications = Array.isArray(data.certifications) ? data.certifications : [];

  return <details style={{ marginTop: '.85rem', border: '1px solid #e7eaf0', borderRadius: 14, padding: '.8rem' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{tamil ? 'Application Resume Snapshot' : 'Application resume snapshot'}</summary>
    <p style={{ fontSize: '.88rem', opacity: .75 }}>{tamil ? 'Apply செய்த நேரத்தில் applicant share செய்த career விவரங்களின் frozen copy. பின்னர் profile edit செய்தாலும் இந்த record மாறாது.' : 'Frozen career details shared when the applicant applied. Later profile edits do not change this record.'}</p>
    <div style={{ display: 'grid', gap: '.75rem' }}>
      <div>
        <strong>{career?.career_headline || role?.title || data.profile?.headline || 'Professional applicant'}</strong>
        {career?.career_summary ? <p style={{ whiteSpace: 'pre-wrap' }}>{career.career_summary}</p> : role?.summary ? <p>{role.summary}</p> : null}
        <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', fontSize: '.86rem', opacity: .8 }}>
          {career?.preferred_location ? <span>Preferred: {career.preferred_location}</span> : null}
          {career?.open_to_remote ? <span>· Remote</span> : null}
          {career?.willing_to_relocate ? <span>· Open to relocate</span> : null}
          {career?.notice_period_days != null ? <span>· Notice {career.notice_period_days} days</span> : null}
          {career?.available_from ? <span>· Available {new Date(`${career.available_from}T00:00:00`).toLocaleDateString()}</span> : null}
        </div>
        {career?.availability_note ? <p style={{ fontSize: '.9rem' }}>{career.availability_note}</p> : null}
      </div>

      {role ? <div><strong>Selected talent</strong><div>{role.title}{role.experience_years != null ? ` · ${role.experience_years} years` : ''}</div></div> : null}
      {skills.length ? <div><strong>Skills</strong><div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.35rem' }}>{skills.map((skill, index) => <span key={skill.id || `${skill.name}-${index}`} style={{ border: '1px solid #e7eaf0', borderRadius: 999, padding: '.2rem .55rem', fontSize: '.84rem' }}>{skill.name || 'Skill'}{skill.proficiency ? ` · ${skill.proficiency}` : ''}{skill.years_experience != null ? ` · ${skill.years_experience}y` : ''}</span>)}</div></div> : null}
      {experiences.length ? <div><strong>Experience</strong><div style={{ display: 'grid', gap: '.55rem', marginTop: '.35rem' }}>{experiences.map((item, index) => <div key={item.id || index}><div><strong>{item.role_title || 'Role'}</strong>{item.organization ? ` · ${item.organization}` : ''}</div><div style={{ fontSize: '.86rem', opacity: .75 }}>{dateLabel(item.start_date)}{item.is_current ? ' – Present' : item.end_date ? ` – ${dateLabel(item.end_date)}` : ''}{item.location ? ` · ${item.location}` : ''}</div>{item.description ? <div style={{ fontSize: '.9rem' }}>{item.description}</div> : null}</div>)}</div></div> : null}
      {education.length ? <div><strong>Education</strong><div style={{ display: 'grid', gap: '.45rem', marginTop: '.35rem' }}>{education.map((item, index) => <div key={item.id || index}><div><strong>{item.qualification || 'Qualification'}</strong>{item.field_of_study ? ` · ${item.field_of_study}` : ''}</div><div style={{ fontSize: '.86rem', opacity: .75 }}>{item.institution || ''}{item.end_date ? ` · ${dateLabel(item.end_date)}` : ''}</div></div>)}</div></div> : null}
      {certifications.length ? <div><strong>Certifications</strong><div style={{ display: 'grid', gap: '.35rem', marginTop: '.35rem' }}>{certifications.map((item, index) => <div key={item.id || index}>{item.name || 'Certification'}{item.issuing_organization ? ` · ${item.issuing_organization}` : ''}{item.credential_url?.startsWith('https://') || item.credential_url?.startsWith('http://') ? <> · <a href={item.credential_url} target="_blank" rel="noreferrer">Credential</a></> : null}</div>)}</div></div> : null}
      <small style={{ opacity: .7 }}>Captured {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.captured_at))} · Snapshot v{row.snapshot_version}. No contact, KYC/legal, grievance or finance data is included.</small>
    </div>
  </details>;
}
