/// <reference types="@figma/plugin-typings" />

import { HINT_KEY } from "./plugin-data.ts";

const HINT_COLOR: RGB = { r: 0.18, g: 0.47, b: 1 };

let hints: SceneNode[] = [];

export function enclosingFrame(node: BaseNode): SceneNode | undefined {
  let parent: BaseNode | null = node.parent;
  while (parent && parent.type !== "PAGE" && parent.type !== "DOCUMENT") {
    if (
      parent.type === "FRAME" ||
      parent.type === "COMPONENT" ||
      parent.type === "COMPONENT_SET" ||
      parent.type === "INSTANCE" ||
      parent.type === "SECTION"
    ) {
      return parent;
    }
    parent = parent.parent;
  }
  return undefined;
}

/** Outermost component/instance, otherwise the nearest frame. Used so card width stays editable. */
export function enclosingComponentOrFrame(node: BaseNode): SceneNode | undefined {
  let nearestFrame: SceneNode | undefined;
  let outerComponent: SceneNode | undefined;
  let parent: BaseNode | null = node.parent;
  while (parent && parent.type !== "PAGE" && parent.type !== "DOCUMENT") {
    if (parent.type === "INSTANCE" || parent.type === "COMPONENT") {
      outerComponent = parent;
    }
    if (
      !nearestFrame &&
      (parent.type === "FRAME" ||
        parent.type === "INSTANCE" ||
        parent.type === "COMPONENT")
    ) {
      nearestFrame = parent;
    }
    parent = parent.parent;
  }
  return outerComponent ?? nearestFrame;
}

export function isHintNode(node: BaseNode): boolean {
  return "getPluginData" in node && node.getPluginData(HINT_KEY) !== "";
}

/** Outline a node (or its enclosing frame) without adding it to the selection. */
export async function showFormulaHints(
  targets: { node: SceneNode; label: string }[],
): Promise<void> {
  await hideFormulaHints();
  if (targets.length === 0) {
    return;
  }

  const font = await loadHintFont();
  const seen = new Set<string>();

  for (const target of targets) {
    const box = target.node.absoluteBoundingBox;
    if (!box || seen.has(target.node.id)) {
      continue;
    }
    seen.add(target.node.id);

    const rect = figma.createRectangle();
    rect.resize(Math.max(box.width, 1), Math.max(box.height, 1));
    rect.x = box.x;
    rect.y = box.y;
    rect.fills = [];
    rect.strokes = [{ type: "SOLID", color: HINT_COLOR }];
    rect.strokeWeight = 1.5;
    rect.dashPattern = [5, 4];
    if ("strokeAlign" in rect) {
      rect.strokeAlign = "OUTSIDE";
    }
    rect.locked = true;
    rect.name = `hint:${target.label}`;
    rect.setPluginData(HINT_KEY, target.label);
    figma.currentPage.appendChild(rect);
    hints.push(rect);

    if (!font) {
      continue;
    }
    const label = figma.createText();
    label.fontName = font;
    label.fontSize = 10;
    label.textAutoResize = "WIDTH_AND_HEIGHT";
    label.characters = target.label;
    label.fills = [{ type: "SOLID", color: HINT_COLOR }];
    label.locked = true;
    label.name = `hint-id:${target.label}`;
    label.setPluginData(HINT_KEY, target.label);
    figma.currentPage.appendChild(label);
    label.x = box.x;
    label.y = box.y - label.height - 4;
    hints.push(label);
  }
}

export async function hideFormulaHints(): Promise<void> {
  for (const hint of hints) {
    if (!hint.removed) {
      hint.remove();
    }
  }
  hints = [];
  for (const node of figma.currentPage.findAllWithCriteria({
    types: ["RECTANGLE", "TEXT"],
    pluginData: { keys: [HINT_KEY] },
  })) {
    if (node.getPluginData(HINT_KEY) && !node.removed) {
      node.remove();
    }
  }
}

async function loadHintFont(): Promise<FontName | undefined> {
  const candidates: FontName[] = [
    { family: "Inter", style: "Regular" },
    { family: "Roboto", style: "Regular" },
  ];
  for (const font of candidates) {
    try {
      await figma.loadFontAsync(font);
      return font;
    } catch {
      continue;
    }
  }
  return undefined;
}
