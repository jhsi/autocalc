import { describe, expect, it } from "vitest";
import { evaluateFormula } from "../src/core/evaluator.ts";
import { ComputationEngine } from "../src/core/engine.ts";
import {
  ComputeError,
  errorLabel,
  isComputeError,
} from "../src/core/errors.ts";
import { createDoc, expectError } from "./helpers.ts";

describe("error helpers (available from the start)", () => {
  it("maps structured kinds to default display labels without the engine depending on those strings", () => {
    expect(errorLabel(new ComputeError("REF", "missing"))).toBe("#REF!");
    expect(errorLabel(new ComputeError("VALUE", "bad"))).toBe("#VALUE!");
    expect(errorLabel(new ComputeError("DIV_ZERO", "div"))).toBe("#DIV/0!");
    expect(errorLabel(new ComputeError("CYCLE", "loop"))).toBe("#CYCLE!");
  });

  it("isComputeError distinguishes errors from cell values", () => {
    expect(isComputeError(10)).toBe(false);
    expect(isComputeError(null)).toBe(false);
    expect(isComputeError(new ComputeError("REF", "missing"))).toBe(true);
  });
});

// Remove `.skip` after Milestone 9 (formatting) is green.
describe.skip("Milestone 10 — errors", () => {
  it("unknown cell → REF, displayed as #REF!", () => {
    const doc = createDoc([{ id: "a", rawValue: 1 }]);
    const result = evaluateFormula("missing", doc);
    expectError(result, "REF");
    if (isComputeError(result)) {
      expect(errorLabel(result)).toBe("#REF!");
    }
  });

  it("non-numeric arithmetic → VALUE, displayed as #VALUE!", () => {
    const doc = createDoc([
      { id: "a", rawValue: "hello" },
      { id: "b", rawValue: 1 },
    ]);
    const result = evaluateFormula("a + b", doc);
    expectError(result, "VALUE");
    if (isComputeError(result)) {
      expect(errorLabel(result)).toBe("#VALUE!");
    }
  });

  it("division by zero → DIV_ZERO, displayed as #DIV/0!", () => {
    const result = evaluateFormula("1 / 0");
    expectError(result, "DIV_ZERO");
    if (isComputeError(result)) {
      expect(errorLabel(result)).toBe("#DIV/0!");
    }
  });

  it("cycle → CYCLE, displayed as #CYCLE!", () => {
    const doc = createDoc([
      { id: "a", formula: "b + 1" },
      { id: "b", formula: "a + 1" },
    ]);
    const engine = new ComputationEngine(doc);
    const result = engine.getValue("a");
    expectError(result, "CYCLE");
    if (isComputeError(result)) {
      expect(errorLabel(result)).toBe("#CYCLE!");
    }
  });

  it("propagates a REF through dependents instead of producing NaN", () => {
    const doc = createDoc([
      { id: "a", formula: "missing + 1" },
      { id: "b", formula: "a + 1" },
    ]);
    const engine = new ComputationEngine(doc);
    expectError(engine.getValue("a"), "REF");
    expectError(engine.getValue("b"), "REF");
    const b = engine.getValue("b");
    expect(typeof b === "number" && Number.isNaN(b)).toBe(false);
  });

  it("propagates DIV_ZERO through dependents", () => {
    const doc = createDoc([
      { id: "a", formula: "1 / 0" },
      { id: "b", formula: "a + 1" },
    ]);
    const engine = new ComputationEngine(doc);
    expectError(engine.getValue("a"), "DIV_ZERO");
    expectError(engine.getValue("b"), "DIV_ZERO");
  });

  it("unknown function name is a NAME error", () => {
    expectError(evaluateFormula("NOPE(1, 2)"), "NAME");
  });

  it("syntax errors are PARSE errors, not thrown crashes", () => {
    const result = evaluateFormula("1 +");
    expectError(result, "PARSE");
  });
});
