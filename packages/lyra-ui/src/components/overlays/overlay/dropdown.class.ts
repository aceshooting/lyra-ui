import { LyraPopover } from './popover.class.js';

/**
 * `<lr-dropdown>` — a menu-role popover for action lists and consumer-supplied menu content.
 * For full roving-focus menu behavior, compose `<lr-menu>`; this primitive is useful when a
 * consumer owns the menu rows or needs a small migration-compatible trigger surface.
 *
 * Everything else — `show()`/`hide()`/`open`, the
 * `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide` lifecycle, `placement`/`distance`/
 * `skidding`/`for`, and the `arrow`/`arrow-placement`/`arrow-padding` trio — is inherited from
 * `<lr-popover>` unchanged.
 *
 * @customElement lr-dropdown
 * @slot trigger - The interactive trigger.
 * @slot - Menu content.
 * @event lr-show - The dropdown is about to open. Cancelable.
 * @event lr-after-show - The dropdown is open and its transition has finished.
 * @event lr-hide - The dropdown is about to close. Cancelable.
 * @event lr-after-hide - The dropdown is closed and its transition has finished.
 * @csspart trigger - The trigger wrapper.
 * @csspart popup - The positioned popup.
 * @csspart content - The content wrapper.
 * @csspart arrow - The arrow element, rendered only when `arrow` is set.
 * @cssprop --lr-overlay-max-inline-size - Maximum inline size of the popup (default `--lr-size-20rem`).
 * @cssprop [--lr-overlay-arrow-size=var(--lr-size-0-375rem)] - Half-width of the arrow square.
 */
export class LyraDropdown extends LyraPopover {
  constructor() {
    super();
    this.popupRole = 'menu';
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-dropdown': LyraDropdown; } }
