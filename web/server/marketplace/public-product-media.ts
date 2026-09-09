import { createSupabaseServiceClient } from '../../lib/supabase/service';

const bucket = 'business-product-media';
const chunkSize = 500;
const signedImageLifetimeSeconds = 60;

export async function loadProductImagePresence(productIds: string[]) {
  const present = new Set<string>();
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return present;

  try {
    const serviceRole = createSupabaseServiceClient();
    for (let start = 0; start < ids.length; start += chunkSize) {
      const chunk = ids.slice(start, start + chunkSize);
      const { data, error } = await serviceRole
        .from('business_products')
        .select('id,primary_image_object_path')
        .in('id', chunk);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const id = String(row.id || '');
        if (id && typeof row.primary_image_object_path === 'string' && row.primary_image_object_path.trim()) {
          present.add(id);
        }
      }
    }
  } catch {
    // Product media is presentation-only. A media enrichment failure must never
    // broaden public visibility or hide an otherwise public Product.
    return new Set<string>();
  }

  return present;
}

export async function createPublicEligibleProductImageUrl(productId: string, businessId: string) {
  try {
    const serviceRole = createSupabaseServiceClient();
    const { data: product, error } = await serviceRole
      .from('business_products')
      .select('primary_image_object_path')
      .eq('id', productId)
      .eq('business_id', businessId)
      .maybeSingle();
    if (error || typeof product?.primary_image_object_path !== 'string' || !product.primary_image_object_path.trim()) return null;

    const expectedPrefix = `business/${businessId}/product/${productId}/`;
    if (!product.primary_image_object_path.startsWith(expectedPrefix)) return null;

    const { data, error: signError } = await serviceRole.storage
      .from(bucket)
      .createSignedUrl(product.primary_image_object_path, signedImageLifetimeSeconds);
    if (signError || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
