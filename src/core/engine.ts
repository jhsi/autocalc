import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import { notImplemented } from "./errors.ts";
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
  constructor(readonly document: DocumentAdapter) {}

  getValue(_id: CellId): CellResult {
    notImplemented("ComputationEngine.getValue", "src/core/engine.ts");
  }

  getFormattedValue(_id: CellId): string {
    notImplemented("ComputationEngine.getFormattedValue", "src/core/engine.ts");
  }

  setValue(_id: CellId, _value: CellValue): CellChange[] {
    notImplemented("ComputationEngine.setValue", "src/core/engine.ts");
  }

  setFormula(_id: CellId, _formula: string | undefined): CellChange[] {
    notImplemented("ComputationEngine.setFormula", "src/core/engine.ts");
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
