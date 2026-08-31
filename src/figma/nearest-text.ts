/// <reference types="@figma/plugin-typings" />

import { isOverlayNode } from "./plugin-data.ts";

function center(node: SceneNode): { x: number; y: number } | undefined {
  const box = node.absoluteBoundingBox;
  if (!box) {
    return undefined;
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function distance2(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Prefer a TEXT node under the click target; otherwise the closest text on the page. */
export function nearestText(node: SceneNode): TextNode | undefined {
  if (node.type === "TEXT") {
    return isOverlayNode(node) ? undefined : node;
  }

  if ("findAllWithCriteria" in node) {
    const nested = node
      .findAllWithCriteria({ types: ["TEXT"] })
      .filter((text) => !isOverlayNode(text));
    if (nested.length === 1) {
      return nested[0];
    }
    if (nested.length > 1) {
      return closestOf(node, nested);
    }
  }

  const pageTexts = figma.currentPage
    .findAllWithCriteria({ types: ["TEXT"] })
    .filter((text) => !isOverlayNode(text));
  return closestOf(node, pageTexts);
}

function closestOf(origin: SceneNode, texts: TextNode[]): TextNode | undefined {
  const originCenter = center(origin);
  if (!originCenter) {
    return texts[0];
  }
  let best: TextNode | undefined;
  let bestDistance = Infinity;
  for (const text of texts) {
    const textCenter = center(text);
    if (!textCenter) {
      continue;
    }
    const d = distance2(originCenter, textCenter);
    if (d < bestDistance) {
      bestDistance = d;
      best = text;
    }
  }
  return best;
}
