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
  INR: "₹",
  BRL: "R$",
  CHF: "CHF",
  CAD: "CA$",
  AUD: "A$",
  MXN: "MX$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  RUB: "₽",
  TRY: "₺",
  TWD: "NT$",
  SGD: "S$",
  HKD: "HK$",
  NZD: "NZ$",
};

type CurrencyPlacement = "prefix" | "prefix-space" | "suffix-space";

interface LocaleNumberStyle {
  decimal: string;
  group: string;
  currency: CurrencyPlacement;
}

const US_STYLE: LocaleNumberStyle = {
  decimal: ".",
  group: ",",
  currency: "prefix",
};

/** CLDR-ish separators / currency placement for locales the plugin offers. */
const LOCALE_STYLES: Record<string, LocaleNumberStyle> = {
  en: US_STYLE,
  de: { decimal: ",", group: ".", currency: "suffix-space" },
  fr: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  "es-MX": { decimal: ".", group: ",", currency: "prefix-space" },
  es: { decimal: ",", group: ".", currency: "suffix-space" },
  it: { decimal: ",", group: ".", currency: "suffix-space" },
  "pt-BR": { decimal: ",", group: ".", currency: "prefix-space" },
  pt: { decimal: ",", group: ".", currency: "suffix-space" },
  ja: US_STYLE,
  zh: US_STYLE,
  ko: US_STYLE,
  nl: { decimal: ",", group: ".", currency: "prefix-space" },
  sv: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  nb: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  nn: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  no: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  da: { decimal: ",", group: ".", currency: "suffix-space" },
  fi: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  pl: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  ru: { decimal: ",", group: "\u00A0", currency: "suffix-space" },
  tr: { decimal: ",", group: ".", currency: "prefix" },
  hi: US_STYLE,
  th: US_STYLE,
  vi: { decimal: ",", group: ".", currency: "suffix-space" },
  id: { decimal: ",", group: ".", currency: "prefix" },
  ar: { decimal: ".", group: ",", currency: "suffix-space" },
  he: { decimal: ".", group: ",", currency: "suffix-space" },
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
 * Figma's plugin sandbox does not, so we fall back to a locale-aware formatter.
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

function localeStyle(locale: string | undefined): LocaleNumberStyle {
  const tag = (locale ?? DEFAULT_LOCALE).replace(/_/g, "-");
  const exact = LOCALE_STYLES[tag];
  if (exact) {
    return exact;
  }
  const lang = tag.split("-")[0];
  if (lang && LOCALE_STYLES[lang]) {
    return LOCALE_STYLES[lang];
  }
  return US_STYLE;
}

/** Locale-aware grouping / currency / percent / compact when Intl is unavailable. */
function formatFallback(value: number, format: CellFormat): string {
  const digits = format.fractionDigits;
  const style = localeStyle(format.locale);
  switch (format.kind) {
    case "currency":
      return formatCurrency(value, digits ?? 2, digits ?? 2, format, style);
    case "percent":
      return `${formatDecimal(value * 100, digits ?? 0, digits ?? 0, style)}%`;
    case "compact":
      return formatCompact(value, digits, style);
    case "number":
    default:
      return formatDecimal(value, digits ?? 0, digits ?? 3, style);
  }
}

function formatCurrency(
  value: number,
  minFractionDigits: number,
  maxFractionDigits: number,
  format: CellFormat,
  style: LocaleNumberStyle,
): string {
  const amount = formatDecimal(
    Math.abs(value),
    minFractionDigits,
    maxFractionDigits,
    style,
  );
  const symbol =
    CURRENCY_SYMBOLS[format.currency ?? DEFAULT_CURRENCY] ??
    `${format.currency ?? DEFAULT_CURRENCY}`;
  const sign = value < 0 || Object.is(value, -0) ? "-" : "";
  switch (style.currency) {
    case "prefix-space":
      return `${sign}${symbol} ${amount}`;
    case "suffix-space":
      return `${sign}${amount} ${symbol}`;
    case "prefix":
    default:
      return `${sign}${symbol}${amount}`;
  }
}

function formatCompact(
  value: number,
  fractionDigits: number | undefined,
  style: LocaleNumberStyle,
): string {
  const abs = Math.abs(value);
  for (const unit of COMPACT_UNITS) {
    if (abs >= unit.value) {
      const scaled = value / unit.value;
      const min = fractionDigits ?? 0;
      const max = fractionDigits ?? 2;
      return `${formatDecimal(scaled, min, max, style)}${unit.suffix}`;
    }
  }
  return formatDecimal(value, fractionDigits ?? 0, fractionDigits ?? 2, style);
}

function formatDecimal(
  value: number,
  minFractionDigits: number,
  maxFractionDigits: number,
  style: LocaleNumberStyle = US_STYLE,
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
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, style.group);
  const sign = negative ? "-" : "";
  return fracPart
    ? `${sign}${grouped}${style.decimal}${fracPart}`
    : `${sign}${grouped}`;
}
