import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatValue } from "../src/core/formatter.ts";
import { ComputationEngine } from "../src/core/engine.ts";
import { createDoc, expectValue } from "./helpers.ts";

// Remove `.skip` after Milestone 8 (circular references) is green.
describe("Milestone 9 — formatting", () => {
  it("formats a plain number with grouping separators", () => {
    expect(formatValue(1234.56, { kind: "number", locale: "en-US" })).toBe(
      "1,234.56",
    );
  });

  it("formats currency, rounding to the requested fraction digits", () => {
    expect(
      formatValue(1234.56, {
        kind: "currency",
        locale: "en-US",
        currency: "USD",
        fractionDigits: 0,
      }),
    ).toBe("$1,235");
  });

  it("formats a ratio as a percentage (value 1.235 → 123.5%)", () => {
    expect(
      formatValue(1.235, {
        kind: "percent",
        locale: "en-US",
        fractionDigits: 1,
      }),
    ).toBe("123.5%");
  });

  it("formats a compact number (1234 → 1.23K)", () => {
    expect(
      formatValue(1234, {
        kind: "compact",
        locale: "en-US",
        fractionDigits: 2,
      }),
    ).toBe("1.23K");
  });

  it("leaves evaluation numeric; formatting is applied afterwards", () => {
    const doc = createDoc([
      { id: "price", rawValue: 1234.56, format: { kind: "currency", currency: "USD" } },
    ]);
    const engine = new ComputationEngine(doc);
    expectValue(engine.getValue("price"), 1234.56);
    expect(engine.getFormattedValue("price")).toBe("$1,234.56");
  });

  it("does not live in the formula language — format is cell metadata", () => {
    const doc = createDoc([
      { id: "n", rawValue: 0.2, format: { kind: "percent", fractionDigits: 0 } },
      { id: "doubled", formula: "n * 2" },
    ]);
    const engine = new ComputationEngine(doc);
    expectValue(engine.getValue("doubled"), 0.4);
    expect(engine.getFormattedValue("n")).toBe("20%");
  });
});

describe("formatting without Intl (Figma plugin sandbox)", () => {
  let IntlSaved: typeof globalThis.Intl;

  beforeEach(() => {
    IntlSaved = globalThis.Intl;
    Object.defineProperty(globalThis, "Intl", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "Intl", {
      value: IntlSaved,
      configurable: true,
      writable: true,
    });
  });

  it("formats a plain number with grouping separators", () => {
    expect(formatValue(1234.56, { kind: "number", locale: "en-US" })).toBe(
      "1,234.56",
    );
  });

  it("formats currency, rounding to the requested fraction digits", () => {
    expect(
      formatValue(1234.56, {
        kind: "currency",
        locale: "en-US",
        currency: "USD",
        fractionDigits: 0,
      }),
    ).toBe("$1,235");
  });

  it("formats a ratio as a percentage (value 1.235 → 123.5%)", () => {
    expect(
      formatValue(1.235, {
        kind: "percent",
        locale: "en-US",
        fractionDigits: 1,
      }),
    ).toBe("123.5%");
  });

  it("formats a compact number (1234 → 1.23K)", () => {
    expect(
      formatValue(1234, {
        kind: "compact",
        locale: "en-US",
        fractionDigits: 2,
      }),
    ).toBe("1.23K");
  });

  it("defaults missing format kind to number", () => {
    expect(formatValue(1234.56)).toBe("1,234.56");
  });
});
