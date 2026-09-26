import "server-only";
import { Resend } from "resend";

/** True when RESEND_API_KEY is set, i.e. the app can send emails. */
export const isEmailConfigured = Boolean(process.env.RESEND_API_KEY);

/**
 * Sender address. Until you verify your own domain in Resend, only
 * "onboarding@resend.dev" works, and only for sending to your own email.
 */
export function emailFrom(displayName: string) {
  const address = process.env.EMAIL_FROM || "onboarding@resend.dev";
  // Remove characters that would break the "Name <address>" format.
  const name = displayName.replace(/[<>"\r\n]/g, "").trim();
  return name ? `${name} <${address}>` : address;
}

let client: Resend | null = null;
export function getResend() {
  if (!isEmailConfigured) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}
