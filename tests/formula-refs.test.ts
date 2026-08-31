import { describe, expect, it } from "vitest";
import {
  appendCellRef,
  formulaCellIds,
  formulaVisualParts,
  insertRefIntoParts,
  insertTextIntoParts,
  removeCellRefAt,
} from "../src/figma/formula-refs.ts";

describe("formula references", () => {
  it("collects cell ids and skips function names", () => {
    expect(formulaCellIds("c200 + c240")).toEqual(["c200", "c240"]);
    expect(formulaCellIds("SUM(price, qty)")).toEqual(["price", "qty"]);
    expect(formulaCellIds("= price * 2")).toEqual(["price"]);
  });

  it("renders cell ids as visual parts separate from operators", () => {
    expect(formulaVisualParts("c200 + c240")).toEqual([
      { kind: "ref", value: "c200" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c240" },
    ]);
  });

  it("appends a cell id with + unless an operator is already open", () => {
    expect(appendCellRef("", "c200")).toBe("= c200");
    expect(appendCellRef("c200", "c240")).toBe("= c200 + c240");
    expect(appendCellRef("= c200 +", "c240")).toBe("= c200 + c240");
    expect(appendCellRef("= c200 + c240", "c240")).toBe("= c200 + c240 + c240");
  });

  it("removes the operator that would otherwise be left dangling", () => {
    const parts = formulaVisualParts("c1 + c2 + c3");
    expect(removeCellRefAt(parts, 0)).toEqual([
      { kind: "ref", value: "c2" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c3" },
    ]);
    expect(removeCellRefAt(parts, 2)).toEqual([
      { kind: "ref", value: "c1" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c3" },
    ]);
    expect(removeCellRefAt(parts, 4)).toEqual([
      { kind: "ref", value: "c1" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c2" },
      { kind: "text", value: "+" },
    ]);
  });

  it("inserts a ref at the caret and adds + between neighboring values", () => {
    const parts = formulaVisualParts("c1 + c2");
    expect(insertRefIntoParts(parts, 0, "c9").parts).toEqual([
      { kind: "ref", value: "c9" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c1" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c2" },
    ]);
    expect(insertRefIntoParts(parts, 1, "c9").parts).toEqual([
      { kind: "ref", value: "c1" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c9" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c2" },
    ]);
    expect(insertRefIntoParts(parts, 2, "c9").parts).toEqual([
      { kind: "ref", value: "c1" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c9" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c2" },
    ]);
    expect(insertRefIntoParts(parts, 3, "c9").parts).toEqual([
      { kind: "ref", value: "c1" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c2" },
      { kind: "text", value: "+" },
      { kind: "ref", value: "c9" },
    ]);
  });

  it("inserts grouping and replaces an adjacent operator", () => {
    const parts = formulaVisualParts("c1 + c2");
    expect(insertTextIntoParts(parts, 0, "(").parts.map((p) => p.value)).toEqual([
      "(",
      "c1",
      "+",
      "c2",
    ]);
    expect(insertTextIntoParts(parts, 3, ")").parts.map((p) => p.value)).toEqual([
      "c1",
      "+",
      "c2",
      ")",
    ]);
    expect(insertTextIntoParts(parts, 1, "*").parts.map((p) => p.value)).toEqual([
      "c1",
      "*",
      "c2",
    ]);
  });
});
