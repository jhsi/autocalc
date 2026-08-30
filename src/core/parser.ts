import type { Expr } from "./ast.ts";
import { notImplemented } from "./errors.ts";
import type { Token } from "./tokenizer.ts";
import { tokenize } from "./tokenizer.ts";

/**
 * Recursive-descent parser.
 *
 * Grammar (implement this; do not add extra language features):
 *
 *   formula     → expression EOF
 *   expression  → term
 *   term        → factor ( ( "+" | "-" ) factor )*
 *   factor      → primary ( ( "*" | "/" ) primary )*
 *   primary     → NUMBER
 *               | STRING
 *               | IDENTIFIER ( "(" arguments ")" )?
 *               | "(" expression ")"
 *   arguments   → expression ( "," expression )*
 *
 * IDENTIFIER with no "(" is a ReferenceExpr (cell or group id).
 * IDENTIFIER "(" ... ")" is a CallExpr.
 * Parentheses do not produce an AST node; they only group.
 *
 * Precedence: * / bind tighter than + -. Left-associative within a level.
 *
 * On syntax errors, throw parseError(...) so evaluateFormula can return a
 * PARSE result instead of crashing.
 */
export function parse(_tokens: Token[]): Expr {
  notImplemented("parse", "src/core/parser.ts");
}

/** Convenience: tokenize then parse. */
export function parseFormula(source: string): Expr {
  return parse(tokenize(source));
}
