import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RoleInput = {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  experience_years?: unknown;
  service_bookings_enabled?: unknown;
  freelance_enabled?: unknown;
  part_time_enabled?: unknown;
  full_time_enabled?: unknown;
  contract_enabled?: unknown;
  active?: unknown;
  display_order?: unknown;
};

type NormalizedRole = {
  title: string;
  summary: string | null;
  experience_years: number | null;
  service_bookings_enabled: boolean;
  freelance_enabled: boolean;
  part_time_enabled: boolean;
  full_time_enabled: boolean;
  contract_enabled: boolean;
  active: boolean;
  display_order: number;
};

const ROLE_SELECT = 'id,professional_id,title,summary,experience_years,service_bookings_enabled,freelance_enabled,part_time_enabled,full_time_enabled,contract_enabled,active,display_order,created_at,updated_at';

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeRole(input: RoleInput): NormalizedRole {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title.length < 2 || title.length > 120) throw new Error('Role title must be between 2 and 120 characters.');

  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  if (summary.length > 1200) throw new Error('Role summary must be 1200 characters or fewer.');

  let experienceYears: number | null = null;
  if (input.experience_years !== null && input.experience_years !== undefined && input.experience_years !== '') {
    const parsed = typeof input.experience_years === 'number' ? input.experience_years : Number(input.experience_years);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 80) throw new Error('Experience years must be a whole number from 0 to 80.');
    experienceYears = parsed;
  }

  let displayOrder = 0;
  if (input.display_order !== null && input.display_order !== undefined && input.display_order !== '') {
    const parsed = typeof input.display_order === 'number' ? input.display_order : Number(input.display_order);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) throw new Error('Display order must be a whole number from 0 to 9999.');
    displayOrder = parsed;
  }

  return {
    title,
    summary: summary || null,
    experience_years: experienceYears,
    service_bookings_enabled: normalizeBoolean(input.service_bookings_enabled, true),
    freelance_enabled: normalizeBoolean(input.freelance_enabled, false),
    part_time_enabled: normalizeBoolean(input.part_time_enabled, false),
    full_time_enabled: normalizeBoolean(input.full_time_enabled, false),
    contract_enabled: normalizeBoolean(input.contract_enabled, false),
    active: normalizeBoolean(input.active, true),
    display_order: displayOrder,
  };
}

async function getOwnedProfessionalProfile(request: Request) {
  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from('professional_profiles')
    .select('id,user_id,verified')
    .eq('user_id', session.user_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error('A professional provider profile is required to manage professional roles.');
  return { supabase, profile };
}

function roleId(input: RoleInput) {
  if (typeof input.id !== 'string' || input.id.trim().length < 10) throw new Error('A valid professional role is required.');
  return input.id.trim();
}

function mutationError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to update professional roles.';
  if (message.toLowerCase().includes('duplicate') || message.includes('23505')) {
    return NextResponse.json({ error: 'This professional role already exists on your profile.' }, { status: 409 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase
      .from('professional_roles')
      .select(ROLE_SELECT)
      .eq('professional_id', profile.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ roles: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load professional roles.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as RoleInput;
    const normalized = normalizeRole(input);
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase
      .from('professional_roles')
      .insert({ professional_id: profile.id, ...normalized })
      .select(ROLE_SELECT)
      .single();

    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    return NextResponse.json({ role: data }, { status: 201 });
  } catch (error) {
    return mutationError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json() as RoleInput;
    const id = roleId(input);
    const normalized = normalizeRole(input);
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase
      .from('professional_roles')
      .update({ ...normalized, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('professional_id', profile.id)
      .select(ROLE_SELECT)
      .maybeSingle();

    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    if (!data) return NextResponse.json({ error: 'Professional role not found.' }, { status: 404 });
    return NextResponse.json({ role: data });
  } catch (error) {
    return mutationError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const input = await request.json() as RoleInput;
    const id = roleId(input);
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase
      .from('professional_roles')
      .delete()
      .eq('id', id)
      .eq('professional_id', profile.id)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Professional role not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true, id: data.id });
  } catch (error) {
    return mutationError(error);
  }
}
