import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { activateOverlay, type OverlayHandle } from '../../internal/overlay-manager.js';
import { nextId, srOnly } from '../../internal/a11y.js';
import { closeIcon, chevronIcon } from '../../internal/icons.js';
import { finiteCount } from '../../internal/numbers.js';
import { styles } from './lightbox.styles.js';
import '../zoomable-frame/zoomable-frame.class.js';
import type { LyraZoomableFrame } from '../zoomable-frame/zoomable-frame.class.js';

/** One image in the set `<lyra-lightbox>` browses. `alt`/`caption` are caller-supplied data
 *  (like a filename), not routed through `localize()` -- only the component's own chrome
 *  strings are. */
export interface LyraLightboxImage {
  /** Full-resolution URL. Passed straight through to the embedded `<lyra-zoomable-frame>`'s own
   *  `src`, which already runs it through `safeMediaSrc()` -- no separate validation needed here. */
  src: string;
  /** Accessible alt text. Defaults to `''` (decorative) when omitted; consumers should supply
   *  real alt text for meaningful images. */
  alt?: string;
  /** Optional visible caption for this image, rendered in `part="caption"` below the stage. */
  caption?: string;
}

/**
 * Reason a lightbox was dismissed, forwarded as the `lyra-lightbox-close` event detail --
 * 1:1 copy of `<lyra-dialog>`'s own `DialogCloseReason` contract. `'escape'` and `'backdrop'`
 * are emitted by the lightbox's own built-in dismiss triggers; `'close-button'` by the built-in
 * close button; `'unmount'` is emitted when the lightbox is removed from the DOM while still
 * open by something other than its own `close()`; any other string is whatever a caller passes
 * to `close()` directly.
 */
export type LyraLightboxCloseReason =
  | 'escape'
  | 'backdrop'
  | 'close-button'
  | 'api'
  | 'unmount'
  | (string & Record<never, never>);

export interface LyraLightboxEventMap {
  'lyra-lightbox-close': CustomEvent<LyraLightboxCloseReason>;
  'lyra-index-change': CustomEvent<{ index: number }>;
  /** Not emitted by `LyraLightbox` itself -- the embedded `<lyra-zoomable-frame>` already
   *  dispatches this via a composed, bubbling `emit()` call, which continues through this
   *  element's own shadow boundary with no re-dispatch needed. Listed here purely for
   *  discoverability. */
  'lyra-zoom-change': CustomEvent<{ zoom: number }>;
}

/**
 * `<lyra-lightbox>` — a full-screen, modal, click-to-enlarge image viewer with prev/next
 * navigation across an ordered set of images. It has no Web Awesome/Shoelace counterpart, so
 * its API follows this library's own conventions.
 *
 * **Not a form-associated control** -- no `label`/`hint`/`errorText` chrome; its
 * `accessibleLabel` only overrides the dialog's own accessible name. The native-wrapper/
 * editing-assistance-passthrough guarantees don't apply either (no internal `<input>`/
 * `<textarea>`).
 *
 * This renders its own dialog panel rather than nesting a `<lyra-dialog>` in its shadow
 * template -- shared overlay infrastructure (`src/internal/overlay-manager.ts`) coordinates
 * stacking, focus trapping, Escape/backdrop dismissal, scroll lock, and focus return with every
 * other overlay in the same document, the same way `<lyra-dialog>`/`<lyra-command-palette>`/
 * `<lyra-widget>` (fullscreen mode)/`<lyra-app-rail>` (mobile mode)/`<lyra-responsive-panel>`
 * already do. Per-image pan/zoom is delegated to one stable embedded `<lyra-zoomable-frame>`
 * instance (its `src`/`alt` swapped per navigation) rather than reimplementing pan/zoom --
 * composing a small sibling leaf component directly in the render template, the same way
 * `<lyra-tool-select-dialog>` composes `<lyra-checkbox>`/`<lyra-switch>`.
 *
 * Zoom/pan reset on navigation is imperative (`LyraZoomableFrame.resetView()`, called from
 * `updated()`) rather than a Lit property binding -- a binding whose value never changes across
 * renders (e.g. `.zoom=${1}`) would only apply once, silently failing to reset on the *second*
 * navigation once the user has interactively zoomed. Recreating the frame element on every
 * navigation (e.g. via Lit's `keyed()` directive) was considered and rejected: it would also
 * reset zoom/pan, but destroying/recreating the element would steal focus from a keyboard user
 * who had Tabbed into the frame's viewport mid-navigation.
 *
 * **Scope for v1 (deliberate, not oversights):** no default slot / no arbitrary slotted content
 * per image (data-driven via `images` only); no dot-style indicators (a textual counter scales
 * better to photo-set sizes); no open/close transition or animation (matches `<lyra-dialog>`'s
 * own precedent of having none -- `prefers-reduced-motion` has nothing to branch on here); no
 * click-on-image-to-navigate (the image is already meaningfully interactive -- it focuses the
 * zoomable frame's viewport and drives its native scroll-to-pan); no touch-swipe-to-navigate.
 *
 * @customElement lyra-lightbox
 * @slot actions - Optional extra toolbar buttons (e.g. download/share/delete), rendered in
 *   `part="toolbar"` between the counter and the close button.
 * @event lyra-lightbox-close - `detail: LyraLightboxCloseReason`. Cancelable -- a listener
 *   calling `preventDefault()` stops the lightbox from closing, for every dismissal path
 *   (Escape, backdrop, the built-in close button, or a consumer's own `close()` call). Fired
 *   whenever the lightbox is dismissed via Escape, a backdrop click, the built-in close button,
 *   a `close()` call, or (with reason `'unmount'`, not cancelable in practice since the element
 *   is already being removed) removal from the DOM by anything else while still open.
 * @event lyra-index-change - Fired only for internally-driven navigation (`next()`/
 *   `previous()`/`goTo()` invoked via a button click or a keyboard shortcut). Not fired when a
 *   consumer sets `index`/`images` directly. `detail: { index }`.
 * @event lyra-zoom-change - Not emitted by `LyraLightbox` itself -- see the interface doc above.
 *   `detail: { zoom }`.
 * @csspart backdrop - The full-viewport scrim, positioned behind `panel`.
 * @csspart panel - `role="dialog"` while open, `aria-modal="true"`, `tabindex="-1"`. Fills the
 *   padded safe area -- unlike `<lyra-dialog>`, it does not shrink-wrap to content, since
 *   maximizing image real estate is the point.
 * @csspart toolbar - Top row: `counter` (start), the `actions` slot wrapper, `close-button` (end).
 * @csspart counter - Visible, localized "Image N of Total" text. Omitted entirely when
 *   `showCounter` is `false`.
 * @csspart live-region - Visually-hidden, `role="status" aria-live="polite" aria-atomic="true"` --
 *   announces the current position on every `index` change while open, regardless of trigger
 *   (button, keyboard, or a consumer setting `index`/`images` directly), decoupled from the
 *   visible `counter` so an unrelated re-render never causes a spurious re-announcement.
 * @csspart actions - Wrapper around the `actions` slot; `hidden` when nothing is slotted.
 * @csspart close-button - The close button. Always rendered -- unlike `<lyra-dialog>`'s opt-in
 *   `closable`, a full-screen lightbox has no other built-in chrome, so this is not optional.
 * @csspart stage - Houses the embedded `<lyra-zoomable-frame>` plus the floating
 *   `previous-button`/`next-button`.
 * @csspart frame - The embedded `<lyra-zoomable-frame>` element itself. Its own internal parts
 *   are not re-exported via `exportparts` -- there is no precedent for `exportparts` anywhere in
 *   this codebase.
 * @csspart previous-button - Floating, absolutely positioned inside `stage`. Rendered only when
 *   `images.length > 1`.
 * @csspart previous-glyph - The `chevronIcon()` inside `previous-button`, mirrored under RTL.
 * @csspart next-button - Symmetric to `previous-button`.
 * @csspart next-glyph - Symmetric to `previous-glyph`.
 * @csspart caption - The current image's caption text. Only rendered when the current image's
 *   `caption` is non-empty. Its `id` is the `aria-describedby` target on `panel`.
 * @cssprop --lyra-lightbox-overlay-color - The backdrop scrim color.
 * @cssprop --lyra-lightbox-control-bg - Background for every floating/toolbar icon button.
 * @cssprop --lyra-lightbox-control-color - Icon/text color paired with `--lyra-lightbox-control-bg`.
 */
export class LyraLightbox extends LyraElement<LyraLightboxEventMap> {
  static styles = [LyraElement.styles, srOnly, styles];

  /** Whether the lightbox is open. Set this (or call `close()`) -- there is no separate
   *  `show()`/`hide()` pair, exactly mirrors `<lyra-dialog>`. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** The ordered set of images being browsed. */
  @property({ attribute: false }) images: LyraLightboxImage[] = [];

  /** The currently displayed image. Clamped defensively for rendering (out-of-range/negative/
   *  non-integer never throws) and silently re-synced onto this property (no event) when
   *  `images` shrinks -- mirrors `<lyra-carousel>`'s `normalizedIndex()`/`syncSlides()` split. */
  @property({ type: Number, reflect: true }) index = 0;

  /** Wraps prev/next past the ends. Mirrors `<lyra-carousel>`'s `loop` 1:1. */
  @property({ type: Boolean, reflect: true }) loop = false;

  /** Opts out of dismissing the lightbox on a backdrop click -- mirrors `<lyra-dialog>`'s
   *  `noLightDismiss` exactly (name, default, no reflect). */
  @property({ type: Boolean, attribute: 'no-light-dismiss' }) noLightDismiss = false;

  /** Shows/hides `part="counter"` (and its `part="live-region"` announcement). Mirrors
   *  `<lyra-carousel>`'s `showIndicators` (name shape, no reflect). */
  @property({ type: Boolean, attribute: 'show-counter' }) showCounter = true;

  /** Passed through to the embedded `<lyra-zoomable-frame>` as `.minZoom`. Same default as
   *  `<lyra-zoomable-frame>` itself. */
  // numeric-guard-exempt: pure pass-through to <lyra-zoomable-frame>, which already normalizes it via its own safeMinZoom
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.5;

  /** Passed through to the embedded `<lyra-zoomable-frame>` as `.maxZoom`. */
  // numeric-guard-exempt: pure pass-through to <lyra-zoomable-frame>, which already normalizes it via its own safeMaxZoom
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 4;

  /** Passed through to the embedded `<lyra-zoomable-frame>` as `.zoomStep`. */
  // numeric-guard-exempt: pure pass-through to <lyra-zoomable-frame>, which already normalizes it via its own safeZoomStep
  @property({ type: Number, attribute: 'zoom-step' }) zoomStep = 0.25;

  /** Host-level `aria-label` override for the panel's accessible name -- wins over the
   *  localized `lightboxLabel` default. Exactly `<lyra-zoomable-frame>`'s own `accessibleLabel`
   *  pattern (no other label source to arbitrate against here). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private hasActionsSlot = false;
  @state() private liveText = '';

  @query('lyra-zoomable-frame') private frameEl?: LyraZoomableFrame;

  private releaseScrollLock?: () => void;
  private overlay?: OverlayHandle;
  private readonly captionId = nextId('lightbox-caption');

  /** Clamped, always-valid index for rendering -- never throws on an out-of-range, negative,
   *  non-integer, or non-finite `index`. */
  private currentIndex(): number {
    const count = this.images.length;
    if (count === 0) return 0;
    return finiteCount(this.index, 0, count - 1);
  }

  // Silently re-syncs `index` onto the clamped value with no event -- mirrors
  // <lyra-carousel>'s syncSlides() clamp-without-event behavior, e.g. when `images` shrinks out
  // from under the current index.
  private syncImages(): void {
    const current = this.currentIndex();
    if (this.index !== current) this.index = current;
  }

  private changeTo(index: number): void {
    const count = this.images.length;
    if (count === 0) return;
    const next = this.loop ? ((index % count) + count) % count : Math.min(count - 1, Math.max(0, index));
    if (next === this.currentIndex()) return;
    this.index = next;
    this.emit('lyra-index-change', { index: next });
  }

  next = (): void => this.changeTo(this.currentIndex() + 1);
  previous = (): void => this.changeTo(this.currentIndex() - 1);
  goTo = (index: number): void => this.changeTo(index);

  /**
   * Close the lightbox and return focus to whatever had it before the lightbox opened. `reason`
   * is forwarded as the `lyra-lightbox-close` detail -- built-in triggers pass `'escape'`/
   * `'backdrop'`/`'close-button'`; a consumer's own close affordance (e.g. an `actions`-slotted
   * button) should call this directly with its own reason string.
   */
  close(reason: LyraLightboxCloseReason = 'api'): void {
    if (!this.open) return;
    const event = this.emit<LyraLightboxCloseReason>('lyra-lightbox-close', reason, { cancelable: true });
    if (event.defaultPrevented) return;
    this.open = false;
  }

  private updateLiveRegion(): void {
    const count = this.images.length;
    this.liveText =
      count === 0
        ? ''
        : this.localize('lightboxImagePosition', undefined, { index: this.currentIndex() + 1, total: count });
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    }
    if (changed.has('images') || changed.has('index')) {
      this.syncImages();
    }
    // Purely derived from already-current state (images/the just-synced index/strings/locale)
    // with no DOM measurement involved, so this belongs here, not in updated(): setting `liveText`
    // (a reactive property) from updated()/firstUpdated() schedules a *second* update on top of
    // the one that just finished, which Lit's dev-mode console flags ("scheduled an update ...
    // after an update completed") -- mirrors lyra-split's/lyra-virtual-list's identical
    // willUpdate()-not-updated() fix for their own derived-property writes.
    if (changed.has('index') || changed.has('images') || changed.has('strings') || changed.has('locale')) {
      this.updateLiveRegion();
    }
    if (changed.has('open')) {
      if (this.open) {
        this.activateOverlay();
      } else {
        this.deactivateOverlay();
      }
    }
  }

  // Runs after render so the manager can resolve the panel and its composed focus targets, and
  // so [part="panel"]/the embedded frame have already landed in the DOM.
  protected updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      this.overlay?.focusInitial();
    }
    // Imperative, not a binding -- see the class doc for why this is required for the reset to
    // keep working past the first navigation.
    if (changed.has('index') && this.open) {
      this.frameEl?.resetView();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no update in between, so
    // willUpdate never reruns to notice `open` is still true -- restore what it dropped.
    if (this.hasUpdated && this.open) {
      if (this.overlay?.isActive()) {
        this.overlay.resume();
        this.releaseScrollLock ??= lockScroll(this.ownerDocument);
      } else {
        this.activateOverlay();
      }
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.suspend();
    if (this.open) {
      // Deferred one microtask so a synchronous reparent (disconnect immediately followed by
      // reconnect) isn't mistaken for a real removal -- mirrors <lyra-dialog>'s identical
      // disconnectedCallback rationale.
      queueMicrotask(() => {
        if (!this.isConnected && this.open) {
          this.open = false;
          this.emit<LyraLightboxCloseReason>('lyra-lightbox-close', 'unmount');
        }
      });
    }
  }

  private activateOverlay(): void {
    if (this.overlay?.isActive()) return;
    this.releaseScrollLock ??= lockScroll(this.ownerDocument);
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close('escape'),
      onBackdrop: () => this.close('backdrop'),
      // An intentionally safe default action -- a full-screen image grabbing focus should hand
      // it to a predictable, always-present, non-destructive escape hatch first, rather than
      // whatever happens to be first in DOM tab order (which could otherwise be a consumer's own
      // actions-slot content if placed before close-button).
      preferredInitialFocus: () => this.shadowRoot?.querySelector<HTMLElement>('[part="close-button"]') ?? null,
    });
  }

  private deactivateOverlay(): void {
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.deactivate();
    this.overlay = undefined;
  }

  private onBackdropClick = (): void => {
    if (this.noLightDismiss) return;
    this.overlay?.dismissBackdrop();
  };

  private onCloseButtonClick = (): void => {
    this.close('close-button');
  };

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // RTL-aware, exactly mirroring <lyra-carousel>'s onViewportKeyDown. Attached on part="panel"
  // itself so it sees keydowns bubbling from anywhere inside, including from within the embedded
  // <lyra-zoomable-frame>'s own shadow tree. Never conflicts with the frame's own +/-/0/=/_ zoom
  // shortcuts, which don't intercept Arrow/Home/End.
  private onPanelKeyDown = (event: KeyboardEvent): void => {
    const rtl = this.effectiveDirection === 'rtl';
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forwardKey) {
      event.preventDefault();
      this.next();
    } else if (event.key === backwardKey) {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.goTo(this.images.length - 1);
    }
  };

  render(): TemplateResult {
    const count = this.images.length;
    const current = this.currentIndex();
    const image = count > 0 ? this.images[current] : undefined;
    const label = this.accessibleLabel ?? this.localize('lightboxLabel');
    const hasCaption = Boolean(image?.caption);
    const positionText =
      count > 0 ? this.localize('lightboxImagePosition', undefined, { index: current + 1, total: count }) : '';

    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-label=${label}
        aria-describedby=${hasCaption ? this.captionId : nothing}
        tabindex="-1"
        @keydown=${this.onPanelKeyDown}
      >
        <div part="toolbar">
          ${this.showCounter && count > 0 ? html`<span part="counter">${positionText}</span>` : nothing}
          <div part="actions" ?hidden=${!this.hasActionsSlot}>
            <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          </div>
          <button part="close-button" type="button" aria-label=${this.localize('close')} @click=${this.onCloseButtonClick}>
            ${closeIcon()}
          </button>
        </div>
        <div part="stage">
          ${count > 1
            ? html`
                <button
                  part="previous-button"
                  type="button"
                  aria-label=${this.localize('previous')}
                  ?disabled=${!this.loop && current === 0}
                  @click=${this.previous}
                >
                  <span part="previous-glyph">${chevronIcon()}</span>
                </button>
              `
            : nothing}
          <lyra-zoomable-frame
            part="frame"
            src=${image?.src ?? ''}
            alt=${image?.alt ?? ''}
            .minZoom=${this.minZoom}
            .maxZoom=${this.maxZoom}
            .zoomStep=${this.zoomStep}
            .accessibleLabel=${positionText || null}
          ></lyra-zoomable-frame>
          ${count > 1
            ? html`
                <button
                  part="next-button"
                  type="button"
                  aria-label=${this.localize('next')}
                  ?disabled=${!this.loop && current === count - 1}
                  @click=${this.next}
                >
                  <span part="next-glyph">${chevronIcon()}</span>
                </button>
              `
            : nothing}
        </div>
        ${hasCaption ? html`<p part="caption" id=${this.captionId}>${image!.caption}</p>` : nothing}
        <span part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true"
          >${this.liveText}</span
        >
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-lightbox': LyraLightbox;
  }
}
