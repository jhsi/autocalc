/// <reference types="@figma/plugin-typings" />

function fontKey(font: FontName): string {
  return `${font.family}@@${font.style}`;
}

function collectFonts(node: TextNode): FontName[] {
  if (node.fontName !== figma.mixed) {
    return [node.fontName];
  }

  const fonts = new Map<string, FontName>();
  const len = node.characters.length;
  for (let i = 0; i < len; i++) {
    const font = node.getRangeFontName(i, i + 1);
    if (font !== figma.mixed) {
      fonts.set(fontKey(font), font);
    }
  }
  return [...fonts.values()];
}

async function loadFont(font: FontName): Promise<FontName> {
  try {
    await figma.loadFontAsync(font);
    return font;
  } catch {
    const fallback: FontName = { family: "Inter", style: "Regular" };
    await figma.loadFontAsync(fallback);
    return fallback;
  }
}

/**
 * Load the node's fonts, then replace `characters` with the formatted value.
 * Mixed-style runs are flattened; Figma cannot set characters while fontName is mixed.
 */
export async function setTextCharacters(
  node: TextNode,
  text: string,
): Promise<void> {
  const fonts = collectFonts(node);
  const loaded = await Promise.all(
    (fonts.length > 0 ? fonts : [{ family: "Inter", style: "Regular" }]).map(
      (font) => loadFont(font),
    ),
  );
  const chosen = loaded[0];
  if (!chosen) {
    throw new Error("Could not load a font for this text layer");
  }

  if (node.fontName === figma.mixed) {
    node.fontName = chosen;
  } else if (fontKey(node.fontName) !== fontKey(chosen)) {
    node.fontName = chosen;
  }

  node.characters = text;
}
