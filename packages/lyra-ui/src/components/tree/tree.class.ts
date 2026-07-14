import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { tag } from '../../internal/prefix.js';
import { isRtl } from '../../internal/rtl.js';
import { styles } from './tree.styles.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import '../empty/empty.class.js';
import './tree-node.class.js';
import type { LyraTreeNode } from './tree-node.class.js';

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
 * @event lyra-node-toggle - `detail: { id, expanded }`, dispatched by a descendant `<lyra-tree-node>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @event lyra-node-select - `detail: { id }`, dispatched by a descendant `<lyra-tree-node>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @csspart base - The tree's root wrapper (role="tree").
 * @csspart empty - The empty-state message shown when `data` is empty.
 * @slot - `<lyra-tree-node>` elements (top-level tree items).
 */
export class LyraTree extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) data: TreeItem[] = [];
  /** Accessible name for the tree -- `role="tree"` lives on an internal element, not the host, so `aria-label`/`aria-labelledby` set directly on `<lyra-tree>` would not label it. */
  @property() label = '';

  @state() private activeId: string | null = null;
  /** Set by `willUpdate()` when a `data` reassignment removes the node that currently holds real DOM focus; consumed by `updated()` to refocus the newly-designated `activeId` node once it's actually focusable. */
  private pendingFocusId: string | null = null;

  private get nodeElements(): LyraTreeNode[] {
    return [...this.querySelectorAll(tag('tree-node'))] as LyraTreeNode[];
  }

  private childrenOf(node: LyraTreeNode): LyraTreeNode[] {
    return [...(node.shadowRoot?.querySelectorAll(tag('tree-node')) ?? [])] as LyraTreeNode[];
  }

  /**
   * Every currently *visible* (ancestor-expanded) node, top-to-bottom.
   *
   * Recomputed on every call rather than memoized: `item`/`expanded` are
   * plain public settable properties on `<lyra-tree-node>` (not just
   * reachable through this class's own `data` setter or the bubbling
   * `lyra-node-toggle` event), so a cache keyed off those two entry points
   * alone would go stale the moment a caller mutated a node directly --
   * e.g. `node.item = { ...node.item, children: [...] }` to append a child
   * in place. This walk only runs from user-paced `keydown` handling (never
   * a hot render-loop path), so the cost of a `shadowRoot.querySelectorAll`
   * per currently-expanded node is not worth trading for that staleness risk.
   */
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
      // `document.activeElement` collapses to the outermost light-DOM node
      // even when the real focus target is a nested descendant several
      // shadow roots down, so this also catches a focused nested node whose
      // top-level ancestor is about to be removed.
      const focused = this.nodeElements.find((n) => n === document.activeElement);
      this.syncNodes();
      if (!this.activeId || !this.findItem(this.data, this.activeId)) {
        this.activeId = this.data[0]?.id ?? null;
      }
      // `node.remove()` inside `syncNodes()` (per the DOM spec) already moved
      // real focus off `focused` and onto <body> by this point; record the
      // newly-resolved `activeId` so `updated()` can restore focus to it.
      this.pendingFocusId = focused && !focused.isConnected ? this.activeId : null;
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

  /** By-id reconciliation of top-level items: reuses/reorders existing `<lyra-tree-node>` elements and removes ones no longer present in `data`. */
  private syncNodes(): void {
    const existingById = new Map<string, LyraTreeNode>();
    for (const node of this.nodeElements) {
      if (node.item) existingById.set(node.item.id, node);
    }
    const seen = new Set<string>();
    let previousSibling: LyraTreeNode | null = null;
    for (const item of this.data) {
      const reused = !seen.has(item.id) ? existingById.get(item.id) : undefined;
      const node = reused ?? (document.createElement(tag('tree-node')) as LyraTreeNode);
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
   * A mouse click always lands directly on the node it interacts with --
   * `select()`/`expand()`/`collapse()` all emit their own node's id --
   * independent of whatever `activeId` currently holds. Sync `activeId` to
   * that id here so a click always becomes the tree's new roving-tabindex
   * target: this keeps it aligned with real DOM focus, keeps the next
   * arrow-key press relative to the item the user just clicked (rather than
   * a stale `activeId`), and keeps `activeId` valid when a click collapses
   * an ancestor of the previously-active node -- the collapsed node's own
   * id (always still visible, since collapsing never removes a node's own
   * top-level or already-rendered self) replaces the now-hidden descendant's
   * id, so at least one node keeps a roving tabindex of 0. Keyboard-driven
   * toggles/selects always target the already-active node, so this is a
   * same-value, no-op assignment for them.
   */
  private onNodeActivate = (e: Event): void => {
    this.activeId = (e as CustomEvent<{ id: string }>).detail.id;
  };

  /**
   * `updated()` only pushes the new `activeId` to *top-level* nodes; nested
   * nodes only receive it once their ancestor chain's own renders cascade it
   * down (one more pending update per depth level). Cascade `updateComplete`
   * to match (see `cascadeUpdateComplete`), so `focusNode()`'s `.focus()`
   * call never runs while a nested target is still mid-cascade -- `.focus()`
   * on an element with no `tabindex` attribute committed yet is a silent
   * no-op.
   *
   * The `pendingFocusId` refocus (set by `willUpdate()` when a `data`
   * reassignment removes the node that currently holds real DOM focus) is
   * also resolved *here*, after the cascade above, rather than from
   * `updated()` firing a detached `void this.updateComplete.then(...)` of
   * its own: `updateComplete`'s getter (see the base class) calls this
   * method fresh on *every* access rather than caching one promise, so a
   * second, independent invocation started from inside `updated()` isn't
   * the same promise chain a caller's own `await el.updateComplete` is
   * following -- both ultimately settle once the same underlying update
   * resolves, but as separate chains their `.then()` continuations aren't
   * ordered against each other, so a caller's `await` can win the race and
   * observe focus *not yet* restored. Doing the refocus inline, before this
   * method's own `await` chain resolves, makes it unconditionally part of
   * whatever `updateComplete` promise every caller (this class's own
   * `focusNode()` included) is already waiting on.
   */
  protected async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await cascadeUpdateComplete(this.nodeElements);
    if (this.pendingFocusId != null) {
      const id = this.pendingFocusId;
      this.pendingFocusId = null;
      this.nodeElements.find((n) => n.item.id === id)?.focus();
    }
    return result;
  }

  private onTreeKeyDown = (e: KeyboardEvent): void => {
    const visible = this.visibleNodeElements();
    if (visible.length === 0) return;
    const currentIndex = visible.findIndex((n) => n.item.id === this.activeId);
    const current = currentIndex >= 0 ? visible[currentIndex] : visible[0];
    // Expand/step-in and collapse/step-out are physical-direction actions --
    // swap which arrow key does which in RTL, matching split.ts/time-range.ts.
    const rtl = isRtl(this);
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

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
      case expandKey:
        e.preventDefault();
        if (!current.hasChildren) break;
        if (!current.expanded) {
          current.expand(); // focus stays put; a 2nd press steps into the first child
        } else {
          const child = visible[currentIndex + 1];
          if (child && child.depth > current.depth) this.focusNode(child);
        }
        break;
      case collapseKey:
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

  /**
   * Expand every node in the tree, recursively. Resolves once every
   * descendant has actually finished expanding (not just had `expanded` set)
   * -- callers that immediately read `visibleNodeElements()`-derived state
   * (or call `collapseAll()` right after) should `await` this instead of
   * firing it and moving on.
   *
   * Guarded on `n.hasChildren`, matching `expand()`'s own invariant -- a leaf
   * node's `expanded` must never be set to `true`, since `collapse()` (and
   * this method's own counterpart, `collapseAll()`) refuse to act on a node
   * that's `!hasChildren`, which would otherwise leave the leaf permanently
   * stuck with a reflected `expanded` attribute nothing can clear.
   */
  async expandAll(): Promise<void> {
    const setAll = async (nodes: LyraTreeNode[]): Promise<void> => {
      await Promise.all(
        nodes.map(async (n) => {
          if (n.hasChildren) n.expanded = true;
          await n.updateComplete;
          await setAll(this.childrenOf(n));
        }),
      );
    };
    await setAll(this.nodeElements);
  }

  /**
   * Collapse every node in the tree, recursively. Goes through each node's
   * own `collapse()` (rather than assigning `expanded` directly) so its
   * `lyra-node-toggle` emit reaches `onNodeActivate` -- that keeps `activeId`
   * re-synced to a node that's still visible after collapsing, even when the
   * roving-tabindex target was a nested descendant whose ancestor's
   * `role="group"` is about to disappear.
   */
  collapseAll(): void {
    const setAll = (nodes: LyraTreeNode[]): void => {
      for (const n of nodes) {
        setAll(this.childrenOf(n));
        n.collapse();
      }
    };
    setAll(this.nodeElements);
  }

  render(): TemplateResult {
    return html`
      <div
        part="base"
        role="tree"
        aria-label=${this.label || nothing}
        @keydown=${this.onTreeKeyDown}
        @lyra-node-toggle=${this.onNodeActivate}
        @lyra-node-select=${this.onNodeActivate}
      >
        ${this.data.length === 0
          ? html`<lyra-empty part="empty" heading=${this.localize('noData')}></lyra-empty>`
          : nothing}
        <slot></slot>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-tree': LyraTree;
  }
}

