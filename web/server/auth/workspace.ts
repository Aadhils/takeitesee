import { cookies } from 'next/headers';

export const WORKSPACE_COOKIE = 'takeitesee_workspace';

export type WorkspaceKind = 'customer' | 'professional' | 'business' | 'admin' | 'super_admin';

const WORKSPACE_VALUES = new Set<WorkspaceKind>(['customer', 'professional', 'business', 'admin', 'super_admin']);

export function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return typeof value === 'string' && WORKSPACE_VALUES.has(value as WorkspaceKind);
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function workspacePreferenceFromRequest(request?: Request): WorkspaceKind | null {
  const value = cookieValue(request?.headers.get('cookie') ?? null, WORKSPACE_COOKIE);
  return isWorkspaceKind(value) ? value : null;
}

export async function getWorkspacePreference(request?: Request): Promise<WorkspaceKind | null> {
  const requestPreference = workspacePreferenceFromRequest(request);
  if (requestPreference) return requestPreference;

  // Some server repositories call auth helpers without forwarding the Request object.
  // Next's server cookie store keeps the signed-in user's workspace preference available
  // in those paths without treating the cookie as an authorization claim.
  const store = await cookies();
  const value = store.get(WORKSPACE_COOKIE)?.value;
  return isWorkspaceKind(value) ? value : null;
}

export function workspaceTarget(workspace: WorkspaceKind) {
  if (workspace === 'professional' || workspace === 'business') return '/provider';
  if (workspace === 'admin') return '/admin';
  if (workspace === 'super_admin') return '/super-admin';
  return '/account';
}
