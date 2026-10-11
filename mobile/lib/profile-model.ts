export type ProfileScope = 'customer' | 'professional' | 'business';
export type IdentityMedia = {
  scope: ProfileScope;
  entity_id: string;
  bucket: string;
  upload_prefix: string;
  avatar_url: string | null;
  banner_url: string | null;
  has_avatar: boolean;
  has_banner: boolean;
};
export type WorkspaceOption = { id: string; label: string; display_name: string; verified?: boolean };
export type NativeProfile = { scope: ProfileScope; label: string; name: string; verified: boolean; media: IdentityMedia | null; mediaError?: string };
export type MediaKind = 'avatar' | 'banner';

export function profileContext(scope: ProfileScope) {
  return scope === 'customer' ? 'customer' : 'provider';
}

export function profileDestination(scope: ProfileScope): '/account' | '/provider' {
  return scope === 'customer' ? '/account' : '/provider';
}

export function ownedWorkspaces(options: WorkspaceOption[]) {
  const profiles = options.filter((option): option is WorkspaceOption & { id: ProfileScope } =>
    option.id === 'customer' || option.id === 'professional' || option.id === 'business');
  if (profiles.filter((profile) => profile.id === 'customer').length !== 1) throw new Error('Your Customer profile could not load.');
  if (profiles.filter((profile) => profile.id !== 'customer').length > 1) throw new Error('Your Provider identity needs review. Please open account settings on the web.');
  return profiles;
}

export function resolveProfileSelection(profiles: Pick<NativeProfile, 'scope'>[], preferred: unknown): ProfileScope {
  return profiles.find((profile) => profile.scope === preferred)?.scope ?? 'customer';
}

export function profileInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

export const MAX_IDENTITY_IMAGE_BYTES = 6 * 1024 * 1024;

export function inspectIdentityImage(buffer: ArrayBuffer) {
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_IDENTITY_IMAGE_BYTES) throw new Error('Choose a photo up to 6 MB.');
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: 'image/jpeg', extension: 'jpg' };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return { contentType: 'image/png', extension: 'png' };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { contentType: 'image/webp', extension: 'webp' };
  throw new Error('Choose a JPG, PNG or WebP photo.');
}
