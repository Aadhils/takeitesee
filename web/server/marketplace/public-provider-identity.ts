import 'server-only';

export type PublicProviderIdentity = {
  provider_type: 'professional' | 'business';
  provider_id: string;
  display_name: string;
  location: string;
  verified: boolean;
};

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function firstRow(value: unknown) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value && typeof value === 'object' ? value : null;
}

export async function loadPublicProviderIdentity(
  supabase: RpcClient,
  providerType: 'professional' | 'business',
  providerId: string | null | undefined,
): Promise<PublicProviderIdentity | null> {
  if (!providerId) return null;

  const { data, error } = await supabase.rpc('get_public_provider_identity', {
    target_provider_type: providerType,
    target_provider_id: providerId,
  });
  if (error) throw new Error(error.message || 'Unable to load public provider identity.');

  const row = firstRow(data) as Record<string, unknown> | null;
  if (!row?.provider_id || !row.provider_type) return null;
  return {
    provider_type: row.provider_type === 'business' ? 'business' : 'professional',
    provider_id: String(row.provider_id),
    display_name: String(row.display_name || ''),
    location: String(row.location || ''),
    verified: row.verified === true,
  };
}
