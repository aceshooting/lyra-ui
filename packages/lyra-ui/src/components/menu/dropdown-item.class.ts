import { LyraMenuItem } from './menu-item.class.js';

/**
 * `<lyra-dropdown-item>` — the Web Awesome-compatible name for a menu item.
 * It is intentionally a subclass of `<lyra-menu-item>`, so it participates in
 * the same roving focus, checkbox, selection, and menu event contracts.
 *
 * @customElement lyra-dropdown-item
 * @slot - The item's label content.
 * @slot icon - Optional leading icon.
 */
export class LyraDropdownItem extends LyraMenuItem {}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-dropdown-item': LyraDropdownItem;
  }
}
