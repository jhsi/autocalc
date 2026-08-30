import type { CellId } from "./types.ts";

/**
 * Tiny formula AST. This is not a general-purpose language.
 * Parentheses are not a node: they only change how the parser builds BinaryExpr.
 */
export type Expr =
  | NumberExpr
  | StringExpr
  | ReferenceExpr
  | BinaryExpr
  | CallExpr;

export interface NumberExpr {
  kind: "number";
  value: number;
}

export interface StringExpr {
  kind: "string";
  value: string;
}

/** A stable cell or group id. The tokenizer/parser treat identifiers as ids. */
export interface ReferenceExpr {
  kind: "ref";
  id: CellId;
}

export type BinaryOp = "+" | "-" | "*" | "/";

export interface BinaryExpr {
  kind: "binary";
  op: BinaryOp;
  left: Expr;
  right: Expr;
}

/**
 * Built-in call. `name` is the identifier lexeme as written (tests use uppercase).
 */
export interface CallExpr {
  kind: "call";
  name: string;
  args: Expr[];
}
