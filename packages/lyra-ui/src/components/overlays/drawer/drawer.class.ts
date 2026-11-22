import { declaredDefaultConverter } from '../../../internal/converters.js';
import { property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { LyraDialog } from '../dialog/dialog.class.js';
import type { RegisteredAnimationSpec } from '../../../internal/registered-animation.js';
import { styles } from './drawer.styles.js';

export type LyraDrawerPlacement = 'start' | 'end' | 'top' | 'bottom';

/**
 * `<lr-drawer>` — a modal panel anchored to one logical edge of the
 * viewport. It shares Lyra's dialog focus trap, Escape/backdrop dismissal,
 * scroll lock, top-layer promotion, stacking, accessible naming,
 * `show()`/`hide()`/`close()` surface, and the whole
 * `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide`/`lr-close` lifecycle — see
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
 * @event lr-close-request - Inherited cancelable proposal with `{ reason }` detail.
 * @event lr-close - Inherited non-cancelable accepted dismissal with `{ reason }` detail.
 *   Removal while open uses reason `unmount`. Filter `event.target === event.currentTarget`
 *   to distinguish this drawer's dismissal from composed descendant notifications.
 * It inherits every `<lr-dialog>` CSS part unchanged, with one deliberate layout exception:
 * `<lr-dialog>`'s `[part="body"]` grows to fill the panel once a consumer sets
 * `--lr-dialog-height`, because that panel is otherwise content-sized. A drawer's panel is
 * unconditionally a definite size for every `placement`, so this component opts back out of that
 * growth — `body` keeps its natural content size and `footer` follows immediately after it, instead of always being pushed to the panel's
 * far edge. The inherited `fill-body` attribute opts back in: `body` grows to the panel and becomes
 * a column flex container whose slotted children fill it.
 * The `size` property, inherited unchanged from `<lr-dialog>`, caps the panel's `max-inline-size`
 * for `start`/`end` placements on the same six-step ladder documented there (`'m'`'s 32rem cap
 * exceeds the panel's own 24rem default inline size, so it stays a no-op at the default tier);
 * `top`/`bottom` placements are unaffected, since those axes are already unconditionally 100%.
 * Not to be confused with the drawer-specific `--size` CSS custom property below, which maps to
 * this same panel's own `inline-size`/`block-size` for the active axis.
 * @cssprop --size - Mapped drawer size for the active axis.
 * @cssprop [--lr-overlay-shadow-modal=var(--lr-shadow-l)] - Shared modal elevation of the panel; its
 *   default is one step below lr-dialog's, since the sheet is flush with three viewport edges.
 * @cssprop --backdrop-filter - Mapped backdrop-filter alias.
 * @cssprop --spacing - Web Awesome shared region spacing.
 * @cssprop --header-spacing - Shoelace header padding.
 * @cssprop --body-spacing - Shoelace body padding.
 * @cssprop --footer-spacing - Shoelace footer padding.
 * @cssprop --show-duration - Opening slide duration.
 * @cssprop --hide-duration - Closing slide duration.
 * @cssprop --lr-drawer-width - Inline size for start/end drawers.
 * @cssprop --lr-drawer-height - Block size for top/bottom drawers.
 * @cssprop [--lr-drawer-panel-bg=var(--lr-dialog-panel-bg)] - Fill of this drawer's panel only.
 *   Wins over the inherited `--lr-dialog-panel-bg`; neither reaches popups opened inside the
 *   drawer, unlike `--lr-overlay-surface`.
 * @cssprop [--lr-drawer-radius=0] - Corner radius of the panel. Square by default; `floating`
 *   changes the default to `--lr-overlay-radius`, and an explicit value here wins either way.
 * @cssprop [--lr-drawer-inset=var(--lr-space-s)] - Gap between a `floating` panel and the viewport
 *   (or, with `contained`, its containing block) on every side. The device safe-area insets still
 *   win wherever they are larger. Ignored unless `floating` is set.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner
 *   radius, read by the panel only when `floating` is set.
 * @cssprop [--lr-drawer-enter-x=calc(-1 * var(--lr-size-1rem))] - Horizontal offset the panel
 *   slides in from, and back out to, for start/end drawers. Its private default changes per
 *   placement (and flips under RTL); an inherited or direct public value remains authoritative.
 * @cssprop [--lr-drawer-enter-y=calc(-1 * var(--lr-size-1rem))] - Vertical offset the panel
 *   slides in from, and back out to, for top/bottom drawers. Its private default becomes
 *   `var(--lr-size-1rem)` for `bottom`; an inherited or direct public value remains authoritative.
 * @status stable
 * @since 4.0.0
 */
export class LyraDrawer extends LyraDialog {
  static override styles = [LyraDialog.styles, styles];

  /** Which edge the drawer slides in from. `end` by default, matching `wa-drawer`; it used to be
   *  `start`, so a mechanical rename silently moved every migrated drawer to the other side. */
  @property({ reflect: true, converter: declaredDefaultConverter('end') })
  placement: LyraDrawerPlacement = 'end';

  /** Positions inside the nearest containing block without modal inerting, focus trapping,
   * scroll locking, top-layer promotion, backdrop, or Escape dismissal. */
  @property({ type: Boolean, reflect: true }) contained = false;

  /** Detaches the panel from the viewport edges as an inset, floating sheet: a
   *  `--lr-drawer-inset` gap on every side (default `var(--lr-space-s)`) and corners rounded with
   *  `--lr-overlay-radius`. Off by default, so the drawer stays square and edge-flush. Combines
   *  with `contained`, where the gap is measured from the containing block. */
  @property({ type: Boolean, reflect: true }) floating = false;

  protected override get modalSurface(): boolean {
    return !this.contained;
  }

  /** A mapped drawer's hide request is cancelable on every path, including external removal. */
  protected override get disconnectHideCancelable(): boolean {
    return true;
  }

  protected override panelAnimationName(showing: boolean): string {
    const placement = `${this.placement
      .charAt(0)
      .toUpperCase()}${this.placement.slice(1)}`;
    return `drawer.${showing ? 'show' : 'hide'}${placement}`;
  }

  protected override overlayAnimationName(showing: boolean): string {
    return showing ? 'drawer.overlay.show' : 'drawer.overlay.hide';
  }

  protected override panelAnimationSpec(
    showing: boolean
  ): RegisteredAnimationSpec {
    const block = this.placement === 'top' || this.placement === 'bottom';
    const offset = block
      ? 'translateY(var(--lr-drawer-enter-y, var(--_lr-drawer-enter-y, calc(-1 * var(--lr-size-1rem)))))'
      : 'translateX(var(--lr-drawer-enter-x, var(--_lr-drawer-enter-x, calc(-1 * var(--lr-size-1rem)))))';
    const resting = block ? 'translateY(0)' : 'translateX(0)';
    const keyframes = showing
      ? [
          { opacity: 0, transform: offset },
          { opacity: 1, transform: resting },
        ]
      : [
          { opacity: 1, transform: resting },
          { opacity: 0, transform: offset },
        ];
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
      this.deactivateOverlay({ restoreFocus: false });
      this.leaveTopLayer();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('contained') &&
      this.open &&
      this.isConnected &&
      this.modalSurface
    ) {
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
