/// <reference types="@figma/plugin-typings" />

declare const __html__: string;

import { ComputationEngine } from "../core/engine.ts";
import { ComputeError, errorLabel, isComputeError, type ComputeErrorKind } from "../core/errors.ts";
import { evaluateFormula } from "../core/evaluator.ts";
import { formatValue } from "../core/formatter.ts";
import type { CellFormat } from "../core/types.ts";
import { FigmaDocumentAdapter } from "./adapter.ts";
import { cellIdFromBadge, hideIdBadges, showIdBadges } from "./badges.ts";
import { formulaCellIds } from "./formula-refs.ts";
import { enclosingComponentOrFrame, hideFormulaHints, showFormulaHints } from "./highlight.ts";
import { nearestText } from "./nearest-text.ts";
import {
  isOverlayName,
  isOverlayNode,
  isValidCellId,
  normalizeFormula,
  parseCharactersAsValue,
  parseLiteralInput,
} from "./plugin-data.ts";
import { setTextCharacters } from "./text.ts";

type UiMessage =
  | { type: "ready" }
  | { type: "formula-focus"; active: boolean }
  | {
      type: "preview";
      cellId: string;
      formula: string;
      rawValue: string;
      format: CellFormat | null;
      commit?: boolean;
      silent?: boolean;
      revealError?: boolean;
    }
  | {
      type: "apply";
      cellId: string;
      formula: string;
      rawValue: string;
      format: CellFormat | null;
      silent?: boolean;
    }
  | { type: "apply-format"; format: CellFormat; silent?: boolean }
  | { type: "clear-formula" }
  | { type: "undo-clear" }
  | { type: "unlink" }
  | { type: "resize"; width?: number; height: number };

const CLEAR_UNDO_MS = 5000;
let clearUndoUntil = 0;
let clearNotify: NotificationHandler | undefined;

let activeTextId: string | undefined;
let draftFormula = "";
let formulaActive = false;
let ignoreSelection = false;
let keepFormulaUntil = 0;

let writingText = false;
let overlayBusy = false;
let overlayQuietUntil = 0;
let lastHintKey = "";
let lastPostedNodeId = "";
let watchedPage: PageNode | undefined;

figma.showUI(__html__, { width: 320, height: 280, themeColors: true });

figma.on("selectionchange", () => {
  handleSelectionChange();
});

figma.on("currentpagechange", () => {
  lastPostedNodeId = "";
  watchCurrentPage();
});

figma.on("close", () => {
  unwatchCurrentPage();
  void hideAllOverlays();
});

watchCurrentPage();

figma.ui.onmessage = async (msg: UiMessage) => {
  try {
    switch (msg.type) {
      case "ready":
        postSelection();
        return;
      case "formula-focus":
        if (!msg.active && Date.now() < keepFormulaUntil) {
          formulaActive = true;
          await syncBadges();
          figma.ui.postMessage({ type: "keep-formula-focus" });
          return;
        }
        formulaActive = msg.active;
        await syncBadges();
        return;
      case "preview":
        draftFormula = msg.formula;
        await postPreview(msg);
        if (!formulaActive) {
          void highlightForActive(msg.formula);
        }
        return;
      case "apply":
        await applyCell(msg, { silent: Boolean(msg.silent) });
        return;
      case "apply-format":
        await applyFormatToSelection(msg.format, { silent: Boolean(msg.silent) });
        return;
      case "clear-formula":
        await clearFormulaOnSelection();
        return;
      case "undo-clear":
        undoClear();
        return;
      case "unlink":
        await unlinkSelection();
        return;
      case "resize":
        figma.ui.resize(msg.width ?? 320, msg.height);
        return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({ type: "error", message });
    if (msg.type !== "preview") {
      figma.notify(message, { error: true });
    }
  }
};

function handleSelectionChange(): void {
  if (ignoreSelection) {
    return;
  }

  const raw = [...figma.currentPage.selection];
  const badgeIds = raw
    .map((node) => cellIdFromBadge(node))
    .filter((id): id is string => Boolean(id));
  const selection = raw.filter((node) => !isOverlayNode(node));
  const active = activeText();
  const picking = formulaActive || Date.now() < keepFormulaUntil;

  if (picking && active && selection.filter(isFrameLike).length < 2) {
    const adapter = new FigmaDocumentAdapter();
    const cellIds: string[] = [...badgeIds];
    for (const node of selection) {
      if (node.id === active.id) {
        continue;
      }
      const text = nearestText(node);
      if (text && text.id !== active.id) {
        cellIds.push(adapter.cellFromNode(text).id);
      }
    }
    if (cellIds.length > 0) {
      stayInFormulaPick();
      figma.ui.postMessage({ type: "insert-ref", cellIds });
      restoreFormulaSelection(active);
    }
    void hintFormulaMembers(active, draftFormula || adapter.cellFromNode(active).formula || "");
    return;
  }

  if (raw.length > 0 && raw.every((node) => isOverlayNode(node))) {
    if (active && picking) {
      stayInFormulaPick();
      figma.ui.postMessage({ type: "keep-formula-focus" });
      restoreFormulaSelection(active);
    }
    return;
  }

  const frames = selection.filter(isFrameLike);
  if (frames.length >= 2) {
    activeTextId = undefined;
    lastPostedNodeId = "";
    void hideAllOverlays();
    figma.ui.postMessage({
      type: "selection",
      mode: "format-only",
      frameCount: frames.length,
      format: formatFromFrames(frames),
    });
    return;
  }

  const directText = selection.find(
    (node): node is TextNode =>
      node.type === "TEXT" && !isOverlayNode(node) && !cellIdFromBadge(node),
  );
  if (
    directText &&
    selection.length === 1 &&
    hasFormula(directText)
  ) {
    const container = enclosingComponentOrFrame(directText);
    if (container && container.id !== directText.id) {
      activeTextId = directText.id;
      figma.currentPage.selection = [container];
      return;
    }
  }

  const text = resolveCellText(selection);
  if (!picking && text && text.id === lastPostedNodeId) {
    return;
  }

  activeTextId = text?.id;
  postSelection();
}

function stayInFormulaPick(): void {
  formulaActive = true;
  keepFormulaUntil = Date.now() + 800;
}

function restoreFormulaSelection(active: TextNode): void {
  const current = figma.currentPage.selection;
  if (current.length === 1 && current[0]?.id === active.id) {
    return;
  }
  ignoreSelection = true;
  figma.currentPage.selection = [active];
  ignoreSelection = false;
}

function hasFormula(node: TextNode): boolean {
  return Boolean(new FigmaDocumentAdapter().cellFromNode(node).formula);
}

function isCellText(node: SceneNode): node is TextNode {
  return (
    node.type === "TEXT" && !isOverlayNode(node) && !cellIdFromBadge(node)
  );
}

function resolveCellText(selection: SceneNode[]): TextNode | undefined {
  const direct = selection.find(isCellText);
  if (direct) {
    return direct;
  }

  const frame = selection[0];
  if (selection.length !== 1 || !frame || !isFrameLike(frame)) {
    return undefined;
  }

  const texts = textNodesInFrames([frame]);
  if (texts.length === 1) {
    return texts[0];
  }
  if (activeTextId) {
    return texts.find((node) => node.id === activeTextId);
  }
  return undefined;
}

function activeText(): TextNode | undefined {
  if (!activeTextId) {
    return undefined;
  }
  const node = figma.currentPage.findOne((candidate) => candidate.id === activeTextId);
  return node?.type === "TEXT" ? node : undefined;
}

function selectedText(): TextNode | undefined {
  if (activeTextId) {
    const active = activeText();
    if (active) {
      return active;
    }
  }
  return resolveCellText(
    [...figma.currentPage.selection].filter((node) => !isOverlayNode(node)),
  );
}

function postSelection(force = false): void {
  const node = selectedText();
  if (!node) {
    lastPostedNodeId = "";
    void hideAllOverlays();
    figma.ui.postMessage({ type: "selection", mode: "empty", cell: null });
    return;
  }

  if (!force && formulaActive && node.id === lastPostedNodeId) {
    void syncBadges();
    return;
  }

  lastPostedNodeId = node.id;
  activeTextId = node.id;
  const adapter = new FigmaDocumentAdapter();
  const engine = new ComputationEngine(adapter);
  const cell = adapter.cellFromNode(node);
  const managed = adapter.isManaged(node);
  let formatted = node.characters;
  let error = false;
  let errorKind: ComputeErrorKind | undefined;
  let errorMessage: string | undefined;
  if (managed) {
    const result = engine.getValue(cell.id);
    if (isComputeError(result)) {
      formatted = errorLabel(result);
      error = true;
      errorKind = result.kind;
      errorMessage = uiErrorText(result);
    } else {
      formatted = formatValue(result, cell.format);
    }
  }
  const rawDisplay =
    cell.rawValue === undefined || cell.rawValue === null
      ? ""
      : String(cell.rawValue);

  draftFormula = cell.formula ?? "";
  void hintFormulaMembers(node, draftFormula);
  void syncBadges();

  figma.ui.postMessage({
    type: "selection",
    mode: "cell",
    cell: {
      name: node.name,
      cellId: cell.id,
      managed,
      formula: cell.formula ?? "",
      rawValue: cell.formula ? "" : rawDisplay,
      format: cell.format ?? null,
      formatted,
      error,
      errorKind,
      errorMessage,
    },
  });
}

async function postPreview(msg: {
  cellId: string;
  formula: string;
  rawValue: string;
  format: CellFormat | null;
  commit?: boolean;
  silent?: boolean;
  revealError?: boolean;
}): Promise<void> {
  const { formatted, error, kind, message } = computePreview(msg);
  figma.ui.postMessage({
    type: "preview",
    formatted,
    error,
    errorKind: kind,
    errorMessage: message,
    revealError: Boolean(msg.revealError),
  });
  if (shouldPersistPreview(msg, error, kind)) {
    await applyCell(msg, {
      silent: msg.silent !== false,
      recordHistory: Boolean(msg.revealError) || msg.silent === false,
    });
  }
}

function computePreview(msg: {
  formula: string;
  rawValue: string;
  format: CellFormat | null;
}): { formatted: string; error: boolean; kind?: ComputeErrorKind; message?: string } {
  const adapter = new FigmaDocumentAdapter();
  const format = msg.format ?? undefined;
  const formula = normalizeFormula(msg.formula);
  try {
    const result = formula
      ? evaluateFormula(formula, adapter)
      : parseLiteralInput(msg.rawValue);
    if (isComputeError(result)) {
      return {
        formatted: errorLabel(result),
        error: true,
        kind: result.kind,
        message: uiErrorText(result),
      };
    }
    return { formatted: formatValue(result, format), error: false };
  } catch (error) {
    if (isComputeError(error)) {
      return {
        formatted: errorLabel(error),
        error: true,
        kind: error.kind,
        message: uiErrorText(error),
      };
    }
    throw error;
  }
}

function uiErrorText(error: ComputeError): string {
  switch (error.kind) {
    case "REF":
      return error.cellId ? `Unknown reference "${error.cellId}"` : "Unknown reference";
    case "CYCLE":
      return "Circular reference";
    case "PARSE": {
      const expected = error.message.match(/Expected '([^']+)'/);
      if (expected?.[1]) {
        return `Expected "${expected[1]}"`;
      }
      return error.message.replace(/\.$/, "");
    }
    case "DIV_ZERO":
      return "Division by zero";
    default:
      return error.message;
  }
}

function shouldPersistPreview(
  msg: { commit?: boolean; formula: string; rawValue: string; revealError?: boolean },
  error: boolean,
  kind: ComputeErrorKind | undefined,
): boolean {
  if (!msg.commit || !hasExpression(msg)) {
    return false;
  }
  if (!error) {
    return true;
  }
  if (msg.revealError) {
    return true;
  }
  return kind === "REF" || kind === "DIV_ZERO" || kind === "VALUE" || kind === "NAME" || kind === "CYCLE";
}

function hasExpression(msg: { formula: string; rawValue: string }): boolean {
  return Boolean(normalizeFormula(msg.formula) || String(msg.rawValue ?? "").trim());
}

async function applyCell(
  msg: {
    cellId: string;
    formula: string;
    rawValue: string;
    format: CellFormat | null;
  },
  options?: { silent?: boolean; recordHistory?: boolean },
): Promise<void> {
  const node = selectedText();
  if (!node) {
    throw new Error("Select a text layer first.");
  }

  const silent = Boolean(options?.silent);
  const recordHistory = options?.recordHistory ?? !silent;
  if (!silent) {
    await hideIdBadges();
    await hideFormulaHints();
  }

  const cellId = normalizeCellId(msg.cellId, node);
  const adapter = new FigmaDocumentAdapter();
  adapter.attach(node, cellId);

  const engine = new ComputationEngine(adapter);
  const formula = normalizeFormula(msg.formula);
  if (formula) {
    engine.setFormula(cellId, formula);
  } else if (msg.rawValue !== undefined) {
    engine.setValue(cellId, parseLiteralInput(msg.rawValue));
  }

  await recalculatePage(adapter, engine);
  if (recordHistory) {
    figma.commitUndo();
  }
  if (!silent) {
    figma.notify(`Updated ${cellId}`);
    postSelection(true);
  }
}

async function clearFormulaOnSelection(): Promise<void> {
  const node = selectedText();
  if (!node) {
    throw new Error("Select a text layer first.");
  }

  figma.commitUndo();
  await hideIdBadges();
  await hideFormulaHints();

  const adapter = new FigmaDocumentAdapter();
  const engine = new ComputationEngine(adapter);
  const cell = adapter.cellFromNode(node);
  adapter.attach(node, cell.id);

  if (cell.formula) {
    const result = engine.getValue(cell.id);
    const kept = isComputeError(result)
      ? parseCharactersAsValue(node.characters)
      : result;
    engine.setValue(cell.id, kept);
  } else {
    engine.setValue(cell.id, null);
  }

  await recalculatePage(adapter, engine);
  figma.commitUndo();

  clearUndoUntil = Date.now() + CLEAR_UNDO_MS;
  clearNotify?.cancel();
  clearNotify = figma.notify("Formula cleared", {
    timeout: CLEAR_UNDO_MS,
    button: {
      text: "Undo",
      action: () => {
        undoClear();
      },
    },
  });

  postSelection(true);
}

function undoClear(): void {
  if (Date.now() > clearUndoUntil) {
    return;
  }
  clearUndoUntil = 0;
  clearNotify?.cancel();
  clearNotify = undefined;
  figma.triggerUndo();
  figma.ui.postMessage({ type: "clear-undone" });
  postSelection(true);
}

async function unlinkSelection(): Promise<void> {
  const node = selectedText();
  if (!node) {
    throw new Error("Select a text layer first.");
  }
  await hideIdBadges();
  await hideFormulaHints();
  const adapter = new FigmaDocumentAdapter();
  adapter.detach(node);
  figma.commitUndo();
  figma.notify("Unlinked layer");
  postSelection(true);
}

/** Re-evaluate and rewrite every managed cell on the current page. Display only. */
async function recalculatePage(
  adapter: FigmaDocumentAdapter,
  engine: ComputationEngine,
  skipNodeId?: string,
): Promise<void> {
  writingText = true;
  try {
    for (const node of adapter.managedTextNodes()) {
      if (node.id === skipNodeId) {
        continue;
      }
      const cell = adapter.cellFromNode(node);
      await setTextCharacters(node, engine.getFormattedValue(cell.id));
    }
  } finally {
    writingText = false;
  }
}

async function applyFormatToSelection(
  format: CellFormat,
  options?: { silent?: boolean },
): Promise<void> {
  const node = selectedText();
  if (!node) {
    await applyFormatToSelectedFrames(format, options);
    return;
  }

  const adapter = new FigmaDocumentAdapter();
  const cell = adapter.cellFromNode(node);
  adapter.attach(node, cell.id);
  if (cell.formula === undefined) {
    adapter.setRawValue(
      cell.id,
      cell.rawValue !== undefined ? cell.rawValue : parseCharactersAsValue(node.characters),
    );
  }
  adapter.setFormat(cell.id, format);
  const engine = new ComputationEngine(adapter);
  await recalculatePage(adapter, engine);
  figma.commitUndo();
  if (!options?.silent) {
    figma.notify("Formatted");
  }
}

async function hideAllOverlays(): Promise<void> {
  overlayBusy = true;
  try {
    await hideIdBadges();
    await hideFormulaHints();
    lastHintKey = "";
  } finally {
    overlayBusy = false;
    overlayQuietUntil = Date.now() + 200;
  }
}

async function syncBadges(): Promise<void> {
  overlayBusy = true;
  try {
    if (!formulaActive) {
      await hideIdBadges();
      return;
    }
    await hideFormulaHints();
    lastHintKey = "";
    const node = activeText() ?? selectedText();
    if (!node) {
      await hideIdBadges();
      return;
    }
    await showIdBadges(new FigmaDocumentAdapter(), node);
  } finally {
    overlayBusy = false;
    overlayQuietUntil = Date.now() + 200;
  }
}

function highlightForActive(formula: string): void {
  const node = activeText() ?? selectedText();
  if (node) {
    void hintFormulaMembers(node, formula);
  }
}

async function hintFormulaMembers(
  node: TextNode,
  formulaSource: string,
): Promise<void> {
  overlayBusy = true;
  try {
    if (formulaActive) {
      await hideFormulaHints();
      lastHintKey = "";
      return;
    }

    const adapter = new FigmaDocumentAdapter();
    const formula = normalizeFormula(formulaSource);
    const hintKey = `${node.id}:${formula ?? ""}`;
    if (!formula) {
      await hideFormulaHints();
      lastHintKey = "";
      return;
    }
    if (hintKey === lastHintKey) {
      return;
    }

    const activeContainer = enclosingComponentOrFrame(node);
    const selectedIds = new Set(figma.currentPage.selection.map((sceneNode) => sceneNode.id));
    const targets: { node: SceneNode; label: string }[] = [];
    for (const id of formulaCellIds(formula)) {
      const ref = adapter.findTextNode(id);
      if (!ref || ref.id === node.id) {
        continue;
      }
      const refContainer = enclosingComponentOrFrame(ref);
      const hinted =
        refContainer && refContainer.id !== activeContainer?.id ? refContainer : ref;
      if (selectedIds.has(hinted.id) || hinted.id === activeContainer?.id) {
        continue;
      }
      targets.push({ node: hinted, label: id });
    }
    await showFormulaHints(targets);
    lastHintKey = hintKey;
  } finally {
    overlayBusy = false;
    overlayQuietUntil = Date.now() + 200;
  }
}

function isFrameLike(node: SceneNode): boolean {
  return (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET" ||
    node.type === "INSTANCE" ||
    node.type === "SECTION"
  );
}

function textNodesInFrames(frames: SceneNode[]): TextNode[] {
  const texts: TextNode[] = [];
  for (const frame of frames) {
    if (!("findAllWithCriteria" in frame)) {
      continue;
    }
    for (const node of frame.findAllWithCriteria({ types: ["TEXT"] })) {
      if (!isOverlayNode(node) && !cellIdFromBadge(node)) {
        texts.push(node);
      }
    }
  }
  return texts;
}

function formatFromFrames(frames: SceneNode[]): CellFormat | null {
  const adapter = new FigmaDocumentAdapter();
  for (const node of textNodesInFrames(frames)) {
    const format = adapter.cellFromNode(node).format;
    if (format) {
      return format;
    }
  }
  return null;
}

async function applyFormatToSelectedFrames(
  format: CellFormat,
  options?: { silent?: boolean },
): Promise<void> {
  const frames = figma.currentPage.selection.filter(isFrameLike);
  const texts = textNodesInFrames(frames);
  if (texts.length === 0) {
    throw new Error("No text layers in the selected frames.");
  }

  const adapter = new FigmaDocumentAdapter();
  const engine = new ComputationEngine(adapter);
  for (const node of texts) {
    const cell = adapter.cellFromNode(node);
    adapter.attach(node, cell.id);
    if (cell.formula === undefined) {
      adapter.setRawValue(
        cell.id,
        cell.rawValue !== undefined ? cell.rawValue : parseCharactersAsValue(node.characters),
      );
    }
    adapter.setFormat(cell.id, format);
  }
  await recalculatePage(adapter, engine);
  figma.commitUndo();
  if (!options?.silent) {
    figma.notify(`Formatted ${texts.length} layers`);
  }
}

function normalizeCellId(input: string, node: TextNode): string {
  const trimmed = input.trim();
  if (isValidCellId(trimmed)) {
    return trimmed;
  }
  return new FigmaDocumentAdapter().cellFromNode(node).id;
}

function watchCurrentPage(): void {
  unwatchCurrentPage();
  watchedPage = figma.currentPage;
  watchedPage.on("nodechange", handleNodeChange);
}

function unwatchCurrentPage(): void {
  if (watchedPage) {
    watchedPage.off("nodechange", handleNodeChange);
    watchedPage = undefined;
  }
}

function handleNodeChange(event: NodeChangeEvent): void {
  if (writingText || overlayBusy || Date.now() < overlayQuietUntil) {
    return;
  }
  if (textGraphChanged(event)) {
    void recalcManagedFormulas();
    return;
  }
  if (formulaActive) {
    return;
  }
  void syncCanvasLiteral(event);
}

function isOverlaySceneNode(node: BaseNode | RemovedNode): boolean {
  if ("name" in node && typeof node.name === "string" && isOverlayName(node.name)) {
    return true;
  }
  return "getPluginData" in node && isOverlayNode(node);
}

function textGraphChanged(event: NodeChangeEvent): boolean {
  return event.nodeChanges.some((change) => {
    if (change.type !== "CREATE" && change.type !== "DELETE") {
      return false;
    }
    const node = change.node;
    if (node.type !== "TEXT") {
      return false;
    }
    if (isOverlaySceneNode(node)) {
      return false;
    }
    return true;
  });
}

async function recalcManagedFormulas(): Promise<void> {
  const adapter = new FigmaDocumentAdapter();
  const engine = new ComputationEngine(adapter);
  await recalculatePage(adapter, engine);
}

async function syncCanvasLiteral(event: NodeChangeEvent): Promise<void> {
  const editing = figma.currentPage.selectedTextRange;
  if (!editing) {
    return;
  }

  const node = selectedText();
  if (!node || node.removed || editing.node.id !== node.id) {
    return;
  }

  const adapter = new FigmaDocumentAdapter();
  const cell = adapter.cellFromNode(node);
  if (cell.formula) {
    return;
  }

  const changed = event.nodeChanges.some((change) => {
    if (change.type !== "PROPERTY_CHANGE") {
      return false;
    }
    if (change.node.id !== node.id) {
      return false;
    }
    return change.properties.includes("characters");
  });
  if (!changed) {
    return;
  }

  const value = parseCharactersAsValue(node.characters);
  if (adapter.isManaged(node)) {
    adapter.setRawValue(cell.id, value);
  }

  const engine = new ComputationEngine(adapter);
  await recalculatePage(adapter, engine, node.id);

  figma.ui.postMessage({
    type: "canvas-value",
    rawValue: value === null ? "" : String(value),
  });
}
