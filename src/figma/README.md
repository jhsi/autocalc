# Future Figma adapter

The headless engine in `src/core` must stay Figma-free. This directory is where
a plugin adapter will later implement `DocumentAdapter` against the Figma scene
graph.

Do not add `@figma/plugin-typings` or plugin code until the engine milestones
are in place.

## Concept mapping

```text
Figma TextNode              → Cell
Figma Frame / Group         → CellGroup
TextNode.id                 → CellId
pluginData on TextNode      → formula + formatting metadata
computed CellValue          → TextNode.characters
```

Names (`TextNode.name`, layer names) are presentation only. Formulas stored in
the engine must reference stable node ids, not visible names.

A frame's child nodes become `CellGroup.children`. Nested frames become nested
groups.

## Integration concerns (unsolved on purpose)

These are real plugin problems. Do not solve them in the core engine:

- Loading fonts before changing `TextNode.characters`
- Storing formulas and format metadata in `pluginData`
- Listening to document changes while the plugin runs
- Resolving nodes by id (`figma.getNodeById`)
- Traversing frames and groups
- Node deletion (cells that formulas still reference)
- Duplication producing new Figma node ids
- Renamed layers (ids stay stable; names do not)
- Preserving mixed text styles when writing `characters`
- Undo behavior (`figma.commitUndo` / plugin-initiated edits)

## Suggested adapter shape (later)

```ts
class FigmaDocumentAdapter implements DocumentAdapter {
  getCell(id: CellId): Cell | undefined { /* read TextNode + pluginData */ }
  getGroup(id: string): CellGroup | undefined { /* read Frame/Group */ }
  // ...
}
```

The plugin would:

1. Walk the current page into a `DocumentAdapter` view (or query it live).
2. Construct `ComputationEngine`.
3. On edits, call `engine.setValue` / `engine.setFormula`.
4. Apply returned `CellChange[]` back onto the corresponding text nodes.
