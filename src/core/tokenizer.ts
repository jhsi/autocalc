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
  lexeme?: string;
  /** Parsed value for NUMBER and STRING; null otherwise. */
  literal?: number | string | null;
}

export function tokenize(_source: string): Token[] {
  const tokenizer = new Tokenizer(_source);
  tokenizer.tokenize();
  return tokenizer.getTokens();
}

const CH_NULL = "\0";

class Tokenizer {
  private index;
  private source;
  private tokens: Token[];

  constructor(source: string) {
    this.index = 0;
    this.source = source;
    this.tokens = [];
  }

  advance() {
    this.index++;
  }

  peek() {
    return this.source[this.index] ?? CH_NULL;
  }

  isAtEnd() {
    return this.index > this.source.length - 1;
  }

  getTokens() {
    return this.tokens;
  }

  addToken(t: Token) {
    this.tokens.push(t);
  }

  createToken({ type, lexeme, literal = null }: Token) {
    return { type, lexeme, literal };
  }

  tokenize() {
    while (!this.isAtEnd()) {
      const i = this.index;
      const ch = this.source[i] ?? CH_NULL;
      switch (ch) {
        case " ":
          this.advance();
          continue;
        case "*":
        case "/":
        case "+":
        case "-":
        case "(":
        case ")":
        case ",":
          const type = getTokenType(ch);
          if (type === null) {
            throw new Error("Mismatched token type");
          }
          this.addToken({
            type,
            lexeme: ch,
            literal: null,
          });
          this.advance();
          continue;
      }

      if (isNumeric(ch)) {
        this.tokenizeNumber();
        continue;
      } else if (isAlpha(ch)) {
        this.tokenizeIdentifier();
        continue;
      } else {
        // TODO: handling "STRING"
        this.advance();
      }
    }

    this.addToken({
      type: "EOF",
    });
  }

  tokenizeNumber() {
    let rawValue = "";
    while (!this.isAtEnd() && !isOperator(this.peek()) && !isAlpha(this.peek()) && this.peek() != " ") {
      rawValue += this.peek();
      this.advance();
    }

    const numValue = parseFloat(rawValue);
    // TODO: could be NaN

    this.addToken({
      type: "NUMBER",
      lexeme: rawValue,
      literal: numValue,
    });
  }

  tokenizeIdentifier() {
    let rawValue = "";
    while (!this.isAtEnd() && !isOperator(this.peek()) && this.peek() != " ") {
      rawValue += this.peek();
      this.advance();
    }

    this.addToken({
      type: "IDENTIFIER",
      lexeme: rawValue,
    });
  }
}

function isNumeric(ch: string) {
  return /[0-9]/.test(ch);
}

function isAlpha(ch: string) {
  return /^[A-Za-z]+$/.test(ch);
}

function isOperator(ch: string) {
  return getTokenType(ch) != null
}

function getTokenType(ch: string) {
  switch (ch) {
    case "*":
      return "STAR";
    case "/":
      return "SLASH";
    case "+":
      return "PLUS";
    case "-":
      return "MINUS";
    case "(":
      return "LPAREN";
    case ")":
      return "RPAREN";
    case ",":
      return "COMMA";
    case " ":
      return null;
  }
  return null;
}
