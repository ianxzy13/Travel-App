import "server-only";

export const RETENTION_MONTHS = 12;
export const WARNING_DAYS = 30;

export function retentionCutoff(months = RETENTION_MONTHS): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function warningCutoff(months = RETENTION_MONTHS, days = WARNING_DAYS): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
