// Money helpers. Amounts are kept as numbers in the wedding's currency, but
// every sum is done in whole cents so 0.1 + 0.2 never becomes 0.30000000004.

export const toCents = (amount: number | string | null | undefined) =>
  Math.round(Number(amount ?? 0) * 100);

export const fromCents = (cents: number) => cents / 100;

/** Sum of money amounts, exact to the cent. */
export function sumMoney(amounts: (number | string | null | undefined)[]) {
  return fromCents(amounts.reduce<number>((total, a) => total + toCents(a), 0));
}

/** "€1,234.50" – uses the viewer's locale and the wedding's currency. */
export function formatMoney(amount: number, currency: string, opts: { cents?: boolean } = {}) {
  const cents = opts.cents ?? !Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(cents ? 2 : 0)}`;
  }
}

/**
 * Reads what people type: "1.234,50", "1,234.50", "1234.5", "€ 800" → number.
 * The last "." or "," followed by 1–2 digits is treated as the decimal point.
 * Returns null for empty input and NaN for nonsense.
 */
export function parseMoney(input: string): number | null {
  const s = input.replace(/[^\d.,-]/g, "");
  if (s === "" || s === "-") return null;
  const m = s.match(/^(-?[\d.,]*?)[.,](\d{1,2})$/);
  const whole = (m ? m[1] : s).replace(/[.,]/g, "");
  const value = Number(m ? `${whole || "0"}.${m[2]}` : whole);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : Number.NaN;
}
