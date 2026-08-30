import type { Expr } from "./ast.ts";
import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import { isComputeError, notImplemented } from "./errors.ts";
import type { CellId, CellResult } from "./types.ts";
import { parseFormula } from "./parser.ts";

/**
 * Optional evaluation state. Used later for cycle detection.
 * Milestone 1 does not need this.
 */
export interface EvalState {
  visiting?: Set<CellId>;
}

/**
 * Walk an AST and produce a CellResult.
 *
 * Suggested responsibilities (you implement the algorithms):
 * - number / string literals → that value
 * - binary ops → evaluate sides, then apply + - * / (numbers only)
 * - ref → look up the id on `doc`; missing → REF error
 *   - literal cell → rawValue
 *   - formula cell → evaluate that formula (needed from Milestone 5)
 * - call → SUM / AVG / MIN / MAX (Milestone 3+)
 *   - a ref argument that names a group expands to numeric descendants
 *
 * Propagate ComputeError instead of producing NaN.
 * Division by zero should be a DIV_ZERO error, not Infinity.
 */
export function evaluate(
  _expr: Expr,
  _doc?: DocumentAdapter,
  _state?: EvalState,
): CellResult {
  notImplemented("evaluate", "src/core/evaluator.ts");
}

/**
 * Convenience: parse a formula then evaluate it against a document.
 * If tokenize/parse throw a ComputeError, it is returned as a value so
 * formula cells can display PARSE errors instead of crashing.
 */
export function evaluateFormula(
  source: string,
  doc?: DocumentAdapter,
  state?: EvalState,
): CellResult {
  try {
    return evaluate(parseFormula(source), doc, state);
  } catch (error) {
    if (isComputeError(error)) {
      return error;
    }
    throw error;
  }
}
