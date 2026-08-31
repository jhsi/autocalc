import type { BinaryExpr, CallExpr, Expr, NumberExpr, ReferenceExpr } from "./ast.ts";
import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import { divZeroError, isComputeError, nameError, refError, valueError } from "./errors.ts";
import type { CellId, CellResult } from "./types.ts";
import { parseFormula, type EvaluatorFunction } from "./parser.ts";

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
  const evaluator = new Evaluator(_expr, _doc);
  return evaluator.evaluate();
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

class Evaluator {
  private ast;
  private doc;

  constructor(_expr: Expr, _doc?: DocumentAdapter) {
    this.ast = _expr;
    this.doc = _doc;
  }

  evaluate() {
    return this.evaluateFormula(this.ast);
  }

  evaluateFormula(n: Expr): any {
    switch (n.kind) {
      case "binary":
        return this.evaluateBinary(n);
      case "call":
        return this.evaluateCall(n);
      case "number":
        return (n as NumberExpr).value;
      case "ref":
        return getCellValue(n.id, this.doc);
      default:
        return 0;
    }
  }

  evaluateBinary(n: BinaryExpr): number {
    const left = numeric(this.evaluateFormula(n.left));
    const right = numeric(this.evaluateFormula(n.right));
    switch (n.op) {
      case "*":
        return left * right;
      case "/":
        if (right === 0) {
          throw divZeroError();
        }
        return left / right;
      case "-":
        return left - right;
      case "+":
        return left + right;
      default:
        throw new EvalError("Undefined operator");
    }
  }

  evaluateCall(n: CallExpr): number {
    const args = n.args.map((expr) => numeric(this.evaluateFormula(expr)));
    switch (n.name) {
      case "SUM" satisfies EvaluatorFunction:
        return args.reduce((sum, value) => sum + value, 0);
      case "AVG" satisfies EvaluatorFunction:
        if (args.length === 0) {
          throw divZeroError();
        }
        return args.reduce((sum, value) => sum + value, 0) / args.length;
      case "MIN" satisfies EvaluatorFunction:
        return args.reduce((minVal, val) => (val <= minVal ? val : minVal), Infinity);
      case "MAX" satisfies EvaluatorFunction:
        return args.reduce((maxVal, val) => (val >= maxVal ? val : maxVal), -Infinity);
    }
    throw nameError(n.name);
  }
}

function numeric(value: unknown): number {
  if (isComputeError(value)) {
    throw value;
  }
  if (typeof value !== "number") {
    throw valueError(`Expected a number, got ${String(value)}`);
  }
  return value;
}

export function getCellValue(id: string, doc: DocumentAdapter | undefined) {
  const cell = doc?.getCell(id);
  if (cell === undefined) {
    throw refError(id);
  }
  if (cell.rawValue != undefined) {
    return cell.rawValue;
  }
  if (cell.formula !== undefined) {
    const result = evaluateFormula(cell.formula, doc);
    if (isComputeError(result)) {
      throw result;
    }
    return result;
  }
  throw valueError(id);
}