import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../lib/supabase/service';
import { assertProductionBackendConfigured } from '../config';

export type BusinessProductOrderStatus = 'requested' | 'accepted' | 'declined' | 'fulfilled' | 'cancelled';
export type BusinessProductOrderAction = 'accept' | 'decline' | 'fulfill';

export interface BusinessProductOrderRecord {
  id: string;
  product_id: string;
  business_id: string;
  customer_user_id: string;
  product_revision: number;
  product_name_snapshot: string;
  business_name_snapshot: string;
  customer_name_snapshot: string;
  unit_price_snapshot: number;
  currency_snapshot: string;
  unit_label_snapshot: string;
  quantity: number;
  customer_note: string | null;
  business_note: string | null;
  status: BusinessProductOrderStatus;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBusinessProductOrderInput {
  product_id: string;
  quantity: number;
  customer_note?: string | null;
}

type BusinessIdentity = { business_id: string };

const orderColumns = [
  'id',
  'product_id',
  'business_id',
  'customer_user_id',
  'product_revision',
  'product_name_snapshot',
  'business_name_snapshot',
  'customer_name_snapshot',
  'unit_price_snapshot',
  'currency_snapshot',
  'unit_label_snapshot',
  'quantity',
  'customer_note',
  'business_note',
  'status',
  'status_changed_at',
  'created_at',
  'updated_at',
].join(',');

function mapOrder(row: Record<string, unknown>): BusinessProductOrderRecord {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    business_id: String(row.business_id),
    customer_user_id: String(row.customer_user_id),
    product_revision: Number(row.product_revision),
    product_name_snapshot: String(row.product_name_snapshot),
    business_name_snapshot: String(row.business_name_snapshot),
    customer_name_snapshot: String(row.customer_name_snapshot),
    unit_price_snapshot: Number(row.unit_price_snapshot),
    currency_snapshot: String(row.currency_snapshot),
    unit_label_snapshot: String(row.unit_label_snapshot),
    quantity: Number(row.quantity),
    customer_note: (row.customer_note as string | null) ?? null,
    business_note: (row.business_note as string | null) ?? null,
    status: row.status as BusinessProductOrderStatus,
    status_changed_at: String(row.status_changed_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new Error('Quantity must be a whole number between 1 and 999.');
  }
  return quantity;
}

function normalizeNote(value: unknown, label: string, required = false) {
  const note = String(value ?? '').trim();
  if (required && note.length < 3) throw new Error(`${label} is required.`);
  if (note.length > 1200) throw new Error(`${label} must be 1200 characters or fewer.`);
  return note || null;
}

async function resolveBusinessIdentity(session: ServerCustomerSession): Promise<BusinessIdentity> {
  const supabase = await createSupabaseServerClient();
  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
  ]);
  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) throw new Error('Business Provider identity is required to manage product orders.');
  if (!business) throw new Error('Business Provider identity was not found.');
  return { business_id: String(business.id) };
}

export const productionBusinessOrderRepository = {
  async listCustomer(session: ServerCustomerSession): Promise<BusinessProductOrderRecord[]> {
    assertProductionBackendConfigured();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('business_product_orders')
      .select(orderColumns)
      .eq('customer_user_id', session.user_id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>));
  },

  async create(session: ServerCustomerSession, input: CreateBusinessProductOrderInput): Promise<BusinessProductOrderRecord> {
    assertProductionBackendConfigured();
    const productId = String(input.product_id ?? '').trim();
    if (!productId) throw new Error('Product ID is required.');
    const serviceRole = createSupabaseServiceClient();
    const { data, error } = await serviceRole.rpc('create_business_product_order_request', {
      target_product_id: productId,
      target_customer_user_id: session.user_id,
      target_quantity: normalizeQuantity(input.quantity),
      target_customer_note: normalizeNote(input.customer_note, 'Order note'),
    }).single();
    if (error || !data) throw new Error(error?.message ?? 'Order request could not be created.');
    return mapOrder(data as Record<string, unknown>);
  },

  async cancelCustomer(session: ServerCustomerSession, orderId: string): Promise<BusinessProductOrderRecord> {
    assertProductionBackendConfigured();
    if (!orderId) throw new Error('Order ID is required.');
    const serviceRole = createSupabaseServiceClient();
    const { data, error } = await serviceRole.rpc('cancel_business_product_order_request', {
      target_order_id: orderId,
      target_customer_user_id: session.user_id,
    }).single();
    if (error || !data) throw new Error(error?.message ?? 'Order request could not be cancelled.');
    return mapOrder(data as Record<string, unknown>);
  },

  async listBusiness(session: ServerCustomerSession): Promise<BusinessProductOrderRecord[]> {
    assertProductionBackendConfigured();
    const identity = await resolveBusinessIdentity(session);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('business_product_orders')
      .select(orderColumns)
      .eq('business_id', identity.business_id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>));
  },

  async transitionBusiness(
    session: ServerCustomerSession,
    orderId: string,
    action: BusinessProductOrderAction,
    note?: string | null,
  ): Promise<BusinessProductOrderRecord> {
    assertProductionBackendConfigured();
    if (!orderId) throw new Error('Order ID is required.');
    if (!['accept', 'decline', 'fulfill'].includes(action)) throw new Error('Order action is invalid.');
    await resolveBusinessIdentity(session);
    const serviceRole = createSupabaseServiceClient();
    const { data, error } = await serviceRole.rpc('transition_business_product_order', {
      target_order_id: orderId,
      target_business_owner_user_id: session.user_id,
      target_action: action,
      target_note: normalizeNote(note, 'Decline reason', action === 'decline'),
    }).single();
    if (error || !data) throw new Error(error?.message ?? 'Order could not be updated.');
    return mapOrder(data as Record<string, unknown>);
  },
};
