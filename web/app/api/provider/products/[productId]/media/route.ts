import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'business-product-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

type OwnedProduct = {
  id: string;
  business_id: string;
  primary_image_object_path: string | null;
  review_revision: number;
};

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function jsonError(error: unknown, status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unable to manage product media.' },
    { status, headers: noStoreHeaders },
  );
}

async function resolveOwnedProduct(request: Request, productId: string): Promise<{ supabase: ServerSupabase; product: OwnedProduct }> {
  if (!productId) throw new Error('Product ID is required.');
  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();

  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
  ]);
  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) throw new Error('Business Provider identity is required to manage product media.');
  if (!business?.id) throw new Error('Business Provider identity was not found.');

  const { data, error } = await supabase
    .from('business_products')
    .select('id,business_id,primary_image_object_path,review_revision')
    .eq('id', productId)
    .eq('business_id', String(business.id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Product was not found or is not owned by this Business.');

  return {
    supabase,
    product: {
      id: String(data.id),
      business_id: String(data.business_id),
      primary_image_object_path: (data.primary_image_object_path as string | null) ?? null,
      review_revision: Number(data.review_revision ?? 1),
    },
  };
}

function uploadPrefix(product: OwnedProduct) {
  return `business/${product.business_id}/product/${product.id}`;
}

async function signedImageUrl(supabase: ServerSupabase, path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return error ? null : data?.signedUrl ?? null;
}

async function responseMedia(supabase: ServerSupabase, product: OwnedProduct) {
  return {
    bucket: BUCKET,
    upload_prefix: uploadPrefix(product),
    image_url: await signedImageUrl(supabase, product.primary_image_object_path),
    has_image: Boolean(product.primary_image_object_path),
    review_revision: product.review_revision,
  };
}

function validateObjectPath(product: OwnedProduct, value: unknown) {
  if (typeof value !== 'string') throw new Error('Uploaded product image path is required.');
  const prefix = `${uploadPrefix(product)}/`;
  if (!value.startsWith(prefix)) throw new Error('Product image path does not belong to this Business product.');
  const fileName = value.slice(prefix.length);
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(fileName)) throw new Error('Product image file path is invalid.');
  return { objectPath: value, folder: uploadPrefix(product), fileName };
}

async function assertUploadedObject(supabase: ServerSupabase, folder: string, fileName: string) {
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 100, search: fileName });
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((item) => item.name === fileName)) throw new Error('Uploaded product image was not found.');
}

async function persistPath(product: OwnedProduct, path: string | null): Promise<OwnedProduct> {
  const serviceRole = createSupabaseServiceClient();
  const { data, error } = await serviceRole
    .from('business_products')
    .update({ primary_image_object_path: path })
    .eq('id', product.id)
    .eq('business_id', product.business_id)
    .select('id,business_id,primary_image_object_path,review_revision')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Product image path could not be saved.');
  return {
    id: String(data.id),
    business_id: String(data.business_id),
    primary_image_object_path: (data.primary_image_object_path as string | null) ?? null,
    review_revision: Number(data.review_revision ?? product.review_revision),
  };
}

async function removeObject(supabase: ServerSupabase, path: string | null) {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function GET(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const { productId } = await context.params;
    const { supabase, product } = await resolveOwnedProduct(request, productId);
    return NextResponse.json({ media: await responseMedia(supabase, product) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const { productId } = await context.params;
    const input = await request.json() as { object_path?: unknown };
    const { supabase, product } = await resolveOwnedProduct(request, productId);
    const { objectPath, folder, fileName } = validateObjectPath(product, input.object_path);
    await assertUploadedObject(supabase, folder, fileName);

    const oldPath = product.primary_image_object_path;
    const updated = await persistPath(product, objectPath);
    if (oldPath && oldPath !== objectPath) await removeObject(supabase, oldPath);

    return NextResponse.json({ media: await responseMedia(supabase, updated) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const { productId } = await context.params;
    const { supabase, product } = await resolveOwnedProduct(request, productId);
    const oldPath = product.primary_image_object_path;
    const updated = await persistPath(product, null);
    await removeObject(supabase, oldPath);
    return NextResponse.json({ media: await responseMedia(supabase, updated) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error);
  }
}
