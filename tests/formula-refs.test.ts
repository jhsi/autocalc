import { describe, expect, it } from "vitest";
import { appendCellRef, formulaCellIds, formulaVisualParts } from "../src/figma/formula-refs.ts";

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
    expect(appendCellRef("= c200 + c240", "c240")).toBe("= c200 + c240");
  });
});
