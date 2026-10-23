/**
 * Timezone utilities for WebGran analytics and financial metrics.
 * Official Business Reference Timezone: America/Recife (UTC-3).
 *
 * Rules:
 * - Timestamps in the database are absolute instants stored in UTC.
 * - Commercial aggregations and display labels must respect America/Recife.
 * - Never use naked local Date methods (setHours, getHours, getDate) on the server.
 */

export const BUSINESS_TIMEZONE = "America/Recife";

export interface BusinessDateTimeParts {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
  hour: number; // 0 - 23
  minute: number;
  second: number;
}

// Backwards-compatible alias for existing callers
export type SaoPauloDateTimeParts = BusinessDateTimeParts;

/**
 * Extracts calendar date parts in America/Recife timezone.
 */
export function getBusinessParts(date: Date = new Date()): BusinessDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);

  return { year, month, day, hour, minute, second };
}

// Backwards-compatible alias
export const getSaoPauloParts = getBusinessParts;

/**
 * Returns formatted "YYYY-MM-DD" key in America/Recife.
 */
export function getBusinessDateKey(date: Date): string {
  const { year, month, day } = getBusinessParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const getSaoPauloDateKey = getBusinessDateKey;

/**
 * Returns formatted "DD/MM" label in America/Recife.
 */
export function getBusinessDateLabel(date: Date): string {
  const { month, day } = getBusinessParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

export const getSaoPauloDateLabel = getBusinessDateLabel;

/**
 * Returns formatted chart label (e.g. "22 de out.") in America/Recife.
 */
export function getBusinessChartDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short",
  }).format(date);
}

/**
 * Returns formatted "YYYY-MM" month key in America/Recife.
 */
export function getBusinessMonthKey(date: Date): string {
  const { year, month } = getBusinessParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export const getSaoPauloMonthKey = getBusinessMonthKey;

/**
 * Returns short month name (e.g. "jan.", "out.") in pt-BR in America/Recife.
 */
export function getBusinessMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
  }).format(date);
}

export const getSaoPauloMonthLabel = getBusinessMonthLabel;

/**
 * Returns a UTC Date representing the start of a calendar day (00:00:00.000) in America/Recife.
 * In Brazil (UTC-3), 00:00:00 BRT corresponds to 03:00:00.000Z in UTC.
 */
export function getBusinessStartOfDay(date: Date = new Date()): Date {
  const { year, month, day } = getBusinessParts(date);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

export const getSaoPauloStartOfDay = getBusinessStartOfDay;

/**
 * Returns a UTC Date representing the exclusive end of a calendar day (00:00:00.000 BRT of next day).
 */
export function getBusinessEndOfDay(date: Date = new Date()): Date {
  const start = getBusinessStartOfDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export const getSaoPauloEndOfDay = getBusinessEndOfDay;

/**
 * Returns start of calendar month (00:00:00 on day 1) in America/Recife as a UTC Date.
 */
export function getBusinessStartOfMonth(date: Date = new Date()): Date {
  const { year, month } = getBusinessParts(date);
  return new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
}

/**
 * Returns start of next calendar month (00:00:00 on day 1) in America/Recife as a UTC Date.
 */
export function getBusinessStartOfNextMonth(date: Date = new Date()): Date {
  const { year, month } = getBusinessParts(date);
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return new Date(Date.UTC(nextYear, nextMonth - 1, 1, 3, 0, 0, 0));
}

/**
 * Returns short weekday name in pt-BR in America/Recife (e.g. "Dom", "Seg", "Ter").
 */
export function getBusinessWeekdayShort(date: Date): string {
  const raw = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
  }).format(date);
  const clean = raw.replace(".", "").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export const getSaoPauloWeekdayShort = getBusinessWeekdayShort;

/**
 * Formats a Date to "DD/MM/YYYY HH:mm" in America/Recife.
 */
export function formatBusinessDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const { year, month, day, hour, minute } = getBusinessParts(d);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Formats a Date to "DD/MM/YYYY" in America/Recife.
 */
export function formatBusinessDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const { year, month, day } = getBusinessParts(d);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/**
 * Safely parses a civil date string "YYYY-MM-DD" into calendar parts
 * without timezone distortion.
 */
export function parseCivilDate(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
}

/**
 * Formats a civil date "YYYY-MM-DD" directly to "DD/MM/YYYY" without Date object UTC skew.
 */
export function formatCivilDateToBR(dateStr: string): string {
  const parts = parseCivilDate(dateStr);
  if (!parts) return dateStr;
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}
