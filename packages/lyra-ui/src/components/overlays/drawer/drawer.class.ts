import { property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { LyraDialog } from '../dialog/dialog.class.js';
import type { RegisteredAnimationSpec } from '../../../internal/registered-animation.js';
import { styles } from './drawer.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraDrawerPlacement = 'start' | 'end' | 'top' | 'bottom';

/**
 * `<lr-drawer>` — a modal panel anchored to one logical edge of the
 * viewport. It shares Lyra's dialog focus trap, Escape/backdrop dismissal,
 * scroll lock, top-layer promotion, stacking, accessible naming,
 * `show()`/`hide()`/`close()` surface, and the whole
 * `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide`/`lr-dialog-close` lifecycle — see
 * `<lr-dialog>` for all of it. `contained` instead positions within the nearest containing block
 * as a nonmodal panel: no backdrop, inerting, focus trap, scroll lock, top layer, or global Escape.
 * Only that mode, the slide animation, `placement`, and the `--size` alias are drawer-specific.
 * The panel registry names are `drawer.showTop`/`hideTop`, `showEnd`/`hideEnd`,
 * `showBottom`/`hideBottom`, and `showStart`/`hideStart`; the scrim uses
 * `drawer.overlay.show`/`drawer.overlay.hide`.
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
 * @event lr-initial-focus - Inherited cancelable event before automatic modal focus movement.
 * @event lr-request-close - Inherited cancelable built-in dismissal request with a source detail.
 * @event lr-dialog-close - Inherited conditionally cancelable close event; detail is the dismissal
 *   reason. Ordinary dismissal can be vetoed; an `'unmount'` notification after external removal
 *   cannot be.
 * It inherits every `<lr-dialog>` CSS part unchanged.
 * @cssprop --size - Mapped drawer size for the active axis.
 * @cssprop --backdrop-filter - Mapped backdrop-filter alias.
 * @cssprop --spacing - Web Awesome shared region spacing.
 * @cssprop --header-spacing - Shoelace header padding.
 * @cssprop --body-spacing - Shoelace body padding.
 * @cssprop --footer-spacing - Shoelace footer padding.
 * @cssprop --show-duration - Opening slide duration.
 * @cssprop --hide-duration - Closing slide duration.
 * @cssprop --lr-drawer-width - Inline size for start/end drawers.
 * @cssprop --lr-drawer-height - Block size for top/bottom drawers.
 * @cssprop [--lr-drawer-enter-x=calc(-1 * var(--lr-size-1rem))] - Horizontal offset the panel
 *   slides in from, and back out to, for start/end drawers. Set per placement (and flipped under
 *   RTL) by the stylesheet.
 * @cssprop [--lr-drawer-enter-y=calc(-1 * var(--lr-size-1rem))] - Vertical offset the panel
 *   slides in from, and back out to, for top/bottom drawers. Set to `var(--lr-size-1rem)` for
 *   `bottom`.
 * @status stable
 * @since 4.0.0
 */
export class LyraDrawer extends LyraDialog {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraDialog.styles, styles];

  /** Which edge the drawer slides in from. `end` by default, matching `wa-drawer`; it used to be
   *  `start`, so a mechanical rename silently moved every migrated drawer to the other side. */
  @property({ reflect: true }) placement: LyraDrawerPlacement = 'end';

  /** Positions inside the nearest containing block without modal inerting, focus trapping,
   * scroll locking, top-layer promotion, backdrop, or Escape dismissal. */
  @property({ type: Boolean, reflect: true }) contained = false;

  protected override get modalSurface(): boolean {
    return !this.contained;
  }

  /** A mapped drawer's hide request is cancelable on every path, including external removal. */
  protected override get disconnectHideCancelable(): boolean {
    return true;
  }

  protected override panelAnimationName(showing: boolean): string {
    const placement = `${this.placement.charAt(0).toUpperCase()}${this.placement.slice(1)}`;
    return `drawer.${showing ? 'show' : 'hide'}${placement}`;
  }

  protected override overlayAnimationName(showing: boolean): string {
    return showing ? 'drawer.overlay.show' : 'drawer.overlay.hide';
  }

  protected override panelAnimationSpec(showing: boolean): RegisteredAnimationSpec {
    const block = this.placement === 'top' || this.placement === 'bottom';
    const offset = block
      ? 'translateY(var(--lr-drawer-enter-y, calc(-1 * var(--lr-size-1rem))))'
      : 'translateX(var(--lr-drawer-enter-x, calc(-1 * var(--lr-size-1rem))))';
    const resting = block ? 'translateY(0)' : 'translateX(0)';
    const keyframes = showing
      ? [{ opacity: 0, transform: offset }, { opacity: 1, transform: resting }]
      : [{ opacity: 1, transform: resting }, { opacity: 0, transform: offset }];
    return {
      keyframes,
      // The fallback itself resolves logical start/end through the live custom property. Keeping
      // an RTL branch also gives keyframes-only global overrides the same registry vocabulary.
      rtlKeyframes: keyframes,
      durationProperties: [
        showing ? '--show-duration' : '--hide-duration',
        '--lr-dialog-panel-duration',
        '--lr-duration-base',
      ],
      easingProperties: ['--lr-easing-standard'],
    };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!changed.has('contained') || !this.open) return;
    if (this.modalSurface && this.isConnected) this.activateOverlay();
    else {
      this.deactivateOverlay();
      this.leaveTopLayer();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('contained') && this.open && this.isConnected && this.modalSurface) {
      this.enterTopLayer();
      this.focusInitial();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-drawer': LyraDrawer;
  }
}
