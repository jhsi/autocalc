/**
 * Shared domain types for the headless computation engine.
 * Cell identity is an opaque id. Names are presentation-only.
 * Formulas reference ids, never display names.
 */

import type { ComputeError } from "./errors.ts";

export type CellId = string;

/**
 * A successfully computed cell value.
 * Errors are not part of this union; see ComputeError in errors.ts.
 */
export type CellValue = number | string | boolean | null;

export type CellResult = CellValue | ComputeError;

export type CellFormatKind = "number" | "currency" | "percent" | "compact";

/**
 * Display formatting stored on a cell. Never part of the formula language.
 * Evaluation ignores this; only the formatter reads it.
 */
export interface CellFormat {
  kind: CellFormatKind;
  /** BCP 47 tag. The formatter should default to "en-US" when omitted. */
  locale?: string;
  /** ISO 4217 code used when kind is "currency". Default "USD". */
  currency?: string;
  /** Fraction digits to display, when the kind supports it. */
  fractionDigits?: number;
}

export interface Cell {
  id: CellId;
  /** Presentation label only. Never used for formula lookup. */
  name: string;
  /** Literal source value when this cell is not a formula. */
  rawValue?: CellValue;
  /** Formula source text when this cell is computed. */
  formula?: string;
  /** Optional parent group id. */
  parentId?: string;
  format?: CellFormat;
}

export interface CellGroup {
  id: string;
  name: string;
  /** Child cell ids and/or nested group ids. Order is preserved. */
  children: string[];
}

/** One cell whose displayed value changed after a mutation. */
export interface CellChange {
  id: CellId;
  value: CellResult;
}
