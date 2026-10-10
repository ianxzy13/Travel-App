import "server-only";
import twilio from "twilio";

export const isSmsConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER,
);

let client: ReturnType<typeof twilio> | null = null;

export function getTwilio() {
  if (!isSmsConfigured) return null;
  client ??= twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
  );
  return client;
}

export function twilioFrom() {
  return process.env.TWILIO_PHONE_NUMBER!;
}

export type SmsCost = { currency: string; amount: string };

const SEGMENT_LIMIT = 160;
const UCS2_SEGMENT_LIMIT = 70;

export function estimateSegments(text: string): number {
  const isGsm = /^[\x20-\x7E\n\r]+$/.test(text);
  const limit = isGsm ? SEGMENT_LIMIT : UCS2_SEGMENT_LIMIT;
  return Math.ceil(text.length / limit) || 1;
}
