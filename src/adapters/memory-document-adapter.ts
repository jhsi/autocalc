import type { DocumentAdapter } from "./document-adapter.ts";
import type { Cell, CellId, CellValue } from "../core/types.ts";

/**
 * In-memory document used by tests.
 * This is the stand-in for the future Figma adapter.
 */
export class MemoryDocumentAdapter implements DocumentAdapter {
  private readonly cells = new Map<CellId, Cell>();

  addCell(input: Cell): Cell {
    this.assertUniqueId(input.id);
    const cell: Cell = { ...input };
    this.cells.set(cell.id, cell);
    return cell;
  }

  getCell(id: CellId): Cell | undefined {
    return this.cells.get(id);
  }

  getAllCells(): Cell[] {
    return [...this.cells.values()];
  }

  setRawValue(id: CellId, value: CellValue): void {
    const cell = this.requireCell(id, "setRawValue");
    cell.rawValue = value;
    cell.formula = undefined;
  }

  setFormula(id: CellId, formula: string | undefined): void {
    const cell = this.requireCell(id, "setFormula");
    cell.formula = formula;
    if (formula !== undefined) {
      cell.rawValue = undefined;
    }
  }

  private requireCell(id: CellId, action: string): Cell {
    const cell = this.cells.get(id);
    if (!cell) {
      throw new Error(`${action}: unknown cell '${id}'`);
    }
    return cell;
  }

  private assertUniqueId(id: string): void {
    if (this.cells.has(id)) {
      throw new Error(`Id '${id}' is already used by a cell`);
    }
  }
}
