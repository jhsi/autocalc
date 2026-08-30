import { describe, expect, it } from "vitest";
import { ComputationEngine } from "../src/core/engine.ts";
import { isComputeError } from "../src/core/errors.ts";
import { createDoc, expectError, expectValue } from "./helpers.ts";

// Remove `.skip` after Milestone 4 (groups) is green.
describe.skip("Milestone 5 — formulas stored on cells", () => {
  it("engine.getValue returns a literal cell's rawValue", () => {
    const doc = createDoc([
      { id: "jan", name: "January", rawValue: 100 },
      { id: "feb", name: "February", rawValue: 200 },
    ]);
    const engine = new ComputationEngine(doc);
    expectValue(engine.getValue("jan"), 100);
  });

  it("engine.getValue evaluates a formula stored on a cell", () => {
    const doc = createDoc([
      { id: "jan", name: "January", rawValue: 100 },
      { id: "feb", name: "February", rawValue: 200 },
      { id: "total", name: "Total", formula: "SUM(jan, feb)" },
    ]);
    const engine = new ComputationEngine(doc);
    expectValue(engine.getValue("total"), 300);
  });

  it("a formula can depend on another formula cell", () => {
    const doc = createDoc([
      { id: "jan", rawValue: 100 },
      { id: "feb", rawValue: 200 },
      { id: "total", formula: "SUM(jan, feb)" },
      { id: "tax", formula: "total * 0.1" },
    ]);
    const engine = new ComputationEngine(doc);
    expectValue(engine.getValue("total"), 300);
    expectValue(engine.getValue("tax"), 30);
  });
});

// Remove `.skip` after Milestone 6 (dependency graph) is green.
describe.skip("Milestone 7 — recalculation", () => {
  it("setValue updates dependents and reports which cells changed", () => {
    const doc = createDoc([
      { id: "a", rawValue: 100 },
      { id: "b", rawValue: 200 },
      { id: "total", formula: "SUM(a, b)" },
      { id: "tax", formula: "total * 0.1" },
    ]);
    const engine = new ComputationEngine(doc);

    expectValue(engine.getValue("total"), 300);
    expectValue(engine.getValue("tax"), 30);

    const changes = engine.setValue("a", 500);

    expectValue(engine.getValue("a"), 500);
    expectValue(engine.getValue("total"), 700);
    expectValue(engine.getValue("tax"), 70);

    // Edited cell first, then dependents in topological order
    // (a cell appears after the cells it depends on).
    expect(changes).toEqual([
      { id: "a", value: 500 },
      { id: "total", value: 700 },
      { id: "tax", value: 70 },
    ]);
  });

  it("does not include unrelated cells in the change list", () => {
    const doc = createDoc([
      { id: "a", rawValue: 1 },
      { id: "b", rawValue: 2 },
      { id: "sumA", formula: "a + 10" },
      { id: "sumB", formula: "b + 10" },
    ]);
    const engine = new ComputationEngine(doc);
    const changes = engine.setValue("a", 5);
    expect(changes.map((change) => change.id).sort()).toEqual(["a", "sumA"]);
  });
});

// Remove `.skip` after Milestone 7 (recalculation) is green.
describe.skip("Milestone 8 — circular references", () => {
  it("detects a self-reference", () => {
    const doc = createDoc([{ id: "a", formula: "a + 1" }]);
    const engine = new ComputationEngine(doc);
    const result = engine.getValue("a");
    expectError(result, "CYCLE");
    if (isComputeError(result)) {
      expect(result.cells).toContain("a");
    }
  });

  it("detects a two-cell cycle", () => {
    const doc = createDoc([
      { id: "a", formula: "b + 1" },
      { id: "b", formula: "a + 1" },
    ]);
    const engine = new ComputationEngine(doc);
    const result = engine.getValue("a");
    expectError(result, "CYCLE");
    if (isComputeError(result)) {
      expect(result.cells).toEqual(expect.arrayContaining(["a", "b"]));
    }
  });

  it("detects a longer cycle a → b → c → a", () => {
    const doc = createDoc([
      { id: "a", formula: "b + 1" },
      { id: "b", formula: "c + 1" },
      { id: "c", formula: "a + 1" },
    ]);
    const engine = new ComputationEngine(doc);
    expectError(engine.getValue("a"), "CYCLE");
  });

  it("allows a diamond that is not a cycle", () => {
    const doc = createDoc([
      { id: "a", rawValue: 1 },
      { id: "b", formula: "a + 1" },
      { id: "c", formula: "a + 2" },
      { id: "d", formula: "b + c" },
    ]);
    const engine = new ComputationEngine(doc);
    expectValue(engine.getValue("d"), 5);
  });
});
