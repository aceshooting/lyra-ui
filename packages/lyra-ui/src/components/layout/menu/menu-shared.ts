/**
 * Leaf module shared by `<lr-menu>` and `<lr-menu-item>`.
 *
 * A submenu makes the two components mutually dependent — the menu drives its items' submenus,
 * and an item drives the `<lr-menu>` assigned to its `submenu` slot. `menu.class.ts` already
 * imports `menu-item.class.ts`, so the return edge (even as `import type`, which the import-cycle
 * gate counts) would close a cycle. Everything both sides need therefore lives here instead.
 */

/**
 * Where roving focus lands when a menu opens. `'none'` opens without moving DOM focus at all —
 * what pointer-driven opening needs, so a submenu that appears under the cursor never yanks focus
 * away from the keyboard's current position (and never strands it on a hidden element when the
 * pointer moves on again).
 */
export type MenuFocusTarget = 'first' | 'last' | 'none';

/**
 * The slice of `<lr-menu>`'s API an `<lr-menu-item>` drives when a menu is assigned to its
 * `submenu` slot. Declared structurally rather than imported for the cycle reason above; the
 * assigned element is matched by tag name, so an element that has not upgraded yet is simply not
 * treated as a submenu.
 */
export interface SubmenuPanel extends HTMLElement {
  open: boolean;
  anchor: HTMLElement | null;
  show(focus?: MenuFocusTarget): void;
  hide(options?: { focusTrigger?: boolean }): void;
}
