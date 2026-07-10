import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './tree.styles.js';
import './tree-node.js';
import type { LyraTreeNode } from './tree-node.js';

export interface TreeItem {
  id: string;
  label: string;
  children?: TreeItem[];
  badge?: string | number;
}

/**
 * `<lyra-tree>` — an expand/collapse hierarchy for graph/document navigation.
 * First-party invention; no shared web-component seed existed across the
 * surveyed repos (only bespoke React equivalents).
 *
 * Top-level `<lyra-tree-node>` elements are created imperatively as real
 * light-DOM children (like `<lyra-toast>` creates `<lyra-toast-item>`s) so
 * they're projected through the default `<slot>` rather than living only in
 * this component's shadow root — that's what lets consumers, and this
 * component's own `expandAll()`/`collapseAll()`, reach them via the DOM.
 *
 * Re-assigning `data` reconciles by `item.id` instead of tearing down and
 * recreating every top-level node, so each `<lyra-tree-node>` instance (and
 * the `expanded` state it owns) survives a re-fetch that produces a new
 * array reference for the same items.
 *
 * @customElement lyra-tree
 * @event lyra-node-toggle - `detail: { id, expanded }`, re-emitted from a child `<lyra-tree-node>`.
 * @event lyra-node-select - `detail: { id }`, re-emitted from a child `<lyra-tree-node>`.
 * @csspart base
 * @slot - `<lyra-tree-node>` elements (top-level tree items).
 */
export class LyraTree extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) data: TreeItem[] = [];

  private get nodeElements(): LyraTreeNode[] {
    return [...this.querySelectorAll('lyra-tree-node')] as LyraTreeNode[];
  }

  /** A node's own recursive children live in *its* shadow root, not the light DOM. */
  private childrenOf(node: LyraTreeNode): LyraTreeNode[] {
    return [...(node.shadowRoot?.querySelectorAll('lyra-tree-node') ?? [])] as LyraTreeNode[];
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('data')) this.syncNodes();
  }

  /**
   * Reconcile the light-DOM `<lyra-tree-node>` children with `this.data` by
   * `item.id`, reusing existing node instances (and therefore preserving the
   * `expanded` state each one owns) instead of destroying and recreating
   * every top-level node on each `data` reassignment.
   */
  private syncNodes(): void {
    const existingById = new Map<string, LyraTreeNode>();
    for (const node of this.nodeElements) {
      if (node.item) existingById.set(node.item.id, node);
    }

    const seen = new Set<string>();
    let previousSibling: LyraTreeNode | null = null;
    for (const item of this.data) {
      const reused = !seen.has(item.id) ? existingById.get(item.id) : undefined;
      const node = reused ?? (document.createElement('lyra-tree-node') as LyraTreeNode);
      node.item = item;
      node.depth = 0;
      seen.add(item.id);

      const targetPosition: Element | null = previousSibling
        ? previousSibling.nextElementSibling
        : this.firstElementChild;
      if (targetPosition !== node) this.insertBefore(node, targetPosition);
      previousSibling = node;
    }

    for (const [id, node] of existingById) {
      if (!seen.has(id)) node.remove();
    }
  }

  /** Expand every node in the tree, recursively. */
  expandAll(): void {
    const setAll = (nodes: LyraTreeNode[]): void => {
      for (const n of nodes) {
        n.expanded = true;
        void n.updateComplete.then(() => setAll(this.childrenOf(n)));
      }
    };
    setAll(this.nodeElements);
  }

  /** Collapse every node in the tree. */
  collapseAll(): void {
    const setAll = (nodes: LyraTreeNode[]): void => {
      for (const n of nodes) {
        setAll(this.childrenOf(n));
        n.expanded = false;
      }
    };
    setAll(this.nodeElements);
  }

  render(): TemplateResult {
    return html`
      <div part="base" role="tree">
        <slot></slot>
      </div>
    `;
  }
}

defineElement('tree', LyraTree);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tree': LyraTree;
  }
}
