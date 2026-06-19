/** Money + locale formatting helpers. */

const CURRENCY_LOCALE: Record<string, string> = {
  EUR: "de-DE",
  PLN: "pl-PL",
  USD: "en-US",
  GBP: "en-GB",
};

export const SUPPORTED_CURRENCIES = ["EUR", "PLN", "USD", "GBP"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** cents + currency -> "6.401,25 €" (locale aware) */
export function formatMoney(cents: number, currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? "de-DE";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** minutes -> decimal hours rounded to 2dp (for rate math) */
export function minutesToHours(min: number): number {
  return min / 60;
}

/** amount in cents for a duration at an hourly rate (also in cents) */
export function amountCents(durationMin: number, rateCents: number): number {
  return Math.round((durationMin / 60) * rateCents);
}

/** "YYYY-MM-DD" for a Date in local time (no UTC shift) */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** parse "YYYY-MM-DD" to a local Date (midnight) */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
