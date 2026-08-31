import type { Cell, CellId, CellValue } from "../core/types.ts";

/**
 * Persistence-agnostic document surface.
 * A future Figma adapter will implement this against the scene graph.
 * The engine must depend only on this interface, never on Figma APIs.
 *
 * Ids are unique across cells and groups.
 */
export interface DocumentAdapter {
  getCell(id: CellId): Cell | undefined;
  getAllCells(): Cell[];
  /** Store a literal and clear any formula on that cell. */
  setRawValue(id: CellId, value: CellValue): void;
  /** Store a formula and clear the literal on that cell. */
  setFormula(id: CellId, formula: string | undefined): void;
}
