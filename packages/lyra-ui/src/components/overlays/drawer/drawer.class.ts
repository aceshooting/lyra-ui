import { property } from 'lit/decorators.js';
import { LyraDialog } from '../dialog/dialog.class.js';
import { styles } from './drawer.styles.js';

export type LyraDrawerPlacement = 'start' | 'end' | 'top' | 'bottom';

/**
 * `<lr-drawer>` — a modal panel anchored to one logical edge of the
 * viewport. It shares Lyra's dialog focus trap, Escape/backdrop dismissal,
 * scroll lock, top-layer promotion, stacking, accessible naming,
 * `show()`/`hide()`/`close()` surface, and the whole
 * `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide`/`lr-dialog-close` lifecycle — see
 * `<lr-dialog>` for all of it. Only the slide animation and `placement` are its own.
 *
 * @customElement lr-drawer
 * @slot - The drawer body.
 * @slot label - Rich header content, inherited from `<lr-dialog>`.
 * @slot header-actions - Extra header controls, inherited from `<lr-dialog>`.
 * @slot footer - Action buttons rendered in the footer row.
 * @event lr-show - The drawer is about to open. Cancelable.
 * @event lr-after-show - The drawer is open and has finished sliding in.
 * @event lr-hide - The drawer is about to close. Cancelable.
 * @event lr-after-hide - The drawer is closed and has finished sliding out.
 * @event lr-dialog-close - Inherited cancelable close event; detail is the dismissal reason.
 * The rendered CSS parts are inherited from `<lr-dialog>`: `backdrop`,
 * `panel`, `header`, `heading`, `header-actions`, `close-button`, `label`, `body`, and `footer`.
 * @cssprop --lr-drawer-width - Inline size for start/end drawers.
 * @cssprop --lr-drawer-height - Block size for top/bottom drawers.
 * @cssprop [--lr-drawer-enter-x=calc(-1 * var(--lr-size-1rem))] - Horizontal offset the panel
 *   slides in from, and back out to, for start/end drawers. Set per placement (and flipped under
 *   RTL) by the stylesheet.
 * @cssprop [--lr-drawer-enter-y=calc(-1 * var(--lr-size-1rem))] - Vertical offset the panel
 *   slides in from, and back out to, for top/bottom drawers. Set to `var(--lr-size-1rem)` for
 *   `bottom`.
 */
export class LyraDrawer extends LyraDialog {
  static override styles = [LyraDialog.styles, styles];

  /** Which edge the drawer slides in from. `end` by default, matching `wa-drawer`; it used to be
   *  `start`, so a mechanical rename silently moved every migrated drawer to the other side. */
  @property({ reflect: true }) placement: LyraDrawerPlacement = 'end';
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-drawer': LyraDrawer;
  }
}
