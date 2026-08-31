/// <reference types="@figma/plugin-typings" />

import type { DocumentAdapter } from "../adapters/document-adapter.ts";
import type { Cell, CellFormat, CellId, CellValue } from "../core/types.ts";
import {
  PLUGIN_DATA_KEY,
  cellIdFromLayerName,
  isOverlayNode,
  parseCharactersAsValue,
  parseStoredCell,
  serializeStoredCell,
  uniqueCellIds,
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

  cellFromNode(node: TextNode): Cell {
    const stored = this.readStored(node);
    const id = this.idOf(node);
    if (stored) {
      return {
        id,
        name: node.name,
        formula: stored.formula,
        rawValue: stored.formula !== undefined ? undefined : stored.rawValue,
        format: stored.format,
      };
    }
    return {
      id,
      name: node.name,
      rawValue: parseCharactersAsValue(node.characters),
    };
  }

  isManaged(node: TextNode): boolean {
    return this.readStored(node) !== undefined;
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
    return this.ensureCellIds().get(node.id) ?? cellIdFromLayerName(node.name);
  }

  private ensureCellIds(): Map<string, string> {
    if (!this.cellIdMap) {
      this.cellIdMap = uniqueCellIds(
        this.allTextNodes().map((node) => ({
          nodeId: node.id,
          storedId: this.readStored(node)?.cellId,
          layerName: node.name,
        })),
      );
    }
    return this.cellIdMap;
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
