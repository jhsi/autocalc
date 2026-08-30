import { notImplemented } from "./errors.ts";

/**
 * Turns formula source text into a flat token list.
 * Skip whitespace. Always end with an EOF token.
 *
 * Identifiers are cell/group ids or function names (e.g. a, q1, SUM).
 * There is no A1:B7 range syntax.
 *
 * On unexpected characters, throw parseError(...) so callers can surface PARSE.
 */
export type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENTIFIER"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface Token {
  type: TokenType;
  /** Raw slice of the source. */
  lexeme: string;
  /** Parsed value for NUMBER and STRING; null otherwise. */
  literal: number | string | null;
  /** Start index in the source string. */
  start: number;
}

export function tokenize(_source: string): Token[] {
  notImplemented("tokenize", "src/core/tokenizer.ts");
}
