import { property } from 'lit/decorators.js';
import { LyraMenuItem, type LyraMenuItemEventMap } from './menu-item.class.js';
import type { MenuFocusTarget } from './menu-shared.js';

export interface LyraDropdownItemEventMap extends LyraMenuItemEventMap {
  focus: FocusEvent;
  blur: FocusEvent;
}

/**
 * `<lr-dropdown-item>` — the Web Awesome-compatible name for a menu item.
 * It is intentionally a subclass of `<lr-menu-item>`, so it participates in
 * the same roving focus, checkbox, selection, and menu event contracts — and
 * in the same `size` ladder, including the `small`/`medium`/`large` spellings.
 *
 * @customElement lr-dropdown-item
 * @slot - The item's label content.
 * @slot icon - Optional leading icon.
 * @slot prefix - Shoelace-compatible leading content.
 * @slot details - WA-compatible secondary detail text.
 * @slot suffix - Shoelace-compatible trailing content.
 * @slot submenu - A nested `<lr-menu>` or direct mapped dropdown items that open beside this row.
 * @event focus - Native, non-bubbling, composed, non-cancelable `FocusEvent` emitted by the
 * focusable host when it gains focus.
 * @event blur - Native, non-bubbling, composed, non-cancelable `FocusEvent` emitted by the
 * focusable host when it loses focus.
 * @csspart base - The visual item row.
 * @csspart checkmark - WA-compatible checkbox glyph.
 * @csspart checked-icon - Shoelace-compatible checkbox-glyph wrapper.
 * @csspart icon - Leading icon wrapper.
 * @csspart prefix - Shoelace-compatible leading-content wrapper.
 * @csspart label - Label wrapper.
 * @csspart details - WA-compatible detail wrapper.
 * @csspart suffix - Shoelace-compatible trailing-content wrapper.
 * @csspart spinner - Loading spinner.
 * @csspart spinner__base - Shoelace-compatible spinner alias.
 * @csspart submenu-icon - Submenu chevron wrapper.
 * @csspart submenu - Submenu panel/wrapper.
 * @method openSubmenu - Opens the submenu and resolves after its open state settles.
 * @method closeSubmenu - Closes the submenu and resolves after its closed state settles.
 * @status stable
 * @since 4.0.0
 */
export class LyraDropdownItem extends LyraMenuItem {
  /** Whether the submenu is currently open. Assigning it, or changing the reflected
   * `submenu-open` attribute, drives the same panel as `openSubmenu()` / `closeSubmenu()` without
   * moving focus. Like those methods, it is a no-op until submenu content is connected.
   * @default false */
  @property({ type: Boolean, reflect: true, attribute: 'submenu-open' })
  override get submenuOpen(): boolean {
    return super.submenuOpen;
  }
  override set submenuOpen(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === super.submenuOpen) return;
    if (normalized) void super.openSubmenu('none');
    else void super.closeSubmenu();
  }

  /** Opens the submenu and resolves after the panel state and render settle. The optional focus
   * target preserves Lyra's existing menu-controller vocabulary while the no-argument call is the
   * mapped Web Awesome contract. */
  override async openSubmenu(focus: MenuFocusTarget = 'first'): Promise<void> {
    await super.openSubmenu(focus);
  }

  /** Closes the submenu and resolves after the panel state and render settle. */
  override async closeSubmenu(): Promise<void> {
    await super.closeSubmenu();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-dropdown-item': LyraDropdownItem;
  }
}
