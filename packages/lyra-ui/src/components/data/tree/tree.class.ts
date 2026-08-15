import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { tag } from '../../../internal/prefix.js';
import { isRtl } from '../../../internal/rtl.js';
import { styles } from './tree.styles.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import {
  configureTreeItemOwner,
  setTreeItemSelection,
  treeItemOwnerContext,
} from './tree-owner-controller.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import './tree-item.class.js';
import type { LyraTreeItem } from './tree-item.class.js';

// Data types live in ./tree-item.js (extracted to break a type-only import cycle with
// tree-item.class.ts); re-exported here so `export *` from tree.js keeps the public paths.
import type { TreeBadge, TreeIdentityContext, LyraTreeNodeData, TreeSelection } from './tree-types.js';
import { TREE_MAX_RENDER_DEPTH, TREE_MAX_RENDER_NODES } from './tree-types.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_noData, LYRA_DEFAULT_treeNodeMoved } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { TreeBadge, LyraTreeNodeData, TreeSelection };

export interface LyraTreeEventMap {
  'lr-node-toggle': CustomEvent<{ nodeId: string; expanded: boolean }>;
  'lr-node-select': CustomEvent<{ nodeId: string }>;
  'lr-reorder': CustomEvent<{ nodeId: string; parentNodeId: string | null; fromIndex: number; toIndex: number }>;
  'lr-selection-change': CustomEvent<
    LyraEventDetailSnapshot<{ readonly selection: readonly LyraTreeItem[] }>
  >;
  'lr-expand': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-after-expand': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-collapse': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-after-collapse': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-lazy-change': CustomEvent<
    LyraEventDetailSnapshot<{ readonly item: LyraTreeItem; readonly loading: boolean }>
  >;
  'lr-lazy-load': CustomEvent<
    LyraEventDetailSnapshot<{ readonly item: LyraTreeItem; readonly generation: number }>
  >;
}

const TREE_SELECTIONS = new Set<TreeSelection>(['single', 'multiple', 'leaf', 'leaf-multiple']);
const TREE_BADGE_LIMIT = 100;
const EMPTY_TREE_DATA = Object.freeze([]) as readonly LyraTreeNodeData[];

type MutableTreeNodeData = {
  id: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  lazy?: boolean;
  children?: MutableTreeNodeData[];
  badges?: readonly TreeBadge[];
  icon?: unknown;
  description?: string;
  accessibleLabel?: string;
};

function ownValue(record: object, key: PropertyKey): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function arrayLength(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  try {
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(value.length)));
  } catch {
    return 0;
  }
}

function normalizeBadges(value: unknown): { badges?: readonly TreeBadge[]; truncated: boolean } {
  if (!Array.isArray(value)) return { truncated: value !== undefined };
  const badges: TreeBadge[] = [];
  const length = arrayLength(value);
  for (let index = 0; index < Math.min(length, TREE_BADGE_LIMIT); index++) {
    const raw = ownValue(value, String(index));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const text = ownValue(raw, 'text');
    if (typeof text !== 'string') continue;
    const rawTone = ownValue(raw, 'tone');
    const tone =
      rawTone === 'brand' || rawTone === 'success' || rawTone === 'warning' || rawTone === 'danger'
        ? rawTone
        : 'neutral';
    const rawLabel = ownValue(raw, 'label');
    badges.push(Object.freeze({ text, tone, ...(typeof rawLabel === 'string' ? { label: rawLabel } : {}) }));
  }
  return { badges: Object.freeze(badges), truncated: length > TREE_BADGE_LIMIT };
}

function normalizeTreeData(input: unknown): {
  data: readonly LyraTreeNodeData[];
  declaredChildrenAtPath: ReadonlyMap<string, number>;
  declaredRootCount: number;
  truncated: boolean;
} {
  if (!Array.isArray(input)) {
    return {
      data: EMPTY_TREE_DATA,
      declaredChildrenAtPath: new Map(),
      declaredRootCount: 0,
      truncated: input != null,
    };
  }

  const root: MutableTreeNodeData[] = [];
  const declaredChildrenAtPath = new Map<string, number>();
  const created: MutableTreeNodeData[] = [];
  const rootLength = arrayLength(input);
  let truncated = false;
  let accepted = 0;
  const seenIds = new Set<string>();
  const identityFilteredCollections = new Set<MutableTreeNodeData[]>();
  const jobs: Array<{
    source: unknown;
    target: MutableTreeNodeData[];
    parentPath: string;
    depth: number;
    ancestors: ReadonlySet<object>;
  }> = [];
  const rootScanLength = Math.min(rootLength, TREE_MAX_RENDER_NODES);
  if (rootLength > rootScanLength) truncated = true;
  for (let index = rootScanLength - 1; index >= 0; index--) {
    jobs.push({ source: ownValue(input, String(index)), target: root, parentPath: '', depth: 0, ancestors: new Set() });
  }

  while (jobs.length > 0) {
    if (accepted >= TREE_MAX_RENDER_NODES) {
      truncated = true;
      break;
    }
    const job = jobs.pop()!;
    const raw = job.source;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      truncated = true;
      identityFilteredCollections.add(job.target);
      continue;
    }
    const id = ownValue(raw, 'id');
    const label = ownValue(raw, 'label');
    if (
      typeof id !== 'string' ||
      id.trim() === '' ||
      seenIds.has(id) ||
      typeof label !== 'string'
    ) {
      truncated = true;
      identityFilteredCollections.add(job.target);
      continue;
    }
    seenIds.add(id);

    const node: MutableTreeNodeData = { id, label };
    const selected = ownValue(raw, 'selected');
    const disabled = ownValue(raw, 'disabled');
    const lazy = ownValue(raw, 'lazy');
    if (typeof selected === 'boolean') node.selected = selected;
    if (typeof disabled === 'boolean') node.disabled = disabled;
    if (typeof lazy === 'boolean') node.lazy = lazy;
    const icon = ownValue(raw, 'icon');
    if (icon !== undefined) node.icon = icon;
    const description = ownValue(raw, 'description');
    if (typeof description === 'string') node.description = description;
    const accessibleLabel = ownValue(raw, 'accessibleLabel');
    if (typeof accessibleLabel === 'string') node.accessibleLabel = accessibleLabel;
    const normalizedBadges = normalizeBadges(ownValue(raw, 'badges'));
    if (normalizedBadges.badges?.length) node.badges = normalizedBadges.badges;
    truncated ||= normalizedBadges.truncated;

    const ownIndex = job.target.length;
    const path = job.parentPath === '' ? String(ownIndex) : `${job.parentPath}/${ownIndex}`;
    job.target.push(node);
    created.push(node);
    accepted++;

    const rawChildren = ownValue(raw, 'children');
    const childCount = arrayLength(rawChildren);
    if (childCount === 0) continue;
    declaredChildrenAtPath.set(path, childCount);
    if (job.depth >= TREE_MAX_RENDER_DEPTH || job.ancestors.has(raw)) {
      truncated = true;
      continue;
    }
    const children: MutableTreeNodeData[] = [];
    node.children = children;
    const ancestors = new Set(job.ancestors);
    ancestors.add(raw);
    for (let index = childCount - 1; index >= 0; index--) {
      jobs.push({
        source: ownValue(rawChildren as object, String(index)),
        target: children,
        parentPath: path,
        depth: job.depth + 1,
        ancestors,
      });
    }
  }

  for (let index = created.length - 1; index >= 0; index--) {
    const node = created[index]!;
    if (node.children) Object.freeze(node.children);
    Object.freeze(node);
  }
  const normalizedJobs = root.map((node, index) => ({ node, path: String(index) }));
  while (normalizedJobs.length > 0) {
    const { node, path } = normalizedJobs.pop()!;
    const children = node.children ?? [];
    if (identityFilteredCollections.has(children)) {
      declaredChildrenAtPath.set(path, children.length);
    }
    for (let index = children.length - 1; index >= 0; index--)
      normalizedJobs.push({ node: children[index]!, path: `${path}/${index}` });
  }
  return {
    data: Object.freeze(root),
    declaredChildrenAtPath,
    declaredRootCount: identityFilteredCollections.has(root) ? root.length : rootLength,
    truncated,
  };
}

interface PendingTreeReorder {
  node: LyraTreeItem;
  parent: LyraTreeItem | null;
  originalSiblings: LyraTreeItem[];
  targetSibling: LyraTreeItem;
  fromIndex: number;
  toIndex: number;
}

/**
 * Whether `node` is inert *because of markup inside this tree* — its own `inert`, or that of an
 * ancestor item between it and `root`.
 *
 * `role="treeitem"` and the roving `tabindex` both live on the `<lr-tree-item>` host itself, so an
 * inert item literally refuses `focus()`: stepping the roving index onto one leaves focus behind on
 * `<body>` and every later arrow press dies. It therefore belongs in the navigability predicate
 * alongside `isDisabled`, matching `<lr-menu>`'s own item predicate.
 *
 * The walk stops at `root` (this `<lr-tree>`) on purpose, rather than using a plain
 * `closest('[inert]')`. When an ancestor *outside* the tree is inert — the page behind an open
 * modal — every item is inert together; excluding them all would empty the visible walk, null out
 * `activeId`, and leave the tree with zero `tabindex="0"` stops that nothing restores once the
 * dialog closes (the child observer never sees a mutation outside its own subtree). Uniform
 * inertness needs no special handling: focus cannot be inside the tree at all.
 */
function isInertWithin(node: Element, root: Element): boolean {
  for (let current: Element | null = node; current && current !== root; current = current.parentElement) {
    if (current.hasAttribute('inert')) return true;
  }
  return false;
}

/**
 * `<lr-tree>` — an expand/collapse hierarchy for graph/document navigation.
 *
 * **Two child models are accepted.** Nested `<lr-tree-item>` elements written as light-DOM children
 * mirror `wa-tree`/`sl-tree`, so that markup renames mechanically; each item carries its own
 * `label`/`expanded`/`disabled`/`selected` (see `<lr-tree-item>`). Assigning `data` — a `LyraTreeNodeData[]`
 * of plain objects, which additionally supports per-row icons, descriptions and badges — is this
 * library's own original shape and remains fully supported. A tree containing any author-written
 * `<lr-tree-item>` child is read purely as the declarative model and `data` is ignored, so the two
 * never interleave ambiguously; the empty state renders only when neither model has any items.
 * Data-model `LyraTreeNodeData.id` values are nonblank global identities and must be unique across
 * the reachable hierarchy. Malformed rows and later duplicate ids are omitted before rendering,
 * focus, selection, expansion, or reorder requests; the first valid depth-first occurrence wins.
 *
 * Implements the WAI-ARIA treeitem keyboard pattern: a single roving
 * `tabindex` (tracked here as `activeId`, pushed down to every
 * `<lr-tree-item>` — including nested ones, recursively) and
 * ArrowUp/Down/Right/Left/Home/End/Enter/Space handled by one delegated
 * `keydown` listener. Native `KeyboardEvent`s are `composed: true` and
 * bubble across shadow-DOM boundaries, so a press inside a deeply-nested
 * `<lr-tree-item>`'s own shadow root still reaches this listener.
 *
 * **`inert` excludes an item and its whole subtree from that navigation exactly as `disabled`
 * does** — the roving `tabindex` and `role="treeitem"` live on the `<lr-tree-item>` host itself, so
 * an inert item refuses `focus()` outright. Marking the focused item inert therefore moves the
 * roving target, and real focus with it, instead of stranding focus on `<body>`. Only `inert`
 * *inside* the tree counts: a tree the page behind an open modal has inerted keeps its selection,
 * its roving target, and its `activeId` untouched. Selection is deliberately unaffected either way
 * — inert means "not interactive right now", never "deselected".
 *
 * Set `reorderable` to opt into keyboard reordering: Ctrl/Cmd+ArrowUp/ArrowDown on the focused
 * node emits `lr-reorder` — a *request*, exactly like every other event here. `data` is
 * host-owned and never mutated by this component, so nothing moves until the host reassigns a
 * reordered `data`; focus then follows the moved node. The keybinding matches
 * `<lr-dashboard-grid>`'s `cells-draggable` precedent (Alt+Arrow is browser back/forward on
 * Windows/Linux). `<lr-file-tree>` deliberately **opts out**: its `LyraTreeNodeData[]` is derived from
 * `nodes` on every render and keyed by filesystem path, an order it does not own.
 * The reorder live region announces success only after a rendered sibling-order change confirms
 * the host accepted the exact requested swap. Ignored, delayed, or rejected requests never claim
 * that a move already happened; unrelated updates keep an asynchronous request pending.
 *
 * @customElement lr-tree
 * @event lr-node-toggle - `detail: { nodeId, expanded }`, dispatched by a descendant `<lr-tree-item>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @event lr-node-select - `detail: { nodeId }`, dispatched by a descendant `<lr-tree-item>` and observed here (bubbling, composed) to keep the roving-tabindex `activeId` in sync.
 * @event lr-reorder - `detail: { nodeId, parentNodeId, fromIndex, toIndex }` — Ctrl/Cmd+ArrowUp/ArrowDown requests moving the focused node within its **own parent's** child list (`parentNodeId` is `null` for a top-level item; the indices are sibling-scoped, not flattened-visible-list positions). Only fired while `reorderable`. Never fires at a subtree boundary, so a reorder can never become a reparent. Success is announced only after the rendered sibling order confirms the request.
 * @event lr-selection-change - Selection changed. `detail: { selection }`, where `selection` is the current `selectedItems` array.
 * @event lr-expand - Bubbles from the item whose expansion began. `detail: { item }`.
 * @event lr-after-expand - Bubbles after an item's expansion motion completes. `detail: { item }`.
 * @event lr-collapse - Bubbles from the item whose collapse began. `detail: { item }`.
 * @event lr-after-collapse - Bubbles after an item's collapse motion completes. `detail: { item }`.
 * @event lr-lazy-change - Bubbles when an item's pending lazy-loading state changes. `detail: { item, loading }`.
 * @event lr-lazy-load - Bubbles when a lazy item requests children. `detail: { item, generation }`.
 * @csspart base - Compatibility name for the root wrapper; `tree` is the component-specific alias.
 * @csspart tree - The tree's root wrapper (`role="tree"`). It is the same node as `base`.
 * @csspart empty - The empty-state message shown when neither child model has any items.
 * @slot - Top-level `<lr-tree-item>` elements, each nesting its own children — the declarative child model. Leave it empty and assign `data` instead for the object model.
 * @slot expand-icon - Default icon shown by expanded items; an item-level slot takes precedence.
 * @slot collapse-icon - Default icon shown by collapsed items; an item-level slot takes precedence.
 * @cssprop [--indent-size=var(--lr-space-l)] - Indentation step for nested items.
 * @cssprop [--indent-guide-color=var(--lr-color-border)] - Indentation guide color.
 * @cssprop [--indent-guide-offset=0] - Block-axis inset for indentation guides.
 * @cssprop [--indent-guide-style=solid] - Indentation guide border style.
 * @cssprop [--indent-guide-width=0] - Indentation guide width.
 * @status stable
 * @since 4.0.0
 */
export class LyraTree extends LyraElement<LyraTreeEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    noData: LYRA_DEFAULT_noData,
    treeNodeMoved: LYRA_DEFAULT_treeNodeMoved,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-selection-change',
  ]);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-selection-change': Object.freeze(['selection']),
  });

  static override styles = [LyraElement.styles, styles];

  /** Object child model. Installed values are clone-owned/frozen and bounded to 1,000 nodes over
   * at most 64 descendant levels. Every reachable `LyraTreeNodeData.id` must be globally unique;
   * later duplicate occurrences fail closed as disabled rows so one public id can never own
   * multiple actions. Reassign after changes. */
  private _data: readonly LyraTreeNodeData[] = EMPTY_TREE_DATA;
  private declaredChildrenAtPath: ReadonlyMap<string, number> = new Map();
  private declaredRootCount = 0;
  private _dataTruncated = false;

  /** Clone-owned/frozen object child model.
   * @default [] */
  @property({ attribute: false })
  get data(): readonly LyraTreeNodeData[] {
    return this._data;
  }
  set data(value: readonly LyraTreeNodeData[]) {
    const previous = this._data;
    const normalized = normalizeTreeData(value);
    this._data = normalized.data;
    this.declaredChildrenAtPath = normalized.declaredChildrenAtPath;
    this.declaredRootCount = normalized.declaredRootCount;
    this._dataTruncated = normalized.truncated;
    this.requestUpdate('data', previous);
  }

  /** Whether normalization omitted malformed, over-depth, or over-budget data. */
  get dataTruncated(): boolean {
    return this._dataTruncated;
  }
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

  private _selection: TreeSelection = 'single';
  /** Selection behavior. Multiple modes cascade through enabled descendants and expose checkboxes.
   * @default 'single' */
  @property()
  get selection(): TreeSelection {
    return this._selection;
  }
  set selection(value: TreeSelection) {
    const old = this._selection;
    const normalized = TREE_SELECTIONS.has(value) ? value : 'single';
    if (old === normalized) return;
    this._selection = normalized;
    this.selectionSyncPending = true;
    this.requestUpdate('selection', old);
  }

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
  /** First depth-first path owning each public data id, plus the ids seen at later paths. */
  private dataIdOwnerPaths: ReadonlyMap<string, string> = new Map();
  private dataIdCollisions: ReadonlySet<string> = new Set();
  private selectionSyncPending = true;
  private dataSyncPending = false;
  /** Set when the child observer reports an `inert` attribute mutation, consumed by
   *  `resolveActiveFromDom()`'s focus repair below. */
  private inertMutationPending = false;
  /** The last item this tree saw take real focus. Read only as corroboration that a focus loss the
   *  platform caused (see `resolveActiveFromDom()`) actually happened *here*. */
  private lastFocusedNodeId: string | null = null;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  private pendingReorder?: PendingTreeReorder;

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

  /** Whether `node` can hold the roving `tabindex` and receive arrow-key focus. `inert` counts
   *  alongside `isDisabled` — see `isInertWithin()`. Deliberately *not* consulted by the selection
   *  engine: an inert subtree is temporarily non-interactive, not deselected, and a modal inerting
   *  the page must never silently wipe a tree's selection. */
  private isNavigable(node: LyraTreeItem): boolean {
    return !node.isDisabled && !isInertWithin(node, this);
  }

  /** Every item in document order, including descendants of collapsed branches. */
  private allNodeElements(): LyraTreeItem[] {
    const result: LyraTreeItem[] = [];
    const seen = new Set<LyraTreeItem>();
    const stack = this.nodeElements
      .map((node) => ({ node, depth: 0 }))
      .reverse();
    while (stack.length > 0 && result.length < TREE_MAX_RENDER_NODES) {
      const { node, depth } = stack.pop()!;
      if (seen.has(node)) continue;
      seen.add(node);
      result.push(node);
      if (depth >= TREE_MAX_RENDER_DEPTH) continue;
      const children = this.childrenOf(node);
      for (let index = children.length - 1; index >= 0; index--) {
        stack.push({ node: children[index]!, depth: depth + 1 });
      }
    }
    return result;
  }

  /** The current selected item elements in document order. */
  get selectedItems(): readonly LyraTreeItem[] {
    return Object.freeze(this.allNodeElements().filter((node) => node.selected));
  }

  private iconSource(name: 'expand-icon' | 'collapse-icon'): Element | null {
    return this.querySelector(`:scope > [slot="${name}"]`);
  }

  private applyTreeContext(): void {
    const expandIcon = this.iconSource('expand-icon');
    const collapseIcon = this.iconSource('collapse-icon');
    const roots = this.nodeElements;
    const rootCount = this.hasAuthoredItems ? roots.length : this.declaredRootCount;
    const stack: Array<{
      node: LyraTreeItem;
      ancestry: readonly LyraTreeNodeData[];
      depth: number;
      setSize: number;
      posInSet: number;
      identity?: TreeIdentityContext;
    }> = [];
    for (let index = roots.length - 1; index >= 0; index--) {
      stack.push({
        node: roots[index]!,
        ancestry: [],
        depth: 0,
        setSize: rootCount,
        posInSet: index + 1,
        identity: this.hasAuthoredItems ? undefined : this.treeIdentityAt(String(index)),
      });
    }
    const seen = new Set<LyraTreeItem>();
    while (stack.length > 0 && seen.size < TREE_MAX_RENDER_NODES) {
      const frame = stack.pop()!;
      if (seen.has(frame.node)) continue;
      seen.add(frame.node);
      configureTreeItemOwner(frame.node, {
        ...treeItemOwnerContext(frame.node),
        activeId: this.activeId,
        ancestry: frame.ancestry,
        depth: frame.depth,
        setSize: frame.setSize,
        posInSet: frame.posInSet,
        selection: this.selection,
        ownsSelection: true,
        identity: frame.identity,
        expandIcon,
        collapseIcon,
      });
      if (frame.depth >= TREE_MAX_RENDER_DEPTH) continue;
      const children = this.childrenOf(frame.node);
      const declaredCount =
        frame.identity?.declaredChildrenAtPath.get(frame.identity.path) ??
        frame.node.item?.children?.length ??
        children.length;
      const childAncestry = frame.node.item
        ? [...frame.ancestry, frame.node.item]
        : frame.ancestry;
      for (let index = children.length - 1; index >= 0; index--) {
        const identity = frame.identity
          ? {
              path: `${frame.identity.path}/${index}`,
              ownerPaths: frame.identity.ownerPaths,
              collisionIds: frame.identity.collisionIds,
              declaredChildrenAtPath: frame.identity.declaredChildrenAtPath,
            }
          : undefined;
        stack.push({
          node: children[index]!,
          ancestry: childAncestry,
          depth: frame.depth + 1,
          setSize: declaredCount,
          posInSet: index + 1,
          identity,
        });
      }
    }
  }

  private selectableInSingleMode(node: LyraTreeItem): boolean {
    return !node.isDisabled && (this.selection !== 'leaf' || !node.hasChildren);
  }

  private normalizeSingleSelection(): void {
    let kept = false;
    for (const node of this.allNodeElements()) {
      const selected = !kept && node.selected && this.selectableInSingleMode(node);
      setTreeItemSelection(node, selected, false);
      if (selected) kept = true;
    }
  }

  private setBranchSelection(node: LyraTreeItem, selected: boolean, leavesOnly: boolean): void {
    const stack = [node];
    const seen = new Set<LyraTreeItem>();
    while (stack.length > 0 && seen.size < TREE_MAX_RENDER_NODES) {
      const current = stack.pop()!;
      if (seen.has(current) || current.isDisabled) continue;
      seen.add(current);
      const children = this.childrenOf(current).filter((child) => !child.isDisabled);
      if (!leavesOnly || children.length === 0) {
        // A lazy node with no loaded children is still a branch, not a selectable leaf.
        setTreeItemSelection(current, leavesOnly && current.hasChildren ? false : selected, false);
      } else {
        setTreeItemSelection(current, false, false);
      }
      for (let index = children.length - 1; index >= 0; index--) stack.push(children[index]!);
    }
  }

  private deriveMultipleSelection(
    node: LyraTreeItem,
    leavesOnly: boolean,
  ): 'all' | 'some' | 'none' | 'ignored' {
    type SelectionState = 'all' | 'some' | 'none' | 'ignored';
    const states = new Map<LyraTreeItem, SelectionState>();
    const stack: Array<{ item: LyraTreeItem; visited: boolean }> = [{ item: node, visited: false }];
    const queued = new Set<LyraTreeItem>();
    while (stack.length > 0) {
      const entry = stack.pop()!;
      if (entry.visited) {
        const current = entry.item;
        if (current.isDisabled) {
          setTreeItemSelection(current, false, false);
          states.set(current, 'ignored');
          continue;
        }
        const children = this.childrenOf(current).filter((child) => !child.isDisabled);
        if (children.length === 0) {
          if (leavesOnly && current.hasChildren) {
            setTreeItemSelection(current, false, false);
            states.set(current, 'none');
          } else {
            setTreeItemSelection(current, current.selected, false);
            states.set(current, current.selected ? 'all' : 'none');
          }
          continue;
        }
        const childStates = children.map((child) => states.get(child) ?? 'ignored').filter((state) => state !== 'ignored');
        if (childStates.length === 0) {
          setTreeItemSelection(current, false, false);
          states.set(current, 'none');
          continue;
        }
        const all = childStates.every((state) => state === 'all');
        const none = childStates.every((state) => state === 'none');
        setTreeItemSelection(current, all, !all && !none);
        states.set(current, all ? 'all' : none ? 'none' : 'some');
        continue;
      }
      if (queued.size >= TREE_MAX_RENDER_NODES) continue;
      if (queued.has(entry.item)) continue;
      queued.add(entry.item);
      stack.push({ item: entry.item, visited: true });
      const children = this.childrenOf(entry.item);
      for (let index = children.length - 1; index >= 0; index--) {
        if (!queued.has(children[index]!)) stack.push({ item: children[index]!, visited: false });
      }
    }
    return states.get(node) ?? 'none';
  }

  private normalizeMultipleSelection(): void {
    const leavesOnly = this.selection === 'leaf-multiple';
    // A preselected branch means "select this branch" on initial markup/data reconciliation.
    // Apply that intent before deriving parent states from descendants.
    for (const node of this.allNodeElements()) {
      if (node.selected && this.childrenOf(node).length > 0) {
        this.setBranchSelection(node, true, leavesOnly);
      }
    }
    for (const root of this.nodeElements) this.deriveMultipleSelection(root, leavesOnly);
  }

  private normalizeSelection(): void {
    if (this.selection === 'single' || this.selection === 'leaf') this.normalizeSingleSelection();
    else this.normalizeMultipleSelection();
  }

  private selectionSignature(): string {
    return this.allNodeElements()
      .map((node) => `${node.nodeId}:${node.selected ? 1 : 0}:${node.indeterminate ? 1 : 0}`)
      .join('|');
  }

  private updateSelectionFrom(node: LyraTreeItem): boolean {
    if (node.isDisabled) return false;
    const before = this.selectionSignature();
    if (this.selection === 'single' || this.selection === 'leaf') {
      if (!this.selectableInSingleMode(node)) return false;
      for (const candidate of this.allNodeElements()) {
        setTreeItemSelection(candidate, candidate === node, false);
      }
    } else {
      const select = node.indeterminate || !node.selected;
      this.setBranchSelection(node, select, this.selection === 'leaf-multiple');
      for (const root of this.nodeElements) {
        this.deriveMultipleSelection(root, this.selection === 'leaf-multiple');
      }
    }
    return before !== this.selectionSignature();
  }

  /** Recomputed from the DOM rather than tracked incrementally: children can be added by the parser,
   *  by a framework re-render, or by `syncNodes()` itself, and only the generated-node set is a
   *  reliable discriminator. */
  private refreshAuthoredItems(): void {
    const nodes = this.nodeElements;
    for (const node of nodes) {
      // A nested item promoted to the top level still carries the `slot` its former parent item
      // assigned it, and this element has only a default slot -- leaving it there would assign the
      // node to nothing at all, so it would silently render nowhere while still counting as an item.
      if (node.hasAttribute('slot')) node.removeAttribute('slot');
    }
    const authored = nodes.some((node) => !this.generatedNodes.has(node));
    // Once author-written items exist, the data model is genuinely absent rather than merely
    // ignored by the controller. Keeping generated nodes in the slot would still expose them to
    // rendering, focus navigation, selection, and assistive technology, interleaving both models.
    if (authored) {
      for (const node of nodes) {
        if (this.generatedNodes.has(node)) node.remove();
      }
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
    const seen = new Set<LyraTreeItem>();
    const stack = this.nodeElements
      .map((node) => ({ node, depth: 0 }))
      .reverse();
    while (stack.length > 0 && acc.length < TREE_MAX_RENDER_NODES) {
      const { node, depth } = stack.pop()!;
      if (seen.has(node)) continue;
      seen.add(node);
      // Skipping the whole branch, not just this node: an inert item inerts its own descendants
      // too, so none of them can take focus either.
      if (!this.isNavigable(node)) continue;
      acc.push(node);
      if (!node.expanded || depth >= TREE_MAX_RENDER_DEPTH) continue;
      const children = this.childrenOf(node);
      for (let index = children.length - 1; index >= 0; index--) {
        stack.push({ node: children[index]!, depth: depth + 1 });
      }
    }
    return acc;
  }

  private findItem(items: readonly LyraTreeNodeData[], id: string): LyraTreeNodeData | undefined {
    const stack = [...items].reverse();
    const seen = new Set<LyraTreeNodeData>();
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

  private isDuplicateDataPath(item: LyraTreeNodeData, path: string): boolean {
    return this.dataIdCollisions.has(item.id) && this.dataIdOwnerPaths.get(item.id) !== path;
  }

  /** Analyze every reachable occurrence without recursion so adversarially deep data cannot
   * overflow the call stack. Cycles count the repeated rendered occurrence, then stop at it. */
  private rebuildDataIdentity(): void {
    const ownerPaths = new Map<string, string>();
    const collisionIds = new Set<string>();
    const ancestry = new Set<LyraTreeNodeData>();
    const stack: Array<{
      items: readonly LyraTreeNodeData[];
      index: number;
      parentPath: string;
      depth: number;
      owner?: LyraTreeNodeData;
    }> = [{ items: this.data, index: 0, parentPath: '', depth: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      if (frame.index >= frame.items.length) {
        if (frame.owner) ancestry.delete(frame.owner);
        stack.pop();
        continue;
      }
      const index = frame.index++;
      const item = frame.items[index];
      if (!item) continue;
      const path = frame.parentPath === '' ? String(index) : `${frame.parentPath}/${index}`;
      if (ownerPaths.has(item.id)) collisionIds.add(item.id);
      else ownerPaths.set(item.id, path);

      if (frame.depth >= TREE_MAX_RENDER_DEPTH || ancestry.has(item) || !item.children?.length) continue;
      ancestry.add(item);
      stack.push({
        items: item.children,
        index: 0,
        parentPath: path,
        depth: frame.depth + 1,
        owner: item,
      });
    }

    this.dataIdOwnerPaths = ownerPaths;
    this.dataIdCollisions = collisionIds;
  }

  private treeIdentityAt(path: string): TreeIdentityContext {
    return {
      path,
      ownerPaths: this.dataIdOwnerPaths,
      collisionIds: this.dataIdCollisions,
      declaredChildrenAtPath: this.declaredChildrenAtPath,
    };
  }

  private firstEnabledId(items: readonly LyraTreeNodeData[]): string | null {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item || item.disabled || this.isDuplicateDataPath(item, String(index))) continue;
      return item.id;
    }
    return null;
  }

  private isEnabledReachableId(items: readonly LyraTreeNodeData[], id: string): boolean {
    const stack = items
      .map((item, index) => ({ item, path: String(index) }))
      .reverse();
    const seen = new Set<LyraTreeNodeData>();
    while (stack.length > 0) {
      const { item, path } = stack.pop()!;
      if (seen.has(item)) continue;
      seen.add(item);
      if (item.disabled || this.isDuplicateDataPath(item, path)) continue;
      if (item.id === id) return true;
      if (item.children) {
        for (let i = item.children.length - 1; i >= 0; i--) {
          const child = item.children[i];
          if (child) stack.push({ item: child, path: `${path}/${i}` });
        }
      }
    }
    return false;
  }

  /** Resolve the exact rendered sibling list for either child model. Data descendants live in
   * their parent item's shadow root; declarative descendants remain light-DOM children. */
  private findRenderedSiblings(
    node: LyraTreeItem,
  ): { parent: LyraTreeItem | null; siblings: LyraTreeItem[]; index: number } | undefined {
    const root = node.getRootNode() as Document | ShadowRoot;
    const shadowHost = 'host' in root ? root.host : null;
    const shadowParent = shadowHost?.localName === tag('tree-item') ? (shadowHost as LyraTreeItem) : null;
    const lightParent =
      node.parentElement?.localName === tag('tree-item') ? (node.parentElement as LyraTreeItem) : null;
    const parentItem = shadowParent ?? lightParent;
    const siblings = parentItem ? parentItem.childItems() : this.nodeElements;
    const index = siblings.indexOf(node);
    if (index < 0) return undefined;
    return { parent: parentItem, siblings, index };
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
    const active = deepActiveElementIn(this.ownerDocument);
    if (!active || active.localName !== tag('tree-item')) return null;
    const node = active as LyraTreeItem;
    return this.visibleNodeElements().some((n) => n.nodeId === node.nodeId) ? node : null;
  }

  /**
   * The declarative child model's answer to the `data`-driven `activeId` resolution below: there is
   * no `data` change to hang it off, so it is re-derived from the DOM on every update instead. If
   * `activeId` no longer names a currently *visible* node -- removed, disabled, inert, or hidden
   * inside a collapsed ancestor -- the first visible one takes over, so the tree never ends up with zero
   * `tabindex="0"` stops and silently drops out of the tab order. Deliberately in `willUpdate()`
   * rather than `updated()`: the nodes are light-DOM children, so they already exist before this
   * element renders, and assigning here folds into the current update instead of scheduling
   * another one.
   */
  private resolveActiveFromDom(): void {
    const inertMutation = this.inertMutationPending;
    this.inertMutationPending = false;
    const visible = this.visibleNodeElements();
    if (visible.some((node) => node.nodeId === this.activeId)) return;
    const displaced = this.activeId;
    this.activeId = visible[0]?.nodeId ?? null;
    // An item that becomes `inert` while it holds real DOM focus is dropped by the platform, and
    // focus lands on `<body>` -- outside this tree's own delegated keydown handler, so every later
    // arrow press dies with no visible cause. Hand it to the newly-resolved roving target instead.
    // Guarded three ways so this can never *steal* focus: an `inert` mutation must actually have
    // arrived, the displaced item must be the one this tree last saw focused, and focus must be
    // stranded rather than on something that legitimately claimed it. "Stranded" covers both
    // orderings observed in Chromium: focus already dropped to `<body>`, or still nominally parked
    // on the now-inert item (the drop is deferred past this microtask, but that item can no longer
    // be re-focused or receive input either way).
    if (!inertMutation || this.activeId == null) return;
    if (displaced == null || displaced !== this.lastFocusedNodeId) return;
    const ownerDocument = this.ownerDocument;
    const active = deepActiveElementIn(ownerDocument);
    const strandedOnDisplaced =
      active?.nodeType === 1 &&
      active.localName === tag('tree-item') &&
      (active as LyraTreeItem).nodeId === displaced;
    if (active !== null && active !== ownerDocument.body && !strandedOnDisplaced) return;
    this.pendingFocusId = this.activeId;
  }

  /** Remembers which item last held real focus -- see `resolveActiveFromDom()`'s focus repair. */
  private onTreeFocusIn = (e: FocusEvent): void => {
    const item = e.composedPath().find(
      (target): target is LyraTreeItem =>
        (target as Partial<Node>).nodeType === 1 &&
        (target as Partial<Element>).localName === tag('tree-item'),
    );
    if (item) this.lastFocusedNodeId = item.nodeId;
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // The declarative child model owns the hierarchy outright: `data` is ignored (and never
    // reconciled into the light DOM) for as long as any author-written item is present, so the
    // two models can never interleave into one ambiguous tree.
    this.refreshAuthoredItems();
    if (changed.has('data') || changed.has('selection')) this.selectionSyncPending = true;
    if (this.hasAuthoredItems) {
      this.resolveActiveFromDom();
      return;
    }
    if (changed.has('data') || this.dataSyncPending) {
      this.dataSyncPending = false;
      const focused = this.deepFocusedNode();
      const focusedId = focused?.nodeId ?? null;
      this.rebuildDataIdentity();
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
    // `LyraTreeNodeData` has no `inert` field, but a consumer can still mark a *generated* node inert
    // through the DOM. Nothing else re-checks `activeId` against the live elements in this model,
    // so without this the roving `tabindex` would stay parked on a node that refuses focus. Also
    // what clears the flag, so a mutation can never outlive the update it raised.
    if (this.inertMutationPending) this.resolveActiveFromDom();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('activeId') || changed.has('data') || this.hasAuthoredItems) {
      const nodes = this.nodeElements;
      const count = this.hasAuthoredItems ? nodes.length : this.declaredRootCount;
      nodes.forEach((node, i) => {
        configureTreeItemOwner(node, {
          ...treeItemOwnerContext(node),
          activeId: this.activeId,
          ancestry: [],
          depth: 0,
          setSize: count,
          posInSet: i + 1,
          selection: this.selection,
          ownsSelection: true,
          identity: this.hasAuthoredItems ? undefined : this.treeIdentityAt(String(i)),
          expandIcon: this.iconSource('expand-icon'),
          collapseIcon: this.iconSource('collapse-icon'),
        });
      });
    }
  }

  /** Children changed: re-derive which child model is in play, and (via the requested update)
   *  re-resolve the roving tabindex. Covers author-written items arriving from the HTML parser or
   *  a framework re-render *after* this element first updated -- the case `willUpdate()`'s
   *  synchronous read cannot see -- and the active node being removed, which changes nothing
   *  about `hasAuthoredItems` and so would otherwise schedule no update at all. */
  private onChildrenChanged = (): void => {
    const wasAuthored = this.hasAuthoredItems;
    this.refreshAuthoredItems();
    if (wasAuthored && !this.hasAuthoredItems) this.dataSyncPending = true;
    this.selectionSyncPending = true;
    this.requestUpdate();
  };

  /** `slotchange` sees an assignment change but not a child that never becomes assigned -- a node
   *  moved here still carrying its old parent item's `slot="children"` is exactly that, and
   *  `refreshAuthoredItems()` is what un-strands it. Subtree observation also catches nested
   *  `selected`/`disabled`/`lazy` changes because those affect the tree-owned selection engine;
   *  each item still owns its own child-slot reconciliation. */
  private childObserver?: MutationObserver;
  private childObserverDocument?: Document;
  private childObserverGeneration = 0;

  /** The observer's own entry point: it additionally records whether an `inert` toggle was among
   *  the records, which `resolveActiveFromDom()` needs to tell a platform-caused focus loss apart
   *  from any other reason the active item stopped being navigable. */
  private onChildMutations = (records: MutationRecord[]): void => {
    if (records.some((record) => record.attributeName === 'inert')) this.inertMutationPending = true;
    this.onChildrenChanged();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.armChildObserver();
  }

  private armChildObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.childObserver && this.childObserverDocument === ownerDocument) return;
    this.resetChildObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.childObserverGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.childObserver !== observer ||
        this.childObserverDocument !== ownerDocument ||
        this.childObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onChildMutations(records);
    });
    this.childObserver = observer;
    this.childObserverDocument = ownerDocument;
    observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['selected', 'disabled', 'inert', 'lazy'],
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pendingReorder = undefined;
    this.resetChildObserver();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetChildObserver();
  }

  private resetChildObserver(): void {
    this.childObserverGeneration += 1;
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.childObserverDocument = undefined;
  }

  /** By-id reconciliation of top-level items: reuses/reorders existing `<lr-tree-item>` elements and removes ones no longer present in `data`. */
  private syncNodes(): void {
    const existingById = new Map<string, LyraTreeItem[]>();
    for (const node of this.nodeElements) {
      if (!node.item) continue;
      const matches = existingById.get(node.item.id) ?? [];
      matches.push(node);
      existingById.set(node.item.id, matches);
    }
    let previousSibling: LyraTreeItem | null = null;
    for (let index = 0; index < this.data.length; index++) {
      const item = this.data[index]!;
      const matches = existingById.get(item.id);
      let node = matches?.shift();
      if (!node) {
        node = this.ownerDocument.createElement(tag('tree-item')) as LyraTreeItem;
        this.generatedNodes.add(node);
      }
      node.item = item;
      configureTreeItemOwner(node, {
        ...treeItemOwnerContext(node),
        ancestry: [],
        depth: 0,
        setSize: this.declaredRootCount,
        posInSet: index + 1,
        selection: this.selection,
        ownsSelection: true,
        identity: this.treeIdentityAt(String(index)),
        expandIcon: this.iconSource('expand-icon'),
        collapseIcon: this.iconSource('collapse-icon'),
      });
      const targetPosition: Element | null = previousSibling
        ? previousSibling.nextElementSibling
        : this.firstElementChild;
      if (targetPosition !== node) this.insertBefore(node, targetPosition);
      previousSibling = node;
    }
    for (const nodes of existingById.values()) for (const node of nodes) node.remove();
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
    const id = (e as CustomEvent<{ nodeId: string }>).detail.nodeId;
    const node = this.allNodeElements().find((candidate) => candidate.nodeId === id);
    if (node && !node.isDisabled) {
      this.activeId = id;
      if (e.type === 'lr-node-toggle') {
        this.selectionSyncPending = true;
        this.requestUpdate();
      }
    }
  };

  private onNodeSelect = (event: Event): void => {
    const id = (event as CustomEvent<{ nodeId: string }>).detail.nodeId;
    const node = this.allNodeElements().find((candidate) => candidate.nodeId === id);
    if (!node || node.isDisabled) return;
    this.activeId = id;
    if (!this.updateSelectionFrom(node)) return;
    this.emit('lr-selection-change', Object.freeze({ selection: this.selectedItems }));
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
    this.applyTreeContext();
    if (this.selectionSyncPending) {
      this.selectionSyncPending = false;
      this.normalizeSelection();
    }
    await cascadeUpdateComplete(this.nodeElements);
    this.confirmPendingReorder();
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
    const found = this.findRenderedSiblings(node);
    if (!found) return;
    const { parent, siblings, index } = found;
    const total = siblings.length;
    const toIndex = index + delta;
    if (toIndex < 0 || toIndex >= total) return;
    this.pendingReorder = {
      node,
      parent,
      originalSiblings: [...siblings],
      targetSibling: siblings[toIndex]!,
      fromIndex: index,
      toIndex,
    };
    this.emit('lr-reorder', {
      nodeId: id,
      parentNodeId: parent?.nodeId ?? null,
      fromIndex: index,
      toIndex,
    });
  }

  /** Announce only after the rendered sibling order proves that the host accepted the request.
   * Unrelated updates retain the request; a divergent sibling change rejects and clears it. */
  private confirmPendingReorder(): void {
    const pending = this.pendingReorder;
    if (!pending) return;
    const found = this.findRenderedSiblings(pending.node);
    if (!found) {
      this.pendingReorder = undefined;
      return;
    }
    const orderChanged =
      found.siblings.length !== pending.originalSiblings.length ||
      found.siblings.some((node, index) => node !== pending.originalSiblings[index]);
    if (!orderChanged) return;

    this.pendingReorder = undefined;
    if (
      found.parent !== pending.parent ||
      found.index !== pending.toIndex ||
      found.siblings[pending.fromIndex] !== pending.targetSibling
    ) {
      return;
    }
    this.liveRegion?.announce(
      this.localize('treeNodeMoved', undefined, {
        label: pending.node.nodeLabel,
        index: this.formatCount(found.index + 1),
        total: this.formatCount(found.siblings.length),
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
          if (
            child &&
            treeItemOwnerContext(child).depth > treeItemOwnerContext(current).depth
          ) {
            this.focusNode(child);
          }
        }
        break;
      case collapseKey:
        e.preventDefault();
        if (current.hasChildren && current.expanded) {
          current.collapse();
        } else {
          for (let i = currentIndex - 1; i >= 0; i--) {
            const sibling = visible[i];
            if (
              sibling &&
              treeItemOwnerContext(sibling).depth < treeItemOwnerContext(current).depth
            ) {
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
   *
   * Goes through each node's own `expand()` (rather than assigning `expanded`
   * directly) so a not-yet-loaded `lazy` node is routed through
   * `beginLazyLoad()` exactly as a click would -- `expand()` is the only code
   * path that emits `lr-lazy-load` and waits for children, so assigning
   * `expanded` directly here left a lazy node visually expanded with its
   * content never actually requested. It also keeps `expandAll()`'s
   * `lr-expand`/`lr-node-toggle` emits consistent with `collapseAll()`'s own
   * `collapse()` calls below. A lazy node whose children have not arrived yet
   * has none to recurse into, so `childrenOf(n)` naturally stops the walk
   * there without this method ever waiting on the external response.
   */
  async expandAll(): Promise<void> {
    const queue = this.nodeElements.map((node) => ({ node, depth: 0 }));
    const seen = new Set<LyraTreeItem>();
    for (let index = 0; index < queue.length && seen.size < TREE_MAX_RENDER_NODES; index++) {
      const { node, depth } = queue[index]!;
      if (seen.has(node)) continue;
      seen.add(node);
      if (node.isDisabled) node.expanded = false;
      else if (node.hasChildren) node.expand();
      await node.updateComplete;
      if (depth < TREE_MAX_RENDER_DEPTH) {
        queue.push(...this.childrenOf(node).map((child) => ({ node: child, depth: depth + 1 })));
      }
    }
  }

  /**
   * Collapse every node in the tree, recursively. Goes through each node's
   * own `collapse()` (rather than assigning `expanded` directly) so its
   * `lr-node-toggle` emit reaches `onNodeActivate` -- that keeps `activeId`
   * re-synced to a node that's still visible after collapsing, even when the
   * roving-tabindex target was a nested descendant whose ancestor's
   * `role="group"` is about to disappear.
   */
  async collapseAll(): Promise<void> {
    const focused = this.deepFocusedNode();
    const topLevel = this.nodeElements;
    const nodes = this.allNodeElements();
    for (let index = nodes.length - 1; index >= 0; index--) {
      const node = nodes[index]!;
      if (node.isDisabled) node.expanded = false;
      else node.collapse();
    }
    const activeTopLevel = this.hasAuthoredItems
      ? topLevel.some((node) => this.isNavigable(node) && node.nodeId === this.activeId)
      : this.data.some((item) => !item.disabled && item.id === this.activeId);
    if (!activeTopLevel) {
      this.activeId = this.hasAuthoredItems
        ? (topLevel.find((node) => this.isNavigable(node))?.nodeId ?? null)
        : this.firstEnabledId(this.data);
    }
    if (focused) this.pendingFocusId = this.activeId;
    await cascadeUpdateComplete(topLevel);
  }

  override render(): TemplateResult {
    return html`
      <div
        part="base tree"
        role="tree"
        aria-label=${this.label || this.getAttribute('aria-label') || nothing}
        aria-multiselectable=${String(this.selection === 'multiple' || this.selection === 'leaf-multiple')}
        @focusin=${this.onTreeFocusIn}
        @keydown=${this.onTreeKeyDown}
        @lr-node-toggle=${this.onNodeActivate}
        @lr-node-select=${this.onNodeSelect}
      >
        ${this.data.length === 0 && !this.hasAuthoredItems
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : nothing}
        <slot @slotchange=${this.onChildrenChanged}></slot>
        <slot name="expand-icon" hidden @slotchange=${this.onChildrenChanged}></slot>
        <slot name="collapse-icon" hidden @slotchange=${this.onChildrenChanged}></slot>
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
