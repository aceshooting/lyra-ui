export interface SequenceStripItem {
  readonly id: string;
  readonly categoryId: string;
  /** A small marker rendered at the bottom of this cell — a secondary boolean annotation
   *  independent of the primary category color (e.g. a subagent-dispatched turn). */
  readonly marker?: boolean;
  /** Per-item text shown in the hover/focus tooltip and exposed as the item's accessible name
   *  (falls back to the category's own `label`, or the localized unnamed-category label). */
  readonly label?: string;
  /**
   * Marks this item non-actionable: `aria-disabled="true"` replaces the selected/active
   * affordances of the cell that represents it, activating it (click, or Enter/Space while
   * roving-focused) emits nothing, and roving keyboard navigation (arrow keys, Home/End) steps
   * past it instead of landing on it. Above `MAX_RENDERED_CELLS`, one cell paints a whole RANGE of
   * items and activating it always resolves to that range's first item (`cell.start`, see
   * `activateCell()`), so a range cell's disabled state follows that same first item. Omitted or
   * `false` renders the item exactly as before this field existed.
   */
  readonly disabled?: boolean;
}
