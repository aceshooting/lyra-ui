// Shared tree data types, extracted so `tree-node.class.ts` can type its `item` without importing
// from `tree.class.ts` (which imports `LyraTreeNode`'s type back from tree-node) -- that pair was a
// type-only import cycle. `tree.class.ts` re-exports these, so every public path is unchanged.

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
  /** Whether this item is the current selection. When set, the treeitem exposes
   * `aria-selected` and renders the matching selected state. */
  selected?: boolean;
  /** Removes this item from roving focus and prevents select/toggle activation. */
  disabled?: boolean;
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
