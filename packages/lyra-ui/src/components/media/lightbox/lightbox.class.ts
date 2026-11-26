import { tag } from '../../../internal/prefix.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraLightboxImage, LyraLightboxSource } from './lightbox-types.js';
export type { LyraLightboxImage, LyraLightboxSource } from './lightbox-types.js';
import { NativeModalCarrier } from '../../../internal/native-modal-carrier.js';
import { ModalOpenRequest } from '../../../internal/modal-open-request.js';
import { ModalSurfaceController } from '../../../internal/modal-surface-controller.js';
import { nativeModalCarrierStyles } from '../../../internal/native-modal-carrier.styles.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { property, query, state } from 'lit/decorators.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { isAccessibilityVisible, nextId, srOnly } from '../../../internal/a11y.js';
import { closeIcon, chevronIcon, minusIcon, playIcon, plusIcon } from '../../../internal/icons.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { animateRegistered, type RegisteredAnimationSpec } from '../../../internal/registered-animation.js';
import type { LyraLightboxItem } from './lightbox-item.class.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import { normalizeImageFit, type LyraImageFit } from '../../../internal/image-fit.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { styles } from './lightbox.styles.js';
import { LightboxSourceController, SOURCE_THUMBNAIL_WINDOW } from './lightbox-source.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import type { LyraPanZoom } from '../pan-zoom/pan-zoom.class.js';
import { keyEventOwnedByInnerControl } from '../../../internal/hotkey.js';
import { isElement } from '../../../internal/rendered-tree-traversal.js';
import { composedContains } from '../../../internal/composed-tree.js';
import { repairControlFocusOnUpdate } from '../../../internal/control-focus-repair.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { focusFirstAvailable } from '../../../internal/focus-navigation.js';
import { trackScrollRegions } from '../../../internal/scroll-region.js';
import { blankNumberConverter } from '../../../internal/converters.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { setCustomState } from '../../../internal/custom-states.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_imageViewerFailedToLoad, LYRA_DEFAULT_lightboxImagePosition, LYRA_DEFAULT_lightboxLabel } from '../../../internal/default-strings/media.generated.js';
import { LYRA_DEFAULT_close, LYRA_DEFAULT_details, LYRA_DEFAULT_loading, LYRA_DEFAULT_next, LYRA_DEFAULT_previous, LYRA_DEFAULT_retry, LYRA_DEFAULT_zoomIn, LYRA_DEFAULT_zoomOut } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraImageFit } from '../../../internal/image-fit.js';
const MAX_LIGHTBOX_IMAGES = 10_000;
const EMPTY_LIGHTBOX_IMAGES: readonly LyraLightboxImage[] = Object.freeze([]);

function snapshotLightboxImages(value: unknown): readonly LyraLightboxImage[] {
  try {
    if (!Array.isArray(value)) return EMPTY_LIGHTBOX_IMAGES;
    const count = Math.min(value.length, MAX_LIGHTBOX_IMAGES);
    const images: LyraLightboxImage[] = [];
    for (let index = 0; index < count; index++) {
      try {
        const candidate = value[index] as Partial<LyraLightboxImage> | null;
        if (typeof candidate !== 'object' || candidate === null) continue;
        const src = candidate.src;
        if (typeof src !== 'string') continue;
        const alt = candidate.alt;
        const caption = candidate.caption;
        const thumbnail = candidate.thumbnail;
        images.push(Object.freeze({
          src,
          ...(typeof alt === 'string' ? { alt } : {}),
          ...(typeof caption === 'string' ? { caption } : {}),
          ...(typeof thumbnail === 'string' ? { thumbnail } : {}),
        }));
      } catch {
        // A hostile getter invalidates only its own record; later valid images remain reachable.
      }
    }
    return images.length ? Object.freeze(images) : EMPTY_LIGHTBOX_IMAGES;
  } catch {
    return EMPTY_LIGHTBOX_IMAGES;
  }
}

/**
 * Reason a lightbox was dismissed, forwarded as the `lr-close-request` and `lr-close` event detail --
 * 1:1 copy of `<lr-dialog>`'s own `DialogCloseReason` contract. `'escape'` and `'backdrop'`
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

/** The close affordance, or the lightbox host when removal closes an open instance. */
export interface LyraLightboxHideDetail {
  source: Element;
}

/** The affordance that requested lightbox dismissal. */
export interface LyraLightboxCloseDetail {
  reason: LyraLightboxCloseReason;
}

/** Detail of `lr-item-change`: the new and previous position, with the matching `<lr-lightbox-item>`
 *  elements when the lightbox is showing slotted items (`null` for `images`/`imageSource` data). */
export interface LyraLightboxItemChangeDetail {
  index: number;
  previousIndex: number;
  item: LyraLightboxItem | null;
  previousItem: LyraLightboxItem | null;
}

/** The viewer's record for one slotted item. */
interface LightboxItemRecord {
  readonly element: LyraLightboxItem;
  /** `custom` items show a copy of their `<template>` instead of an image or video. */
  readonly type: 'image' | 'video' | 'custom';
  readonly template?: HTMLTemplateElement;
  readonly thumbnail: string;
  readonly width?: number;
  readonly height?: number;
}

/** Sets an item's viewer-owned custom state; an element that has not upgraded yet is skipped. */
function setItemViewerState(item: LyraLightboxItem, name: 'active' | 'morphing', present: boolean): void {
  (item as Partial<LyraLightboxItem>).setViewerState?.(name, present);
}

const SWIPE_DISTANCE = 50;
const SWIPE_SLOP = 10;
/** Share of the drag distance the slide follows when there is no item in that direction. */
const SWIPE_EDGE_RESISTANCE = 0.3;
/** The light-DOM slot name of the copied custom slide content. */
const CUSTOM_SLIDE_SLOT = 'slide-content';
const CUSTOM_SLIDE_ATTRIBUTE = 'data-lightbox-slide';
/** Pointer targets that own their own drag or tap, so a swipe never starts on them. */
const SWIPE_EXEMPT = 'video, button, a[href], input, select, textarea, [contenteditable]:not([contenteditable="false"])';
const MAX_THUMBNAILS = 200;
/** The documented opening and closing duration properties the surface animations read. */
const SHOW_DURATION_PROPERTY = '--show-duration';
const HIDE_DURATION_PROPERTY = '--hide-duration';

export interface LyraLightboxEventMap {
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<LyraLightboxHideDetail>;
  'lr-after-hide': CustomEvent<null>;
  'lr-close-request': CustomEvent<LyraLightboxCloseDetail>;
  'lr-close': CustomEvent<LyraLightboxCloseDetail>;
  'lr-index-change': CustomEvent<{ index: number }>;
  'lr-item-change': CustomEvent<LyraLightboxItemChangeDetail>;
  /** Not emitted by `LyraLightbox` itself -- the embedded `<lr-pan-zoom>` already
   *  dispatches this via a composed, bubbling `emit()` call, which continues through this
   *  element's own shadow boundary with no re-dispatch needed. Listed here purely for
   *  discoverability. */
  'lr-zoom-change': CustomEvent<{ zoom: number }>;
}

function queueDocumentMicrotask(ownerDocument: Document, callback: VoidFunction): void {
  const ownerWindow = ownerDocument.defaultView;
  if (ownerWindow) {
    ownerWindow.queueMicrotask(callback);
    return;
  }
  void Promise.resolve().then(callback);
}

/**
 * `<lr-lightbox>` — a full-screen, modal, click-to-enlarge image and video viewer with prev/next
 * navigation across an ordered set of media. It mirrors `wa-lightbox`: slot `<lr-lightbox-item>`
 * children (progressive-enhancement links that work without JavaScript) or drive it from data with
 * `images`/`imageSource`; the original data-driven API is unchanged and takes precedence when set.
 *
 * **Not a form-associated control** -- no `label`/`hint`/`errorText` chrome; its
 * `accessibleLabel` only overrides the dialog's own accessible name. The native-wrapper/
 * editing-assistance-passthrough guarantees don't apply either (no internal `<input>`/
 * `<textarea>`).
 *
 * This renders its own dialog panel rather than nesting a `<lr-dialog>` in its shadow
 * template -- shared overlay infrastructure (`src/internal/overlay-manager.ts`) coordinates
 * stacking, focus trapping, Escape/backdrop dismissal, scroll lock, and focus return with every
 * other overlay in the same document, the same way `<lr-dialog>`/`<lr-command-palette>`/
 * `<lr-widget>` (fullscreen mode)/`<lr-app-rail>` (mobile mode)/`<lr-responsive-panel>`
 * already do. Per-image pan/zoom is delegated to one stable embedded `<lr-pan-zoom>`
 * instance (its `src`/`alt` swapped per navigation) rather than reimplementing pan/zoom --
 * composing a small sibling leaf component directly in the render template, the same way
 * `<lr-tool-select-dialog>` composes `<lr-checkbox>`/`<lr-switch>`.
 *
 * Zoom/pan reset on navigation is imperative (`LyraPanZoom.resetView()`, called from
 * `updated()`) rather than a Lit property binding -- a binding whose value never changes across
 * renders (e.g. `.zoom=${1}`) would only apply once, silently failing to reset on the *second*
 * navigation once the user has interactively zoomed. Recreating the frame element on every
 * navigation (e.g. via Lit's `keyed()` directive) was considered and rejected: it would also
 * reset zoom/pan, but destroying/recreating the element would steal focus from a keyboard user
 * who had Tabbed into the frame's viewport mid-navigation.
 *
 * Lifecycle: `show()` emits cancelable `lr-show` before committing `open=true`, followed by
 * `lr-after-show` once the open panel has rendered and its enter animation has finished.
 * `hide()`/`close()` and post-render writes to `open=false` emit cancelable `lr-hide` and
 * `lr-close-request`, followed by `lr-close` with `{ reason }` after the state commits, and
 * `lr-after-hide` once the exit animation has finished. Under `prefers-reduced-motion` or a zero
 * `--show-duration`/`--hide-duration` the animations finish at once, so both events follow the
 * render directly. A transition interrupted by the opposite one emits no after-event of its own.
 * The returned promises resolve with the after-events. A veto leaves the property and reflected
 * attribute synchronized. Initial `open` markup is state rather than a transition and emits no
 * lifecycle events. Removing an open instance emits non-cancelable `lr-hide`, `lr-close` with
 * reason `unmount`, and `lr-after-hide`; removal cannot be vetoed.
 *
 * **Slotted items.** With `<lr-lightbox-item>` children (at any depth) and no `images`/`imageSource`,
 * the host stays inline on the page and shows the items; opening presents the viewer over the
 * page. Items with `type="video"` play in a native `<video>` that pauses when the slide changes
 * or the viewer closes. `with-thumbnails` adds a thumbnail strip, `without-navigation` hides the
 * previous/next buttons (swipe and arrow keys still work), and `without-zoom` removes zooming.
 * An item whose direct child is a `<template>` shows a copy of that template's content as its
 * slide (see `<lr-lightbox-item>`); the copy is made while the slide is shown and placed in a
 * `<div slot="slide-content">` the lightbox appends to itself, so page styles reach it.
 * Content that handles its own dragging should call `preventDefault()` on `pointerdown` so a swipe
 * does not start there.
 *
 * **Swiping.** In every mode, a touch or pen drag that is clearly horizontal moves the slide with
 * the pointer. Releasing it at least 50px from where it started, toward an existing item, moves to
 * that item and the incoming slide continues from the release point; a shorter drag, a mostly
 * vertical one, a drag past the first or last item without `loop` (which follows the pointer with
 * resistance), and a `pointercancel` settle the slide back into place. Directions reverse under
 * RTL. Under `prefers-reduced-motion` the slide does not follow the pointer and the release
 * navigates or stays without motion. A mouse never swipes, nor does a drag that starts on a
 * control, a link, a video or a form field, or while the image is zoomed in. The open/close and
 * slide motion use the `--show-duration`/`--hide-duration`/`--slide-gap` properties and stop under
 * `prefers-reduced-motion`.
 *
 * **Scope (deliberate, not oversights):** no dot-style indicators (a textual counter scales
 * better to photo-set sizes); no click-on-image-to-navigate (the image is already meaningfully
 * interactive -- it focuses the zoomable frame's viewport and drives its native scroll-to-pan);
 * no inertial fling (only the release distance decides).
 *
 * When opened outside an existing native modal dialog, the modal surface uses an internal
 * native dialog so pointer, keyboard, and focus interaction remain available without moving
 * the host. Escape and close requests retain their normal cancelable lifecycle.
 * Closing returns focus to the element that held it when the lightbox opened, including an opener
 * the host re-shows only after the close.
 *
 * @customElement lr-lightbox
 * @slot - One or more `<lr-lightbox-item>` elements, with any markup that lays them out.
 * @slot actions - Optional extra toolbar buttons (e.g. download/share/delete), rendered in
 *   `part="toolbar"` between the counter and the close button.
 * @slot details - Optional rich content for the current data-mode image. Update one shared
 *   panel on `lr-index-change`. The slot is hidden while a source image loads or fails.
 * @slot close-icon - Optional close icon used instead of the default.
 * @slot previous-icon - Optional previous icon used instead of the default.
 * @slot next-icon - Optional next icon used instead of the default.
 * @slot zoom-in-icon - Optional icon on the zoom button while the image can be zoomed in.
 * @slot zoom-out-icon - Optional icon on the zoom button while the image is zoomed in.
 * @event lr-hide - Conditionally cancelable visibility event with the close source in its detail:
 *   cancelable before a requested close, non-cancelable when an open instance unmounts.
 * @event lr-close-request - Cancelable proposal before dismissal; `detail: { reason }`.
 *   Calling `preventDefault()` keeps the lightbox open.
 * @event lr-close - Non-cancelable accepted dismissal with `{ reason }` detail, including unmount.
 * @event lr-show - Cancelable request fired by `show()` before `open` changes.
 * @event lr-after-show - Fired after a successful `show()` has rendered the open panel and its
 *   enter animation has finished (immediately under reduced motion or a zero duration).
 * @event lr-after-hide - Fired after a successful `hide()`/`close()` has rendered closed and its
 *   exit animation has finished (immediately under reduced motion or a zero duration).
 * @event lr-index-change - Fired for `next()`/`previous()`/`goTo()` navigation, including the
 *   built-in button, swipe, thumbnail and keyboard paths, and when a shrinking `images` moves the
 *   shown image. Not fired when a consumer sets `index` directly (as `<lr-carousel>` does not fire
 *   `lr-slide-change` for a direct `currentSlide` write); call `goTo()` to change the item and be
 *   notified. Source mode uses the complete logical count
 *   and emits the requested index before asynchronous image resolution. `detail: { index }` is always the rendered
 *   integer index.
 * @event lr-item-change - Fired alongside `lr-index-change` for the same navigations, with
 *   `detail: { index, previousIndex, item, previousItem }` (items are `null` in data mode). Like
 *   `lr-index-change` it reports navigation, so writing `index` directly does not fire it, whether
 *   the lightbox is open or closed; `goTo()`, `next()` and `previous()` do.
 * @event lr-zoom-change - Not emitted by `LyraLightbox` itself -- see the interface doc above.
 *   `detail: { zoom }`.
 * @csspart surface - The viewer's viewport layer. Only positioned and shown while open (slotted mode).
 * @csspart backdrop - The full-viewport scrim, positioned behind `panel`.
 * @csspart panel - Also exposed as `dialog`. `role="dialog"` while open, `aria-modal="true"`, `tabindex="-1"`. Fills the
 *   padded safe area -- unlike `<lr-dialog>`, it does not shrink-wrap to content, since
 *   maximizing image real estate is the point.
 * @csspart dialog - The same element as `panel`.
 * @csspart toolbar - Top row: `counter` (start), the `actions` slot wrapper, `close-button` (end).
 * @csspart counter - Visible, localized "Image N of Total" text. Omitted entirely while
 *   `without-counter` is set.
 * @csspart live-region - Visually-hidden, `aria-hidden` mirror of the current position. On every
 *   `index` change while open, the spoken copy is appended to the shared light-DOM polite sink,
 *   regardless of trigger (button, keyboard, or a consumer setting `index`/`images` directly),
 *   unless the lightbox or a composed ancestor is excluded from the accessibility tree. The
 *   mirror is decoupled from the visible `counter` so an unrelated re-render never causes a
 *   spurious re-announcement.
 * @csspart actions - Wrapper around the `actions` slot; `hidden` when nothing is slotted.
 * @csspart close-button - The close button. Always rendered -- unlike `<lr-dialog>`'s opt-in
 *   `closable`, a full-screen lightbox has no other built-in chrome, so this is not optional.

 * @csspart stage - Also exposed as `scroll-container`. Houses the embedded `<lr-pan-zoom>` plus the floating
 *   `previous-button`/`next-button`.
 * @csspart scroll-container - The same element as `stage`.
 * @csspart details - Scrollable wrapper around the data-mode details slot.
 * @csspart source-loading - Source-mode loading message.
 * @csspart source-error - Source descriptor or image loading error.
 * @csspart source-retry - Retry the current source image after an error.
 * @csspart slide - The wrapper around the current image or video.
 * @csspart video - The current video of a `type="video"` item.
 * @csspart zoom-button - Toolbar button that toggles between fitted and zoomed in. Rendered for
 *   slotted items only; `images`/`imageSource` galleries keep the embedded `frame-controls`.
 * @csspart thumbnails - The thumbnail strip, rendered only with `with-thumbnails`.
 * @csspart thumbnail - One thumbnail button in the strip.
 * @csspart thumbnail-active - Added to the current item's thumbnail.
 * @csspart frame - The embedded `<lr-pan-zoom>` element itself.
 * @csspart image - The same element as `frame`: the current full-size image's zoomable frame.
 * @csspart frame-viewport - The embedded pan-zoom's scrollable viewport.
 * @csspart frame-content - The embedded pan-zoom's transformed content wrapper.
 * @csspart frame-controls - The embedded pan-zoom's zoom controls.
 * @csspart previous-button - Also exposed as `navigation-button navigation-button-previous`. Floating, absolutely positioned inside `stage`. Rendered only when
 *   `images.length > 1`.
 * @csspart previous-glyph - The `chevronIcon()` inside `previous-button`, mirrored under RTL.
 * @csspart next-button - Symmetric to `previous-button` (`navigation-button navigation-button-next`).
 * @csspart next-glyph - Symmetric to `previous-glyph`.
 * @csspart navigation-button - Both the previous and the next button.
 * @csspart navigation-button-previous - The same element as `previous-button`.
 * @csspart navigation-button-next - The same element as `next-button`.
 * @csspart caption - The current image's caption text. Only rendered when the current image's
 *   `caption` is non-empty. Its `id` is the `aria-describedby` target on `panel`.
 * @cssprop --lr-lightbox-overlay-color - The backdrop scrim color.
 * @cssprop [--backdrop-color=var(--lr-color-overlay-strong)] - The backdrop scrim color; `--lr-lightbox-overlay-color` wins when both are set.
 * @cssprop [--backdrop-filter=none] - A filter applied to the page behind the backdrop, e.g. `blur(1rem)`.
 * @cssprop --lr-lightbox-control-bg - Background for every floating/toolbar icon button.
 * @cssprop --lr-lightbox-control-color - Icon/text color paired with `--lr-lightbox-control-bg`.
 * @cssprop [--controls-background=var(--lr-color-neutral)] - Background of the controls, counter, caption and details; `--lr-lightbox-control-bg` wins when both are set.
 * @cssprop [--controls-color=var(--lr-color-on-neutral)] - Text and icon color of the controls, counter, caption and details; `--lr-lightbox-control-color` wins when both are set.
 * @cssprop [--spacing=var(--lr-space-s)] - Space between the toolbar, media, details, caption and thumbnail strip.
 * @cssprop --lr-lightbox-control-hover-bg - Hovered control background. Defaults to `--lr-color-brand-quiet`.
 * @cssprop --lr-lightbox-control-hover-color - Hovered control icon/text color. Defaults to `--lr-color-brand`.
 * @cssprop --lr-lightbox-control-active-bg - Pressed control background. Defaults to the hover background mixed toward `--lr-color-mix-partner`.
 * @cssprop --lr-lightbox-control-active-color - Pressed control icon/text color. Defaults to the hover color.
 * @cssprop [--show-duration=var(--lr-lightbox-panel-duration)] - Opening animation duration.
 * @cssprop [--hide-duration=var(--lr-lightbox-panel-duration)] - Closing animation duration.
 * @cssprop --lr-lightbox-panel-duration - Duration of the viewer's open/close and slide motion. Defaults to `--lr-duration-base`.
 * @cssprop [--slide-gap=var(--lr-lightbox-slide-gap)] - Space the incoming slide travels past the edge. Defaults to `--lr-space-l`.
 * @cssprop --lr-lightbox-slide-gap - Public form of `--slide-gap`.
 * @cssprop [--thumbnail-size=var(--lr-lightbox-thumbnail-size)] - Inline and block size of each thumbnail.
 * @cssprop --lr-lightbox-thumbnail-size - Public form of `--thumbnail-size`. Defaults to `--lr-size-3-5rem`.
 * @cssprop [--media-border-radius=var(--lr-lightbox-media-radius)] - Corner radius of the media.
 * @cssprop --lr-lightbox-media-radius - Public form of `--media-border-radius`. Defaults to `0`.
 * @cssprop --lr-lightbox-status-color - Color of the source-mode loading and error messages on the backdrop.
 * @cssstate open - Present while the lightbox is open.
 * @cssstate zoomed - Present while the current image is zoomed in.
 * @status stable
 * @since 4.0.0
 */
export class LyraLightbox extends LyraElement<LyraLightboxEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
    details: LYRA_DEFAULT_details,
    imageViewerFailedToLoad: LYRA_DEFAULT_imageViewerFailedToLoad,
    lightboxImagePosition: LYRA_DEFAULT_lightboxImagePosition,
    lightboxLabel: LYRA_DEFAULT_lightboxLabel,
    loading: LYRA_DEFAULT_loading,
    next: LYRA_DEFAULT_next,
    previous: LYRA_DEFAULT_previous,
    retry: LYRA_DEFAULT_retry,
    zoomIn: LYRA_DEFAULT_zoomIn,
    zoomOut: LYRA_DEFAULT_zoomOut,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze(['lr-item-change']);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-item-change': Object.freeze(['item', 'previousItem']),
  });

  static override styles = [LyraElement.styles, nativeModalCarrierStyles, srOnly, styles];
  private readonly hostDescription = new HostDescriptionController(
    this, () => this.renderRoot.querySelector<HTMLElement>(
      this.nativeModal.requested ? 'dialog[data-native-modal-carrier]' : '[part~="panel"][role="dialog"]',
    ),
  );

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
    this.hostDescription.adopted();
    this.sourceController.adopted();
  }

  private _open = false;

  /** Whether the lightbox is open. Post-render writes run the same cancelable lifecycle as
   *  `show()`/`hide()`/`close()`; initial markup is state and emits nothing. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
    if (this.openRequest.coalesce(normalized)) return;
    if (normalized === this._open) return;
    if (!this.hasUpdated) {
      this.applyOpenState(normalized);
      return;
    }
    if (normalized) void this.show();
    else void this.close('api');
  }

  protected static override readonly identityCollectionObjectProperties = Object.freeze(['imageSource']);
  private _imageSource?: LyraLightboxSource;
  private navigationIntent = 0;
  private pendingIndexChange?: number;
  private sourceBindingCurrent = true;
  @state() private sourceState = 0;
  private readonly sourceController = new LightboxSourceController(this, () => { this.sourceState++; });

  /** Optional host-owned full image collection. Takes precedence over images; undefined restores
   * legacy input. Reassign, including the same source, or call requestUpdate() after mutation.
   * Only the current image loads; at most three descriptors are retained (with `with-thumbnails`,
 * a separate strip window also reads the descriptors of the 15 positions around the current one). Each key/src/alt/caption
   * is limited to 65,536 UTF-16 units. Invalid defined sources fail closed with a retry action.
   * index remains the requested logical index while its image loads. */
  @property({ attribute: false, noAccessor: true, hasChanged: () => true })
  get imageSource(): LyraLightboxSource | undefined { return this._imageSource; }
  set imageSource(value: LyraLightboxSource | undefined) {
    const previous = this._imageSource;
    this.navigationIntent++;
    this.sourceBindingCurrent = false;
    this._imageSource = value;
    this.sourceController?.refresh();
    if (this.frameEl) this.frameEl.src = '';
    this.requestUpdate('imageSource', previous);
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined && this._imageSource !== undefined) {
      this.navigationIntent++;
      this.sourceBindingCurrent = false;
      this.sourceController?.refresh();
      if (this.frameEl) this.frameEl.src = '';
    }
    super.requestUpdate(...args);
  }

  private imageCount(): number {
    return this.imageSource === undefined ? this.activeImages.length : this.sourceController.count;
  }

  private _images: readonly LyraLightboxImage[] = EMPTY_LIGHTBOX_IMAGES;
  private _imagesSource?: unknown;
  private _fit: LyraImageFit = 'actual';

  /** The ordered, bounded, immutable set of images being browsed. Assign a new collection to
   * update it; malformed records are omitted and at most 10,000 candidates are inspected. */
  @property({ attribute: false })
  get images(): readonly LyraLightboxImage[] {
    return this._images;
  }
  set images(value: readonly LyraLightboxImage[]) {
    if (value === this._imagesSource || value === this._images) return;
    this._imagesSource = value;
    const old = this._images;
    this._images = snapshotLightboxImages(value);
    this.requestUpdate('images', old);
  }

  private _index = 0;
  /** The current logical image index. Clamped defensively for rendering (out-of-range/negative/
   * non-integer never throws) and re-synced when the active collection shrinks.
   * Source mode retains the requested index while loading.
   * @default 0
   */
  @property({ converter: blankNumberConverter(0), reflect: true, noAccessor: true })
  get index(): number { return this._index; }
  set index(value: number) {
    this.navigationIntent++;
    const previous = this._index;
    this._index = value;
    if (value !== previous && this.imageSource !== undefined) {
      this.sourceController?.select(this.currentIndex());
      if (this.frameEl) this.frameEl.src = '';
    }
    this.requestUpdate('index', previous);
  }

  /** Wraps prev/next past the ends. Mirrors `<lr-carousel>`'s `loop` 1:1. */
  @property({ type: Boolean, reflect: true }) loop = false;

  /** Dismisses the lightbox on a backdrop click. Opt-in and `false` by default -- mirrors
   *  `<lr-dialog>`'s `lightDismiss` exactly (name, default, no reflect), which in turn matches
   *  `wa-dialog`. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false;

  /** Hides only the visible `part="counter"`. The accessibility `part="live-region"`
   *  announcement remains active so navigation is still conveyed when visual chrome is hidden.
   *  Not reflected, matching the published contract. */
  @property({ type: Boolean, attribute: 'without-counter' }) withoutCounter = false;

  /** Shows a strip of thumbnails for jumping between items. Each uses the item's `thumbnail`
   *  (slotted items and `images`/`imageSource` records), else the full image. With `imageSource`
   *  the strip covers the 15 positions around the current one and reads only their descriptors;
   *  a position whose descriptor is still loading shows its number. */
  @property({ type: Boolean, reflect: true, attribute: 'with-thumbnails' }) withThumbnails = false;

  /** Hides the previous/next buttons. Swiping and the arrow keys still navigate. */
  @property({ type: Boolean, reflect: true, attribute: 'without-navigation' }) withoutNavigation = false;

  /** Disables zooming and removes the zoom button and the embedded zoom controls. */
  @property({ type: Boolean, reflect: true, attribute: 'without-zoom' }) withoutZoom = false;

  /** A label that names the viewer for assistive technology, e.g. "Vacation photos". A host
   *  `aria-label` wins over it; blank falls back to the localized default. Reflected. */
  @property({ reflect: true }) label = '';

  /** Base image sizing policy, using the same vocabulary as `<lr-image-viewer>`. `actual`
   * preserves the current natural-size behavior; `contain` fits the complete image inside the
   * available stage and `width` fills its inline size. Fit recalculates from layout when the
   * stage allocation changes. Explicit user zoom remains in effect until navigation or a reset. */
  @property({ reflect: true })
  get fit(): LyraImageFit {
    return this._fit;
  }
  set fit(value: LyraImageFit) {
    const old = this._fit;
    this._fit = normalizeImageFit(value, 'actual');
    this.requestUpdate('fit', old);
  }

  /** Passed through to the embedded `<lr-pan-zoom>` as `.minZoom`. Same default as
   *  `<lr-pan-zoom>` itself. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeMinZoom
  @property({ converter: blankNumberConverter(0.5), attribute: 'min-zoom' }) minZoom = 0.5;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.maxZoom`. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeMaxZoom
  @property({ converter: blankNumberConverter(4), attribute: 'max-zoom' }) maxZoom = 4;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.zoomStep`. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeZoomStep
  @property({ converter: blankNumberConverter(0.25), attribute: 'zoom-step' }) zoomStep = 0.25;

  /** A nonblank host label names the dialog. Blank labels use the localized `lightboxLabel` default. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Place data-mode details at inline-end when space allows, or always below the image. */
  @property({ attribute: 'details-placement' }) detailsPlacement: 'end' | 'bottom' = 'end';

  private readonly slotPresence = new SlotPresenceController(this);
  @state() private itemsVersion = 0;
  @state() private zoomLevel = 1;
  private itemRecords: readonly LightboxItemRecord[] = [];
  private itemImages: readonly LyraLightboxImage[] = EMPTY_LIGHTBOX_IMAGES;
  private itemObserver?: MutationObserver;
  private renderedIndex = 0;
  private renderedRecord?: LightboxItemRecord;
  private lastShownSrc = '';
  private firstUpdateDone = false;
  private swipe?: { id: number; x: number; y: number; dx: number; dragging: boolean };
  private transitionAnimations: Animation[] = [];
  private morphGeneration = 0;
  private morphingItem?: LyraLightboxItem;
  private lastItemSignature = '';

  /** The slotted `<lr-lightbox-item>` elements in document order, including those without usable media. */
  get items(): LyraLightboxItem[] {
    return this.collectItems();
  }

  /** The current slotted item, or `undefined` in data mode. Useful for download/share buttons in `actions`. */
  get currentItem(): LyraLightboxItem | undefined {
    return this.itemMode ? this.itemRecords[this.currentIndex()]?.element : undefined;
  }

  private get itemMode(): boolean {
    return this.imageSource === undefined && this._images.length === 0 && this.itemRecords.length > 0;
  }

  private get activeImages(): readonly LyraLightboxImage[] {
    return this.itemMode ? this.itemImages : this._images;
  }

  private collectItems(): LyraLightboxItem[] {
    const own = tag('lightbox');
    return Array.from(this.querySelectorAll<LyraLightboxItem>(tag('lightbox-item'))).filter(
      (element) => element.closest(own) === this && !element.closest(`[${CUSTOM_SLIDE_ATTRIBUTE}]`),
    );
  }

  /** @internal Called by a child item whenever its media-describing state changes. */
  itemChanged(): void {
    this.syncItems();
  }

  private syncItems(): void {
    const records: LightboxItemRecord[] = [];
    const images: LyraLightboxImage[] = [];
    for (const element of this.collectItems()) {
      const raw = element as Partial<LyraLightboxItem> & Element;
      const src = raw.mediaSrc ?? safeMediaSrc(element.getAttribute('src')) ?? '';
      const template = raw.slideTemplate ?? element.querySelector<HTMLTemplateElement>(':scope > template') ?? undefined;
      if (!src && !template) continue;
      const type = template ? 'custom' : (raw.type ?? element.getAttribute('type')) === 'video' ? 'video' : 'image';
      const alt = raw.resolvedAlt ?? element.getAttribute('alt') ?? '';
      const caption = raw.captionText ?? element.getAttribute('caption') ?? '';
      const width = Number(raw.width ?? element.getAttribute('width'));
      const height = Number(raw.height ?? element.getAttribute('height'));
      records.push({
        element: element as LyraLightboxItem,
        type,
        ...(template ? { template } : {}),
        thumbnail: raw.thumbnailSrc ?? safeMediaSrc(element.getAttribute('thumbnail')) ?? '',
        ...(Number.isFinite(width) && width > 0 ? { width } : {}),
        ...(Number.isFinite(height) && height > 0 ? { height } : {}),
      });
      images.push(Object.freeze({ src, alt, ...(caption ? { caption } : {}) }));
    }
    const signature = records
      .map((record, i) => `${i}\u0000${images[i]!.src}\u0000${images[i]!.alt}\u0000${images[i]!.caption ?? ''}\u0000${record.type}\u0000${record.thumbnail}\u0000${record.width ?? ''}x${record.height ?? ''}`)
      .join('\u0001');
    const sameElements =
      records.length === this.itemRecords.length &&
      records.every((record, i) => record.element === this.itemRecords[i]!.element && record.template === this.itemRecords[i]!.template);
    if (signature === this.lastItemSignature && sameElements) return;
    this.lastItemSignature = signature;
    this.itemRecords = Object.freeze(records);
    this.itemImages = images.length ? Object.freeze(images) : EMPTY_LIGHTBOX_IMAGES;
    this.itemsVersion++;
  }

  private onHostClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!this.itemMode) return;
    const itemTag = tag('lightbox-item');
    const item = (event.composedPath() as Node[]).find(
      (node): node is LyraLightboxItem => isElement(node) && node.localName === itemTag,
    );
    if (!item || item.closest(tag('lightbox')) !== this) return;
    const position = this.itemRecords.findIndex((record) => record.element === item);
    if (position < 0) return;
    event.preventDefault();
    this.index = position;
    void this.show();
  };

  /** Zooms the current image in by one step. A no-op for video, or with `without-zoom`. */
  zoomIn(): void {
    if (this.canZoom()) this.frameEl?.zoomIn();
  }

  /** Zooms the current image out by one step. A no-op for video, or with `without-zoom`. */
  zoomOut(): void {
    if (this.canZoom()) this.frameEl?.zoomOut();
  }

  private canZoom(): boolean {
    const type = this.itemMode ? this.itemRecords[this.currentIndex()]?.type : undefined;
    return !this.withoutZoom && type !== 'video' && type !== 'custom';
  }

  private toggleZoom = (): void => {
    if (this.zoomLevel > 1) this.frameEl?.resetZoom();
    else this.zoomIn();
  };

  private onZoomChange = (event: Event): void => {
    const zoom = (event as CustomEvent<{ zoom: number }>).detail?.zoom;
    if (typeof zoom === 'number' && Number.isFinite(zoom)) this.zoomLevel = zoom;
  };

  private pauseVideos(): void {
    // Nothing has rendered yet, and server rendering has no render root to query.
    if (!this.hasUpdated) return;
    for (const video of this.renderRoot.querySelectorAll('video')) video.pause();
  }

  private onSwipeStart = (event: PointerEvent): void => {
    if (event.defaultPrevented || event.pointerType === 'mouse' || !event.isPrimary || this.imageCount() < 2) return;
    if (this.zoomLevel > 1) return;
    if ((event.composedPath() as Node[]).some((node) => isElement(node) && node.matches(SWIPE_EXEMPT))) return;
    this.releaseDrag(false);
    this.swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
  };

  /** Moves the slide with the pointer once the gesture is clearly horizontal. Under reduced motion
   *  the slide stays put and only the release decides. */
  private onSwipeMove = (event: PointerEvent): void => {
    const swipe = this.swipe;
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe.dx = dx;
    if (!swipe.dragging) {
      if (Math.abs(dx) < SWIPE_SLOP || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      swipe.dragging = true;
    }
    if (prefersReducedMotion(this)) return;
    const slide = this.slideElement();
    if (!slide) return;
    for (const animation of slide.getAnimations()) animation.cancel();
    const offset = this.hasNeighbor(this.swipeIsForward(dx)) ? dx : dx * SWIPE_EDGE_RESISTANCE;
    slide.style.transform = `translateX(${offset}px)`;
    slide.toggleAttribute('data-dragging', true);
  };

  private onSwipeEnd = (event: PointerEvent): void => {
    const swipe = this.swipe;
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    const forward = this.swipeIsForward(dx);
    const navigates =
      Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) >= Math.abs(dy) * 1.2 && this.hasNeighbor(forward);
    if (!navigates) {
      this.releaseDrag(true);
      return;
    }
    // The incoming slide continues from where the dragged one was let go.
    this.swipeRelease = swipe.dragging && !prefersReducedMotion(this) ? dx : 0;
    this.releaseDrag(false);
    if (forward) this.next();
    else this.previous();
    if (this.pendingIndexChange === undefined) this.swipeRelease = 0;
  };

  private onSwipeCancel = (event: PointerEvent): void => {
    if (this.swipe?.id === event.pointerId) this.releaseDrag(true);
  };

  /** Ends the current gesture; `settle` animates a dragged slide back into place. */
  private releaseDrag(settle: boolean): void {
    const swipe = this.swipe;
    this.swipe = undefined;
    const slide = this.slideElement();
    if (!slide || !slide.hasAttribute('data-dragging')) return;
    const from = slide.style.transform;
    slide.style.removeProperty('transform');
    slide.removeAttribute('data-dragging');
    if (!settle || !swipe?.dragging || !from) return;
    const animation = animateRegistered(this, slide, 'lightbox.slide.return', this.effectiveDirection, {
      keyframes: [{ transform: from }, { transform: 'translateX(0)' }],
      durationProperties: ['--lr-lightbox-panel-duration', '--lr-duration-base'],
      easingProperties: ['--lr-easing-standard'],
    });
    if (animation) void animation.finished.catch(() => undefined);
  }

  /** Whether a horizontal movement of `dx` pixels points toward the next item. */
  private swipeIsForward(dx: number): boolean {
    return this.effectiveDirection === 'rtl' ? dx > 0 : dx < 0;
  }

  private hasNeighbor(forward: boolean): boolean {
    const count = this.imageCount();
    if (count < 2) return false;
    if (this.loop) return true;
    const current = this.currentIndex();
    return forward ? current < count - 1 : current > 0;
  }

  private slideElement(): HTMLElement | null {
    return this.hasUpdated ? this.renderRoot.querySelector<HTMLElement>('[part="slide"]') : null;
  }

  /** Pixel offset of a slide released mid-drag, consumed by the next slide animation. */
  private swipeRelease = 0;
  @state() private liveText = '';

  @query(tag('pan-zoom')) private frameEl?: LyraPanZoom;
  private readonly lightboxInternals = attachInternalsSafely(this);

  private overlay?: OverlayHandle;
  private readonly nativeModal = new NativeModalCarrier(this, {
    onCancel: () => { if (this.overlay?.isTopmost()) void this.closeFrom('escape', this.renderRoot.querySelector('[part~="panel"]') ?? this); },
    onUnexpectedClose: () => {
      void this.hide().then(() => { if (this.open) this.modalSurface.show(); });
    },
  });
  private readonly modalSurface = new ModalSurfaceController(this, this.nativeModal);
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private sourceErrorAnnounced = false;
  private sourceHasRendered = false;
  private lastSourceImage?: LyraLightboxImage;
  private announcementBaseline?: {
    index: number;
    images: readonly LyraLightboxImage[];
    source?: LyraLightboxSource;
  };
  private connectionGeneration = 0;
  private transitionGeneration = 0;
  private readonly openRequest = new ModalOpenRequest();
  private readonly captionId = nextId('lightbox-caption');

  /** Clamped, always-valid index for rendering -- never throws on an out-of-range, negative,
   *  non-integer, or non-finite `index`. */
  private currentIndex(): number {
    const count = this.imageCount();
    if (count === 0) return 0;
    return finiteCount(this.index, 0, count - 1);
  }

  private syncImages(): void {
    const current = this.currentIndex();
    if (this.index !== current) this.index = current;
  }

  private changeTo(index: number): void {
    const count = this.imageCount();
    if (count === 0 || !Number.isFinite(index)) return;
    const requested = finiteInteger(index, 0);
    const next = this.loop
      ? ((requested % count) + count) % count
      : Math.min(count - 1, Math.max(0, requested));
    if (next === this.currentIndex()) return;
    this.pendingIndexChange = this.navigationIntent + 1;
    this.index = next;
  }

  /** Advances to the next image, respecting `loop`. */
  next(): void {
    this.changeTo(this.currentIndex() + 1);
  }
  /** Moves to the previous image, respecting `loop`. */
  previous(): void {
    this.changeTo(this.currentIndex() - 1);
  }

  /** Jumps to a finite image index. Fractional values are truncated toward zero before
   *  clamping or loop wrapping, so `lr-index-change.detail.index` is always the rendered
   *  integer index. Non-finite values are no-ops. */
  goTo(index: number): void {
    this.changeTo(index);
  }

  /** Request opening, then resolve once the open panel is rendered and its enter animation has
   *  finished (immediately under reduced motion or a zero duration). */
  async show(): Promise<void> {
    if (this.openRequest.coalesce(true) || this._open) return;
    this.openRequest.begin(true);
    const prevented = this.emit('lr-show', null, { cancelable: true }).defaultPrevented;
    const superseded = this.openRequest.superseded(true);
    this.openRequest.finish();
    if (prevented || superseded) {
      this.syncOpenAttribute();
      return;
    }
    this.cancelTransitionAnimations();
    this.removeAttribute('data-closing');
    this.applyOpenState(true);
    const generation = ++this.transitionGeneration;
    await this.updateComplete;
    // `updated()` started the enter animation for this render; `lr-after-show` waits for it, as on
    // the other overlays. A close or reopen in the meantime cancels it and bumps the generation,
    // so an interrupted open never reports that it finished.
    if (generation !== this.transitionGeneration || !this._open) return;
    await this.settleAnimations();
    if (generation === this.transitionGeneration && this._open) this.emit('lr-after-show', null);
  }

  /** Close with the standard API reason. */
  hide(): Promise<void> {
    return this.close('api');
  }

  /**
   * Close the lightbox and return focus to whatever had it before the lightbox opened. `reason`
   * is forwarded as the `lr-close-request` and `lr-close` detail -- built-in triggers pass `'escape'`/
   * `'backdrop'`/`'close-button'`; a consumer's own close affordance (e.g. an `actions`-slotted
   * button) should call this directly with its own reason string.
   */
  async close(reason: LyraLightboxCloseReason = 'api'): Promise<void> {
    return this.closeFrom(reason, this);
  }

  private async closeFrom(reason: LyraLightboxCloseReason, source: Element): Promise<void> {
    if (this.openRequest.coalesce(false) || !this._open) return;
    this.openRequest.begin(false);
    if (
      this.emit('lr-hide', { source }, { cancelable: true }).defaultPrevented ||
      this.openRequest.superseded(false)
    ) {
      this.openRequest.finish();
      this.syncOpenAttribute();
      return;
    }
    const proposal = this.emit('lr-close-request', { reason }, { cancelable: true });
    if (proposal.defaultPrevented || this.openRequest.superseded(false)) {
      this.openRequest.finish();
      this.syncOpenAttribute();
      return;
    }
    this.openRequest.finish();
    this.cancelTransitionAnimations();
    if (this.isConnected) this.setAttribute('data-closing', '');
    this.pauseVideos();
    this.applyOpenState(false);
    const generation = ++this.transitionGeneration;
    this.emit('lr-close', { reason });
    await this.updateComplete;
    if (generation !== this.transitionGeneration || this._open) {
      if (this._open) this.removeAttribute('data-closing');
      return;
    }
    // `data-closing` keeps the fading surface painted while the exit animation runs; `lr-after-hide`
    // (and this promise) wait for it to finish, as on the other overlays. A reopen in the meantime
    // cancels the exit and bumps the generation, so the interrupted close reports nothing more.
    await this.playExit();
    if (generation !== this.transitionGeneration || this._open) return;
    this.removeAttribute('data-closing');
    this.syncCustomSlide();
    this.emit('lr-after-hide', null);
  }

  private cancelTransitionAnimations(): void {
    for (const animation of this.transitionAnimations) animation.cancel();
    this.transitionAnimations = [];
  }

  private async settleAnimations(): Promise<void> {
    const running = this.transitionAnimations;
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    if (this.transitionAnimations === running) this.transitionAnimations = [];
  }

  private surfaceSpec(showing: boolean, panel: boolean): RegisteredAnimationSpec {
    const offset = 'translateY(calc(-1 * var(--lr-size-0-5rem)))';
    const keyframes: Keyframe[] = panel
      ? showing
        ? [{ opacity: 0, transform: offset }, { opacity: 1, transform: 'translateY(0)' }]
        : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: offset }]
      : showing
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0 }];
    return {
      keyframes,
      durationProperties: [showing ? SHOW_DURATION_PROPERTY : HIDE_DURATION_PROPERTY, '--lr-lightbox-panel-duration', '--lr-duration-base'],
      easingProperties: ['--lr-easing-standard'],
    };
  }

  private startSurfaceAnimations(showing: boolean): Animation[] {
    const panel = this.renderRoot.querySelector<HTMLElement>('[part~="panel"]');
    const backdrop = this.renderRoot.querySelector<HTMLElement>('[part="backdrop"]');
    const direction = this.effectiveDirection;
    return [
      panel && animateRegistered(this, panel, showing ? 'lightbox.show' : 'lightbox.hide', direction, this.surfaceSpec(showing, true)),
      backdrop && animateRegistered(this, backdrop, showing ? 'lightbox.overlay.show' : 'lightbox.overlay.hide', direction, this.surfaceSpec(showing, false)),
    ].filter((animation): animation is Animation => animation !== undefined && animation !== null);
  }

  private async playExit(): Promise<void> {
    if (!this.isConnected || this.nativeModal.requested) return;
    this.cancelTransitionAnimations();
    this.transitionAnimations = this.startSurfaceAnimations(false);
    this.markMorphing(this.renderedRecord?.element ?? this.currentItem, this.transitionAnimations);
    await this.settleAnimations();
  }

  private animateSlide(forward: boolean): void {
    const slide = this.renderRoot.querySelector<HTMLElement>('[part="slide"]');
    if (!slide) return;
    const gap = 'var(--slide-gap, var(--lr-lightbox-slide-gap, var(--lr-space-l)))';
    const from = (sign: number): string => `translateX(calc(${sign} * (100% + ${gap})))`;
    const spec = (sign: number): RegisteredAnimationSpec => ({
      keyframes: [{ opacity: 0, transform: from(sign) }, { opacity: 1, transform: 'translateX(0)' }],
      rtlKeyframes: [{ opacity: 0, transform: from(-sign) }, { opacity: 1, transform: 'translateX(0)' }],
      durationProperties: ['--lr-lightbox-panel-duration', '--lr-duration-base'],
      easingProperties: ['--lr-easing-standard'],
    });
    const sign = forward ? 1 : -1;
    const release = this.swipeRelease;
    this.swipeRelease = 0;
    let motion = spec(sign);
    if (release) {
      // A released drag: start the incoming slide beside the point where the dragged one was let
      // go. Pointer offsets are physical, so both directions use the same keyframes.
      const physical = this.effectiveDirection === 'rtl' ? -sign : sign;
      const keyframes: Keyframe[] = [
        { opacity: 0, transform: `translateX(calc(${physical} * (100% + ${gap}) + ${release}px))` },
        { opacity: 1, transform: 'translateX(0)' },
      ];
      motion = { ...motion, keyframes, rtlKeyframes: keyframes };
    }
    const animation = animateRegistered(this, slide, forward ? 'lightbox.slide.next' : 'lightbox.slide.previous', this.effectiveDirection, motion);
    if (animation) void animation.finished.catch(() => undefined);
  }

  private customSlide?: { readonly record: LightboxItemRecord; readonly element: HTMLElement };

  /** Keeps the copied `<template>` content in step with the shown custom item: created when that
   *  slide is shown, kept through the close motion, removed on any other slide or once closed. */
  private syncCustomSlide(): void {
    const showing = this.isConnected && (this.open || this.hasAttribute('data-closing'));
    const record = showing && this.itemMode ? this.itemRecords[this.currentIndex()] : undefined;
    const wanted = record?.type === 'custom' && record.template ? record : undefined;
    if (this.customSlide && this.customSlide.record.template === wanted?.template && this.customSlide.record.element === wanted?.element) return;
    this.removeCustomSlide();
    if (!wanted?.template) return;
    const doc = this.ownerDocument;
    const element = doc.createElement('div');
    element.slot = CUSTOM_SLIDE_SLOT;
    element.setAttribute(CUSTOM_SLIDE_ATTRIBUTE, '');
    if (wanted.width && wanted.height) {
      element.setAttribute('data-ratio', '');
      element.style.setProperty('--_lr-lightbox-slide-ratio', String(wanted.width / wanted.height));
    }
    element.append(doc.importNode(wanted.template.content, true));
    this.customSlide = { record: wanted, element };
    this.append(element);
  }

  private removeCustomSlide(): void {
    const current = this.customSlide;
    this.customSlide = undefined;
    current?.element.remove();
  }

  /** Publishes the item's `morphing` state while the open or close motion runs, then clears it. */
  private markMorphing(item: LyraLightboxItem | undefined, animations: readonly Animation[]): void {
    const generation = ++this.morphGeneration;
    if (this.morphingItem) setItemViewerState(this.morphingItem, 'morphing', false);
    this.morphingItem = undefined;
    if (!item || animations.length === 0) return;
    this.morphingItem = item;
    setItemViewerState(item, 'morphing', true);
    void Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => {
      if (generation !== this.morphGeneration) return;
      setItemViewerState(item, 'morphing', false);
      this.morphingItem = undefined;
    });
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    this._open = next;
    this.requestUpdate('open', old);
  }

  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  private updateLiveRegion(): void {
    const count = this.imageCount();
    const formatter = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
      useGrouping: false,
    });
    this.liveText =
      count === 0
        ? ''
        : this.localize('lightboxImagePosition', undefined, {
          index: formatter.format(this.currentIndex() + 1),
          total: formatter.format(count),
        });
  }

  private captureAnnouncementBaseline(): void {
    this.announcementBaseline = {
      index: this.currentIndex(),
      images: this.activeImages,
      source: this.imageSource,
    };
  }

  private showsDetails(): boolean {
    return this.slotPresence.has('details') && !this.itemMode &&
      (this.imageSource === undefined
        ? this.imageCount() > 0
        : this.sourceBindingCurrent && this.sourceController.state === 'ready');
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.sourceBindingCurrent = this.sourceController.update(this.imageSource, this.effectiveLocale);
    this.toggleAttribute('data-items', this.itemMode);
    if (changed.has('index') || changed.has('open')) this.pauseVideos();
    // A programmatic change or a close mid-drag drops the gesture; the slide snaps into place.
    if ((changed.has('index') || changed.has('open') || changed.has('zoomLevel')) && this.swipe) this.releaseDrag(false);
    if ((changed.has('index') || changed.has('imageSource') || changed.has('itemsVersion')) && this.zoomLevel !== 1) this.zoomLevel = 1;
    if (this.sourceBindingCurrent && (changed.has('itemsVersion') || changed.has('images') || changed.has('index') || changed.has('imageSource') || changed.has('sourceState'))) {
      const index = changed.has('index') ? undefined : this.index;
      const intent = this.navigationIntent + 1;
      this.syncImages();
      if (index !== undefined && this.index !== index && this.navigationIntent === intent && this.sourceBindingCurrent) {
        this.pendingIndexChange = intent;
      }
    }
    if (this.sourceBindingCurrent && this.imageSource !== undefined) {
      this.sourceController.select(this.currentIndex());
      const count = this.sourceController.count;
      if (this.withThumbnails && count > 1) this.sourceController.requestThumbnails(...this.thumbnailRange(count, this.currentIndex()));
    }
    if (!this.sourceBindingCurrent) {
      // A provider callback can replace the binding inside this update. Lit folds writes made
      // during willUpdate into the current cycle, so schedule a named paint for the newest input.
      queueDocumentMicrotask(this.ownerDocument, () => { if (this.isConnected) this.sourceState++; });
    }
    if (this.sourceBindingCurrent && (changed.has('index') || changed.has('itemsVersion') || changed.has('images') || changed.has('imageSource') || changed.has('sourceState') || changed.has('strings') || changed.has('locale'))) {
      this.updateLiveRegion();
    }
    if (this.open && !this.showsDetails()) {
      const details = this.renderRoot.querySelector<HTMLElement>('[part="details"]:not([hidden])');
      if (details && composedContains(details, deepActiveElementIn(this.ownerDocument))) {
        focusFirstAvailable([this.renderRoot.querySelector<HTMLElement>('[part="close-button"]')]);
      }
    }
    if (changed.has('open')) {
      if (this.open) {
        this.modalSurface.open(() => this.activateOverlay());
      } else {
        const hadOverlay = this.overlay !== undefined;
        this.modalSurface.close(hadOverlay, () => this.deactivateOverlay(), () => !this.open);
      }
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('index') || changed.has('imageSource') || changed.has('images')) {
      const details = this.renderRoot.querySelector<HTMLElement>('[part="details"]');
      if (details) details.scrollTop = 0;
    }
    // Reconnecting establishes a silent baseline for navigation announcements.
    const isConnectionBaseline =
      this.announcementBaseline?.index === this.currentIndex() &&
      this.announcementBaseline.images === this.activeImages &&
      this.announcementBaseline.source === this.imageSource;
    if (
      !isConnectionBaseline &&
      this.sourceBindingCurrent &&
      this.open &&
      this.liveText !== '' &&
      isAccessibilityVisible(this) &&
      (changed.has('index') || changed.has('itemsVersion') || changed.has('images') || changed.has('imageSource'))
    ) {
      this.announcements.announcePolite(this.liveText);
    }
    const sourceError = this.sourceBindingCurrent && this.imageSource !== undefined && this.sourceController.state === 'error';
    if (!sourceError) this.sourceErrorAnnounced = false;
    if (sourceError && !this.sourceErrorAnnounced && this.sourceHasRendered && this.open && isAccessibilityVisible(this)) {
      this.sourceErrorAnnounced = true;
      this.announcements.announcePolite(this.localize('imageViewerFailedToLoad'));
    }
    this.sourceHasRendered = true;
    if (this.isConnected && this.sourceBindingCurrent) this.captureAnnouncementBaseline();
    if (changed.has('open') && this.open) {
      this.modalSurface.show();
      this.overlay?.focusInitial();
    }
    let currentSourceChanged = false;
    if (changed.has('images')) {
      const previousImages = changed.get('images') as readonly LyraLightboxImage[] | undefined;
      const previousIndex = changed.has('index')
        ? (changed.get('index') as number | undefined) ?? 0
        : this.index;
      const oldCurrent = previousImages?.[
        previousImages.length > 0
          ? finiteCount(previousIndex, 0, previousImages.length - 1)
          : 0
      ];
      currentSourceChanged = oldCurrent?.src !== this.images[this.currentIndex()]?.src;
    }
    const sourceImage = this.imageSource === undefined ? undefined : this.sourceController.image;
    currentSourceChanged ||= changed.has('imageSource') || (sourceImage !== undefined && sourceImage !== this.lastSourceImage);
    this.lastSourceImage = sourceImage;
    const shownSrc = this.imageSource === undefined ? this.activeImages[this.currentIndex()]?.src ?? '' : '';
    if (this.itemMode && changed.has('itemsVersion') && shownSrc !== this.lastShownSrc) currentSourceChanged = true;
    this.lastShownSrc = shownSrc;
    if (this.open && (changed.has('index') || currentSourceChanged)) {
      this.frameEl?.resetView();
    }
    const current = this.currentIndex();
    const record = this.itemMode ? this.itemRecords[current] : undefined;
    if (this.open && this.firstUpdateDone && changed.has('index') && this.renderedIndex !== current) {
      this.animateSlide(this.effectiveDirection === 'rtl' ? current < this.renderedIndex : current > this.renderedIndex);
    }
    if (changed.has('open') && this.open && this.firstUpdateDone) {
      this.cancelTransitionAnimations();
      this.transitionAnimations = this.startSurfaceAnimations(true);
      this.markMorphing(record?.element, this.transitionAnimations);
    }
    for (const item of this.itemRecords) {
      const active = this.open && item === record;
      item.element.toggleAttribute('data-active', active);
      setItemViewerState(item.element, 'active', active);
    }
    setCustomState(this.lightboxInternals, 'open', this.open);
    setCustomState(this.lightboxInternals, 'zoomed', this.zoomLevel > 1);
    const intent = this.pendingIndexChange;
    this.pendingIndexChange = undefined;
    if (intent === this.navigationIntent) {
      this.emit('lr-index-change', { index: this.index });
      this.emit('lr-item-change', {
        index: this.index,
        previousIndex: this.renderedIndex,
        item: record?.element ?? null,
        previousItem: this.renderedRecord?.element ?? null,
      });
    }
    this.renderedIndex = current;
    this.renderedRecord = record;
    this.firstUpdateDone = true;
    this.swipeRelease = 0;
    this.syncCustomSlide();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const generation = ++this.connectionGeneration;
    const connectionDocument = this.ownerDocument;
    this.addEventListener('click', this.onHostClick);
    this.syncItems();
    if (typeof MutationObserver === 'function') {
      this.itemObserver?.disconnect();
      this.itemObserver = new MutationObserver(() => this.syncItems());
      this.itemObserver.observe(this, { childList: true, subtree: true });
    }
    this.captureAnnouncementBaseline();
    // Moving an open host can reconnect it without another Lit update.
    if (this.hasUpdated && this.open) {
      if (this.overlay?.isActive()) {
        this.overlay.resume();
      } else {
        this.activateOverlay();
      }
      queueDocumentMicrotask(connectionDocument, () => {
        if (
          this.connectionGeneration === generation &&
          this.ownerDocument === connectionDocument &&
          this.isConnected &&
          this.open
        ) {
          this.modalSurface.show();
          this.overlay?.focusInitial();
        }
      });
    }
  }

  override disconnectedCallback(): void {
    const generation = ++this.connectionGeneration;
    const connectionDocument = this.ownerDocument;
    this.announcementBaseline = undefined;
    this.sourceErrorAnnounced = false;
    this.sourceHasRendered = false;
    this.lastSourceImage = undefined;
    this.removeEventListener('click', this.onHostClick);
    this.itemObserver?.disconnect();
    this.itemObserver = undefined;
    this.releaseDrag(false);
    this.removeCustomSlide();
    this.cancelTransitionAnimations();
    this.removeAttribute('data-closing');
    super.disconnectedCallback();
    this.modalSurface.disconnect();
    this.overlay?.suspend();
    if (this.open) {
      // Give a synchronous reparent time to reconnect before delivering unmount events.
      queueDocumentMicrotask(connectionDocument, () => {
        if (
          this.connectionGeneration === generation &&
          this.ownerDocument === connectionDocument &&
          !this.isConnected &&
          this.open
        ) {
          this.transitionGeneration++;
          this.emit('lr-hide', { source: this });
          this.applyOpenState(false);
          this.emit('lr-close', { reason: 'unmount' });
          this.emit('lr-after-hide', null);
        }
      });
    }
  }

  private activateOverlay(): void {
    if (this.overlay?.isActive()) return;
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part~="panel"]') ?? null,
      onEscape: () => {
        const panel = this.renderRoot.querySelector('[part~="panel"]') ?? this;
        void this.closeFrom('escape', panel);
      },
      onBackdrop: () => {
        const backdrop = this.renderRoot.querySelector('[part="backdrop"]') ?? this;
        void this.closeFrom('backdrop', backdrop);
      },
      preferredInitialFocus: () => this.shadowRoot?.querySelector<HTMLElement>('[part="close-button"]') ?? null,
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  private deactivateOverlay(): void {
    this.overlay?.deactivate();
    this.overlay = undefined;
  }

  private onBackdropClick = (): void => {
    if (!this.lightDismiss) return;
    this.overlay?.dismissBackdrop();
  };

  private onCloseButtonClick = (): void => {
    const button = this.renderRoot.querySelector('[part="close-button"]') ?? this;
    void this.closeFrom('close-button', button);
  };

  private onPanelKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || shouldIgnoreNavigationKey(event) || event.shiftKey) return;
    // Details and slotted controls keep their own scrolling and navigation keys.
    for (const target of event.composedPath() as Node[]) {
      if (target === this) break;
      if (isElement(target) && target.getAttribute('part') === 'details' && target.getRootNode() === this.shadowRoot) return;
      if (
        isElement(target) && target.getRootNode() !== this.shadowRoot &&
        target.matches('a[href], button, [role="button"], [role="link"], [role="slider"], input, select, textarea, [contenteditable]:not([contenteditable="false"])')
      ) return;
    }
    if ((event.composedPath() as Node[]).some((node) => isElement(node) && node.localName === 'video')) return;
    if (
      keyEventOwnedByInnerControl(event, {
        container: this,
        ownerTag: tag('pan-zoom'),
      })
    ) return;
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
      this.goTo(this.imageCount() - 1);
    }
  };

  constructor() {
    super();
    // Next/previous disable at the ends without `loop`; focus stays inside the modal.
    repairControlFocusOnUpdate(this, () => [
      this.renderRoot.querySelector<HTMLElement>('[part="close-button"]'),
      this.renderRoot.querySelector<HTMLElement>('[part~="frame"]'),
    ]);
    // Capped content takes a tab stop only while there is more to scroll to.
    trackScrollRegions(this, () => {
      const caption = this.renderRoot.querySelector<HTMLElement>('[part="caption"]');
      const details = this.renderRoot.querySelector<HTMLElement>('[part="details"]:not([hidden])');
      return [caption && { el: caption, role: false }, details && { el: details, name: this.localize('details') }];
    });
  }

  /** The `[start, end)` positions the thumbnail strip shows around `current`. */
  private thumbnailRange(count: number, current: number): [number, number] {
    const size = this.imageSource === undefined ? MAX_THUMBNAILS : SOURCE_THUMBNAIL_WINDOW;
    const start = Math.max(0, Math.min(current - Math.floor(size / 2), count - size));
    return [start, Math.min(count, start + size)];
  }

  private renderThumbnails(count: number, current: number): TemplateResult | typeof nothing {
    if (!this.withThumbnails || count < 2) return nothing;
    const sourceMode = this.imageSource !== undefined;
    const [start, end] = this.thumbnailRange(count, current);
    const formatter = getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 0, useGrouping: false });
    const thumbs: TemplateResult[] = [];
    for (let i = start; i < end; i++) {
      // Source mode reads the strip window's descriptors; one still loading shows its number.
      const image = sourceMode ? this.sourceController.thumbnailAt(i) : this.activeImages[i];
      if (!image && !sourceMode) continue;
      const record = this.itemMode ? this.itemRecords[i] : undefined;
      const media = record ? record.thumbnail || (record.type === 'image' ? image?.src : '') : image?.thumbnail || image?.src;
      const source = safeMediaSrc(media);
      const active = i === current;
      const position = this.localize('lightboxImagePosition', undefined, {
        index: formatter.format(i + 1),
        total: formatter.format(count),
      });
      const content = source
        ? html`<img src=${source} alt="" loading="lazy" decoding="async" />`
        : record?.type === 'video' ? playIcon() : html`<span aria-hidden="true">${formatter.format(i + 1)}</span>`;
      thumbs.push(html`<button
        type="button"
        part=${active ? 'thumbnail thumbnail-active' : 'thumbnail'}
        aria-label=${image?.alt || position}
        aria-current=${active ? 'true' : 'false'}
        @click=${() => this.goTo(i)}
      >${content}</button>`);
    }
    return html`<div part="thumbnails">${thumbs}</div>`;
  }

  override render(): TemplateResult {
    const count = this.imageCount();
    const current = this.currentIndex();
    const image = this.imageSource === undefined
      ? (count > 0 ? this.activeImages[current] : undefined) : this.sourceController.image;
    const record = this.itemMode ? this.itemRecords[current] : undefined;
    const isVideo = record?.type === 'video';
    const isCustom = record?.type === 'custom';
    const mediaSrc = isVideo ? safeMediaSrc(image?.src) ?? '' : '';
    const sourceState = this.imageSource === undefined ? undefined : this.sourceController.state;
    const label = this.accessibleLabel?.trim()
      ? this.accessibleLabel
      : (this.label ?? '').trim() ? this.label : this.localize('lightboxLabel');
    const hasCaption = Boolean(image?.caption);
    const formatter = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
      useGrouping: false,
    });
    const positionText =
      count > 0
        ? this.localize('lightboxImagePosition', undefined, {
          index: formatter.format(current + 1),
          total: formatter.format(count),
        })
        : '';
    const zoomed = this.zoomLevel > 1;
    // The toolbar zoom toggle belongs to the slotted-item viewer; data mode keeps its original
    // chrome (the embedded pan-zoom controls) so existing galleries gain no new button.
    const showZoom = this.itemMode && !this.withoutZoom && !isVideo && !isCustom && count > 0;
    const showDetails = this.showsDetails();
    const detailsPlacement = this.detailsPlacement === 'bottom' ? 'bottom' : 'end';

    return html`<slot></slot><div part="surface">${this.nativeModal.render(html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel dialog"
        role=${this.open && !this.nativeModal.requested ? 'dialog' : nothing}
        aria-modal=${this.open && !this.nativeModal.requested ? 'true' : nothing}
        aria-label=${this.nativeModal.requested ? nothing : label}
        aria-describedby=${hasCaption && !this.nativeModal.requested ? this.captionId : nothing}
        tabindex="-1"
        @keydown=${this.onPanelKeyDown}
      >
        <div part="toolbar">
          ${!this.withoutCounter && count > 0 ? html`<span part="counter">${positionText}</span>` : nothing}
          <div part="actions" ?hidden=${!this.slotPresence.has('actions')}>
            <slot name="actions"></slot>
          </div>
          ${showZoom
            ? html`<button
                part="zoom-button"
                type="button"
                aria-label=${this.localize(zoomed ? 'zoomOut' : 'zoomIn')}
                @click=${this.toggleZoom}
              >${zoomed
                ? html`<slot name="zoom-out-icon">${minusIcon()}</slot>`
                : html`<slot name="zoom-in-icon">${plusIcon()}</slot>`}</button>`
            : nothing}
          <button part="close-button" type="button" aria-label=${this.localize('close')} @click=${this.onCloseButtonClick}>
            <slot name="close-icon">${closeIcon()}</slot>
          </button>
        </div>
        <div class="media-layout" data-details-placement=${showDetails ? detailsPlacement : nothing}>
          <div
            part="stage scroll-container"
            aria-busy=${sourceState === 'loading' ? 'true' : 'false'}
            @pointerdown=${this.onSwipeStart}
            @pointermove=${this.onSwipeMove}
            @pointerup=${this.onSwipeEnd}
            @pointercancel=${this.onSwipeCancel}
          >
            ${sourceState === 'loading' ? html`<p part="source-loading">${this.localize('loading')}</p>` : nothing}
            ${sourceState === 'error' ? html`<div part="source-error">${this.localize('imageViewerFailedToLoad')}<button part="source-retry" type="button" @click=${() => this.sourceController.retry(this.currentIndex())}>${this.localize('retry')}</button></div>` : nothing}
            ${count > 1 && !this.withoutNavigation
              ? html`
                  <button
                    part="previous-button navigation-button navigation-button-previous"
                    type="button"
                    aria-label=${this.localize('previous')}
                    ?disabled=${!this.loop && current === 0}
                    @click=${this.previous}
                  >
                    <span part="previous-glyph"><slot name="previous-icon">${chevronIcon()}</slot></span>
                  </button>
                `
              : nothing}
            <div part="slide">
              ${isVideo
                ? keyed(current, html`<video
                    part="video"
                    controls
                    playsinline
                    preload="metadata"
                    src=${mediaSrc}
                    poster=${ifDefined(record?.thumbnail || undefined)}
                    aria-label=${ifDefined(image?.alt || undefined)}
                    width=${ifDefined(record?.width)}
                    height=${ifDefined(record?.height)}
                  ></video>`)
                : nothing}
              ${isCustom ? html`<slot name=${CUSTOM_SLIDE_SLOT}></slot>` : nothing}
              <lr-pan-zoom
                part="frame image"
                exportparts="viewport:frame-viewport,content:frame-content,controls:frame-controls"
                ?hidden=${isVideo || isCustom}
                .src=${live(isVideo || isCustom ? '' : image?.src ?? '')}
                alt=${image?.alt ?? ''}
                .fit=${this.fit}
                .minZoom=${this.withoutZoom ? 1 : this.minZoom}
                .maxZoom=${this.withoutZoom ? 1 : this.maxZoom}
                .zoomStep=${this.zoomStep}
                .accessibleLabel=${positionText || null}
                @focus=${(event: Event) => event.stopPropagation()}
                @blur=${(event: Event) => event.stopPropagation()}
                @lr-zoom-change=${this.onZoomChange}
              ></lr-pan-zoom>
            </div>
            ${count > 1 && !this.withoutNavigation
              ? html`
                  <button
                    part="next-button navigation-button navigation-button-next"
                    type="button"
                    aria-label=${this.localize('next')}
                    ?disabled=${!this.loop && current === count - 1}
                    @click=${this.next}
                  >
                    <span part="next-glyph"><slot name="next-icon">${chevronIcon()}</slot></span>
                  </button>
                `
              : nothing}
          </div>
          <div part="details" ?hidden=${!showDetails}>
            <slot name="details"></slot>
          </div>
        </div>
        ${hasCaption ? html`<p part="caption" id=${this.captionId}>${image!.caption}</p>` : nothing}
        ${this.renderThumbnails(count, current)}
        <span part="live-region" class="sr-only" aria-hidden="true"
          >${this.liveText}</span
        >
        ${this.nativeModal.renderHelperSlot()}
      </div>
    `, { label, describedBy: hasCaption ? this.captionId : null })}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-lightbox': LyraLightbox;
  }
}
