/**
 * Timezone utilities for WebGran analytics and financial metrics.
 * Business Timezone: America/Sao_Paulo (UTC-3 permanently since 2019).
 */

export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

export interface SaoPauloDateTimeParts {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
  hour: number; // 0 - 23
  minute: number;
  second: number;
}

/**
 * Extracts calendar date parts in America/Sao_Paulo timezone.
 */
export function getSaoPauloParts(date: Date = new Date()): SaoPauloDateTimeParts {
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

/**
 * Returns formatted "YYYY-MM-DD" key in America/Sao_Paulo.
 */
export function getSaoPauloDateKey(date: Date): string {
  const { year, month, day } = getSaoPauloParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Returns formatted "DD/MM" label in America/Sao_Paulo.
 */
export function getSaoPauloDateLabel(date: Date): string {
  const { month, day } = getSaoPauloParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/**
 * Returns formatted "YYYY-MM" month key in America/Sao_Paulo.
 */
export function getSaoPauloMonthKey(date: Date): string {
  const { year, month } = getSaoPauloParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Returns short month name (e.g. "Jan", "Fev") in pt-BR in America/Sao_Paulo.
 */
export function getSaoPauloMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
  }).format(date);
}

/**
 * Returns a UTC Date representing the start of a calendar day (00:00:00.000) in America/Sao_Paulo.
 * In Brazil (UTC-3), 00:00:00 BRT corresponds to 03:00:00.000Z in UTC.
 */
export function getSaoPauloStartOfDay(date: Date = new Date()): Date {
  const { year, month, day } = getSaoPauloParts(date);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

/**
 * Returns a UTC Date representing the exclusive end of a calendar day (00:00:00.000 BRT of next day).
 */
export function getSaoPauloEndOfDay(date: Date = new Date()): Date {
  const start = getSaoPauloStartOfDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Returns short weekday name in pt-BR in America/Sao_Paulo (e.g. "Dom", "Seg", "Ter").
 */
export function getSaoPauloWeekdayShort(date: Date): string {
  const raw = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
  }).format(date);
  const clean = raw.replace(".", "").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

