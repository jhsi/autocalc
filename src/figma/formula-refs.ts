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

export function joinFormulaParts(parts: readonly FormulaPart[]): string {
  return parts
    .map((part) => part.value)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const BINARY_OPS = new Set(["+", "-", "*", "/", ","]);

export function isBinaryOpPart(part: FormulaPart | undefined): boolean {
  return Boolean(part && part.kind === "text" && BINARY_OPS.has(part.value));
}

function isValuePart(part: FormulaPart | undefined): boolean {
  if (!part) {
    return false;
  }
  if (part.kind === "ref") {
    return true;
  }
  return part.value === ")" || /^\d/.test(part.value);
}

/**
 * Remove a cell pill. First pill also drops the following operator;
 * any other non-last pill also drops the preceding operator. The last
 * pill is removed on its own so a trailing operator can stay for the next ref.
 */
export function removeCellRefAt(
  parts: readonly FormulaPart[],
  index: number,
): FormulaPart[] {
  const next = [...parts];
  if (index < 0 || index >= next.length || next[index]?.kind !== "ref") {
    return next;
  }
  const refIndexes = next
    .map((part, i) => (part.kind === "ref" ? i : -1))
    .filter((i) => i >= 0);
  const pos = refIndexes.indexOf(index);
  const isFirst = pos === 0;
  const isLast = pos === refIndexes.length - 1;

  if (isFirst && !isLast && isBinaryOpPart(next[index + 1])) {
    next.splice(index, 2);
    return next;
  }
  if (!isLast && isBinaryOpPart(next[index - 1])) {
    next.splice(index - 1, 2);
    return next;
  }
  if (!isLast && isBinaryOpPart(next[index + 1])) {
    next.splice(index, 2);
    return next;
  }
  next.splice(index, 1);
  return next;
}

/** Insert a cell id at a caret index in the token list. Adds `+` between neighboring values. */
export function insertRefIntoParts(
  parts: readonly FormulaPart[],
  index: number,
  cellId: string,
): { parts: FormulaPart[]; caret: number } {
  const clamped = Math.max(0, Math.min(index, parts.length));
  const before = parts.slice(0, clamped);
  const after = parts.slice(clamped);
  const prev = before[before.length - 1];
  const nextTok = after[0];
  const out: FormulaPart[] = [...before];
  if (isValuePart(prev)) {
    out.push({ kind: "text", value: "+" });
  }
  out.push({ kind: "ref", value: cellId });
  const caret = out.length;
  if (isValuePart(nextTok) || nextTok?.value === "(") {
    out.push({ kind: "text", value: "+" });
  }
  out.push(...after);
  return { parts: out, caret };
}

/** Insert an operator or grouping token. A binary op next to another binary op replaces it. */
export function insertTextIntoParts(
  parts: readonly FormulaPart[],
  index: number,
  text: string,
): { parts: FormulaPart[]; caret: number } {
  const next = [...parts];
  const clamped = Math.max(0, Math.min(index, next.length));
  if (BINARY_OPS.has(text) && text !== ",") {
    if (isBinaryOpPart(next[clamped])) {
      next[clamped] = { kind: "text", value: text };
      return { parts: next, caret: clamped + 1 };
    }
    if (clamped > 0 && isBinaryOpPart(next[clamped - 1])) {
      next[clamped - 1] = { kind: "text", value: text };
      return { parts: next, caret: clamped };
    }
  }
  next.splice(clamped, 0, { kind: "text", value: text });
  return { parts: next, caret: clamped + 1 };
}

function formulaFromParts(parts: readonly FormulaPart[]): string {
  const body = joinFormulaParts(parts);
  return body ? `= ${body}` : "=";
}

/** Insert a cell id into formula text. Always returns a leading `=` (formula mode). */
export function appendCellRef(formula: string, cellId: string): string {
  const current = normalizeFormula(formula) ?? "";
  if (current === "") {
    return `= ${cellId}`;
  }
  const existing = formulaVisualParts(formula);
  const { parts } = insertRefIntoParts(existing, existing.length, cellId);
  return formulaFromParts(parts);
}
