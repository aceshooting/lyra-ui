import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
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
 *
 * Implements the WAI-ARIA treeitem keyboard pattern: a single roving
 * `tabindex` (tracked here as `activeId`, pushed down to every
 * `<lyra-tree-node>` — including nested ones, recursively) and
 * ArrowUp/Down/Right/Left/Home/End/Enter/Space handled by one delegated
 * `keydown` listener. Native `KeyboardEvent`s are `composed: true` and
 * bubble across shadow-DOM boundaries, so a press inside a deeply-nested
 * `<lyra-tree-node>`'s own shadow root still reaches this listener.
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

  @state() private activeId: string | null = null;

  private get nodeElements(): LyraTreeNode[] {
    return [...this.querySelectorAll('lyra-tree-node')] as LyraTreeNode[];
  }

  private childrenOf(node: LyraTreeNode): LyraTreeNode[] {
    return [...(node.shadowRoot?.querySelectorAll('lyra-tree-node') ?? [])] as LyraTreeNode[];
  }

  /** Every currently *visible* (ancestor-expanded) node, top-to-bottom. */
  private visibleNodeElements(): LyraTreeNode[] {
    const acc: LyraTreeNode[] = [];
    const walk = (nodes: LyraTreeNode[]): void => {
      for (const n of nodes) {
        acc.push(n);
        if (n.expanded) walk(this.childrenOf(n));
      }
    };
    walk(this.nodeElements);
    return acc;
  }

  private findItem(items: TreeItem[], id: string): TreeItem | undefined {
    for (const item of items) {
      if (item.id === id) return item;
      const nested = item.children && this.findItem(item.children, id);
      if (nested) return nested;
    }
    return undefined;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('data')) {
      this.syncNodes();
      if (!this.activeId || !this.findItem(this.data, this.activeId)) {
        this.activeId = this.data[0]?.id ?? null;
      }
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('activeId') || changed.has('data')) {
      const count = this.data.length;
      this.nodeElements.forEach((node, i) => {
        node.activeId = this.activeId;
        node.setSize = count;
        node.posInSet = i + 1;
      });
    }
  }

  /** Unchanged from the existing implementation — by-id reconciliation of top-level items. */
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

  private focusNode(node: LyraTreeNode | undefined): void {
    if (!node) return;
    this.activeId = node.item.id;
    node.focus();
  }

  /**
   * `updated()` only pushes the new `activeId` to *top-level* nodes; a
   * nested node only receives it once its ancestor chain's own renders
   * cascade it down (one more pending update per depth level). Cascade
   * `updateComplete` itself to match: awaiting `<lyra-tree>`'s (or any
   * `<lyra-tree-node>`'s — see the matching override there) `updateComplete`
   * now transitively waits for every visible descendant node's own update,
   * not just this element's. Without this, `focusNode()`'s `.focus()` call
   * can run while a nested target is still mid-cascade (no `tabindex`
   * attribute committed yet), and `.focus()` on an element with no
   * `tabindex` attribute at all is a silent no-op.
   */
  protected async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await Promise.all(this.nodeElements.map((n) => n.updateComplete));
    return result;
  }

  private onTreeKeyDown = (e: KeyboardEvent): void => {
    const visible = this.visibleNodeElements();
    if (visible.length === 0) return;
    const currentIndex = visible.findIndex((n) => n.item.id === this.activeId);
    const current = currentIndex >= 0 ? visible[currentIndex] : visible[0];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusNode(visible[Math.min(visible.length - 1, currentIndex + 1)]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusNode(visible[Math.max(0, currentIndex - 1)]);
        break;
      case 'Home':
        e.preventDefault();
        this.focusNode(visible[0]);
        break;
      case 'End':
        e.preventDefault();
        this.focusNode(visible[visible.length - 1]);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (!current.hasChildren) break;
        if (!current.expanded) {
          current.expand(); // focus stays put; a 2nd ArrowRight steps into the first child
        } else {
          const child = visible[currentIndex + 1];
          if (child && child.depth > current.depth) this.focusNode(child);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (current.hasChildren && current.expanded) {
          current.collapse();
        } else {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (visible[i].depth < current.depth) {
              this.focusNode(visible[i]);
              break;
            }
          }
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        current.select();
        break;
      default:
        return;
    }
  };

  /** Expand every node in the tree, recursively. (unchanged) */
  expandAll(): void {
    const setAll = (nodes: LyraTreeNode[]): void => {
      for (const n of nodes) {
        n.expanded = true;
        void n.updateComplete.then(() => setAll(this.childrenOf(n)));
      }
    };
    setAll(this.nodeElements);
  }

  /** Collapse every node in the tree. (unchanged) */
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
      <div part="base" role="tree" @keydown=${this.onTreeKeyDown}>
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
