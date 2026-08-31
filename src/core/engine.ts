import { identTok } from "../../tests/helpers.ts";
import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import { errorLabel, isComputeError, notImplemented, valueError } from "./errors.ts";
import { evaluateFormula, getCellValue } from "./evaluator.ts";
import { formatValue } from "./formatter.ts";
import { tokenize } from "./tokenizer.ts";
import type { CellChange, CellId, CellResult, CellValue } from "./types.ts";

/**
 * Orchestrates document reads/writes, evaluation, and recalculation.
 * Knows nothing about Figma — only DocumentAdapter.
 *
 * Suggested shape (you implement the algorithms):
 * - getValue: literal → rawValue; formula → evaluateFormula
 * - setValue: write a literal, clear formula, recompute dependents
 * - setFormula: write a formula, recompute this cell and dependents
 * - dependency queries: delegate to dependencies.ts
 *
 * setValue / setFormula should return every cell whose computed value
 * changed, so a future Figma adapter can update only those text nodes.
 */
export class ComputationEngine {
  private doc;

  constructor(readonly document: DocumentAdapter) {
    this.doc = document;
  }

  getValue(_id: CellId): CellResult {
    return getCellValue(_id, this.doc);
  }

  getFormattedValue(id: CellId): string {
    const result = this.getValue(id);
    if (isComputeError(result)) {
      return errorLabel(result);
    }
    return formatValue(result, this.doc.getCell(id)?.format);
  }

  setValue(_id: CellId, _value: CellValue): CellChange[] {
    // naive: rerender everything
    return this.doc.getAllCells().map((cell) => {
      if (cell.id === _id) {
        return {
          id: _id,
          value: _value
        } satisfies CellChange
      } else if (cell.formula && hasDependency(cell.formula, _id)) {
        return {
          id: cell.id,
          value: getCellValue(cell.id, this.doc),
        }
      } else {
        return null;
      }
    }).filter(c => c !== null)
  }

  setFormula(_id: CellId, _formula: string | undefined): CellChange[] {
    // naive: rerender everything
    return this.doc.getAllCells().map((cell) => {
      return {
        id: cell.id,
        value: getCellValue(cell.id, this.doc),
      }
    })
  }

  directDependenciesOf(_id: CellId): CellId[] {
    notImplemented("ComputationEngine.directDependenciesOf", "src/core/engine.ts");
  }

  dependenciesOf(_id: CellId): CellId[] {
    notImplemented("ComputationEngine.dependenciesOf", "src/core/engine.ts");
  }

  directDependentsOf(_id: CellId): CellId[] {
    notImplemented("ComputationEngine.directDependentsOf", "src/core/engine.ts");
  }

  dependentsOf(_id: CellId): CellId[] {
    notImplemented("ComputationEngine.dependentsOf", "src/core/engine.ts");
  }
}

function hasDependency(srcId: string, depId: string) {
  return true; // naively recalculate everything
}
