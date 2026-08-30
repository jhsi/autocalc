import { notImplemented } from "./errors.ts";
import type { CellFormat, CellValue } from "./types.ts";

/**
 * Format a computed value for display.
 * Pure: does not evaluate formulas and must not live in the formula language.
 * Prefer `Intl.NumberFormat` for locale-aware number/currency/percent/compact.
 */
export function formatValue(_value: CellValue, _format?: CellFormat): string {
  notImplemented("formatValue", "src/core/formatter.ts");
}
