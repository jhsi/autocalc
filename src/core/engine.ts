import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import { errorLabel, isComputeError, notImplemented } from "./errors.ts";
import { getCellValue } from "./evaluator.ts";
import { formatValue } from "./formatter.ts";
import type { CellChange, CellId, CellResult, CellValue } from "./types.ts";

/**
 * Orchestrates document reads/writes, evaluation, and recalculation.
 * Knows nothing about Figma — only DocumentAdapter.
 *
 * setValue / setFormula persist through the adapter, then return every cell
 * whose computed value should be refreshed so a Figma adapter can update
 * only those text nodes (currently the whole document, naively).
 */
export class ComputationEngine {
  private doc;

  constructor(readonly document: DocumentAdapter) {
    this.doc = document;
  }

  getValue(id: CellId): CellResult {
    try {
      return getCellValue(id, this.doc);
    } catch (error) {
      if (isComputeError(error)) {
        return error;
      }
      throw error;
    }
  }

  getFormattedValue(id: CellId): string {
    const result = this.getValue(id);
    if (isComputeError(result)) {
      return errorLabel(result);
    }
    return formatValue(result, this.doc.getCell(id)?.format);
  }

  setValue(id: CellId, value: CellValue): CellChange[] {
    this.doc.setRawValue(id, value);
    return this.snapshot();
  }

  setFormula(id: CellId, formula: string | undefined): CellChange[] {
    this.doc.setFormula(id, formula);
    return this.snapshot();
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

  private snapshot(): CellChange[] {
    return this.doc.getAllCells().map((cell) => ({
      id: cell.id,
      value: this.getValue(cell.id),
    }));
  }
}
