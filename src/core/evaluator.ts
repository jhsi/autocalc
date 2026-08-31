import type { BinaryExpr, CallExpr, Expr, NumberExpr, ReferenceExpr } from "./ast.ts";
import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import { divZeroError, isComputeError, nameError, notImplemented, refError, valueError } from "./errors.ts";
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
    switch (n.op) {
      case "*":
        return this.evaluateFormula(n.left) * this.evaluateFormula(n.right);
      case "/":
        const right = this.evaluateFormula(n.right);
        if (right === 0) {
          throw divZeroError();
        }
        return this.evaluateFormula(n.left) / right;
      case "-":
        return this.evaluateFormula(n.left) - this.evaluateFormula(n.right);
      case "+":
        return this.evaluateFormula(n.left) + this.evaluateFormula(n.right);
      default:
        throw new EvalError("Undefined operator");
    }
  }

  evaluateCall(n: CallExpr): number {
    switch (n.name) {
      case "SUM" satisfies EvaluatorFunction:
        return n.args.reduce((sum, expr) => sum + this.evaluateFormula(expr), 0);
      case "AVG" satisfies EvaluatorFunction:
        if (n.args.length === 0) {
          throw divZeroError();
        }
        const sum = n.args.reduce((sum, expr) => sum + this.evaluateFormula(expr), 0);
        return sum / n.args.length;
      case "MIN" satisfies EvaluatorFunction:
        return n.args.map((expr) => this.evaluateFormula(expr)).reduce((minVal, val) => {
          if (val <= minVal) {
            return val;
          }
          return minVal;
        }, Infinity);
      case "MAX" satisfies EvaluatorFunction:
        return n.args.map((expr) => this.evaluateFormula(expr)).reduce((maxVal, val) => {
          if (val >= maxVal) {
            return val;
          }
          return maxVal;
        }, -Infinity);
    }
    throw nameError(n.name);
  }
}

export function getCellValue(id: string, doc: DocumentAdapter | undefined) {
  const cell = doc?.getCell(id)
  if (cell !== undefined) {
    if (cell.rawValue != undefined) {
      return cell.rawValue;
    } else if (cell.formula !== undefined) {
      return evaluateFormula(cell?.formula, doc)
    } else {
      throw valueError(id);
    }
  } else {
    // TODO: handle groups
    throw refError(id);
  }

}