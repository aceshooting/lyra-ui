// Shared tree data types, extracted so `tree-item.class.ts` can type its `item` without importing
// from `tree.class.ts` (which imports `LyraTreeItem`'s type back from tree-item) -- that pair was a
// type-only import cycle. `tree.class.ts` re-exports these, so every public path is unchanged.

import type { LyraVariant } from '../../../internal/variants.js';

/** Maximum rendered data-tree depth, shared with owner-side identity analysis. @internal */
export const TREE_MAX_RENDER_DEPTH = 64;

/** Maximum normalized/projected nodes owned by one tree instance. @internal */
export const TREE_MAX_RENDER_NODES = 1_000;

/** Selection behavior shared by the declarative and data-driven tree models. */
export type TreeSelection = 'single' | 'multiple' | 'leaf' | 'leaf-multiple';

export interface TreeBadge {
  readonly text: string;
  readonly tone?: LyraVariant;
  /** Accessible name override; falls back to `text` when omitted. */
  readonly label?: string;
}

export interface LyraTreeNodeData {
  /** Stable public identity, unique across every reachable item in one data tree. If invalid input
   * repeats an id, its first depth-first occurrence owns it and later occurrences fail closed as
   * disabled rows until the host supplies unique data. */
  readonly id: string;
  readonly label: string;
  /** Whether this item is the current selection. When set, the treeitem exposes
   * `aria-selected` and renders the matching selected state. */
  readonly selected?: boolean;
  /** Removes this item from roving focus and prevents select/toggle activation. */
  readonly disabled?: boolean;
  /** Marks children as asynchronously loadable. Assign a refreshed item with children (or
   * `lazy: false`) in response to `lr-lazy-load` to finish the pending expansion. */
  readonly lazy?: boolean;
  readonly children?: readonly LyraTreeNodeData[];
  /** Token-colored chips rendered after the row label. */
  readonly badges?: readonly TreeBadge[];
  /** Optional decorative leading content, such as an icon TemplateResult. */
  readonly icon?: unknown;
  /** Secondary visible row text. */
  readonly description?: string;
  /** Spoken treeitem name when it needs more context than the visible row. */
  readonly accessibleLabel?: string;
}

/** Internal identity analysis shared by the owner tree and its recursively rendered items.
 * @internal */
export interface TreeIdentityContext {
  readonly path: string;
  readonly ownerPaths: ReadonlyMap<string, string>;
  readonly collisionIds: ReadonlySet<string>;
  readonly declaredChildrenAtPath: ReadonlyMap<string, number>;
}
