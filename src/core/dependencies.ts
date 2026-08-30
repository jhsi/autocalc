import type { Expr } from "./ast.ts";
import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import { notImplemented } from "./errors.ts";
import type { CellId } from "./types.ts";

/**
 * Dependency graph helpers.
 *
 * Keep this small:
 * - collectReferences: ids mentioned in an AST
 * - directDependencies: ids a cell's formula names
 * - dependenciesOf: transitive (what this cell needs, recursively)
 * - directDependents: cells whose formula names this id
 * - dependentsOf: transitive (what would change if this cell changed)
 *
 * A cell with no formula has no dependencies.
 * Do not treat display names as references.
 */
export function collectReferences(_expr: Expr): CellId[] {
  notImplemented("collectReferences", "src/core/dependencies.ts");
}

export function directDependencies(
  _id: CellId,
  _doc: DocumentAdapter,
): CellId[] {
  notImplemented("directDependencies", "src/core/dependencies.ts");
}

export function dependenciesOf(_id: CellId, _doc: DocumentAdapter): CellId[] {
  notImplemented("dependenciesOf", "src/core/dependencies.ts");
}

export function directDependents(_id: CellId, _doc: DocumentAdapter): CellId[] {
  notImplemented("directDependents", "src/core/dependencies.ts");
}

export function dependentsOf(_id: CellId, _doc: DocumentAdapter): CellId[] {
  notImplemented("dependentsOf", "src/core/dependencies.ts");
}
