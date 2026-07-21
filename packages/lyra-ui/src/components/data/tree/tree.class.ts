import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { isRtl } from '../../../internal/rtl.js';
import { styles } from './tree.styles.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import '../../overlays/empty/empty.js';
// The registering barrel, not the bare `*.class.js` module -- this side effect is what makes
// `<lr-live-region>` an actually-defined tag by the time a reorderable tree renders one.
import '../../utility/live-region/live-region.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import './tree-node.class.js';
import type { LyraTreeNode } from './tree-node.class.js';

/** Tone for a `TreeBadge` chip; the same closed set as `ButtonVariant`. */
export type TreeBadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface TreeBadge {
  text: string;
  tone?: TreeBadgeTone;
  /** Accessible name override; falls back to `text` when omitted. */
  label?: string;
}

export interface TreeItem {
  id: string;
  label: string;
  children?: TreeItem[];
  badge?: string | number;
  /** Additive, token-colored chips rendered after the legacy `badge`. Omit for byte-identical
   *  output to today. */
  badges?: TreeBadge[];
  /** Optional decorative leading content, such as an icon TemplateResult. */
  icon?: unknown;
  /** Secondary visible row text. */
  description?: string;
  /** Spoken treeitem name when it needs more context than the visible row. */
  accessibleLabel?: string;
}

/**
 * `<lr-tree>` — an expand/collapse hierarchy for graph/document navigation.
 *
 * Implements the WAI-ARIA treeitem keyboard pattern: a single roving
 * `tabindex` (tracked here as `activeId`, pushed down to every
 * `<lr-tree-node>` — including nested ones, recursively) and
 * ArrowUp/Down/Right/Left/Home/End/Enter/Space handled by one delegated
 * `keydown` listener. Native `KeyboardEvent`s are `composed: true` and
 * bubble across shadow-DOM boundaries, so a press inside a deeply-nested
 * `<lr-tree-node>`'s own shadow root still reaches this listener.
 *
 * Set `reorderable` to opt into keyboard reordering: Ctrl/Cmd+ArrowUp/ArrowDown on the focused
 * node emits `lr-reorder` — a *request*, exactly like every other event here. `data` is
 * host-owned and never mutated by this component, so nothing moves until the host reassigns a
 * reordered `data`; focus then follows the moved node. The keybinding matches
 * `<lr-dashboard-grid>`'s `cells-draggable` precedent (Alt+Arrow is browser back/forward on
 * Windows/Linux). `<lr-file-tree>` deliberately **opts out**: its `TreeItem[]` is derived from
 * `nodes` on every render and keyed by filesystem path, an order it does not own.
 *
 * @customElement lr-tree
 * @event lr-node-toggle - `detail: { id, expanded }`, dispatched by a descendant `<lr-tree-node>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @event lr-node-select - `detail: { id }`, dispatched by a descendant `<lr-tree-node>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @event lr-reorder - `detail: { id, parentId, fromIndex, toIndex }` — Ctrl/Cmd+ArrowUp/ArrowDown moved the focused node within its **own parent's** child list (`parentId` is `null` for a top-level item; the indices are sibling-scoped, not flattened-visible-list positions). Only fired while `reorderable`. Never fires at a subtree boundary, so a reorder can never become a reparent.
 * @csspart base - The tree's root wrapper (role="tree").
 * @csspart empty - The empty-state message shown when `data` is empty.
 * @slot - `<lr-tree-node>` elements (top-level tree items).
 */
export class LyraTree extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) data: TreeItem[] = [];
  /**
   * Accessible name forwarded to the internal `role="tree"` element. A host `aria-label` is also
   * forwarded as a fallback when `label` is empty; `label` takes precedence when both are set.
   * External `aria-labelledby` idrefs are not forwarded across the shadow boundary.
   */
  @property() label = '';
  /**
   * Opts into Ctrl/Cmd+ArrowUp/ArrowDown keyboard reordering (see the class doc). Defaults to
   * `false`: unset, no `lr-reorder` is ever emitted, Ctrl/Cmd+Arrow keeps behaving exactly like
   * a plain Arrow press, and the internal live region is not rendered at all.
   */
  @property({ type: Boolean, reflect: true }) reorderable = false;

  @state() private activeId: string | null = null;
  /** Set by `willUpdate()` when a `data` reassignment displaces the node that currently holds real DOM focus -- either by removing it (refocus the newly-designated `activeId`) or by merely re-indexing it (refocus that same node); consumed by `getUpdateComplete()` once the target is actually focusable again. */
  private pendingFocusId: string | null = null;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

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
   * plain public settable properties on `<lr-tree-node>` (not just
   * reachable through this class's own `data` setter or the bubbling
   * `lr-node-toggle` event), so a cache keyed off those two entry points
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

  /**
   * The sibling list `id` belongs to, plus its position in it and its parent's
   * id (`null` at the top level). This is the *sibling* index space, which is
   * what a reorder operates in -- deliberately not the flattened visible-list
   * index space the arrow keys navigate, since that one crosses parents and
   * skips collapsed subtrees.
   */
  private findSiblings(
    id: string,
    items: TreeItem[] = this.data,
    parentId: string | null = null,
  ): { parentId: string | null; siblings: TreeItem[]; index: number } | undefined {
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) return { parentId, siblings: items, index };
    for (const item of items) {
      const nested = item.children && this.findSiblings(id, item.children, item.id);
      if (nested) return nested;
    }
    return undefined;
  }

  /**
   * The `<lr-tree-node>` that genuinely holds real DOM focus, or `null`.
   *
   * `document.activeElement` collapses to the outermost light-DOM node even
   * when the real focus target is a nested descendant several shadow roots
   * down, so it can't distinguish "the top-level node is focused" from "one of
   * its nested descendants is". Walking the `shadowRoot.activeElement` chain
   * resolves the actual node, which is what lets a `data` reassignment restore
   * focus to a *nested* node rather than yanking it up to that node's
   * top-level ancestor.
   */
  private deepFocusedNode(): LyraTreeNode | null {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (!active || active.localName !== tag('tree-node')) return null;
    const node = active as LyraTreeNode;
    const id = node.item?.id;
    return id != null && this.visibleNodeElements().some((n) => n.item?.id === id) ? node : null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('data')) {
      const focused = this.deepFocusedNode();
      const focusedId = focused?.item?.id ?? null;
      this.syncNodes();
      if (!this.activeId || !this.findItem(this.data, this.activeId)) {
        this.activeId = this.data[0]?.id ?? null;
      }
      // Two distinct ways a `data` reassignment drops real DOM focus, both of
      // which land it on <body> synchronously (per the DOM spec) before this
      // method returns:
      //   * the focused node was *removed* -- `node.remove()` in `syncNodes()`,
      //     or, for a nested node, its parent's `repeat()` dropping the key;
      //   * the focused node was merely *re-indexed* -- `insertBefore()` here,
      //     or `repeat()` reordering a nested list, both of which are a
      //     remove+insert of an already-connected element.
      // Only the first case has to fall back to the newly-resolved `activeId`;
      // a re-indexed node is still in `data`, so focus goes right back to it.
      this.pendingFocusId =
        focused == null
          ? null
          : focusedId != null && this.findItem(this.data, focusedId)
            ? focusedId
            : this.activeId;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('activeId') || changed.has('data')) {
      const count = this.data.length;
      this.nodeElements.forEach((node, i) => {
        node.activeId = this.activeId;
        node.setSize = count;
        node.posInSet = i + 1;
      });
    }
  }

  /** By-id reconciliation of top-level items: reuses/reorders existing `<lr-tree-node>` elements and removes ones no longer present in `data`. */
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
  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await cascadeUpdateComplete(this.nodeElements);
    if (this.pendingFocusId != null) {
      const id = this.pendingFocusId;
      this.pendingFocusId = null;
      // Searched across the *visible* walk, not just `nodeElements`, so a
      // nested node that was only re-indexed gets focus back where it was
      // rather than having it pulled up to its top-level ancestor. A node
      // whose ancestor collapsed in the same update is no longer visible (and
      // has no committed `tabindex`), so fall back to the roving target.
      const visible = this.visibleNodeElements();
      (
        visible.find((n) => n.item?.id === id) ??
        visible.find((n) => n.item?.id === this.activeId)
      )?.focus();
    }
    return result;
  }

  /**
   * Emit a sibling-scoped reorder *request* for `node`, `delta` slots later
   * (`+1`) or earlier (`-1`) among its own parent's children.
   *
   * Deliberately constrained to one sibling list. Ctrl+ArrowDown on the last
   * child of a subtree is otherwise ambiguous -- the visually next row is a
   * top-level uncle, so "move down" could mean either "swap with the next
   * sibling" (there is none) or "reparent up a level". Reparenting is a
   * structural edit, not a reorder, and there is no keyboard affordance that
   * distinguishes the two, so a request that would leave the sibling list is
   * simply not made: no event, no announcement, focus stays put -- exactly
   * like a plain ArrowDown on the last visible row.
   */
  private requestReorder(node: LyraTreeNode, delta: 1 | -1): void {
    const id = node.item?.id;
    if (id == null) return;
    const found = this.findSiblings(id);
    if (!found) return;
    const { parentId, siblings, index } = found;
    const toIndex = index + delta;
    if (toIndex < 0 || toIndex >= siblings.length) return;
    this.emit('lr-reorder', { id, parentId, fromIndex: index, toIndex });
    this.liveRegion?.announce(
      this.localize('treeNodeMoved', undefined, {
        label: node.item.accessibleLabel || node.item.label,
        index: toIndex + 1,
        total: siblings.length,
      }),
      // A discrete, user-initiated action: never coalesce it behind the
      // announcer's throttle window the way streaming status text is.
      { force: true },
    );
  }

  private onTreeKeyDown = (e: KeyboardEvent): void => {
    const visible = this.visibleNodeElements();
    if (visible.length === 0) return;
    const currentIndex = visible.findIndex((n) => n.item.id === this.activeId);
    const current = currentIndex >= 0 ? visible[currentIndex] : visible[0];
    if (!current) return; // visible is non-empty (checked above), so current is always defined
    // Ctrl/Cmd+ArrowUp/ArrowDown reorders instead of navigating, matching
    // <lr-dashboard-grid>'s `cells-draggable` keyboard move. ArrowUp/ArrowDown
    // are not direction-sensitive, so this branch is deliberately *not*
    // RTL-swapped: "down" always means later in the sibling list.
    if (this.reorderable && (e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.requestReorder(current, e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
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
            const sibling = visible[i];
            if (sibling && sibling.depth < current.depth) {
              this.focusNode(sibling);
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
   * `lr-node-toggle` emit reaches `onNodeActivate` -- that keeps `activeId`
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

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        role="tree"
        aria-label=${this.label || this.getAttribute('aria-label') || nothing}
        @keydown=${this.onTreeKeyDown}
        @lr-node-toggle=${this.onNodeActivate}
        @lr-node-select=${this.onNodeActivate}
      >
        ${this.data.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : nothing}
        <slot></slot>
      </div>
      ${this.reorderable ? html`<lr-live-region></lr-live-region>` : nothing}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tree': LyraTree;
  }
}
