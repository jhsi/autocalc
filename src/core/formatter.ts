import type { CellFormat, CellValue } from "./types.ts";

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
};

const COMPACT_UNITS = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
] as const;

/**
 * Format a computed value for display.
 * Pure: does not evaluate formulas and must not live in the formula language.
 * Uses `Intl.NumberFormat` when the host provides it (Node, browsers).
 * Figma's plugin sandbox does not, so we fall back to an en-US formatter.
 */
export function formatValue(value: CellValue, format?: CellFormat): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value === null ? "" : String(value);
  }

  const resolved: CellFormat = {
    kind: format?.kind ?? "number",
    locale: format?.locale ?? DEFAULT_LOCALE,
    currency: format?.currency ?? DEFAULT_CURRENCY,
    fractionDigits: format?.fractionDigits,
  };

  const formatted = tryIntlFormat(value, resolved);
  return formatted ?? formatFallback(value, resolved);
}

function tryIntlFormat(value: number, format: CellFormat): string | undefined {
  const NumberFormat = intlNumberFormat();
  if (!NumberFormat) {
    return undefined;
  }
  try {
    return new NumberFormat(
      format.locale ?? DEFAULT_LOCALE,
      numberFormatOptions(format),
    ).format(value);
  } catch {
    return undefined;
  }
}

function intlNumberFormat():
  | (new (
      locale?: string | string[],
      options?: object,
    ) => { format(value: number): string })
  | undefined {
  try {
    const ctor = (
      globalThis as {
        Intl?: { NumberFormat?: new (
          locale?: string | string[],
          options?: object,
        ) => { format(value: number): string } };
      }
    ).Intl?.NumberFormat;
    return typeof ctor === "function" ? ctor : undefined;
  } catch {
    return undefined;
  }
}

function numberFormatOptions(format: CellFormat): object {
  const fractionDigits = format.fractionDigits;
  const fraction =
    fractionDigits === undefined
      ? {}
      : {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        };

  switch (format.kind) {
    case "currency":
      return {
        style: "currency",
        currency: format.currency ?? DEFAULT_CURRENCY,
        ...fraction,
      };
    case "percent":
      return { style: "percent", ...fraction };
    case "compact":
      return { notation: "compact", compactDisplay: "short", ...fraction };
    case "number":
    default:
      return fraction;
  }
}

/** en-US grouping / currency / percent / compact when Intl is unavailable. */
function formatFallback(value: number, format: CellFormat): string {
  const digits = format.fractionDigits;
  switch (format.kind) {
    case "currency": {
      const amount = formatDecimal(value, digits ?? 2, digits ?? 2);
      const symbol =
        CURRENCY_SYMBOLS[format.currency ?? DEFAULT_CURRENCY] ??
        `${format.currency ?? DEFAULT_CURRENCY} `;
      return value < 0 ? `-${symbol}${amount.slice(1)}` : `${symbol}${amount}`;
    }
    case "percent":
      return `${formatDecimal(value * 100, digits ?? 0, digits ?? 0)}%`;
    case "compact":
      return formatCompact(value, digits);
    case "number":
    default:
      return formatDecimal(value, digits ?? 0, digits ?? 3);
  }
}

function formatCompact(value: number, fractionDigits?: number): string {
  const abs = Math.abs(value);
  for (const unit of COMPACT_UNITS) {
    if (abs >= unit.value) {
      const scaled = value / unit.value;
      const min = fractionDigits ?? 0;
      const max = fractionDigits ?? 2;
      return `${formatDecimal(scaled, min, max)}${unit.suffix}`;
    }
  }
  return formatDecimal(value, fractionDigits ?? 0, fractionDigits ?? 2);
}

function formatDecimal(
  value: number,
  minFractionDigits: number,
  maxFractionDigits: number,
): string {
  const negative = value < 0 || Object.is(value, -0);
  const abs = Math.abs(value);
  const factor = 10 ** maxFractionDigits;
  const rounded = Math.round(abs * factor + Number.EPSILON) / factor;
  let [intPart = "0", fracPart = ""] = rounded
    .toFixed(maxFractionDigits)
    .split(".");
  if (maxFractionDigits > minFractionDigits) {
    fracPart = fracPart.replace(/0+$/, "");
    if (fracPart.length < minFractionDigits) {
      fracPart = fracPart.padEnd(minFractionDigits, "0");
    }
  }
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";
  return fracPart ? `${sign}${grouped}.${fracPart}` : `${sign}${grouped}`;
}
