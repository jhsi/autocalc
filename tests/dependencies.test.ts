import { describe, expect, it } from "vitest";
import { ComputationEngine } from "../src/core/engine.ts";
import { collectReferences } from "../src/core/dependencies.ts";
import { parseFormula } from "../src/core/parser.ts";
import { createDoc } from "./helpers.ts";

/**
 * Example graph used by several tests:
 *
 *   price ────────┐
 *                 ↓
 *   quantity → subtotal → tax
 *                    └────→ total
 *                          ↑
 *                         tax
 *
 *   price     literal
 *   quantity  literal
 *   subtotal  = price * quantity
 *   tax       = subtotal * 0.1
 *   total     = subtotal + tax
 */
function ledger() {
  const doc = createDoc([
    { id: "price", rawValue: 10 },
    { id: "quantity", rawValue: 5 },
    { id: "subtotal", formula: "price * quantity" },
    { id: "tax", formula: "subtotal * 0.1" },
    { id: "total", formula: "subtotal + tax" },
  ]);
  return { doc, engine: new ComputationEngine(doc) };
}

// Remove `.skip` after Milestone 5 (formulas stored on cells) is green.
describe.skip("Milestone 6 — dependency graph", () => {
  it("collects ids mentioned in an AST", () => {
    const ids = collectReferences(parseFormula("price * quantity"));
    expect(ids.sort()).toEqual(["price", "quantity"]);
  });

  it("a literal cell has no dependencies", () => {
    const { engine } = ledger();
    expect(engine.directDependenciesOf("price")).toEqual([]);
    expect(engine.dependenciesOf("price")).toEqual([]);
  });

  it("directDependenciesOf reads only the formula's immediate refs", () => {
    const { engine } = ledger();
    expect(engine.directDependenciesOf("subtotal").sort()).toEqual([
      "price",
      "quantity",
    ]);
    expect(engine.directDependenciesOf("tax")).toEqual(["subtotal"]);
    expect(engine.directDependenciesOf("total").sort()).toEqual([
      "subtotal",
      "tax",
    ]);
  });

  it("dependenciesOf includes transitive refs", () => {
    const { engine } = ledger();
    expect(engine.dependenciesOf("tax").sort()).toEqual([
      "price",
      "quantity",
      "subtotal",
    ]);
    expect(engine.dependenciesOf("total").sort()).toEqual([
      "price",
      "quantity",
      "subtotal",
      "tax",
    ]);
  });

  it("directDependentsOf are cells whose formula names this id", () => {
    const { engine } = ledger();
    expect(engine.directDependentsOf("price")).toEqual(["subtotal"]);
    expect(engine.directDependentsOf("subtotal").sort()).toEqual([
      "tax",
      "total",
    ]);
    expect(engine.directDependentsOf("total")).toEqual([]);
  });

  it("dependentsOf includes every cell that would change if this cell changed", () => {
    const { engine } = ledger();
    expect(engine.dependentsOf("price").sort()).toEqual([
      "subtotal",
      "tax",
      "total",
    ]);
    expect(engine.dependentsOf("tax")).toEqual(["total"]);
    expect(engine.dependentsOf("total")).toEqual([]);
  });
});
