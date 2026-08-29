import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type CashfreeMode = 'sandbox' | 'production';

export type CashfreeConfig = {
  enabled: boolean;
  provider: 'cashfree';
  mode: CashfreeMode;
  apiVersion: '2025-01-01';
  baseUrl: string;
  clientId: string | null;
  clientSecret: string | null;
  missing: string[];
};

export type CashfreeOrder = {
  order_id: string;
  cf_order_id?: string | number;
  order_status: string;
  order_amount: number;
  order_currency: string;
  payment_session_id: string;
  order_expiry_time?: string | null;
};

export type CashfreePayment = {
  cf_payment_id: string | number;
  payment_status: string;
  payment_amount: number;
  payment_currency: string;
  payment_message?: string | null;
  payment_time?: string | null;
  payment_completion_time?: string | null;
  bank_reference?: string | null;
  error_details?: {
    error_code?: string | null;
    error_description?: string | null;
    error_reason?: string | null;
  } | null;
};

export type CashfreeRefund = {
  cf_payment_id?: string | number | null;
  cf_refund_id?: string | number | null;
  refund_id: string;
  order_id: string;
  refund_amount: number;
  refund_currency: string;
  refund_note?: string | null;
  refund_status: 'SUCCESS' | 'PENDING' | 'CANCELLED' | 'ONHOLD' | 'FAILED' | string;
  status_description?: string | null;
  refund_arn?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
  refund_mode?: string | null;
  refund_speed?: {
    requested?: string | null;
    accepted?: string | null;
    processed?: string | null;
    message?: string | null;
  } | null;
  requested_speed?: string | null;
  processed_speed?: string | null;
};

export class CashfreeApiError extends Error {
  readonly httpStatus: number;
  readonly payload: unknown;
  constructor(message: string, httpStatus: number, payload: unknown) {
    super(message);
    this.name = 'CashfreeApiError';
    this.httpStatus = httpStatus;
    this.payload = payload;
  }
}

export function getCashfreeConfig(): CashfreeConfig {
  const selected = (process.env.PAYMENT_GATEWAY_PROVIDER ?? '').trim().toLowerCase();
  const mode: CashfreeMode = process.env.CASHFREE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const clientId = process.env.CASHFREE_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET?.trim() || null;
  const missing: string[] = [];
  if (selected !== 'cashfree') missing.push('PAYMENT_GATEWAY_PROVIDER=cashfree');
  if (!clientId) missing.push('CASHFREE_CLIENT_ID');
  if (!clientSecret) missing.push('CASHFREE_CLIENT_SECRET');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return {
    enabled: missing.length === 0,
    provider: 'cashfree',
    mode,
    apiVersion: '2025-01-01',
    baseUrl: mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
    clientId,
    clientSecret,
    missing,
  };
}

async function cashfreeRequest<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const config = getCashfreeConfig();
  if (!config.enabled || !config.clientId || !config.clientSecret) throw new Error('Cashfree payment gateway is not configured.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'x-api-version': config.apiVersion,
        ...(init.idempotencyKey ? { 'x-idempotency-key': init.idempotencyKey } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'message' in payload ? String((payload as { message?: unknown }).message || '') : '';
      throw new CashfreeApiError(message || `Cashfree request failed with status ${response.status}.`, response.status, payload);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchCashfreeOrder(orderId: string): Promise<CashfreeOrder> {
  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

export function fetchCashfreePayments(orderId: string): Promise<CashfreePayment[]> {
  return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, { method: 'GET' });
}

export function fetchCashfreeRefund(orderId: string, refundId: string): Promise<CashfreeRefund> {
  return cashfreeRequest<CashfreeRefund>(`/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`, { method: 'GET' });
}

export async function createCashfreeRefund(input: {
  orderId: string;
  refundId: string;
  amountMinor: number;
  note: string;
  speed?: 'STANDARD' | 'INSTANT';
}): Promise<CashfreeRefund> {
  const result = await cashfreeRequest<CashfreeRefund | CashfreeRefund[]>(`/orders/${encodeURIComponent(input.orderId)}/refunds`, {
    method: 'POST',
    idempotencyKey: input.refundId,
    body: JSON.stringify({
      refund_amount: input.amountMinor / 100,
      refund_id: input.refundId,
      refund_note: input.note,
      refund_speed: input.speed ?? 'STANDARD',
    }),
  });
  const refund = Array.isArray(result) ? result[0] : result;
  if (!refund) throw new Error('Cashfree refund response did not contain a refund entity.');
  return refund;
}

export async function createCashfreeOrder(input: {
  intentId: string;
  bookingId: string;
  bookingReference: string;
  amountMinor: number;
  currency: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnBaseUrl: string;
}): Promise<CashfreeOrder> {
  const orderId = `tis_${input.intentId.replaceAll('-', '')}`;

  // A deterministic order id lets client retries recover the existing Cashfree order safely.
  try {
    const existing = await fetchCashfreeOrder(orderId);
    if (Math.round(Number(existing.order_amount) * 100) !== input.amountMinor || existing.order_currency !== input.currency) {
      throw new Error('Existing Cashfree order does not match the payment intent amount or currency.');
    }
    return existing;
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('does not match')) throw cause;
  }

  const returnUrl = `${input.returnBaseUrl}/bookings/${encodeURIComponent(input.bookingId)}?payment_return=1&order_id={order_id}`;
  const notifyUrl = `${input.returnBaseUrl}/api/payments/cashfree/webhook`;
  return cashfreeRequest<CashfreeOrder>('/orders', {
    method: 'POST',
    idempotencyKey: input.intentId,
    body: JSON.stringify({
      order_id: orderId,
      order_amount: input.amountMinor / 100,
      order_currency: input.currency,
      customer_details: {
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
      },
      order_meta: { return_url: returnUrl, notify_url: notifyUrl },
      order_note: `Takeitesee booking ${input.bookingReference}`,
      order_tags: { booking_id: input.bookingId, payment_intent_id: input.intentId },
    }),
  });
}

export function verifyCashfreeWebhook(rawBody: string, timestamp: string, signature: string) {
  const config = getCashfreeConfig();
  if (!config.clientSecret) return false;
  const expected = createHmac('sha256', config.clientSecret).update(`${timestamp}${rawBody}`).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
