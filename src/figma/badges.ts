/// <reference types="@figma/plugin-typings" />

import { FigmaDocumentAdapter } from "./adapter.ts";
import { BADGE_KEY } from "./plugin-data.ts";

const MAX_BADGES = 80;
const LABEL_COLOR: RGB = { r: 0.18, g: 0.47, b: 1 };

let badges: TextNode[] = [];

export function cellIdFromBadge(node: BaseNode): string | undefined {
  if (!("getPluginData" in node)) {
    return undefined;
  }
  const id = node.getPluginData(BADGE_KEY);
  return id.length > 0 ? id : undefined;
}

export async function hideIdBadges(): Promise<void> {
  for (const badge of badges) {
    if (!badge.removed) {
      badge.remove();
    }
  }
  badges = [];
  for (const node of figma.currentPage.findAllWithCriteria({
    types: ["TEXT"],
    pluginData: { keys: [BADGE_KEY] },
  })) {
    if (node.getPluginData(BADGE_KEY) && !node.removed) {
      node.remove();
    }
  }
}

export async function showIdBadges(
  adapter: FigmaDocumentAdapter,
  active: TextNode,
): Promise<void> {
  await hideIdBadges();
  const font = await loadBadgeFont(active);
  if (!font) {
    return;
  }

  const nodes = adapter
    .textNodes()
    .filter((node) => node.id !== active.id)
    .slice(0, MAX_BADGES);

  for (const target of nodes) {
    const box = target.absoluteBoundingBox;
    if (!box) {
      continue;
    }
    const id = adapter.cellFromNode(target).id;
    const badge = figma.createText();
    badge.fontName = font;
    badge.fontSize = 10;
    badge.textAutoResize = "WIDTH_AND_HEIGHT";
    badge.characters = id;
    badge.fills = [{ type: "SOLID", color: LABEL_COLOR }];
    badge.name = `id:${id}`;
    badge.setPluginData(BADGE_KEY, id);
    figma.currentPage.appendChild(badge);
    badge.x = box.x + box.width + 6;
    badge.y = box.y;
    badges.push(badge);
  }
}

async function loadBadgeFont(from: TextNode): Promise<FontName | undefined> {
  const candidates: FontName[] = [];
  if (from.fontName !== figma.mixed) {
    candidates.push(from.fontName);
  }
  candidates.push({ family: "Inter", style: "Regular" });
  candidates.push({ family: "Roboto", style: "Regular" });
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
