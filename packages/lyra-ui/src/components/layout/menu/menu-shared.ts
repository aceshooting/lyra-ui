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

/** @internal Private activation bridge between a menu item and the menu that currently owns it.
 * Keeping this behind a symbol avoids publishing a second selection event solely for
 * child-to-parent plumbing. */
export const menuItemOwner = Symbol('lyra-menu-item-owner');

/** @internal */
export interface MenuItemOwner {
  activate(item: HTMLElement): void;
}

/** @internal */
export interface MenuItemOwned {
  [menuItemOwner](
    owner: MenuItemOwner | null,
    expectedOwner?: MenuItemOwner
  ): void;
}

/** @internal Private submenu presentation bridge. Root menus stay the exact inline semantic
 * controller mapped from Shoelace; only a menu item can attach this internal floating
 * presentation. */
export const submenuPanelController = Symbol('lyra-submenu-panel-controller');

/** @internal */
export interface SubmenuPanelController {
  readonly open: boolean;
  attach(anchor: HTMLElement, onStateChange: (open: boolean) => void): void;
  detach(anchor: HTMLElement): void;
  show(focus?: MenuFocusTarget): Promise<void>;
  hide(options?: { focusTrigger?: boolean }): Promise<void>;
}

/** @internal
 * The slice of `<lr-menu>`'s API an `<lr-menu-item>` drives when a menu is assigned to its
 * `submenu` slot. Declared structurally rather than imported for the cycle reason above; the
 * assigned element is matched by tag name, so an element that has not upgraded yet is simply not
 * treated as a submenu.
 */
export interface SubmenuPanel extends HTMLElement {
  readonly [submenuPanelController]: SubmenuPanelController;
  updateComplete?: Promise<unknown>;
}

/** @internal The small owner surface used when `<lr-menu>` supplies its interaction engine to
 * another trigger/popup component. Kept structural so the menu layer does not import an overlay
 * class. */
export interface ContainedMenuOwner {
  open: boolean;
  show(): void | Promise<void>;
  hide(options?: { focusTrigger?: boolean }): void | Promise<void>;
}
