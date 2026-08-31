import type { BinaryExpr, CallExpr, Expr, NumberExpr, ReferenceExpr } from "./ast.ts";
import { parseError } from "./errors.ts";
import type { Token, TokenType } from "./tokenizer.ts";
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
  const parser = new Parser(_tokens);
  return parser.parse();
}

/** Convenience: tokenize then parse. */
export function parseFormula(source: string): Expr {
  return parse(tokenize(source));
}

class Parser {
  private tokens;
  private index;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.index = 0;
  }

  getToken() {
    return this.tokens[this.index];
  }

  getPreviousToken() {
    return this.tokens[this.index - 1];
  }

  isAtEnd() {
    return this.index >= this.tokens.length || this.tokens[this.index]?.type == "EOF" satisfies TokenType;
  }

  match(tokenType: string) {
    if (this.getToken()?.type == tokenType) {
      this.advance();
      return true;
    } else {
      return false;
    }
  }

  advance() {
    this.index++;
  }

  parse() {
    return this.parseExpression();
  }

  parseExpression() {
    return this.parseTerm();
  }

  parseTerm() {
    let left = this.parseFactor();

    while (!this.isAtEnd() && (this.match("PLUS") || this.match("MINUS"))) {
      const op = this.getPreviousToken()?.type === "PLUS" ? '+' : '-';
      left = {
        kind: "binary",
        op,
        left,
        right: this.parseFactor(),
      } satisfies BinaryExpr;
    }

    return left;
  }

  parseFactor() {
    let left = this.parsePrimary();

    while (!this.isAtEnd() && (this.match("STAR") || this.match("SLASH"))) {
      const op = this.getPreviousToken()?.type === "STAR" ? '*' : '/';
      left = {
        kind: "binary",
        op,
        left,
        right: this.parsePrimary(),
      } satisfies BinaryExpr;
    }

    return left;
  }

  parsePrimary(): Expr {
    if (this.match("NUMBER")) {
      return {
        kind: "number",
        value: this.getPreviousToken()!.literal as number,
      } satisfies NumberExpr
    } else if (this.match("LPAREN")) {
      const expr = this.parseExpression();
      if (!this.match("RPAREN")) {
        throw parseError("Expected ')' after expression.");
      }
      return expr;
    } else {
      return this.parseIdentifier();
    }
  }

  parseIdentifier(): Expr {
    if (this.match("IDENTIFIER")) {
      const name = this.getPreviousToken()?.lexeme ?? "";
      if (this.match("LPAREN")) {
        if (!isSupportedFn(name)) {
          throw parseError("Unsupported function: " + name);
        }
        let args: Expr[] = [];
        if (!this.match("RPAREN")) {
          do {
            args.push(this.parseExpression() as Expr);
          } while (this.match("COMMA"))

          if (!this.match("RPAREN")) {
            throw parseError("Expected ')' after expression.")
          }
        }
        return {
          kind: "call",
          name,
          args,
        } satisfies CallExpr
      } else {
        return {
          kind: "ref",
          id: name,
        } satisfies ReferenceExpr
      }
    }
    throw parseError("Unexpected token")
  }
}


function isSupportedFn(name: string) {
  return name === "sum" || name === "avg";
}