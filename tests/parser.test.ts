import { describe, expect, it } from "vitest";
import { parse, parseFormula } from "../src/core/parser.ts";
import {
  commaTok,
  identTok,
  lparenTok,
  minusTok,
  numberTok,
  plusTok,
  rparenTok,
  slashTok,
  starTok,
  tokens,
} from "./helpers.ts";

describe("Milestone 1 — parser (literals and arithmetic)", () => {
  it("parses a number", () => {
    expect(parse(tokens(numberTok(1)))).toEqual({ kind: "number", value: 1 });
  });

  it("parses 1 + 2", () => {
    expect(parse(tokens(numberTok(1), plusTok(), numberTok(2)))).toEqual({
      kind: "binary",
      op: "+",
      left: { kind: "number", value: 1 },
      right: { kind: "number", value: 2 },
    });
  });

  it("parses 5 - 2, 3 * 4, and 8 / 2", () => {
    expect(parse(tokens(numberTok(5), minusTok(), numberTok(2)))).toEqual({
      kind: "binary",
      op: "-",
      left: { kind: "number", value: 5 },
      right: { kind: "number", value: 2 },
    });
    expect(parse(tokens(numberTok(3), starTok(), numberTok(4)))).toEqual({
      kind: "binary",
      op: "*",
      left: { kind: "number", value: 3 },
      right: { kind: "number", value: 4 },
    });
    expect(parse(tokens(numberTok(8), slashTok(), numberTok(2)))).toEqual({
      kind: "binary",
      op: "/",
      left: { kind: "number", value: 8 },
      right: { kind: "number", value: 2 },
    });
  });

  it("gives * higher precedence than + so 1 + 2 * 3 is 1 + (2 * 3)", () => {
    expect(
      parse(tokens(numberTok(1), plusTok(), numberTok(2), starTok(), numberTok(3))),
    ).toEqual({
      kind: "binary",
      op: "+",
      left: { kind: "number", value: 1 },
      right: {
        kind: "binary",
        op: "*",
        left: { kind: "number", value: 2 },
        right: { kind: "number", value: 3 },
      },
    });
  });

  it("lets parentheses override precedence so (1 + 2) * 3 groups addition first", () => {
    expect(
      parse(
        tokens(
          lparenTok(),
          numberTok(1),
          plusTok(),
          numberTok(2),
          rparenTok(),
          starTok(),
          numberTok(3),
        ),
      ),
    ).toEqual({
      kind: "binary",
      op: "*",
      left: {
        kind: "binary",
        op: "+",
        left: { kind: "number", value: 1 },
        right: { kind: "number", value: 2 },
      },
      right: { kind: "number", value: 3 },
    });
  });

  it("is left-associative for 8 / 2 / 2 → (8 / 2) / 2", () => {
    expect(
      parse(tokens(numberTok(8), slashTok(), numberTok(2), slashTok(), numberTok(2))),
    ).toEqual({
      kind: "binary",
      op: "/",
      left: {
        kind: "binary",
        op: "/",
        left: { kind: "number", value: 8 },
        right: { kind: "number", value: 2 },
      },
      right: { kind: "number", value: 2 },
    });
  });
});

// Remove `.skip` after Milestone 1 (literals and arithmetic) is green.
describe.skip("Milestone 2 — parser (cell references)", () => {
  it("parses a bare identifier as a reference to that id", () => {
    expect(parse(tokens(identTok("a")))).toEqual({ kind: "ref", id: "a" });
  });

  it("parses a + b", () => {
    expect(parse(tokens(identTok("a"), plusTok(), identTok("b")))).toEqual({
      kind: "binary",
      op: "+",
      left: { kind: "ref", id: "a" },
      right: { kind: "ref", id: "b" },
    });
  });

  it("parses a * 2", () => {
    expect(parse(tokens(identTok("a"), starTok(), numberTok(2)))).toEqual({
      kind: "binary",
      op: "*",
      left: { kind: "ref", id: "a" },
      right: { kind: "number", value: 2 },
    });
  });
});

// Remove `.skip` after Milestone 2 (cell references) is green.
describe.skip("Milestone 3 — parser (function calls)", () => {
  it("parses SUM(a, b, c)", () => {
    expect(
      parse(
        tokens(
          identTok("SUM"),
          lparenTok(),
          identTok("a"),
          commaTok(),
          identTok("b"),
          commaTok(),
          identTok("c"),
          rparenTok(),
        ),
      ),
    ).toEqual({
      kind: "call",
      name: "SUM",
      args: [
        { kind: "ref", id: "a" },
        { kind: "ref", id: "b" },
        { kind: "ref", id: "c" },
      ],
    });
  });

  it("parses nested call arguments: SUM(a, b + c)", () => {
    expect(
      parse(
        tokens(
          identTok("SUM"),
          lparenTok(),
          identTok("a"),
          commaTok(),
          identTok("b"),
          plusTok(),
          identTok("c"),
          rparenTok(),
        ),
      ),
    ).toEqual({
      kind: "call",
      name: "SUM",
      args: [
        { kind: "ref", id: "a" },
        {
          kind: "binary",
          op: "+",
          left: { kind: "ref", id: "b" },
          right: { kind: "ref", id: "c" },
        },
      ],
    });
  });

  it("parseFormula wires tokenize + parse for SUM(a, b) * 2", () => {
    expect(parseFormula("SUM(a, b) * 2")).toEqual({
      kind: "binary",
      op: "*",
      left: {
        kind: "call",
        name: "SUM",
        args: [
          { kind: "ref", id: "a" },
          { kind: "ref", id: "b" },
        ],
      },
      right: { kind: "number", value: 2 },
    });
  });
});
