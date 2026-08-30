import { describe, expect, it } from "vitest";
import { tokenize } from "../src/core/tokenizer.ts";

describe("Milestone 1 — tokenizer", () => {
  it("tokenizes a single integer", () => {
    expect(tokenize("1")).toMatchObject([
      { type: "NUMBER", lexeme: "1", literal: 1 },
      { type: "EOF" },
    ]);
  });

  it("tokenizes addition", () => {
    expect(tokenize("1 + 2")).toMatchObject([
      { type: "NUMBER", lexeme: "1", literal: 1 },
      { type: "PLUS", lexeme: "+" },
      { type: "NUMBER", lexeme: "2", literal: 2 },
      { type: "EOF" },
    ]);
  });

  it("tokenizes subtraction, multiplication, and division", () => {
    expect(tokenize("5 - 2")).toMatchObject([
      { type: "NUMBER", literal: 5 },
      { type: "MINUS", lexeme: "-" },
      { type: "NUMBER", literal: 2 },
      { type: "EOF" },
    ]);
    expect(tokenize("3 * 4")).toMatchObject([
      { type: "NUMBER", literal: 3 },
      { type: "STAR", lexeme: "*" },
      { type: "NUMBER", literal: 4 },
      { type: "EOF" },
    ]);
    expect(tokenize("8 / 2")).toMatchObject([
      { type: "NUMBER", literal: 8 },
      { type: "SLASH", lexeme: "/" },
      { type: "NUMBER", literal: 2 },
      { type: "EOF" },
    ]);
  });

  it("tokenizes parentheses", () => {
    expect(tokenize("(1 + 2) * 3")).toMatchObject([
      { type: "LPAREN", lexeme: "(" },
      { type: "NUMBER", literal: 1 },
      { type: "PLUS" },
      { type: "NUMBER", literal: 2 },
      { type: "RPAREN", lexeme: ")" },
      { type: "STAR" },
      { type: "NUMBER", literal: 3 },
      { type: "EOF" },
    ]);
  });

  it("skips extra whitespace", () => {
    expect(tokenize("  1   +    2  ")).toMatchObject([
      { type: "NUMBER", literal: 1 },
      { type: "PLUS" },
      { type: "NUMBER", literal: 2 },
      { type: "EOF" },
    ]);
  });

  it("tokenizes a decimal number", () => {
    expect(tokenize("1.5")).toMatchObject([
      { type: "NUMBER", lexeme: "1.5", literal: 1.5 },
      { type: "EOF" },
    ]);
  });

  it("tokenizes identifiers used as cell ids", () => {
    expect(tokenize("a + b")).toMatchObject([
      { type: "IDENTIFIER", lexeme: "a" },
      { type: "PLUS" },
      { type: "IDENTIFIER", lexeme: "b" },
      { type: "EOF" },
    ]);
    expect(tokenize("q1")).toMatchObject([
      { type: "IDENTIFIER", lexeme: "q1" },
      { type: "EOF" },
    ]);
  });

  it("tokenizes a function call shape", () => {
    expect(tokenize("SUM(a, b)")).toMatchObject([
      { type: "IDENTIFIER", lexeme: "SUM" },
      { type: "LPAREN" },
      { type: "IDENTIFIER", lexeme: "a" },
      { type: "COMMA", lexeme: "," },
      { type: "IDENTIFIER", lexeme: "b" },
      { type: "RPAREN" },
      { type: "EOF" },
    ]);
  });
});
