/// <reference types="@figma/plugin-typings" />

import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import type { Cell, CellFormat, CellId, CellValue } from "../core/types.ts";
import {
  PLUGIN_DATA_KEY,
  assignStableCellIds,
  cellIdFromLayerName,
  isGenericLayerId,
  isOverlayNode,
  parseStoredCell,
  resolvedCellContent,
  serializeStoredCell,
  type StoredCell,
} from "./plugin-data.ts";

/**
 * Live DocumentAdapter over the current Figma page.
 * TextNode → Cell; formula/format/rawValue live in pluginData.
 */
export class FigmaDocumentAdapter implements DocumentAdapter {
  private cellIdMap: Map<string, string> | undefined;

  getCell(id: CellId): Cell | undefined {
    const node = this.findTextNode(id);
    return node ? this.cellFromNode(node) : undefined;
  }

  getAllCells(): Cell[] {
    return this.allTextNodes().map((node) => this.cellFromNode(node));
  }

  setRawValue(id: CellId, value: CellValue): void {
    const node = this.requireTextNode(id);
    const stored = this.readStored(node) ?? this.freshStored(id);
    stored.rawValue = value;
    stored.formula = undefined;
    this.writeStored(node, stored);
  }

  setFormula(id: CellId, formula: string | undefined): void {
    const node = this.requireTextNode(id);
    const stored = this.readStored(node) ?? this.freshStored(id);
    stored.formula = formula;
    if (formula !== undefined) {
      stored.rawValue = undefined;
    }
    this.writeStored(node, stored);
  }

  setFormat(id: CellId, format: CellFormat | undefined): void {
    const node = this.requireTextNode(id);
    const stored = this.readStored(node) ?? this.freshStored(id);
    stored.format = format;
    this.writeStored(node, stored);
  }

  /** Bind a text node to a stable formula id and mark it as a managed cell. */
  attach(node: TextNode, cellId: string): void {
    const stored = this.readStored(node) ?? this.freshStored(cellId);
    stored.cellId = cellId;
    this.writeStored(node, stored);
    this.cellIdMap = undefined;
  }

  detach(node: TextNode): void {
    node.setPluginData(PLUGIN_DATA_KEY, "");
    this.cellIdMap = undefined;
  }

  /**
   * Formula, rawValue, and format live in pluginData.
   * node.characters is display-only (formatted output) and is never
   * treated as formula source. Canvas text is only parsed for layers
   * that have no stored formula or rawValue.
   */
  cellFromNode(node: TextNode): Cell {
    const stored = this.readStored(node);
    const id = this.idOf(node);
    return {
      id,
      name: node.name,
      ...resolvedCellContent(stored, node.characters),
    };
  }

  isManaged(node: TextNode): boolean {
    const stored = this.readStored(node);
    if (!stored) {
      return false;
    }
    return (
      stored.formula !== undefined ||
      stored.rawValue !== undefined ||
      stored.format !== undefined
    );
  }

  managedTextNodes(): TextNode[] {
    return this.allTextNodes().filter((node) => this.isManaged(node));
  }

  findTextNode(id: CellId): TextNode | undefined {
    return this.allTextNodes().find((node) => this.idOf(node) === id);
  }

  /** Every text layer on the page that is not a plugin overlay. */
  textNodes(): TextNode[] {
    return this.allTextNodes();
  }

  private idOf(node: TextNode): string {
    return this.ensureCellIds().get(node.id) ?? "c1";
  }

  private ensureCellIds(): Map<string, string> {
    if (!this.cellIdMap) {
      const nodes = this.allTextNodes();
      this.cellIdMap = assignStableCellIds(
        nodes.map((node) => ({
          nodeId: node.id,
          storedId: this.readStored(node)?.cellId,
          suggestedId: suggestedIdForNode(node),
        })),
      );
      this.persistAssignedIds(nodes, this.cellIdMap);
    }
    return this.cellIdMap;
  }

  private persistAssignedIds(nodes: TextNode[], map: Map<string, string>): void {
    for (const node of nodes) {
      const id = map.get(node.id);
      if (!id) {
        continue;
      }
      const stored = this.readStored(node);
      if (stored?.cellId === id) {
        continue;
      }
      this.writeStored(node, stored ? { ...stored, cellId: id } : { cellId: id });
    }
  }

  private requireTextNode(id: CellId): TextNode {
    const node = this.findTextNode(id);
    if (!node) {
      throw new Error(`Unknown cell '${id}'`);
    }
    return node;
  }

  private allTextNodes(): TextNode[] {
    return figma.currentPage
      .findAllWithCriteria({ types: ["TEXT"] })
      .filter((node) => !isOverlayNode(node));
  }

  private readStored(node: TextNode): StoredCell | undefined {
    return parseStoredCell(node.getPluginData(PLUGIN_DATA_KEY));
  }

  private writeStored(node: TextNode, stored: StoredCell): void {
    node.setPluginData(PLUGIN_DATA_KEY, serializeStoredCell(stored));
  }

  private freshStored(cellId: string): StoredCell {
    return { cellId };
  }
}

function suggestedIdForNode(node: TextNode): string | undefined {
  if (node.autoRename) {
    return undefined;
  }
  const id = cellIdFromLayerName(node.name);
  return isGenericLayerId(id) ? undefined : id;
}
