import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'identity-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

type IdentityContext = 'customer' | 'provider';
type IdentityScope = 'customer' | 'professional' | 'business';
type MediaKind = 'avatar' | 'banner';
type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ResolvedIdentity = {
  context: IdentityContext;
  scope: IdentityScope;
  userId: string;
  entityId: string;
  avatarPath: string | null;
  bannerPath: string | null;
};

type PersistedIdentity = {
  scope?: IdentityScope;
  entity_id?: string;
  avatar_object_path?: string | null;
  banner_object_path?: string | null;
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

async function resolveIdentity(request: Request, context: IdentityContext): Promise<{ identity: ResolvedIdentity; supabase: ServerSupabase }> {
  if (context === 'customer') {
    const session = await productionAuthProvider.requireCustomer(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('avatar_object_path,banner_object_path')
      .eq('user_id', session.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Customer profile is required.');
    return {
      supabase,
      identity: {
        context,
        scope: 'customer',
        userId: session.user_id,
        entityId: session.user_id,
        avatarPath: data.avatar_object_path ?? null,
        bannerPath: data.banner_object_path ?? null,
      },
    };
  }

  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();

  if (session.roles.includes('professional')) {
    const { data, error } = await supabase
      .from('professional_profiles')
      .select('id,avatar_object_path,banner_object_path')
      .eq('user_id', session.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required.');
    return {
      supabase,
      identity: {
        context,
        scope: 'professional',
        userId: session.user_id,
        entityId: data.id,
        avatarPath: data.avatar_object_path ?? null,
        bannerPath: data.banner_object_path ?? null,
      },
    };
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('id,avatar_object_path,banner_object_path')
    .eq('owner_user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Business profile is required.');
  return {
    supabase,
    identity: {
      context,
      scope: 'business',
      userId: session.user_id,
      entityId: data.id,
      avatarPath: data.avatar_object_path ?? null,
      bannerPath: data.banner_object_path ?? null,
    },
  };
}

function uploadPrefix(identity: ResolvedIdentity) {
  return `${identity.userId}/${identity.scope}/${identity.entityId}`;
}

async function signedUrl(supabase: ServerSupabase, path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return error ? null : data?.signedUrl ?? null;
}

async function responseIdentity(supabase: ServerSupabase, identity: ResolvedIdentity) {
  const [avatarUrl, bannerUrl] = await Promise.all([
    signedUrl(supabase, identity.avatarPath),
    signedUrl(supabase, identity.bannerPath),
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

async function assertUploadedObject(supabase: ServerSupabase, folder: string, fileName: string) {
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 100, search: fileName });
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((item) => item.name === fileName)) throw new Error('Uploaded identity media was not found.');
}

async function persistPath(supabase: ServerSupabase, identity: ResolvedIdentity, kind: MediaKind, objectPath: string | null) {
  const { data, error } = await supabase.rpc('set_my_identity_media_path', {
    target_context: identity.context,
    target_kind: kind,
    target_path: objectPath,
  });
  if (error) throw new Error(error.message);

  const persisted = (data ?? {}) as PersistedIdentity;
  if (!persisted.entity_id || persisted.scope !== identity.scope) throw new Error('Identity media could not be saved.');
  return {
    ...identity,
    entityId: persisted.entity_id,
    avatarPath: persisted.avatar_object_path ?? null,
    bannerPath: persisted.banner_object_path ?? null,
  };
}

async function removeObject(supabase: ServerSupabase, path: string | null) {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

function jsonError(error: unknown, status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unable to manage identity media.' },
    { status, headers: noStoreHeaders },
  );
}

export async function GET(request: Request) {
  try {
    const { identity, supabase } = await resolveIdentity(request, requestedContext(request));
    return NextResponse.json({ identity: await responseIdentity(supabase, identity) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error, 401);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = requestedContext(request);
    const input = await request.json() as { kind?: unknown; object_path?: unknown };
    const kind = requestedKind(input.kind);
    const { identity, supabase } = await resolveIdentity(request, context);
    const { objectPath, folder, fileName } = validateObjectPath(identity, kind, input.object_path);
    await assertUploadedObject(supabase, folder, fileName);

    const oldPath = kind === 'avatar' ? identity.avatarPath : identity.bannerPath;
    const updated = await persistPath(supabase, identity, kind, objectPath);
    if (oldPath && oldPath !== objectPath) await removeObject(supabase, oldPath);

    return NextResponse.json({ identity: await responseIdentity(supabase, updated) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = requestedContext(request);
    const input = await request.json() as { kind?: unknown };
    const kind = requestedKind(input.kind);
    const { identity, supabase } = await resolveIdentity(request, context);
    const oldPath = kind === 'avatar' ? identity.avatarPath : identity.bannerPath;
    const updated = await persistPath(supabase, identity, kind, null);
    await removeObject(supabase, oldPath);
    return NextResponse.json({ identity: await responseIdentity(supabase, updated) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error);
  }
}
