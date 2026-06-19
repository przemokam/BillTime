/** Date-range helpers for the reports filter (pure, client + server safe). */

const pad = (n: number) => String(n).padStart(2, "0");

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export type RangePreset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "pastTwoWeeks"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear";

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  lastWeek: "Last week",
  pastTwoWeeks: "Past two weeks",
  thisMonth: "This month",
  lastMonth: "Last month",
  thisYear: "This year",
  lastYear: "Last year",
};

export type DateRange = { start: string; end: string };

/** Monday-based start of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

export function presetRange(preset: RangePreset, ref: Date = new Date()): DateRange {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  switch (preset) {
    case "today":
      return { start: toKey(ref), end: toKey(ref) };
    case "yesterday": {
      const yd = new Date(y, m, d - 1);
      return { start: toKey(yd), end: toKey(yd) };
    }
    case "thisWeek": {
      const s = startOfWeek(ref);
      return { start: toKey(s), end: toKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)) };
    }
    case "lastWeek": {
      const s = startOfWeek(new Date(y, m, d - 7));
      return { start: toKey(s), end: toKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)) };
    }
    case "pastTwoWeeks":
      return { start: toKey(new Date(y, m, d - 13)), end: toKey(ref) };
    case "thisMonth":
      return { start: toKey(new Date(y, m, 1)), end: toKey(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { start: toKey(new Date(y, m - 1, 1)), end: toKey(new Date(y, m, 0)) };
    case "thisYear":
      return { start: toKey(new Date(y, 0, 1)), end: toKey(new Date(y, 11, 31)) };
    case "lastYear":
      return { start: toKey(new Date(y - 1, 0, 1)), end: toKey(new Date(y - 1, 11, 31)) };
  }
}

/** Inclusive list of date keys from start to end. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = fromKey(start);
  const e = fromKey(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(toKey(d));
  return out;
}

/** Short human label for a range, e.g. "1-31 May 2026" or "19 Jun 2026". */
export function rangeLabel(start: string, end: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const s = fromKey(start);
  const e = fromKey(end);
  if (start === end) return `${s.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${s.getDate()}-${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  return `${s.getDate()} ${months[s.getMonth()]} - ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}
