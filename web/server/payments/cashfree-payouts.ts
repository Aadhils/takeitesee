import 'server-only';
import { constants, createHmac, publicEncrypt, randomUUID, timingSafeEqual } from 'node:crypto';

export type CashfreePayoutMode = 'sandbox' | 'production';

export type CashfreePayoutConfig = {
  enabled: boolean;
  mode: CashfreePayoutMode;
  apiVersion: '2024-01-01';
  baseUrl: string;
  clientId: string | null;
  clientSecret: string | null;
  publicKey: string | null;
  useIpWhitelist: boolean;
  missing: string[];
};

export type CashfreeBeneficiary = {
  beneficiary_id: string;
  beneficiary_name: string;
  beneficiary_status: 'VERIFIED' | 'INVALID' | 'INITIATED' | 'CANCELLED' | 'FAILED' | 'DELETED' | string;
  beneficiary_instrument_details?: {
    bank_account_number?: string;
    bank_ifsc?: string;
    vpa?: string;
  };
  added_on?: string;
};

export type CashfreePayoutTransfer = {
  transfer_id: string;
  cf_transfer_id?: string;
  status: string;
  status_code?: string;
  status_description?: string;
  beneficiary_details?: { beneficiary_id?: string };
  transfer_amount: number;
  transfer_mode?: string;
  transfer_utr?: string;
  fundsource_id?: string;
  added_on?: string;
  updated_on?: string;
};

export class CashfreePayoutError extends Error {
  httpStatus: number | null;
  code: string | null;
  constructor(message: string, options: { httpStatus?: number | null; code?: string | null } = {}) {
    super(message);
    this.name = 'CashfreePayoutError';
    this.httpStatus = options.httpStatus ?? null;
    this.code = options.code ?? null;
  }
}

function normalizePem(value: string | null) {
  return value?.replace(/\\n/g, '\n').trim() || null;
}

export function getCashfreePayoutConfig(): CashfreePayoutConfig {
  const mode: CashfreePayoutMode = process.env.CASHFREE_PAYOUT_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const clientId = process.env.CASHFREE_PAYOUT_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.CASHFREE_PAYOUT_CLIENT_SECRET?.trim() || null;
  const publicKey = normalizePem(process.env.CASHFREE_PAYOUT_PUBLIC_KEY?.trim() || null);
  const useIpWhitelist = process.env.CASHFREE_PAYOUT_USE_IP_WHITELIST === 'true';
  const missing: string[] = [];
  if (!clientId) missing.push('CASHFREE_PAYOUT_CLIENT_ID');
  if (!clientSecret) missing.push('CASHFREE_PAYOUT_CLIENT_SECRET');
  if (mode === 'production' && !useIpWhitelist && !publicKey) missing.push('CASHFREE_PAYOUT_PUBLIC_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return {
    enabled: missing.length === 0,
    mode,
    apiVersion: '2024-01-01',
    baseUrl: mode === 'production' ? 'https://api.cashfree.com/payout' : 'https://sandbox.cashfree.com/payout',
    clientId,
    clientSecret,
    publicKey,
    useIpWhitelist,
    missing,
  };
}

function requestSignature(config: CashfreePayoutConfig) {
  if (!config.publicKey || !config.clientId) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const value = `${config.clientId}.${timestamp}`;
  return publicEncrypt({ key: config.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(value)).toString('base64');
}

async function cashfreePayoutRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getCashfreePayoutConfig();
  if (!config.enabled || !config.clientId || !config.clientSecret) throw new CashfreePayoutError('Cashfree Payouts is not configured.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const signature = config.useIpWhitelist ? null : requestSignature(config);
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-version': config.apiVersion,
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'x-request-id': randomUUID(),
        ...(signature ? { 'x-cf-signature': signature } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) {
      const object = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
      const code = object ? String(object.code ?? object.type ?? object.status_code ?? '') || null : null;
      const message = object ? String(object.message ?? object.status_description ?? '') : '';
      throw new CashfreePayoutError(message || `Cashfree Payouts request failed with status ${response.status}.`, { httpStatus: response.status, code });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof CashfreePayoutError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new CashfreePayoutError('Cashfree Payouts request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createCashfreeBeneficiary(input: {
  beneficiaryId: string;
  beneficiaryName: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  vpa?: string;
  email?: string | null;
  phone?: string | null;
}) {
  return cashfreePayoutRequest<CashfreeBeneficiary>('/beneficiary', {
    method: 'POST',
    body: JSON.stringify({
      beneficiary_id: input.beneficiaryId,
      beneficiary_name: input.beneficiaryName,
      beneficiary_instrument_details: {
        ...(input.bankAccountNumber ? { bank_account_number: input.bankAccountNumber } : {}),
        ...(input.bankIfsc ? { bank_ifsc: input.bankIfsc } : {}),
        ...(input.vpa ? { vpa: input.vpa } : {}),
      },
      beneficiary_contact_details: {
        ...(input.email ? { beneficiary_email: input.email } : {}),
        ...(input.phone ? { beneficiary_phone: input.phone, beneficiary_country_code: '+91' } : {}),
      },
    }),
  });
}

export function getCashfreeBeneficiary(beneficiaryId: string) {
  return cashfreePayoutRequest<CashfreeBeneficiary>(`/beneficiary?beneficiary_id=${encodeURIComponent(beneficiaryId)}`, { method: 'GET' });
}

export function getCashfreeBeneficiaryByBank(bankAccountNumber: string, bankIfsc: string) {
  return cashfreePayoutRequest<CashfreeBeneficiary>(`/beneficiary?bank_account_number=${encodeURIComponent(bankAccountNumber)}&bank_ifsc=${encodeURIComponent(bankIfsc)}`, { method: 'GET' });
}

export function removeCashfreeBeneficiary(beneficiaryId: string) {
  return cashfreePayoutRequest<CashfreeBeneficiary>(`/beneficiary?beneficiary_id=${encodeURIComponent(beneficiaryId)}`, { method: 'DELETE' });
}

export function createCashfreePayoutTransfer(input: {
  transferId: string;
  amountMinor: number;
  beneficiaryId: string;
  transferMode: 'banktransfer' | 'upi';
  remarks: string;
}) {
  return cashfreePayoutRequest<CashfreePayoutTransfer>('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      transfer_id: input.transferId,
      transfer_amount: input.amountMinor / 100,
      transfer_currency: 'INR',
      transfer_mode: input.transferMode,
      transfer_remarks: input.remarks.replace(/[^A-Za-z0-9 ]/g, ' ').slice(0, 70),
      beneficiary_details: { beneficiary_id: input.beneficiaryId },
    }),
  });
}

export function getCashfreePayoutTransfer(transferId: string) {
  return cashfreePayoutRequest<CashfreePayoutTransfer>(`/transfers?transfer_id=${encodeURIComponent(transferId)}`, { method: 'GET' });
}

export function verifyCashfreePayoutWebhook(rawBody: string, timestamp: string, signature: string) {
  const config = getCashfreePayoutConfig();
  if (!config.clientSecret) return false;
  const expected = createHmac('sha256', config.clientSecret).update(`${timestamp}${rawBody}`).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}