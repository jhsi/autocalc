import { expect } from "vitest";
import { MemoryDocumentAdapter } from "../src/adapters/memory-document-adapter.ts";
import { isComputeError } from "../src/core/errors.ts";
import type { ComputeErrorKind } from "../src/core/errors.ts";
import type { Token, TokenType } from "../src/core/tokenizer.ts";
import type { CellFormat, CellResult, CellValue } from "../src/core/types.ts";

/** Build a token list for parser tests without going through tokenize(). */
export function tok(
  type: TokenType,
  lexeme: string,
  literal: number | string | null = null,
): Token {
  return { type, lexeme, literal, start: 0 };
}

export const numberTok = (n: number, lexeme = String(n)): Token =>
  tok("NUMBER", lexeme, n);

export const identTok = (id: string): Token => tok("IDENTIFIER", id);

export const plusTok = (): Token => tok("PLUS", "+");
export const minusTok = (): Token => tok("MINUS", "-");
export const starTok = (): Token => tok("STAR", "*");
export const slashTok = (): Token => tok("SLASH", "/");
export const lparenTok = (): Token => tok("LPAREN", "(");
export const rparenTok = (): Token => tok("RPAREN", ")");
export const commaTok = (): Token => tok("COMMA", ",");
export const eofTok = (): Token => tok("EOF", "");

export function tokens(...parts: Token[]): Token[] {
  return [...parts, eofTok()];
}

export function createDoc(
  cells: Array<{
    id: string;
    name?: string;
    rawValue?: CellValue;
    formula?: string;
    parentId?: string;
    format?: CellFormat;
  }>,
  groups: Array<{ id: string; name?: string; children: string[] }> = [],
): MemoryDocumentAdapter {
  const doc = new MemoryDocumentAdapter();
  for (const group of groups) {
    doc.addGroup({
      id: group.id,
      name: group.name ?? group.id,
      children: [...group.children],
    });
  }
  for (const cell of cells) {
    doc.addCell({
      id: cell.id,
      name: cell.name ?? cell.id,
      rawValue: cell.rawValue,
      formula: cell.formula,
      parentId: cell.parentId,
      format: cell.format,
    });
  }
  return doc;
}

export function expectValue(result: CellResult, expected: CellValue): void {
  if (isComputeError(result)) {
    throw new Error(
      `expected value ${JSON.stringify(expected)}, got ${result.kind} error: ${result.message}`,
    );
  }
  expect(result).toBe(expected);
}

export function expectError(
  result: CellResult,
  kind: ComputeErrorKind,
): void {
  if (!isComputeError(result)) {
    throw new Error(
      `expected ${kind} error, got value ${JSON.stringify(result)}`,
    );
  }
  expect(result.kind, result.message).toBe(kind);
}
