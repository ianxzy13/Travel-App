/** What every Server Action returns, so forms can show a toast either way. */
export type ActionResult<T = undefined> =
  ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

// Errors are built by lib/errors.ts (fail, err, invalid, noPermission) in the person's language.
