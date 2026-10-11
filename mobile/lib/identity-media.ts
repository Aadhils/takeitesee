import * as Crypto from 'expo-crypto';
import { ApiError, apiFetch } from './api';
import { supabase } from './supabase';
import { inspectIdentityImage, ownedWorkspaces, profileContext, type IdentityMedia, type MediaKind, type NativeProfile, type ProfileScope, type WorkspaceOption } from './profile-model';

async function ownerAccessToken(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Please sign in again to manage your profile.');
  return data.session.access_token;
}

export async function fetchIdentityMedia(userId: string, scope: ProfileScope) {
  const accessToken = await ownerAccessToken(userId);
  const result = await apiFetch<{ identity: IdentityMedia }>(`/api/identity-media?context=${profileContext(scope)}`, { accessToken });
  if (result.identity.scope !== scope) throw new Error('This profile is unavailable.');
  return result.identity;
}

export async function fetchNativeProfiles(userId: string): Promise<NativeProfile[]> {
  const accessToken = await ownerAccessToken(userId);
  const payload = await apiFetch<{ workspaces: WorkspaceOption[] }>('/api/account/workspaces', { accessToken });
  const workspaces = ownedWorkspaces(payload.workspaces);
  return Promise.all(workspaces.map(async (workspace) => {
    const profile = { scope: workspace.id, label: workspace.label, name: workspace.display_name, verified: Boolean(workspace.verified) };
    try {
      return { ...profile, media: await fetchIdentityMedia(userId, workspace.id) };
    } catch {
      return { ...profile, media: null, mediaError: 'Profile photos could not load. Tap Retry to refresh.' };
    }
  }));
}

export async function uploadIdentityMedia(userId: string, scope: ProfileScope, kind: MediaKind, buffer: ArrayBuffer) {
  const image = inspectIdentityImage(buffer);
  const identity = await fetchIdentityMedia(userId, scope);
  const objectPath = `${identity.upload_prefix}/${kind}/${Crypto.randomUUID()}.${image.extension}`;
  await ownerAccessToken(userId);
  const { error } = await supabase.storage.from(identity.bucket).upload(objectPath, buffer, { contentType: image.contentType, cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  try {
    const accessToken = await ownerAccessToken(userId);
    const result = await apiFetch<{ identity: IdentityMedia }>(`/api/identity-media?context=${profileContext(scope)}`, {
      method: 'PATCH', accessToken, body: JSON.stringify({ kind, object_path: objectPath }),
    });
    if (result.identity.scope !== scope) throw new Error('Your profile changed. Please refresh before continuing.');
    return result.identity;
  } catch (cause) {
    // Only remove a definitively rejected upload. A lost response may have committed successfully.
    if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
      try { await ownerAccessToken(userId); await supabase.storage.from(identity.bucket).remove([objectPath]); } catch { /* Retry can safely upload to a new unique path. */ }
    }
    throw cause;
  }
}

export async function removeIdentityMedia(userId: string, scope: ProfileScope, kind: MediaKind) {
  await fetchIdentityMedia(userId, scope);
  const accessToken = await ownerAccessToken(userId);
  const result = await apiFetch<{ identity: IdentityMedia }>(`/api/identity-media?context=${profileContext(scope)}`, {
    method: 'DELETE', accessToken, body: JSON.stringify({ kind }),
  });
  if (result.identity.scope !== scope) throw new Error('Your profile changed. Please refresh before continuing.');
  return result.identity;
}
