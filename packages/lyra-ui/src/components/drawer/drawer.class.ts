import { property } from 'lit/decorators.js';
import { LyraDialog } from '../dialog/dialog.class.js';
import { styles } from './drawer.styles.js';

export type LyraDrawerPlacement = 'start' | 'end' | 'top' | 'bottom';

/**
 * `<lr-drawer>` — a modal panel anchored to one logical edge of the
 * viewport. It shares Lyra's dialog focus trap, Escape/backdrop dismissal,
 * scroll lock, stacking, accessible naming, and cancelable close event.
 *
 * @customElement lr-drawer
 * @slot - The drawer body.
 * @slot footer - Action buttons rendered in the footer row.
 * @event lr-dialog-close - Inherited cancelable close event; detail is the dismissal reason.
 * The rendered CSS parts are inherited from `<lr-dialog>`: `backdrop`,
 * `panel`, `header`, `heading`, `close-button`, `label`, `body`, and `footer`.
 * @cssprop --lr-drawer-width - Inline size for start/end drawers.
 * @cssprop --lr-drawer-height - Block size for top/bottom drawers.
 */
export class LyraDrawer extends LyraDialog {
  static styles = [LyraDialog.styles, styles];

  @property({ reflect: true }) placement: LyraDrawerPlacement = 'start';
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-drawer': LyraDrawer;
  }
}
