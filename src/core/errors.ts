import type { CellId } from "./types.ts";

/**
 * Structured computation failures.
 * The engine should return these as values (spreadsheet-style), not as thrown
 * exceptions, except for NotImplementedError during scaffolding.
 *
 * Display strings like ❌ REF! belong to a UI layer. Use errorLabel() only when
 * you need a default human-readable code.
 */
export type ComputeErrorKind =
  | "REF"
  | "VALUE"
  | "DIV_ZERO"
  | "CYCLE"
  | "PARSE"
  | "NAME";

export class ComputeError {
  readonly kind: ComputeErrorKind;
  readonly message: string;
  readonly cellId?: CellId;
  readonly cells?: readonly CellId[];

  constructor(
    kind: ComputeErrorKind,
    message: string,
    options?: { cellId?: CellId; cells?: readonly CellId[] },
  ) {
    this.kind = kind;
    this.message = message;
    this.cellId = options?.cellId;
    this.cells = options?.cells;
  }
}

export function isComputeError(value: unknown): value is ComputeError {
  return value instanceof ComputeError;
}

export function refError(id: CellId): ComputeError {
  return new ComputeError("REF", `Unknown reference '${id}'`, { cellId: id });
}

export function valueError(message: string): ComputeError {
  return new ComputeError("VALUE", message);
}

export function divZeroError(): ComputeError {
  return new ComputeError("DIV_ZERO", "Division by zero");
}

export function cycleError(cells: readonly CellId[]): ComputeError {
  return new ComputeError("CYCLE", `Circular reference: ${cells.join(" → ")}`, {
    cells,
  });
}

export function parseError(message: string): ComputeError {
  return new ComputeError("PARSE", message);
}

export function nameError(fnName: string): ComputeError {
  return new ComputeError("NAME", `Unknown function '${fnName}'`);
}

/** Default UI labels. The engine itself should not branch on these strings. */
export function errorLabel(error: ComputeError): string {
  switch (error.kind) {
    case "REF":
      return "❌ REF!";
    case "VALUE":
      return "❌ VALUE!";
    case "DIV_ZERO":
      return "❌ DIV/0!";
    case "CYCLE":
      return "❌ CYCLE!";
    case "PARSE":
      return "❌ ERROR!";
    case "NAME":
      return "❌ NAME!";
  }
}

/**
 * Thrown only by TODO stubs. Replace each stub with a real implementation;
 * do not catch this in engine logic.
 */
export class NotImplementedError extends Error {
  constructor(fnName: string, file: string) {
    super(`TODO: implement ${fnName}() in ${file}`);
    this.name = "NotImplementedError";
  }
}

export function notImplemented(fnName: string, file: string): never {
  throw new NotImplementedError(fnName, file);
}
