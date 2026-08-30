import { describe, it } from "vitest";
import { evaluateFormula } from "../src/core/evaluator.ts";
import { createDoc, expectError, expectValue } from "./helpers.ts";

/**
 * Group aggregation behavior (Milestone 4)
 *
 * Nested groups:
 *   Walk descendants. SUM(year) includes every numeric cell under year,
 *   including those nested in q1 / q2.
 *
 * Strings (and booleans / null) inside a numeric group:
 *   Skip them. They do not contribute and do not become VALUE errors.
 *
 * Empty groups / groups with no numeric descendants:
 *   SUM → 0
 *   AVG → DIV_ZERO
 *   MIN / MAX → VALUE
 *
 * Duplicate inclusion:
 *   Expanding a single group counts each descendant cell at most once.
 *   Separate arguments are independent: SUM(q1, jan) adds jan twice if
 *   jan is also inside q1.
 */
// Remove `.skip` after Milestone 3 (functions) is green.
describe.skip("Milestone 4 — groups", () => {
  const quarter = () =>
    createDoc(
      [
        { id: "jan", name: "January", rawValue: 100, parentId: "q1" },
        { id: "feb", name: "February", rawValue: 200, parentId: "q1" },
        { id: "mar", name: "March", rawValue: 300, parentId: "q1" },
      ],
      [{ id: "q1", name: "Q1", children: ["jan", "feb", "mar"] }],
    );

  it("SUM(q1) totals numeric descendants", () => {
    expectValue(evaluateFormula("SUM(q1)", quarter()), 600);
  });

  it("AVG(q1) averages numeric descendants", () => {
    expectValue(evaluateFormula("AVG(q1)", quarter()), 200);
  });

  it("MIN and MAX over a group", () => {
    const doc = quarter();
    expectValue(evaluateFormula("MIN(q1)", doc), 100);
    expectValue(evaluateFormula("MAX(q1)", doc), 300);
  });

  it("walks nested groups", () => {
    const doc = createDoc(
      [
        { id: "jan", rawValue: 100, parentId: "q1" },
        { id: "feb", rawValue: 200, parentId: "q1" },
        { id: "mar", rawValue: 300, parentId: "q1" },
        { id: "apr", rawValue: 400, parentId: "q2" },
        { id: "may", rawValue: 500, parentId: "q2" },
        { id: "jun", rawValue: 600, parentId: "q2" },
      ],
      [
        { id: "year", name: "Year", children: ["q1", "q2"] },
        { id: "q1", name: "Q1", children: ["jan", "feb", "mar"] },
        { id: "q2", name: "Q2", children: ["apr", "may", "jun"] },
      ],
    );

    expectValue(evaluateFormula("SUM(q1)", doc), 600);
    expectValue(evaluateFormula("SUM(q2)", doc), 1500);
    expectValue(evaluateFormula("SUM(year)", doc), 2100);
  });

  it("skips string cells inside a group rather than erroring", () => {
    const doc = createDoc(
      [
        { id: "jan", rawValue: 100, parentId: "q1" },
        { id: "label", rawValue: "hello", parentId: "q1" },
        { id: "feb", rawValue: 200, parentId: "q1" },
      ],
      [{ id: "q1", children: ["jan", "label", "feb"] }],
    );

    expectValue(evaluateFormula("SUM(q1)", doc), 300);
  });

  it("SUM of an empty group is 0", () => {
    const doc = createDoc([], [{ id: "empty", children: [] }]);
    expectValue(evaluateFormula("SUM(empty)", doc), 0);
  });

  it("AVG of an empty group is DIV_ZERO", () => {
    const doc = createDoc([], [{ id: "empty", children: [] }]);
    expectError(evaluateFormula("AVG(empty)", doc), "DIV_ZERO");
  });

  it("MIN/MAX of an empty group is VALUE", () => {
    const doc = createDoc([], [{ id: "empty", children: [] }]);
    expectError(evaluateFormula("MIN(empty)", doc), "VALUE");
    expectError(evaluateFormula("MAX(empty)", doc), "VALUE");
  });

  it("counts a cell once when expanding a single group", () => {
    const doc = createDoc(
      [{ id: "jan", rawValue: 100, parentId: "q1" }],
      [{ id: "q1", children: ["jan", "jan"] }],
    );
    expectValue(evaluateFormula("SUM(q1)", doc), 100);
  });

  it("counts jan twice in SUM(q1, jan) because arguments are independent", () => {
    const doc = createDoc(
      [
        { id: "jan", rawValue: 100, parentId: "q1" },
        { id: "feb", rawValue: 200, parentId: "q1" },
      ],
      [{ id: "q1", children: ["jan", "feb"] }],
    );
    expectValue(evaluateFormula("SUM(q1, jan)", doc), 400);
  });
});
