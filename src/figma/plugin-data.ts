import { MAX_FRACTION_DIGITS, type CellFormat, type CellFormatKind, type CellValue } from "../core/types.ts";

/** pluginData key on TextNode. Stored as JSON. */
export const PLUGIN_DATA_KEY = "cell";

/** pluginData key for canvas id badges shown while the formula field is focused. */
export const BADGE_KEY = "badge";

/** pluginData key for non-selecting formula-member outlines. */
export const HINT_KEY = "hint";

export function isBadgeNode(node: { getPluginData(key: string): string }): boolean {
  return node.getPluginData(BADGE_KEY) !== "";
}

export function isHintNode(node: { getPluginData(key: string): string }): boolean {
  return node.getPluginData(HINT_KEY) !== "";
}

export function isOverlayNode(node: { getPluginData(key: string): string }): boolean {
  return isBadgeNode(node) || isHintNode(node);
}

/** Overlay layers are named `id:…`, `hint:…`, or `hint-id:…` before pluginData is readable. */
export function isOverlayName(name: string): boolean {
  return name.startsWith("id:") || name.startsWith("hint:") || name.startsWith("hint-id:");
}

export interface StoredCell {
  /** Stable formula identifier. Independent of the layer name. */
  cellId: string;
  formula?: string;
  rawValue?: CellValue;
  format?: CellFormat;
}

const FORMAT_KINDS: readonly CellFormatKind[] = [
  "number",
  "currency",
  "percent",
  "compact",
];

export function cellIdFromLayerName(name: string): string {
  let id = name.replace(/[^A-Za-z0-9_]/g, "");
  if (id.length === 0) {
    return "cell";
  }
  if (!/^[A-Za-z]/.test(id)) {
    id = `c${id}`;
  }
  return id;
}

export function isValidCellId(id: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(id);
}

const GENERIC_LAYER_IDS = new Set(["Text", "text", "Type", "cell", "Frame", "frame"]);

/** Names Figma auto-assigns from content or defaults — not stable ids. */
export function isGenericLayerId(id: string): boolean {
  return GENERIC_LAYER_IDS.has(id) || /^c\d+$/.test(id);
}

/**
 * Assign readable compact ids (`c1`, `c2`, …).
 * Stored ids always win. Optional suggested ids (manual layer names) are used
 * only when they are not generic / content-derived.
 */
export function assignStableCellIds(
  entries: readonly {
    nodeId: string;
    storedId?: string;
    suggestedId?: string;
  }[],
): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();

  for (const entry of entries) {
    if (entry.storedId && isValidCellId(entry.storedId) && !used.has(entry.storedId)) {
      result.set(entry.nodeId, entry.storedId);
      used.add(entry.storedId);
    }
  }

  for (const entry of entries) {
    if (result.has(entry.nodeId)) {
      continue;
    }
    const suggested = entry.suggestedId;
    if (
      suggested &&
      isValidCellId(suggested) &&
      !isGenericLayerId(suggested) &&
      !used.has(suggested)
    ) {
      result.set(entry.nodeId, suggested);
      used.add(suggested);
    }
  }

  let n = 1;
  for (const entry of entries) {
    if (result.has(entry.nodeId)) {
      continue;
    }
    while (used.has(`c${n}`)) {
      n += 1;
    }
    const id = `c${n}`;
    result.set(entry.nodeId, id);
    used.add(id);
    n += 1;
  }

  return result;
}

export function parseStoredCell(raw: string): StoredCell | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    const data = parsed as Partial<StoredCell>;
    if (typeof data.cellId !== "string" || data.cellId.length === 0) {
      return undefined;
    }
    const stored: StoredCell = { cellId: data.cellId };
    if (typeof data.formula === "string") {
      stored.formula = data.formula;
    }
    if (isCellValue(data.rawValue)) {
      stored.rawValue = data.rawValue;
    }
    if (isCellFormat(data.format)) {
      stored.format = clampFormatDigits(data.format);
    }
    return stored;
  } catch {
    return undefined;
  }
}

export function serializeStoredCell(data: StoredCell): string {
  return JSON.stringify(data);
}

/** Parse a plugin value field (unformatted literal typed by the user). */
export function parseLiteralInput(input: string): CellValue {
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

/**
 * Resolve formula / rawValue / format from pluginData.
 * Canvas characters are display-only: they are parsed only when a layer has
 * no stored formula and no stored rawValue.
 */
export function resolvedCellContent(
  stored: StoredCell | undefined,
  canvasCharacters: string,
): {
  formula?: string;
  rawValue?: CellValue;
  format?: CellFormat;
} {
  const fromCanvas = parseCharactersAsValue(canvasCharacters);
  if (!stored) {
    return { rawValue: fromCanvas };
  }
  return {
    formula: stored.formula,
    rawValue:
      stored.formula !== undefined
        ? undefined
        : stored.rawValue !== undefined
          ? stored.rawValue
          : fromCanvas,
    format: stored.format,
  };
}

/**
 * Best-effort parse of a text node's visible characters into a cell value.
 * Used for unregistered layers so formulas can reference them.
 */
export function parseCharactersAsValue(characters: string): CellValue {
  const trimmed = characters.trim();
  if (trimmed === "") {
    return null;
  }
  const hadPercent = trimmed.includes("%");
  const stripped = trimmed.replace(/[$%,\s]/g, "");
  if (stripped !== "" && /^-?\d+(\.\d+)?$/.test(stripped)) {
    const n = Number(stripped);
    if (Number.isFinite(n)) {
      return hadPercent ? n / 100 : n;
    }
  }
  return trimmed;
}

function isCellValue(value: unknown): value is CellValue {
  return (
    value === null ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  );
}

function clampFormatDigits(format: CellFormat): CellFormat {
  if (format.fractionDigits === undefined) {
    return format;
  }
  return {
    ...format,
    fractionDigits: Math.min(
      MAX_FRACTION_DIGITS,
      Math.max(0, format.fractionDigits),
    ),
  };
}

function isCellFormat(value: unknown): value is CellFormat {
  if (!value || typeof value !== "object") {
    return false;
  }
  const format = value as CellFormat;
  if (!FORMAT_KINDS.includes(format.kind)) {
    return false;
  }
  if (format.locale !== undefined && typeof format.locale !== "string") {
    return false;
  }
  if (format.currency !== undefined && typeof format.currency !== "string") {
    return false;
  }
  if (
    format.fractionDigits !== undefined &&
    (typeof format.fractionDigits !== "number" ||
      !Number.isInteger(format.fractionDigits))
  ) {
    return false;
  }
  return true;
}

export function normalizeFormula(source: string): string | undefined {
  const trimmed = source.trim().replace(/^=/, "").trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
