import { describe, it } from "vitest";
import type { Expr } from "../src/core/ast.ts";
import { evaluate, evaluateFormula } from "../src/core/evaluator.ts";
import { createDoc, expectError, expectValue } from "./helpers.ts";

const n = (value: number): Expr => ({ kind: "number", value });
const bin = (op: "+" | "-" | "*" | "/", left: Expr, right: Expr): Expr => ({
  kind: "binary",
  op,
  left,
  right,
});
const ref = (id: string): Expr => ({ kind: "ref", id });
const call = (name: string, args: Expr[]): Expr => ({ kind: "call", name, args });

describe("Milestone 1 — evaluator (literals and arithmetic)", () => {
  it("evaluates a number", () => {
    expectValue(evaluate(n(1)), 1);
  });

  it("evaluates 1 + 2", () => {
    expectValue(evaluate(bin("+", n(1), n(2))), 3);
  });

  it("evaluates 5 - 2", () => {
    expectValue(evaluate(bin("-", n(5), n(2))), 3);
  });

  it("evaluates 3 * 4", () => {
    expectValue(evaluate(bin("*", n(3), n(4))), 12);
  });

  it("evaluates 8 / 2", () => {
    expectValue(evaluate(bin("/", n(8), n(2))), 4);
  });

  it("evaluates 1 + 2 * 3 using the already-parsed tree 1 + (2 * 3)", () => {
    expectValue(evaluate(bin("+", n(1), bin("*", n(2), n(3)))), 7);
  });

  it("evaluates (1 + 2) * 3 using the already-parsed tree (1 + 2) * 3", () => {
    expectValue(evaluate(bin("*", bin("+", n(1), n(2)), n(3))), 9);
  });

  it("evaluateFormula runs the tokenize → parse → evaluate pipeline", () => {
    expectValue(evaluateFormula("1"), 1);
    expectValue(evaluateFormula("1 + 2"), 3);
    expectValue(evaluateFormula("5 - 2"), 3);
    expectValue(evaluateFormula("3 * 4"), 12);
    expectValue(evaluateFormula("8 / 2"), 4);
    expectValue(evaluateFormula("1 + 2 * 3"), 7);
    expectValue(evaluateFormula("(1 + 2) * 3"), 9);
  });
});

// Remove `.skip` after Milestone 1 (literals and arithmetic) is green.
describe.skip("Milestone 2 — evaluator (cell references)", () => {
  const doc = () =>
    createDoc([
      { id: "a", rawValue: 10 },
      { id: "b", rawValue: 20 },
    ]);

  it("evaluates a reference to a literal cell", () => {
    expectValue(evaluate(ref("a"), doc()), 10);
  });

  it("evaluates a + b", () => {
    expectValue(evaluate(bin("+", ref("a"), ref("b")), doc()), 30);
    expectValue(evaluateFormula("a + b", doc()), 30);
  });

  it("evaluates a * 2", () => {
    expectValue(evaluateFormula("a * 2", doc()), 20);
  });

  it("evaluates (a + b) / 2", () => {
    expectValue(evaluateFormula("(a + b) / 2", doc()), 15);
  });

  it("returns a REF error for a missing cell instead of 0 or null", () => {
    expectError(evaluateFormula("a + missing", doc()), "REF");
  });
});

// Remove `.skip` after Milestone 2 (cell references) is green.
describe.skip("Milestone 3 — evaluator (functions)", () => {
  const doc = () =>
    createDoc([
      { id: "a", rawValue: 10 },
      { id: "b", rawValue: 20 },
      { id: "c", rawValue: 30 },
    ]);

  it("evaluates SUM(a, b, c)", () => {
    expectValue(
      evaluate(call("SUM", [ref("a"), ref("b"), ref("c")]), doc()),
      60,
    );
    expectValue(evaluateFormula("SUM(a, b, c)", doc()), 60);
  });

  it("evaluates AVG(a, b, c)", () => {
    expectValue(evaluateFormula("AVG(a, b, c)", doc()), 20);
  });

  it("evaluates MIN(a, b, c)", () => {
    expectValue(evaluateFormula("MIN(a, b, c)", doc()), 10);
  });

  it("evaluates MAX(a, b, c)", () => {
    expectValue(evaluateFormula("MAX(a, b, c)", doc()), 30);
  });

  it("evaluates nested expressions: SUM(a, b) * 2", () => {
    expectValue(evaluateFormula("SUM(a, b) * 2", doc()), 60);
  });

  it("evaluates nested expressions: SUM(a, b + c)", () => {
    expectValue(evaluateFormula("SUM(a, b + c)", doc()), 60);
  });
});
