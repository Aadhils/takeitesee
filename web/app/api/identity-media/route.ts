import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { createSupabaseServiceClient } from '../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'identity-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

type IdentityContext = 'customer' | 'provider';
type IdentityScope = 'customer' | 'professional' | 'business';
type MediaKind = 'avatar' | 'banner';
type IdentityRow = { avatar_object_path: string | null; banner_object_path: string | null };
type ResolvedIdentity = {
  context: IdentityContext;
  scope: IdentityScope;
  userId: string;
  entityId: string;
  avatarPath: string | null;
  bannerPath: string | null;
  table: 'customer_profiles' | 'professional_profiles' | 'businesses';
  ownerColumn: 'user_id' | 'id';
  ownerValue: string;
  customerProfileExists?: boolean;
};

function requestedContext(request: Request): IdentityContext {
  const value = new URL(request.url).searchParams.get('context');
  if (value === 'customer' || value === 'provider') return value;
  throw new Error('Choose a valid identity-media context.');
}

function requestedKind(value: unknown): MediaKind {
  if (value === 'avatar' || value === 'banner') return value;
  throw new Error('Choose avatar or banner media.');
}

async function resolveIdentity(request: Request, context: IdentityContext): Promise<ResolvedIdentity> {
  const service = createSupabaseServiceClient();

  if (context === 'customer') {
    const session = await productionAuthProvider.requireCustomer(request);
    const { data, error } = await service
      .from('customer_profiles')
      .select('id,avatar_object_path,banner_object_path')
      .eq('user_id', session.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      context,
      scope: 'customer',
      userId: session.user_id,
      entityId: session.user_id,
      avatarPath: data?.avatar_object_path ?? null,
      bannerPath: data?.banner_object_path ?? null,
      table: 'customer_profiles',
      ownerColumn: 'user_id',
      ownerValue: session.user_id,
      customerProfileExists: Boolean(data),
    };
  }

  const session = await productionAuthProvider.requireProvider(request);
  if (session.roles.includes('professional')) {
    const { data, error } = await service
      .from('professional_profiles')
      .select('id,avatar_object_path,banner_object_path')
      .eq('user_id', session.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required.');
    return {
      context,
      scope: 'professional',
      userId: session.user_id,
      entityId: data.id,
      avatarPath: data.avatar_object_path ?? null,
      bannerPath: data.banner_object_path ?? null,
      table: 'professional_profiles',
      ownerColumn: 'id',
      ownerValue: data.id,
    };
  }

  const { data, error } = await service
    .from('businesses')
    .select('id,avatar_object_path,banner_object_path')
    .eq('owner_user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Business profile is required.');
  return {
    context,
    scope: 'business',
    userId: session.user_id,
    entityId: data.id,
    avatarPath: data.avatar_object_path ?? null,
    bannerPath: data.banner_object_path ?? null,
    table: 'businesses',
    ownerColumn: 'id',
    ownerValue: data.id,
  };
}

function uploadPrefix(identity: ResolvedIdentity) {
  return `${identity.userId}/${identity.scope}/${identity.entityId}`;
}

async function signedUrl(path: string | null) {
  if (!path) return null;
  const service = createSupabaseServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return error ? null : data?.signedUrl ?? null;
}

async function responseIdentity(identity: ResolvedIdentity) {
  const [avatarUrl, bannerUrl] = await Promise.all([
    signedUrl(identity.avatarPath),
    signedUrl(identity.bannerPath),
  ]);
  return {
    scope: identity.scope,
    entity_id: identity.entityId,
    upload_prefix: uploadPrefix(identity),
    avatar_url: avatarUrl,
    banner_url: bannerUrl,
    has_avatar: Boolean(identity.avatarPath),
    has_banner: Boolean(identity.bannerPath),
  };
}

function validateObjectPath(identity: ResolvedIdentity, kind: MediaKind, objectPath: unknown) {
  if (typeof objectPath !== 'string') throw new Error('Uploaded identity media path is required.');
  const folder = `${uploadPrefix(identity)}/${kind}`;
  const expectedPrefix = `${folder}/`;
  if (!objectPath.startsWith(expectedPrefix)) throw new Error('Identity media path does not belong to this account workspace.');
  const fileName = objectPath.slice(expectedPrefix.length);
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(fileName)) throw new Error('Identity media file path is invalid.');
  return { objectPath, folder, fileName };
}

async function assertUploadedObject(folder: string, fileName: string) {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.storage.from(BUCKET).list(folder, { limit: 100, search: fileName });
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((item) => item.name === fileName)) throw new Error('Uploaded identity media was not found.');
}

async function persistPath(identity: ResolvedIdentity, kind: MediaKind, objectPath: string | null) {
  const service = createSupabaseServiceClient();
  const column = kind === 'avatar' ? 'avatar_object_path' : 'banner_object_path';
  const updatedAt = new Date().toISOString();

  let data: IdentityRow | null = null;
  let error: { message: string } | null = null;
  if (identity.table === 'customer_profiles' && !identity.customerProfileExists) {
    const result = await service
      .from('customer_profiles')
      .upsert({ user_id: identity.userId, [column]: objectPath, updated_at: updatedAt }, { onConflict: 'user_id' })
      .select('avatar_object_path,banner_object_path')
      .maybeSingle();
    data = result.data as IdentityRow | null;
    error = result.error;
  } else {
    const result = await service
      .from(identity.table)
      .update({ [column]: objectPath, updated_at: updatedAt })
      .eq(identity.ownerColumn, identity.ownerValue)
      .select('avatar_object_path,banner_object_path')
      .maybeSingle();
    data = result.data as IdentityRow | null;
    error = result.error;
  }

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Identity media could not be saved.');
  return {
    ...identity,
    avatarPath: data.avatar_object_path ?? null,
    bannerPath: data.banner_object_path ?? null,
    customerProfileExists: identity.table === 'customer_profiles' ? true : identity.customerProfileExists,
  };
}

async function removeObject(path: string | null) {
  if (!path) return;
  const service = createSupabaseServiceClient();
  await service.storage.from(BUCKET).remove([path]);
}

function jsonError(error: unknown, status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unable to manage identity media.' },
    { status, headers: noStoreHeaders },
  );
}

export async function GET(request: Request) {
  try {
    const identity = await resolveIdentity(request, requestedContext(request));
    return NextResponse.json({ identity: await responseIdentity(identity) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error, 401);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = requestedContext(request);
    const input = await request.json() as { kind?: unknown; object_path?: unknown };
    const kind = requestedKind(input.kind);
    const identity = await resolveIdentity(request, context);
    const { objectPath, folder, fileName } = validateObjectPath(identity, kind, input.object_path);
    await assertUploadedObject(folder, fileName);

    const oldPath = kind === 'avatar' ? identity.avatarPath : identity.bannerPath;
    const updated = await persistPath(identity, kind, objectPath);
    if (oldPath && oldPath !== objectPath) await removeObject(oldPath);

    return NextResponse.json({ identity: await responseIdentity(updated) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = requestedContext(request);
    const input = await request.json() as { kind?: unknown };
    const kind = requestedKind(input.kind);
    const identity = await resolveIdentity(request, context);
    const oldPath = kind === 'avatar' ? identity.avatarPath : identity.bannerPath;
    const updated = await persistPath(identity, kind, null);
    await removeObject(oldPath);
    return NextResponse.json({ identity: await responseIdentity(updated) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error);
  }
}
