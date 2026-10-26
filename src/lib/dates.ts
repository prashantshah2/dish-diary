/** Dates are stored as plain "YYYY-MM-DD" strings in the visitor's local calendar. */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date — not toISOString(), which would shift days across time zones. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** "Oct 18, 2026" in the visitor's locale. */
export function formatISODate(s: string): string {
  return fromISODate(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "YYYY-MM-DD" shifted by `days` (negative goes back). */
export function addDaysISO(s: string, days: number): string {
  const d = fromISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** "Oct 18" — short label for chart axes. */
export function shortISODate(s: string): string {
  return fromISODate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
