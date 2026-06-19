/**
 * Smart time + duration parsing - replicates the Clockify manual-entry ruleset.
 * Pure functions, exhaustively unit-tested (see time.test.ts).
 *
 * Time-of-day field (minutes from midnight, 0..1439):
 *   "1"    -> 01:00     (1-2 digits = hours)
 *   "13"   -> 13:00
 *   "130"  -> 01:30     (3 digits = H + MM)
 *   "2330" -> 23:30     (4 digits = HH + MM)
 *   "0345" -> 03:45
 *   "9.45" -> 09:45     (dot separator)
 *   "9:45" -> 09:45     (colon separator)
 *   "1pm"  -> 13:00     (am/pm suffix, optional space)
 *
 * Duration field (minutes):
 *   "1.5"  -> 90        "1h30m" -> 90      ".5" -> 30
 *   ":30"  -> 30        "1:30"  -> 90      "0.1" -> 6
 */

/** Parse a time-of-day string to minutes from midnight, or null if invalid. */
export function parseTimeOfDay(raw: string): number | null {
  if (raw == null) return null;
  let s = raw.trim().toLowerCase();
  if (s === "") return null;

  // am/pm suffix (1pm, 1 pm, 1p, 12am ...)
  let ampm: "a" | "p" | null = null;
  const m = s.match(/\s*(a|p)m?\.?$/);
  if (m) {
    ampm = m[1] as "a" | "p";
    s = s.slice(0, m.index).trim();
  }

  let h: number;
  let min: number;

  if (s.includes(":") || s.includes(".")) {
    const [a, b = "0"] = s.split(/[:.]/);
    h = parseInt(a || "0", 10);
    min = parseInt(b.padEnd(2, "0").slice(0, 2), 10);
  } else if (/^\d+$/.test(s)) {
    if (s.length <= 2) {
      h = parseInt(s, 10);
      min = 0;
    } else if (s.length === 3) {
      h = parseInt(s[0], 10);
      min = parseInt(s.slice(1), 10);
    } else {
      h = parseInt(s.slice(0, 2), 10);
      min = parseInt(s.slice(2, 4), 10);
    }
  } else {
    return null;
  }

  if (ampm === "p" && h < 12) h += 12;
  if (ampm === "a" && h === 12) h = 0;

  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Parse a duration string to minutes, or null if invalid. */
export function parseDuration(raw: string): number | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s === "") return null;

  // 1h30m / 90m / 1h / 1h30m1s (seconds rounded down)
  const unit = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/);
  if (unit && (unit[1] || unit[2] || unit[3])) {
    const h = parseInt(unit[1] || "0", 10);
    const m = parseInt(unit[2] || "0", 10);
    return h * 60 + m;
  }

  // 1:30 / :30  -> H:MM
  if (s.includes(":")) {
    const [a, b = "0"] = s.split(":");
    const h = parseInt(a || "0", 10);
    const m = parseInt(b || "0", 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }

  // decimal hours: 1.5 -> 90, .5 -> 30, 0.1 -> 6
  if (/^\d*\.?\d+$/.test(s)) {
    const hours = parseFloat(s);
    if (!Number.isFinite(hours)) return null;
    return Math.round(hours * 60);
  }

  return null;
}

/** minutes from midnight -> "HH:MM" */
export function formatTimeOfDay(min: number): string {
  const norm = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** duration in minutes -> "4h 30m" (or "45m", or "0m") */
export function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/**
 * Duration between start and end (minutes), handling crossing midnight.
 * If end <= start it is assumed to be the next day (+24h).
 */
export function durationMinutes(startMin: number, endMin: number): number {
  let d = endMin - startMin;
  if (d < 0) d += 1440;
  return d;
}
