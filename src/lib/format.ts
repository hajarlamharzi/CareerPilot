import type { SalaryRange } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Symbols to use instead of the CLDR default, keyed by ISO-4217 code.
 *
 * `Intl` renders MAD as the trailing "MAD", but Moroccans write the dirham as
 * "DH" in front of the amount, so we substitute the symbol after formatting and
 * keep `Intl`'s correct locale-aware digit grouping.
 */
const CURRENCY_SYMBOL_OVERRIDES: Record<string, string> = {
  MAD: "DH",
};

/** Format a number as money in the given currency. Never throws. */
export function formatMoney(
  amount: number | null | undefined,
  currency = "USD",
): string {
  if (amount === null || amount === undefined) return "—";
  try {
    const formatted = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
    const override = CURRENCY_SYMBOL_OVERRIDES[currency.toUpperCase()];
    if (!override) return formatted;
    // Replace the trailing ISO code ("13 000 MAD") with the local symbol.
    return formatted
      .replace(new RegExp(`\\s*${currency}\\s*$`, "i"), "")
      .trim()
      .concat(`\u00a0${override}`);
  } catch {
    return `${amount}`;
  }
}

/** Compact salary summary from a SalaryRange (e.g. "DH 13 000 – DH 22 000 / mois"). */
export function formatSalaryRange(salary: SalaryRange | null): string {
  if (!salary) return "Non précisé";
  const currency = salary.currency || "USD";
  const period = salary.period ? ` / ${formatSalaryPeriod(salary.period)}` : "";
  if (salary.min !== null && salary.max !== null) {
    return `${formatMoney(salary.min, currency)} – ${formatMoney(salary.max, currency)}${period}`;
  }
  if (salary.min !== null) return `À partir de ${formatMoney(salary.min, currency)}${period}`;
  if (salary.max !== null) return `Jusqu'à ${formatMoney(salary.max, currency)}${period}`;
  return "Non précisé";
}

/** French label for a salary period stored as an English enum value. */
export function formatSalaryPeriod(period: string | null | undefined): string {
  switch (period) {
    case "year":
      return "an";
    case "month":
      return "mois";
    case "week":
      return "semaine";
    case "day":
      return "jour";
    case "hour":
      return "heure";
    default:
      return period ?? "";
  }
}

export function formatDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

export function formatDateShort(value: string | null | undefined): string {
  return formatDate(value, { month: "short", day: "numeric" });
}

/** Whole days from today until `value`. Negative for the past. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / DAY_MS);
}

/** Human "what day is this" label, e.g. "Today", "Tomorrow", "3d ago". */
export function formatDayRelative(value: string | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return "—";
  if (days === 0) return value ? "Today" : "—";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `in ${days}d` : `${Math.abs(days)}d ago`;
}

/** Month bucket key from an ISO string, e.g. "2026-09". */
export function monthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}` : null;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
    new Date(Number(year), Number(month) - 1, 1),
  );
}

/** "Aug 2026" label for analytics axes. */
export function monthFullLabel(key: string): string {
  const [year, month] = key.split("-");
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(
    new Date(Number(year), Number(month) - 1, 1),
  );
  return `${label} ${year}`;
}