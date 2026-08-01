import { LyraMenuItem } from './menu-item.class.js';

/**
 * `<lr-dropdown-item>` — the Web Awesome-compatible name for a menu item.
 * It is intentionally a subclass of `<lr-menu-item>`, so it participates in
 * the same roving focus, checkbox, selection, and menu event contracts — and
 * in the same `size` ladder, including the `small`/`medium`/`large` spellings.
 *
 * @customElement lr-dropdown-item
 * @slot - The item's label content.
 * @slot icon - Optional leading icon.
 * @slot submenu - A nested `<lr-menu>` that opens beside this row.
 */
export class LyraDropdownItem extends LyraMenuItem {}

declare global {
  interface HTMLElementTagNameMap {
    'lr-dropdown-item': LyraDropdownItem;
  }
}
