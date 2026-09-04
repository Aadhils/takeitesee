import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Section = 'experience' | 'education' | 'certification' | 'skill';
type ResumeInput = Record<string, unknown> & { section?: unknown; id?: unknown };

const PROFILE_SELECT = 'professional_id,career_headline,career_summary,preferred_location,open_to_remote,willing_to_relocate,available_from,notice_period_days,availability_note,public_resume_enabled,created_at,updated_at';
const EXPERIENCE_SELECT = 'id,professional_id,role_title,organization,employment_type,location,start_date,end_date,is_current,description,display_order,created_at,updated_at';
const EDUCATION_SELECT = 'id,professional_id,institution,qualification,field_of_study,start_date,end_date,description,display_order,created_at,updated_at';
const CERTIFICATION_SELECT = 'id,professional_id,name,issuing_organization,issue_date,expiry_date,credential_id,credential_url,display_order,created_at,updated_at';
const SKILL_SELECT = 'id,professional_id,name,proficiency,years_experience,display_order,created_at,updated_at';

async function getOwnedProfessionalProfile(request: Request) {
  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from('professional_profiles')
    .select('id,user_id,verified')
    .eq('user_id', session.user_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error('A professional provider profile is required to manage a career profile.');
  return { supabase, profile };
}

function sectionValue(value: unknown): Section {
  if (value === 'experience' || value === 'education' || value === 'certification' || value === 'skill') return value;
  throw new Error('Choose a valid resume section.');
}

function requiredId(value: unknown) {
  if (typeof value !== 'string' || value.trim().length < 10) throw new Error('A valid resume item is required.');
  return value.trim();
}

function requiredText(value: unknown, min: number, max: number, label: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max) throw new Error(`${label} must be between ${min} and ${max} characters.`);
  return text;
}

function optionalText(value: unknown, max: number, label: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} is invalid.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return text || null;
}

function optionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be a valid date.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return value;
}

function requiredDate(value: unknown, label: string) {
  const date = optionalDate(value, label);
  if (!date) throw new Error(`${label} is required.`);
  return date;
}

function optionalInteger(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return parsed;
}

function displayOrder(value: unknown) {
  return optionalInteger(value, 0, 9999, 'Display order') ?? 0;
}

function optionalHttpUrl(value: unknown) {
  const text = optionalText(value, 1000, 'Credential URL');
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    return url.toString();
  } catch {
    throw new Error('Credential URL must use http or https.');
  }
}

function normalizeProfile(input: ResumeInput) {
  return {
    career_headline: optionalText(input.career_headline, 160, 'Career headline'),
    career_summary: optionalText(input.career_summary, 2400, 'Career summary'),
    preferred_location: optionalText(input.preferred_location, 160, 'Preferred location'),
    open_to_remote: typeof input.open_to_remote === 'boolean' ? input.open_to_remote : false,
    willing_to_relocate: typeof input.willing_to_relocate === 'boolean' ? input.willing_to_relocate : false,
    available_from: optionalDate(input.available_from, 'Available from'),
    notice_period_days: optionalInteger(input.notice_period_days, 0, 365, 'Notice period'),
    availability_note: optionalText(input.availability_note, 600, 'Availability note'),
    public_resume_enabled: typeof input.public_resume_enabled === 'boolean' ? input.public_resume_enabled : false,
    updated_at: new Date().toISOString(),
  };
}

function normalizeExperience(input: ResumeInput) {
  const isCurrent = typeof input.is_current === 'boolean' ? input.is_current : false;
  const startDate = requiredDate(input.start_date, 'Start date');
  const endDate = isCurrent ? null : optionalDate(input.end_date, 'End date');
  if (endDate && endDate < startDate) throw new Error('End date cannot be before start date.');
  const employmentType = typeof input.employment_type === 'string' ? input.employment_type : 'full_time';
  const allowed = new Set(['full_time', 'part_time', 'contract', 'freelance', 'internship', 'self_employed', 'other']);
  if (!allowed.has(employmentType)) throw new Error('Choose a valid employment type.');
  return {
    role_title: requiredText(input.role_title, 2, 160, 'Role title'),
    organization: requiredText(input.organization, 2, 180, 'Organization'),
    employment_type: employmentType,
    location: optionalText(input.location, 160, 'Location'),
    start_date: startDate,
    end_date: endDate,
    is_current: isCurrent,
    description: optionalText(input.description, 2400, 'Experience description'),
    display_order: displayOrder(input.display_order),
    updated_at: new Date().toISOString(),
  };
}

function normalizeEducation(input: ResumeInput) {
  const startDate = optionalDate(input.start_date, 'Start date');
  const endDate = optionalDate(input.end_date, 'End date');
  if (startDate && endDate && endDate < startDate) throw new Error('Education end date cannot be before start date.');
  return {
    institution: requiredText(input.institution, 2, 180, 'Institution'),
    qualification: requiredText(input.qualification, 2, 180, 'Qualification'),
    field_of_study: optionalText(input.field_of_study, 180, 'Field of study'),
    start_date: startDate,
    end_date: endDate,
    description: optionalText(input.description, 1600, 'Education description'),
    display_order: displayOrder(input.display_order),
    updated_at: new Date().toISOString(),
  };
}

function normalizeCertification(input: ResumeInput) {
  const issueDate = optionalDate(input.issue_date, 'Issue date');
  const expiryDate = optionalDate(input.expiry_date, 'Expiry date');
  if (issueDate && expiryDate && expiryDate < issueDate) throw new Error('Certification expiry date cannot be before issue date.');
  return {
    name: requiredText(input.name, 2, 180, 'Certification name'),
    issuing_organization: requiredText(input.issuing_organization, 2, 180, 'Issuing organization'),
    issue_date: issueDate,
    expiry_date: expiryDate,
    credential_id: optionalText(input.credential_id, 180, 'Credential ID'),
    credential_url: optionalHttpUrl(input.credential_url),
    display_order: displayOrder(input.display_order),
    updated_at: new Date().toISOString(),
  };
}

function normalizeSkill(input: ResumeInput) {
  const proficiency = input.proficiency === null || input.proficiency === undefined || input.proficiency === '' ? null : input.proficiency;
  if (proficiency !== null && proficiency !== 'beginner' && proficiency !== 'intermediate' && proficiency !== 'advanced' && proficiency !== 'expert') {
    throw new Error('Choose a valid skill proficiency.');
  }
  return {
    name: requiredText(input.name, 2, 120, 'Skill name'),
    proficiency,
    years_experience: optionalInteger(input.years_experience, 0, 80, 'Skill experience'),
    display_order: displayOrder(input.display_order),
    updated_at: new Date().toISOString(),
  };
}

function config(section: Section) {
  if (section === 'experience') return { table: 'professional_experiences', select: EXPERIENCE_SELECT, normalize: normalizeExperience };
  if (section === 'education') return { table: 'professional_education', select: EDUCATION_SELECT, normalize: normalizeEducation };
  if (section === 'certification') return { table: 'professional_certifications', select: CERTIFICATION_SELECT, normalize: normalizeCertification };
  return { table: 'professional_skills', select: SKILL_SELECT, normalize: normalizeSkill };
}

function mutationError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to update professional resume.';
  if (message.toLowerCase().includes('duplicate') || message.includes('23505')) {
    return NextResponse.json({ error: 'This resume item already exists.' }, { status: 409 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const [career, experiences, education, certifications, skills, roles] = await Promise.all([
      supabase.from('professional_career_profiles').select(PROFILE_SELECT).eq('professional_id', profile.id).maybeSingle(),
      supabase.from('professional_experiences').select(EXPERIENCE_SELECT).eq('professional_id', profile.id).order('display_order').order('start_date', { ascending: false }),
      supabase.from('professional_education').select(EDUCATION_SELECT).eq('professional_id', profile.id).order('display_order').order('end_date', { ascending: false, nullsFirst: false }),
      supabase.from('professional_certifications').select(CERTIFICATION_SELECT).eq('professional_id', profile.id).order('display_order').order('issue_date', { ascending: false, nullsFirst: false }),
      supabase.from('professional_skills').select(SKILL_SELECT).eq('professional_id', profile.id).order('display_order').order('name'),
      supabase.from('professional_roles').select('id,title,active,freelance_enabled,part_time_enabled,full_time_enabled,contract_enabled').eq('professional_id', profile.id).order('display_order'),
    ]);

    for (const result of [career, experiences, education, certifications, skills, roles]) {
      if (result.error) throw new Error(result.error.message);
    }

    return NextResponse.json({
      verified: Boolean(profile.verified),
      career_profile: career.data ?? null,
      experiences: experiences.data ?? [],
      education: education.data ?? [],
      certifications: certifications.data ?? [],
      skills: skills.data ?? [],
      roles: roles.data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load professional resume.' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json() as ResumeInput;
    const { supabase, profile } = await getOwnedProfessionalProfile(request);

    if (input.section === 'profile') {
      const normalized = normalizeProfile(input);
      const { data, error } = await supabase
        .from('professional_career_profiles')
        .upsert({ professional_id: profile.id, ...normalized }, { onConflict: 'professional_id' })
        .select(PROFILE_SELECT)
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ career_profile: data });
    }

    const section = sectionValue(input.section);
    const id = requiredId(input.id);
    const target = config(section);
    const { data, error } = await supabase
      .from(target.table)
      .update(target.normalize(input))
      .eq('id', id)
      .eq('professional_id', profile.id)
      .select(target.select)
      .maybeSingle();
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    if (!data) return NextResponse.json({ error: 'Resume item not found.' }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (error) {
    return mutationError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as ResumeInput;
    const section = sectionValue(input.section);
    const target = config(section);
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase
      .from(target.table)
      .insert({ professional_id: profile.id, ...target.normalize(input) })
      .select(target.select)
      .single();
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return mutationError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const input = await request.json() as ResumeInput;
    const section = sectionValue(input.section);
    const id = requiredId(input.id);
    const target = config(section);
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase
      .from(target.table)
      .delete()
      .eq('id', id)
      .eq('professional_id', profile.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Resume item not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, id: data.id });
  } catch (error) {
    return mutationError(error);
  }
}
