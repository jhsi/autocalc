# Figma plugin

The headless engine in `src/core` stays Figma-free. This folder is the plugin: a `DocumentAdapter` over the scene graph, plus a UI for formulas and display formats.

## Concept mapping

```text
Figma TextNode              → Cell
TextNode.id                 → used only to find the node
pluginData on TextNode      → cell id, formula, rawValue, format
computed formatted value    → TextNode.characters
```

Formulas cannot use Figma's native ids (`3:12`) because the formula language identifiers must start with a letter. Each managed layer gets a stable **cell id** (default: sanitized layer name) stored in `pluginData`. Rename the layer freely; formulas keep working until you change the cell id.

Unmanaged text layers can still be referenced by their sanitized layer name. Their visible characters are parsed as the literal (so `price * qty` works if those layers contain numbers).

## Install (development)

1. `npm install`
2. `npm run figma:build` (or `npm run figma:watch`)
3. In Figma: **Plugins → Development → Import plugin from manifest…**
4. Choose `dist/figma/manifest.json`

## Use

1. Select a text layer.
2. Set a **cell id** (`price`), either a **literal** (`1234.56`) or a **formula** (`qty * price`).
3. Pick a format (number / currency / percent / compact).
4. Type a **value**, or start with `=` for a **formula**. Apply writes pluginData, then recalculates every managed cell on the page.
5. Focus the **formula** field. Tiny cell ids appear next to other text layers — click one to insert it. **⌘⇧-click** a layer also inserts the nearest text cell.
6. Selecting a formula cell highlights its referenced layers. Selecting a referenced input highlights its parent frame.
7. **Unlink** removes pluginData and leaves the current text in place.

Only managed layers (ones you have Applied) are overwritten. Formatting is display-only: evaluation stays numeric.

## Integration notes

- Fonts are loaded before writing `characters`. Mixed-style text is flattened to a single font for the new string.
- `figma.commitUndo()` batches each Apply into one undo step.
- Duplicate cell ids: the first match wins. Give layers unique cell ids.
- Groups / frames as formula ranges are not wired yet.
