import { describe, expect, it } from "vitest";
import {
  assignStableCellIds,
  cellIdFromLayerName,
  isGenericLayerId,
  isHintNode,
  isOverlayNode,
  isValidCellId,
  normalizeFormula,
  parseCharactersAsValue,
  parseLiteralInput,
  parseStoredCell,
  serializeStoredCell,
} from "../src/figma/plugin-data.ts";

describe("Figma pluginData", () => {
  it("turns layer names into formula identifiers", () => {
    expect(cellIdFromLayerName("price")).toBe("price");
    expect(cellIdFromLayerName("Q1")).toBe("Q1");
    expect(cellIdFromLayerName("1total")).toBe("c1total");
    expect(cellIdFromLayerName("unit price")).toBe("unitprice");
  });

  it("round-trips stored formula and format metadata", () => {
    const stored = {
      cellId: "price",
      rawValue: 1234.56,
      format: { kind: "currency", currency: "USD", locale: "en-US" },
    } as const;
    expect(parseStoredCell(serializeStoredCell({ ...stored }))).toEqual(stored);
  });

  it("rejects empty or invalid pluginData", () => {
    expect(parseStoredCell("")).toBeUndefined();
    expect(parseStoredCell("{")).toBeUndefined();
    expect(parseStoredCell(JSON.stringify({ rawValue: 1 }))).toBeUndefined();
  });

  it("parses unformatted literals from the plugin UI", () => {
    expect(parseLiteralInput("")).toBeNull();
    expect(parseLiteralInput("1234.56")).toBe(1234.56);
    expect(parseLiteralInput("hello")).toBe("hello");
  });

  it("parses visible text, including currency and percent", () => {
    expect(parseCharactersAsValue("$1,234.56")).toBe(1234.56);
    expect(parseCharactersAsValue("20%")).toBe(0.2);
    expect(parseCharactersAsValue("January")).toBe("January");
  });

  it("strips an optional leading equals from formulas", () => {
    expect(normalizeFormula("= price * 2")).toBe("price * 2");
    expect(normalizeFormula("  ")).toBeUndefined();
  });

  it("assigns compact cN ids that do not follow layer content", () => {
    const ids = assignStableCellIds([
      { nodeId: "1" },
      { nodeId: "2", storedId: "price" },
      { nodeId: "3", suggestedId: "Text" },
      { nodeId: "4", suggestedId: "c100" },
      { nodeId: "5", suggestedId: "qty" },
    ]);
    expect(ids.get("1")).toBe("c1");
    expect(ids.get("2")).toBe("price");
    expect(ids.get("3")).toBe("c2");
    expect(ids.get("4")).toBe("c3");
    expect(ids.get("5")).toBe("qty");
    expect(isValidCellId("c1")).toBe(true);
    expect(isGenericLayerId("Text")).toBe(true);
    expect(isGenericLayerId("c100")).toBe(true);
  });

  it("treats hint overlays as overlay nodes", () => {
    const hint = { getPluginData: (key: string) => (key === "hint" ? "price" : "") };
    const cell = { getPluginData: () => "" };
    expect(isHintNode(hint)).toBe(true);
    expect(isOverlayNode(hint)).toBe(true);
    expect(isOverlayNode(cell)).toBe(false);
  });
});
