import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'professional-portfolio-media';
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const MEDIA_SELECT = 'id,professional_id,professional_role_id,media_type,object_path,original_filename,mime_type,size_bytes,caption,alt_text,active,display_order,created_at,updated_at';

type MediaInput = {
  id?: unknown;
  object_path?: unknown;
  original_filename?: unknown;
  professional_role_id?: unknown;
  caption?: unknown;
  alt_text?: unknown;
  active?: unknown;
  display_order?: unknown;
};

type MediaRow = {
  id: string;
  professional_id: string;
  professional_role_id: string | null;
  media_type: 'image' | 'video';
  object_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number | string;
  caption: string | null;
  alt_text: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

async function getOwnedProfessionalProfile(request: Request) {
  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from('professional_profiles')
    .select('id,user_id,verified')
    .eq('user_id', session.user_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error('A professional provider profile is required to manage portfolio media.');
  return { supabase, profile };
}

function requiredId(value: unknown, label = 'Portfolio media') {
  if (typeof value !== 'string' || value.trim().length < 10) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalRoleId(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim().length < 10) throw new Error('Choose a valid professional role.');
  return value.trim();
}

function textValue(value: unknown, max: number, label: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`${label} is invalid.`);
  const clean = value.trim();
  if (clean.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return clean || null;
}

function displayOrderValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) throw new Error('Display order must be a whole number from 0 to 9999.');
  return parsed;
}

async function signMedia(row: MediaRow) {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(row.object_path, SIGNED_URL_TTL_SECONDS);
  return { ...row, signed_url: error ? null : data?.signedUrl ?? null };
}

function mutationError(error: unknown, fallback = 'Unable to update professional portfolio media.') {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase
      .from('professional_portfolio_media')
      .select(MEDIA_SELECT)
      .eq('professional_id', profile.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const media = await Promise.all(((data ?? []) as MediaRow[]).map(signMedia));
    return NextResponse.json({ media });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load professional portfolio media.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as MediaInput;
    const objectPath = requiredId(input.object_path, 'Uploaded portfolio media path');
    const originalFilename = typeof input.original_filename === 'string' ? input.original_filename.trim() : '';
    if (!originalFilename || originalFilename.length > 255) throw new Error('Portfolio file name is invalid.');
    const roleId = optionalRoleId(input.professional_role_id);
    const caption = textValue(input.caption, 600, 'Portfolio caption');
    const altText = textValue(input.alt_text, 240, 'Portfolio alt text');
    const active = typeof input.active === 'boolean' ? input.active : true;

    const { supabase } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase.rpc('register_professional_portfolio_media', {
      target_object_path: objectPath,
      target_original_filename: originalFilename,
      target_professional_role_id: roleId,
      target_caption: caption,
      target_alt_text: altText,
      target_active: active,
    }).maybeSingle();

    if (error || !data) throw new Error(error?.message ?? 'Portfolio media could not be registered.');
    return NextResponse.json({ media: await signMedia(data as MediaRow) }, { status: 201 });
  } catch (error) {
    return mutationError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json() as MediaInput;
    const id = requiredId(input.id);
    const roleId = optionalRoleId(input.professional_role_id);
    const caption = textValue(input.caption, 600, 'Portfolio caption');
    const altText = textValue(input.alt_text, 240, 'Portfolio alt text');
    const active = typeof input.active === 'boolean' ? input.active : true;
    const displayOrder = displayOrderValue(input.display_order);

    const { supabase } = await getOwnedProfessionalProfile(request);
    const { data, error } = await supabase.rpc('update_professional_portfolio_media', {
      target_media_id: id,
      target_professional_role_id: roleId,
      target_caption: caption,
      target_alt_text: altText,
      target_active: active,
      target_display_order: displayOrder,
    }).maybeSingle();

    if (error || !data) throw new Error(error?.message ?? 'Portfolio media could not be updated.');
    return NextResponse.json({ media: await signMedia(data as MediaRow) });
  } catch (error) {
    return mutationError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const input = await request.json() as MediaInput;
    const id = requiredId(input.id);
    const { supabase, profile } = await getOwnedProfessionalProfile(request);

    const { data: media, error: mediaError } = await supabase
      .from('professional_portfolio_media')
      .select('id,object_path')
      .eq('id', id)
      .eq('professional_id', profile.id)
      .maybeSingle();
    if (mediaError) throw new Error(mediaError.message);
    if (!media) return NextResponse.json({ error: 'Portfolio media was not found.' }, { status: 404 });

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([media.object_path]);
    if (removeError) throw new Error(removeError.message);

    const { data: deleted, error: deleteError } = await supabase.rpc('delete_professional_portfolio_media', {
      target_media_id: id,
    }).maybeSingle();
    if (deleteError || !deleted) throw new Error(deleteError?.message ?? 'Portfolio media metadata could not be deleted.');

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return mutationError(error, 'Unable to delete professional portfolio media.');
  }
}