import { createClient } from '@supabase/supabase-js';
import PublicProviderIdentityHero from './PublicProviderIdentityHero';
import styles from './PublicProviderIdentity.module.css';

type ProviderKind = 'professional' | 'business';
const BUCKET = 'provider-identity-media';

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function validMediaPath(kind: ProviderKind, providerId: string, mediaKind: 'avatar' | 'banner', path: unknown) {
  if (typeof path !== 'string') return null;
  const prefix = `${kind}/${providerId}/${mediaKind}/`;
  if (!path.startsWith(prefix)) return null;
  const fileName = path.slice(prefix.length);
  return /^[0-9A-Fa-f-]{36}\.(?:jpg|png|webp)$/.test(fileName) ? path : null;
}

export default async function PublicProviderIdentityLayout({
  kind,
  providerId,
  children,
}: {
  kind: ProviderKind;
  providerId: string;
  children: React.ReactNode;
}) {
  const supabase = publicSupabase();
  if (!supabase) return <>{children}</>;

  const query = kind === 'professional'
    ? supabase
        .from('professional_profiles')
        .select('id,headline,description,service_area,verified,avatar_object_path,banner_object_path')
        .eq('id', providerId)
        .eq('verified', true)
        .maybeSingle()
    : supabase
        .from('businesses')
        .select('id,name,description,location,verified,avatar_object_path,banner_object_path')
        .eq('id', providerId)
        .eq('verified', true)
        .maybeSingle();

  const { data, error } = await query;
  if (error || !data) return <>{children}</>;

  const row = data as Record<string, unknown>;
  const displayName = kind === 'professional' ? String(row.headline || '') : String(row.name || '');
  const description = String(row.description || '');
  const location = kind === 'professional' ? String(row.service_area || '') : String(row.location || '');
  const avatarPath = validMediaPath(kind, providerId, 'avatar', row.avatar_object_path);
  const bannerPath = validMediaPath(kind, providerId, 'banner', row.banner_object_path);
  const avatarUrl = avatarPath ? supabase.storage.from(BUCKET).getPublicUrl(avatarPath).data.publicUrl : null;
  const bannerUrl = bannerPath ? supabase.storage.from(BUCKET).getPublicUrl(bannerPath).data.publicUrl : null;

  return <div className={styles.frame}>
    <PublicProviderIdentityHero
      kind={kind}
      displayName={displayName}
      description={description}
      location={location}
      avatarUrl={avatarUrl}
      bannerUrl={bannerUrl}
    />
    <div className={styles.legacyBody}>{children}</div>
  </div>;
}
