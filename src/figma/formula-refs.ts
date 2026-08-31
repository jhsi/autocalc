import { tokenize } from "../core/tokenizer.ts";
import { normalizeFormula } from "./plugin-data.ts";

const FUNCTION_NAMES = new Set(["SUM", "AVG", "MIN", "MAX"]);

export type FormulaPart =
  | { kind: "ref"; value: string }
  | { kind: "text"; value: string };

/** Cell ids referenced by a formula (function names are skipped). */
export function formulaCellIds(source: string): string[] {
  return formulaVisualParts(source)
    .filter((part) => part.kind === "ref")
    .map((part) => part.value)
    .filter((id, index, all) => all.indexOf(id) === index);
}

export function formulaVisualParts(source: string): FormulaPart[] {
  const formula = source.trim().replace(/^=/, "").trim();
  if (!formula) {
    return [];
  }
  try {
    const tokens = tokenize(formula);
    const parts: FormulaPart[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || token.type === "EOF" || !token.lexeme) {
        continue;
      }
      if (
        token.type === "IDENTIFIER" &&
        tokens[i + 1]?.type !== "LPAREN" &&
        !FUNCTION_NAMES.has(token.lexeme)
      ) {
        parts.push({ kind: "ref", value: token.lexeme });
        continue;
      }
      parts.push({ kind: "text", value: token.lexeme });
    }
    return parts;
  } catch {
    return formula ? [{ kind: "text", value: formula }] : [];
  }
}

export function joinFormulaParts(parts: FormulaPart[]): string {
  return parts
    .map((part) => part.value)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Insert a cell id into formula text. Always returns a leading `=` (formula mode). */
export function appendCellRef(formula: string, cellId: string): string {
  const current = normalizeFormula(formula) ?? "";
  if (current === "") {
    return `= ${cellId}`;
  }
  if (/[+\-*/,]$/.test(current) || current.endsWith("(")) {
    return `= ${current} ${cellId}`;
  }
  return `= ${current} + ${cellId}`;
}
