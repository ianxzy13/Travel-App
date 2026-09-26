/** What every Server Action returns, so forms can show a toast either way. */
export type ActionResult<T = undefined> =
  ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

/** Log the real error on the server, return a friendly message to the user. */
export function fail(context: string, error: unknown, message = GENERIC_ERROR) {
  console.error(`[${context}]`, error);
  return { ok: false as const, error: message };
}
