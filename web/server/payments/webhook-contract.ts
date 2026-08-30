import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Cashfree Payments/Payouts V2 signs timestamp + exact raw request body with HMAC-SHA256. */
export function cashfreeWebhookSignature(secret: string, timestamp: string, rawBody: string) {
  return createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');
}

export function verifyCashfreeWebhookContract(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
) {
  if (!secret || !timestamp || !rawBody || !signature) return false;
  const expected = Buffer.from(cashfreeWebhookSignature(secret, timestamp, rawBody));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function runCashfreeWebhookContractSelfTest() {
  const secret = 'takeitesee-contract-test-secret';
  const timestamp = '1746427759733';
  // Deliberately preserve a decimal representation: parsed/re-serialized JSON can alter the raw payload.
  const rawBody = '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"payment":{"cf_payment_id":123456,"payment_amount":170.00,"payment_currency":"INR"}}}';
  const signature = cashfreeWebhookSignature(secret, timestamp, rawBody);

  const valid = verifyCashfreeWebhookContract(secret, timestamp, rawBody, signature);
  const tamperedBodyRejected = !verifyCashfreeWebhookContract(
    secret,
    timestamp,
    rawBody.replace('170.00', '170'),
    signature,
  );
  const wrongTimestampRejected = !verifyCashfreeWebhookContract(
    secret,
    '1746427759734',
    rawBody,
    signature,
  );
  const wrongSignatureRejected = !verifyCashfreeWebhookContract(
    secret,
    timestamp,
    rawBody,
    `${signature.slice(0, -2)}AA`,
  );

  return {
    passed: valid && tamperedBodyRejected && wrongTimestampRejected && wrongSignatureRejected,
    valid_signature_accepted: valid,
    raw_body_tamper_rejected: tamperedBodyRejected,
    timestamp_tamper_rejected: wrongTimestampRejected,
    wrong_signature_rejected: wrongSignatureRejected,
  };
}
