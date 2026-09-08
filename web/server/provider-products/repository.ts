import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';

export type BusinessProductStatus = 'draft' | 'active' | 'paused';
export type BusinessProductStockMode = 'in_stock' | 'out_of_stock' | 'made_to_order';

export interface BusinessProductRecord {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  currency: string;
  unit_label: string;
  stock_mode: BusinessProductStockMode;
  status: BusinessProductStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateBusinessProductInput {
  name: string;
  description?: string | null;
  sku?: string | null;
  price: number;
  currency?: string;
  unit_label?: string;
  stock_mode?: BusinessProductStockMode;
  status?: BusinessProductStatus;
}

export type UpdateBusinessProductInput = Partial<CreateBusinessProductInput>;

type BusinessIdentity = { business_id: string };

const statuses: BusinessProductStatus[] = ['draft', 'active', 'paused'];
const stockModes: BusinessProductStockMode[] = ['in_stock', 'out_of_stock', 'made_to_order'];

async function resolveBusinessIdentity(session: ServerCustomerSession): Promise<BusinessIdentity> {
  const supabase = await createSupabaseServerClient();
  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
  ]);
  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) throw new Error('Business Provider identity is required to manage products.');
  if (!business) throw new Error('Business Provider identity was not found.');
  return { business_id: String(business.id) };
}

function normalizeText(value: unknown, field: string, max: number, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(`${field} is required.`);
  if (text.length > max) throw new Error(`${field} is too long.`);
  return text || null;
}

function normalizePrice(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) throw new Error('Product price is invalid.');
  return Math.round(price * 100) / 100;
}

function normalizeCurrency(value: unknown) {
  const currency = String(value ?? 'INR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter code.');
  return currency;
}

function normalizeStatus(value: unknown): BusinessProductStatus {
  const status = String(value ?? 'draft') as BusinessProductStatus;
  if (!statuses.includes(status)) throw new Error('Product catalog status is invalid.');
  return status;
}

function normalizeStockMode(value: unknown): BusinessProductStockMode {
  const mode = String(value ?? 'in_stock') as BusinessProductStockMode;
  if (!stockModes.includes(mode)) throw new Error('Product stock mode is invalid.');
  return mode;
}

function createPayload(input: CreateBusinessProductInput) {
  return {
    name: normalizeText(input.name, 'Product name', 160, true)!,
    description: normalizeText(input.description, 'Description', 5000),
    sku: normalizeText(input.sku, 'SKU', 64)?.toUpperCase() ?? null,
    price: normalizePrice(input.price),
    currency: normalizeCurrency(input.currency),
    unit_label: normalizeText(input.unit_label ?? 'item', 'Unit label', 40, true)!,
    stock_mode: normalizeStockMode(input.stock_mode),
    status: normalizeStatus(input.status),
  };
}

function updatePayload(input: UpdateBusinessProductInput) {
  const payload: Record<string, unknown> = {};
  if ('name' in input) payload.name = normalizeText(input.name, 'Product name', 160, true)!;
  if ('description' in input) payload.description = normalizeText(input.description, 'Description', 5000);
  if ('sku' in input) payload.sku = normalizeText(input.sku, 'SKU', 64)?.toUpperCase() ?? null;
  if ('price' in input) payload.price = normalizePrice(input.price);
  if ('currency' in input) payload.currency = normalizeCurrency(input.currency);
  if ('unit_label' in input) payload.unit_label = normalizeText(input.unit_label, 'Unit label', 40, true)!;
  if ('stock_mode' in input) payload.stock_mode = normalizeStockMode(input.stock_mode);
  if ('status' in input) payload.status = normalizeStatus(input.status);
  if (!Object.keys(payload).length) throw new Error('No product changes were provided.');
  return payload;
}

function mapProduct(row: Record<string, unknown>): BusinessProductRecord {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    sku: (row.sku as string | null) ?? null,
    price: Number(row.price),
    currency: String(row.currency),
    unit_label: String(row.unit_label),
    stock_mode: row.stock_mode as BusinessProductStockMode,
    status: row.status as BusinessProductStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function friendlyDatabaseError(message: string) {
  if (message.includes('business_products_business_sku_uidx')) return new Error('This Business already has a product with that SKU.');
  return new Error(message);
}

export const productionProviderProductRepository = {
  async list(session: ServerCustomerSession): Promise<BusinessProductRecord[]> {
    assertProductionBackendConfigured();
    const identity = await resolveBusinessIdentity(session);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('business_products')
      .select('id,business_id,name,description,sku,price,currency,unit_label,stock_mode,status,created_at,updated_at')
      .eq('business_id', identity.business_id)
      .order('updated_at', { ascending: false });
    if (error) throw friendlyDatabaseError(error.message);
    return (data ?? []).map((row) => mapProduct(row as Record<string, unknown>));
  },

  async create(session: ServerCustomerSession, input: CreateBusinessProductInput): Promise<BusinessProductRecord> {
    assertProductionBackendConfigured();
    const identity = await resolveBusinessIdentity(session);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('business_products')
      .insert({ business_id: identity.business_id, ...createPayload(input) })
      .select('id,business_id,name,description,sku,price,currency,unit_label,stock_mode,status,created_at,updated_at')
      .single();
    if (error) throw friendlyDatabaseError(error.message);
    return mapProduct(data as Record<string, unknown>);
  },

  async update(session: ServerCustomerSession, productId: string, input: UpdateBusinessProductInput): Promise<BusinessProductRecord> {
    assertProductionBackendConfigured();
    if (!productId) throw new Error('Product ID is required.');
    const identity = await resolveBusinessIdentity(session);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('business_products')
      .update(updatePayload(input))
      .eq('id', productId)
      .eq('business_id', identity.business_id)
      .select('id,business_id,name,description,sku,price,currency,unit_label,stock_mode,status,created_at,updated_at')
      .maybeSingle();
    if (error) throw friendlyDatabaseError(error.message);
    if (!data) throw new Error('Product was not found or is not owned by this Business.');
    return mapProduct(data as Record<string, unknown>);
  },
};
