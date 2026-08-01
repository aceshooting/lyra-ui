import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { tag } from '../../../internal/prefix.js';
import { isRtl } from '../../../internal/rtl.js';
import { styles } from './tree.styles.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import './tree-item.class.js';
import type { LyraTreeItem } from './tree-item.class.js';

// Data types live in ./tree-item.js (extracted to break a type-only import cycle with
// tree-item.class.ts); re-exported here so `export *` from tree.js keeps the public paths.
import type { TreeBadgeTone, TreeBadge, TreeItem } from './tree-types.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
export type { TreeBadgeTone, TreeBadge, TreeItem };

export interface LyraTreeEventMap {
  'lr-node-toggle': CustomEvent<{ id: string; expanded: boolean }>;
  'lr-node-select': CustomEvent<{ id: string }>;
  'lr-reorder': CustomEvent<{ id: string; parentId: string | null; fromIndex: number; toIndex: number }>;
}

/**
 * `<lr-tree>` — an expand/collapse hierarchy for graph/document navigation.
 *
 * **Two child models are accepted.** Nested `<lr-tree-item>` elements written as light-DOM children
 * mirror `wa-tree`/`sl-tree`, so that markup renames mechanically; each item carries its own
 * `label`/`expanded`/`disabled`/`selected` (see `<lr-tree-item>`). Assigning `data` — a `TreeItem[]`
 * of plain objects, which additionally supports per-row icons, descriptions and badges — is this
 * library's own original shape and remains fully supported. A tree containing any author-written
 * `<lr-tree-item>` child is read purely as the declarative model and `data` is ignored, so the two
 * never interleave ambiguously; the empty state renders only when neither model has any items.
 *
 * Implements the WAI-ARIA treeitem keyboard pattern: a single roving
 * `tabindex` (tracked here as `activeId`, pushed down to every
 * `<lr-tree-item>` — including nested ones, recursively) and
 * ArrowUp/Down/Right/Left/Home/End/Enter/Space handled by one delegated
 * `keydown` listener. Native `KeyboardEvent`s are `composed: true` and
 * bubble across shadow-DOM boundaries, so a press inside a deeply-nested
 * `<lr-tree-item>`'s own shadow root still reaches this listener.
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
 * @event lr-node-toggle - `detail: { id, expanded }`, dispatched by a descendant `<lr-tree-item>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @event lr-node-select - `detail: { id }`, dispatched by a descendant `<lr-tree-item>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @event lr-reorder - `detail: { id, parentId, fromIndex, toIndex }` — Ctrl/Cmd+ArrowUp/ArrowDown moved the focused node within its **own parent's** child list (`parentId` is `null` for a top-level item; the indices are sibling-scoped, not flattened-visible-list positions). Only fired while `reorderable`. Never fires at a subtree boundary, so a reorder can never become a reparent.
 * @csspart base - The tree's root wrapper (role="tree").
 * @csspart empty - The empty-state message shown when neither child model has any items.
 * @slot - Top-level `<lr-tree-item>` elements, each nesting its own children — the declarative child model. Leave it empty and assign `data` instead for the object model.
 */
export class LyraTree extends LyraElement<LyraTreeEventMap> {
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
  /** Whether the tree is being driven by author-written `<lr-tree-item>` children rather than by
   *  `data` (see the class doc's child-model note). Recomputed from the light DOM, never guessed. */
  @state() private hasAuthoredItems = false;
  /** Set by `willUpdate()` when a `data` reassignment displaces the node that currently holds real DOM focus -- either by removing it (refocus the newly-designated `activeId`) or by merely re-indexing it (refocus that same node); consumed by `getUpdateComplete()` once the target is actually focusable again. */
  private pendingFocusId: string | null = null;
  /** The `<lr-tree-item>` elements `syncNodes()` created from `data`. Everything else among this
   *  element's children was written by the author, which is what puts the tree in the declarative
   *  child model -- an identity set is the only reliable way to tell the two apart, since a
   *  generated node and an authored one are the same tag. */
  private readonly generatedNodes = new WeakSet<LyraTreeItem>();

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  /** Top-level items only. Deliberately `:scope >`: in the declarative child model nested items are
   *  light-DOM descendants of *this* element too, and a plain descendant query would flatten the
   *  whole hierarchy into the top-level set (wrong `aria-setsize`/`aria-posinset`, wrong roving
   *  order). In the data model the two queries are equivalent, since nested items are rendered into
   *  their own parent's shadow root. */
  private get nodeElements(): LyraTreeItem[] {
    return [...this.querySelectorAll(`:scope > ${tag('tree-item')}`)] as LyraTreeItem[];
  }

  private childrenOf(node: LyraTreeItem): LyraTreeItem[] {
    return node.childItems();
  }

  /** Recomputed from the DOM rather than tracked incrementally: children can be added by the parser,
   *  by a framework re-render, or by `syncNodes()` itself, and only the generated-node set is a
   *  reliable discriminator. */
  private refreshAuthoredItems(): void {
    let authored = false;
    for (const node of this.nodeElements) {
      // A nested item promoted to the top level still carries the `slot` its former parent item
      // assigned it, and this element has only a default slot -- leaving it there would assign the
      // node to nothing at all, so it would silently render nowhere while still counting as an item.
      if (node.hasAttribute('slot')) node.removeAttribute('slot');
      if (!this.generatedNodes.has(node)) authored = true;
    }
    this.hasAuthoredItems = authored;
  }

  /**
   * Every currently *visible* (ancestor-expanded) node, top-to-bottom.
   *
   * Recomputed on every call rather than memoized: `item`/`expanded` are
   * plain public settable properties on `<lr-tree-item>` (not just
   * reachable through this class's own `data` setter or the bubbling
   * `lr-node-toggle` event), so a cache keyed off those two entry points
   * alone would go stale the moment a caller mutated a node directly --
   * e.g. `node.item = { ...node.item, children: [...] }` to append a child
   * in place. This walk only runs from user-paced `keydown` handling (never
   * a hot render-loop path), so the cost of a `shadowRoot.querySelectorAll`
   * per currently-expanded node is not worth trading for that staleness risk.
   */
  private visibleNodeElements(): LyraTreeItem[] {
    const acc: LyraTreeItem[] = [];
    const walk = (nodes: LyraTreeItem[]): void => {
      for (const n of nodes) {
        if (n.isDisabled) continue;
        acc.push(n);
        if (n.expanded) walk(this.childrenOf(n));
      }
    };
    walk(this.nodeElements);
    return acc;
  }

  private findItem(items: TreeItem[], id: string): TreeItem | undefined {
    const stack = [...items].reverse();
    const seen = new Set<TreeItem>();
    while (stack.length > 0) {
      const item = stack.pop()!;
      if (seen.has(item)) continue;
      seen.add(item);
      if (item.id === id) return item;
      if (item.children) {
        for (let i = item.children.length - 1; i >= 0; i--) {
          const child = item.children[i];
          if (child) stack.push(child);
        }
      }
    }
    return undefined;
  }

  private firstEnabledId(items: TreeItem[]): string | null {
    const stack = [...items].reverse();
    const seen = new Set<TreeItem>();
    while (stack.length > 0) {
      const item = stack.pop()!;
      if (seen.has(item)) continue;
      seen.add(item);
      if (item.disabled) continue;
      return item.id;
    }
    return null;
  }

  private isEnabledReachableId(items: TreeItem[], id: string): boolean {
    const stack = [...items].reverse();
    const seen = new Set<TreeItem>();
    while (stack.length > 0) {
      const item = stack.pop()!;
      if (seen.has(item)) continue;
      seen.add(item);
      if (item.disabled) continue;
      if (item.id === id) return true;
      if (item.children) {
        for (let i = item.children.length - 1; i >= 0; i--) {
          const child = item.children[i];
          if (child) stack.push(child);
        }
      }
    }
    return false;
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
  ): { parentId: string | null; total: number; index: number } | undefined {
    const stack: Array<{ items: TreeItem[]; parentId: string | null }> = [{ items, parentId }];
    const seen = new Set<TreeItem[]>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current.items)) continue;
      seen.add(current.items);
      const index = current.items.findIndex((item) => item.id === id);
      if (index >= 0) return { parentId: current.parentId, total: current.items.length, index };
      for (let i = current.items.length - 1; i >= 0; i--) {
        const item = current.items[i];
        if (item?.children) stack.push({ items: item.children, parentId: item.id });
      }
    }
    return undefined;
  }

  /** The declarative child model's answer to `findSiblings()`: the sibling list is the node's own
   *  parent element's child items (or the top-level ones), in the same sibling index space. */
  private findSlottedSiblings(
    node: LyraTreeItem,
  ): { parentId: string | null; total: number; index: number } | undefined {
    const parent = node.parentElement;
    const parentItem = parent?.localName === tag('tree-item') ? (parent as LyraTreeItem) : null;
    const siblings = parentItem ? parentItem.childItems() : this.nodeElements;
    const index = siblings.indexOf(node);
    if (index < 0) return undefined;
    return { parentId: parentItem ? parentItem.nodeId : null, total: siblings.length, index };
  }

  /**
   * The `<lr-tree-item>` that genuinely holds real DOM focus, or `null`.
   *
   * `document.activeElement` collapses to the outermost light-DOM node even
   * when the real focus target is a nested descendant several shadow roots
   * down, so it can't distinguish "the top-level node is focused" from "one of
   * its nested descendants is". Walking the `shadowRoot.activeElement` chain
   * resolves the actual node, which is what lets a `data` reassignment restore
   * focus to a *nested* node rather than yanking it up to that node's
   * top-level ancestor.
   */
  private deepFocusedNode(): LyraTreeItem | null {
    const active = deepActiveElementIn(document);
    if (!active || active.localName !== tag('tree-item')) return null;
    const node = active as LyraTreeItem;
    return this.visibleNodeElements().some((n) => n.nodeId === node.nodeId) ? node : null;
  }

  /**
   * The declarative child model's answer to the `data`-driven `activeId` resolution below: there is
   * no `data` change to hang it off, so it is re-derived from the DOM on every update instead. If
   * `activeId` no longer names a currently *visible* node -- removed, disabled, or hidden inside a
   * collapsed ancestor -- the first visible one takes over, so the tree never ends up with zero
   * `tabindex="0"` stops and silently drops out of the tab order. Deliberately in `willUpdate()`
   * rather than `updated()`: the nodes are light-DOM children, so they already exist before this
   * element renders, and assigning here folds into the current update instead of scheduling
   * another one.
   */
  private resolveActiveFromDom(): void {
    const visible = this.visibleNodeElements();
    if (visible.some((node) => node.nodeId === this.activeId)) return;
    this.activeId = visible[0]?.nodeId ?? null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // The declarative child model owns the hierarchy outright: `data` is ignored (and never
    // reconciled into the light DOM) for as long as any author-written item is present, so the
    // two models can never interleave into one ambiguous tree.
    this.refreshAuthoredItems();
    if (this.hasAuthoredItems) {
      this.resolveActiveFromDom();
      return;
    }
    if (changed.has('data')) {
      const focused = this.deepFocusedNode();
      const focusedId = focused?.nodeId ?? null;
      this.syncNodes();
      const activeItem = this.activeId ? this.findItem(this.data, this.activeId) : undefined;
      if (
        !this.activeId ||
        !activeItem ||
        activeItem.disabled ||
        !this.isEnabledReachableId(this.data, this.activeId)
      ) {
        this.activeId = this.firstEnabledId(this.data);
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
    if (changed.has('activeId') || changed.has('data') || this.hasAuthoredItems) {
      const nodes = this.nodeElements;
      const count = this.hasAuthoredItems ? nodes.length : this.data.length;
      nodes.forEach((node, i) => {
        node.activeId = this.activeId;
        node.setSize = count;
        node.posInSet = i + 1;
        if (this.hasAuthoredItems) node.depth = 0;
      });
    }
  }

  /** Children changed: re-derive which child model is in play, and (via the requested update)
   *  re-resolve the roving tabindex. Covers author-written items arriving from the HTML parser or
   *  a framework re-render *after* this element first updated -- the case `willUpdate()`'s
   *  synchronous read cannot see -- and the active node being removed, which changes nothing
   *  about `hasAuthoredItems` and so would otherwise schedule no update at all. */
  private onChildrenChanged = (): void => {
    this.refreshAuthoredItems();
    this.requestUpdate();
  };

  /** `slotchange` sees an assignment change but not a child that never becomes assigned -- a node
   *  moved here still carrying its old parent item's `slot="children"` is exactly that, and
   *  `refreshAuthoredItems()` is what un-strands it. A childList observer sees the append itself,
   *  so the two together cover both. Direct children only (no `subtree`): a nested item's own
   *  churn is its own parent element's business. */
  private childObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.childObserver = new MutationObserver(this.onChildrenChanged);
    this.childObserver.observe(this, { childList: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.childObserver?.disconnect();
    this.childObserver = undefined;
  }

  /** By-id reconciliation of top-level items: reuses/reorders existing `<lr-tree-item>` elements and removes ones no longer present in `data`. */
  private syncNodes(): void {
    const existingById = new Map<string, LyraTreeItem>();
    for (const node of this.nodeElements) {
      if (node.item) existingById.set(node.item.id, node);
    }
    const seen = new Set<string>();
    let previousSibling: LyraTreeItem | null = null;
    for (const item of this.data) {
      const reused = !seen.has(item.id) ? existingById.get(item.id) : undefined;
      let node = reused;
      if (!node) {
        node = document.createElement(tag('tree-item')) as LyraTreeItem;
        this.generatedNodes.add(node);
      }
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

  private focusNode(node: LyraTreeItem | undefined): void {
    if (!node) return;
    // `nodeId` resolves in both child models: `item.id` when the tree is data-driven, and the
    // node's own generated id when it was written declaratively (where the markup carries none).
    this.activeId = node.nodeId;
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
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    if (!this.findItem(this.data, id)?.disabled) this.activeId = id;
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
      (visible.find((n) => n.nodeId === id) ?? visible.find((n) => n.nodeId === this.activeId))?.focus();
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
  private requestReorder(node: LyraTreeItem, delta: 1 | -1): void {
    const id = node.nodeId;
    const found = this.hasAuthoredItems ? this.findSlottedSiblings(node) : this.findSiblings(id);
    if (!found) return;
    const { parentId, total, index } = found;
    const toIndex = index + delta;
    if (toIndex < 0 || toIndex >= total) return;
    this.emit<LyraTreeEventMap['lr-reorder']['detail']>('lr-reorder', { id, parentId, fromIndex: index, toIndex });
    this.liveRegion?.announce(
      this.localize('treeNodeMoved', undefined, {
        label: node.nodeLabel,
        index: this.formatCount(toIndex + 1),
        total: this.formatCount(total),
      }),
      // A discrete, user-initiated action: never coalesce it behind the
      // announcer's throttle window the way streaming status text is.
      { force: true },
    );
  }

  private onTreeKeyDown = (e: KeyboardEvent): void => {
    const visible = this.visibleNodeElements();
    if (visible.length === 0) return;
    // `nodeId` resolves in both child models -- see `focusNode()`.
    const currentIndex = visible.findIndex((n) => n.nodeId === this.activeId);
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
    const setAll = async (nodes: LyraTreeItem[]): Promise<void> => {
      await Promise.all(
        nodes.map(async (n) => {
          if (n.isDisabled) {
            n.expanded = false;
            await n.updateComplete;
            return;
          }
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
    const focused = this.deepFocusedNode();
    const setAll = (nodes: LyraTreeItem[]): void => {
      for (const n of nodes) {
        setAll(this.childrenOf(n));
        if (n.isDisabled) n.expanded = false;
        else n.collapse();
      }
    };
    const topLevel = this.nodeElements;
    setAll(topLevel);
    const activeTopLevel = this.hasAuthoredItems
      ? topLevel.some((node) => !node.isDisabled && node.nodeId === this.activeId)
      : this.data.some((item) => !item.disabled && item.id === this.activeId);
    if (!activeTopLevel) {
      this.activeId = this.hasAuthoredItems
        ? (topLevel.find((node) => !node.isDisabled)?.nodeId ?? null)
        : this.firstEnabledId(this.data);
    }
    if (focused) this.pendingFocusId = this.activeId;
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
        ${this.data.length === 0 && !this.hasAuthoredItems
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : nothing}
        <slot @slotchange=${this.onChildrenChanged}></slot>
      </div>
      ${this.reorderable ? html`<lr-live-region></lr-live-region>` : nothing}
    `;
  }
  /** `localize()` interpolates with a bare `String(value)`, so a number handed to it renders in
   *  ASCII digits no matter the locale -- mixing two numbering systems inside one translated
   *  sentence. Route every user-facing number through the effective locale instead. */
  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tree': LyraTree;
  }

}
