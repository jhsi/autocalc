import type { CellFormat, CellValue } from "./types.ts";

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";

/**
 * Format a computed value for display.
 * Pure: does not evaluate formulas and must not live in the formula language.
 * Prefer `Intl.NumberFormat` for locale-aware number/currency/percent/compact.
 */
export function formatValue(value: CellValue, format?: CellFormat): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value === null ? "" : String(value);
  }

  const locale = format?.locale ?? DEFAULT_LOCALE;
  return new Intl.NumberFormat(locale, numberFormatOptions(format)).format(
    value,
  );
}

function numberFormatOptions(format?: CellFormat): Intl.NumberFormatOptions {
  const fractionDigits = format?.fractionDigits;
  const fraction: Intl.NumberFormatOptions =
    fractionDigits === undefined
      ? {}
      : {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        };

  switch (format?.kind) {
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
