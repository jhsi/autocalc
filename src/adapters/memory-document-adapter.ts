import type { DocumentAdapter } from "./document-adapter.ts";
import type { Cell, CellGroup, CellId, CellValue } from "../core/types.ts";

/**
 * In-memory document used by tests.
 * This is the stand-in for the future Figma adapter.
 */
export class MemoryDocumentAdapter implements DocumentAdapter {
  private readonly cells = new Map<CellId, Cell>();
  private readonly groups = new Map<string, CellGroup>();

  addCell(input: Cell): Cell {
    this.assertUniqueId(input.id);
    const cell: Cell = { ...input };
    this.cells.set(cell.id, cell);
    if (cell.parentId) {
      const parent = this.groups.get(cell.parentId);
      if (parent && !parent.children.includes(cell.id)) {
        parent.children.push(cell.id);
      }
    }
    return cell;
  }

  addGroup(input: CellGroup): CellGroup {
    this.assertUniqueId(input.id);
    const group: CellGroup = { ...input, children: [...input.children] };
    this.groups.set(group.id, group);
    return group;
  }

  getCell(id: CellId): Cell | undefined {
    return this.cells.get(id);
  }

  getGroup(id: string): CellGroup | undefined {
    return this.groups.get(id);
  }

  getChildren(id: string): string[] {
    const group = this.groups.get(id);
    return group ? [...group.children] : [];
  }

  getAllCells(): Cell[] {
    return [...this.cells.values()];
  }

  getAllGroups(): CellGroup[] {
    return [...this.groups.values()];
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
    if (this.cells.has(id) || this.groups.has(id)) {
      throw new Error(`Id '${id}' is already used by a cell or group`);
    }
  }
}
