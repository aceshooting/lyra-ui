// Shared tree data types, extracted so `tree-item.class.ts` can type its `item` without importing
// from `tree.class.ts` (which imports `LyraTreeItem`'s type back from tree-item) -- that pair was a
// type-only import cycle. `tree.class.ts` re-exports these, so every public path is unchanged.

import type { LyraVariant } from '../../../internal/variants.js';

/** Maximum rendered data-tree depth, shared with owner-side identity analysis. @internal */
export const TREE_MAX_RENDER_DEPTH = 64;

/** Selection behavior shared by the declarative and data-driven tree models. */
export type TreeSelection = 'single' | 'multiple' | 'leaf' | 'leaf-multiple';

/** Tone for a `TreeBadge` chip — the shared semantic tone. Kept as a local name so existing
 *  imports keep resolving. */
export type TreeBadgeTone = LyraVariant;

export interface TreeBadge {
  text: string;
  tone?: TreeBadgeTone;
  /** Accessible name override; falls back to `text` when omitted. */
  label?: string;
}

export interface TreeItem {
  /** Stable public identity, unique across every reachable item in one data tree. If invalid input
   * repeats an id, its first depth-first occurrence owns it and later occurrences fail closed as
   * disabled rows until the host supplies unique data. */
  id: string;
  label: string;
  /** Whether this item is the current selection. When set, the treeitem exposes
   * `aria-selected` and renders the matching selected state. */
  selected?: boolean;
  /** Removes this item from roving focus and prevents select/toggle activation. */
  disabled?: boolean;
  /** Marks children as asynchronously loadable. Assign a refreshed item with children (or
   * `lazy: false`) in response to `lr-lazy-load` to finish the pending expansion. */
  lazy?: boolean;
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

/** Internal identity analysis shared by the owner tree and its recursively rendered items.
 * @internal */
export interface TreeIdentityContext {
  path: string;
  ownerPaths: ReadonlyMap<string, string>;
  collisionIds: ReadonlySet<string>;
}
