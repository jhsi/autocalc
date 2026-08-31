# AutoCalc

Spreadsheet-style formulas for Figma text layers.
Pick a layer, type `= c1 + c2` (or `AVG(c1, c2)`), and Autocalc writes the computed, formatted value onto the canvas. Formula source, raw values, and display formatting stay separate: the characters you see on the canvas are display-only.

https://github.com/user-attachments/assets/b2ed1687-5764-4b22-b712-3cde6bf83ae0

This repo is two pieces:
- **`src/core`** — a Figma-free computation engine (tokenize, parse, evaluate, format)
- **`src/figma`** — the Autocalc plugin that binds that engine to the current page
## Pre-release
**This is pre-release software.** It is experimental, incomplete, and not ready for production work.
- Features, formulas, and stored data shapes can change without a migration path.
- The plugin **overwrites text** on managed layers when it recalculates. Use a copy of files you care about.
- Expect bugs, missing edge cases, and UX that still moves around.
- Not affiliated with Figma, Inc.
Do not rely on it yet for client files, design systems, or anything you cannot reconstruct.
## Install (development)
The plugin is not on the Figma Community listing. Load it as a development plugin:
```bash
npm install
npm run figma:build
```
In Figma: **Plugins → Development → Import plugin from manifest…** and choose `dist/figma/manifest.json`.
Rebuild after pulling changes (`npm run figma:watch` to rebuild on save). Restart the plugin in Figma after each build.
## Use
1. Run **Autocalc**.
2. Select a text layer (or a frame that contains exactly one text layer).
3. Type a **value**, or start with `=` for a **formula**.
4. While the formula field is focused, click other layers (or the id badges next to them) to insert references as chips.
5. Commit the formula with **⌘Enter** (Ctrl+Enter) or by leaving the field. Format, digits, and locale apply as you change them.
Referenced layers get a dashed outline. Hover a chip to turn that outline solid.
**Clear** removes the formula and keeps the last computed number as a literal.
### Formulas
Cell ids are stable (`c1`, `c2`, …) and live in plugin data, not the layer name. Renaming a layer does not break formulas.
```text
= c1 + c2
= c1 * .8
= AVG(c1, c3, c7)
= (c1 + c2) / c3
```
Supported today:
|     |     |
| --- | --- |
| Arithmetic | `+` `-` `*` `/` and parentheses |
| Functions | `SUM` `AVG` `MIN` `MAX` |
| Numbers | `8`, `1.5`, `0.8` |

Errors on the canvas look like `❌ REF!`, `❌ DIV/0!`, `❌ CYCLE!`, and similar.
### Formatting
Format is metadata, not part of the formula. Evaluation stays numeric; only the canvas string is formatted.
- **Number**, **Percent**, **Currency**, **Compact**
- **Digits**: Auto, or 0–5
- Locale and currency under **Locale & formatting**
## Engine
The core has no Figma types. Formulas evaluate against a `DocumentAdapter`. Tests use an in-memory document; the plugin is one adapter over the current page.
```bash
npm test
npm run typecheck
```
## Limitations (current)
- One page at a time; there is no file-wide model or cross-page sheet.
- Frames with **several** text descendants are not bound as a single cell.
- Duplicate cell ids: the first match wins.
- Mixed-style text is flattened to one font when a value is written.
- Group / frame ranges in formulas are not wired yet.
