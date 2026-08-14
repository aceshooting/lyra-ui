import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { isAccessibilityVisible, nextId, srOnly } from '../../../internal/a11y.js';
import { closeIcon, chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { styles } from './lightbox.styles.js';
import '../pan-zoom/pan-zoom.class.js';
import type { LyraPanZoom } from '../pan-zoom/pan-zoom.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close, LYRA_DEFAULT_lightboxImagePosition, LYRA_DEFAULT_lightboxLabel, LYRA_DEFAULT_next, LYRA_DEFAULT_previous } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** One image in the set `<lr-lightbox>` browses. `alt`/`caption` are caller-supplied data
 *  (like a filename), not routed through `localize()` -- only the component's own chrome
 *  strings are. */
export interface LyraLightboxImage {
  /** Full-resolution URL. Passed straight through to the embedded `<lr-pan-zoom>`'s own
   *  `src`, which already runs it through `safeMediaSrc()` -- no separate validation needed here. */
  readonly src: string;
  /** Accessible alt text. Defaults to `''` (decorative) when omitted; consumers should supply
   *  real alt text for meaningful images. */
  readonly alt?: string;
  /** Optional visible caption for this image, rendered in `part="caption"` below the stage. */
  readonly caption?: string;
}

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
        images.push(Object.freeze({
          src,
          ...(typeof alt === 'string' ? { alt } : {}),
          ...(typeof caption === 'string' ? { caption } : {}),
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
 * Reason a lightbox was dismissed, forwarded as the `lr-lightbox-close` event detail --
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

/** The concrete affordance that requested a lightbox hide transition. */
export interface LyraLightboxHideDetail {
  source: Element;
}

export interface LyraLightboxEventMap {
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<LyraLightboxHideDetail>;
  'lr-after-hide': CustomEvent<null>;
  'lr-lightbox-close': CustomEvent<LyraLightboxCloseReason>;
  'lr-index-change': CustomEvent<{ index: number }>;
  /** Not emitted by `LyraLightbox` itself -- the embedded `<lr-pan-zoom>` already
   *  dispatches this via a composed, bubbling `emit()` call, which continues through this
   *  element's own shadow boundary with no re-dispatch needed. Listed here purely for
   *  discoverability. */
  'lr-zoom-change': CustomEvent<{ zoom: number }>;
}

function ownsNavigationKey(event: KeyboardEvent): boolean {
  for (const target of event.composedPath()) {
    const element = target as Element;
    if (typeof element.matches !== 'function') continue;
    if (element.localName === 'lr-pan-zoom') return true;
    if (element.matches(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
      '[role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"], ' +
      '[role="slider"], [role="listbox"], [role="menu"], [role="menuitem"], [role="radio"], ' +
      '[role="radiogroup"], [role="grid"], [role="tree"], [role="tablist"]',
    )) return true;
  }
  return false;
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
 * `<lr-lightbox>` — a full-screen, modal, click-to-enlarge image viewer with prev/next
 * navigation across an ordered set of images. It has no Web Awesome/Shoelace counterpart, so
 * its API follows this library's own conventions.
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
 * `lr-after-show` after the open panel renders. `hide()`/`close()` and post-render writes to
 * `open=false` emit cancelable `lr-hide`, then cancelable `lr-lightbox-close`, followed by
 * `lr-after-hide` after the closed state renders. A veto leaves the property and reflected
 * attribute synchronized. Initial `open` markup is state rather than a transition and emits no
 * lifecycle events.
 *
 * **Scope for v1 (deliberate, not oversights):** no default slot / no arbitrary slotted content
 * per image (data-driven via `images` only); no dot-style indicators (a textual counter scales
 * better to photo-set sizes); no visual open/close animation (`show()`/`hide()` still expose the
 * shared before/after lifecycle contract); no
 * click-on-image-to-navigate (the image is already meaningfully interactive -- it focuses the
 * zoomable frame's viewport and drives its native scroll-to-pan); no touch-swipe-to-navigate.
 *
 * @customElement lr-lightbox
 * @slot actions - Optional extra toolbar buttons (e.g. download/share/delete), rendered in
 *   `part="toolbar"` between the counter and the close button.
 * @event lr-lightbox-close - `detail: LyraLightboxCloseReason`. Cancelable -- a listener
 *   calling `preventDefault()` stops the lightbox from closing, for every dismissal path
 *   (Escape, backdrop, the built-in close button, or a consumer's own `close()` call). Fired
 *   whenever the lightbox is dismissed via Escape, a backdrop click, the built-in close button,
 *   a `close()` call, or (with reason `'unmount'`, not cancelable in practice since the element
 *   is already being removed) removal from the DOM by anything else while still open.
 * @event lr-show - Cancelable request fired by `show()` before `open` changes.
 * @event lr-after-show - Fired after a successful `show()` has rendered the open panel.
 * @event lr-hide - Cancelable request fired before `lr-lightbox-close`; `detail: { source }`,
 *   where `source` is the close button, backdrop, panel (for Escape), or host (for API writes).
 * @event lr-after-hide - Fired after a successful `hide()`/`close()` has rendered closed.
 * @event lr-index-change - Fired for `next()`/`previous()`/`goTo()` navigation, including the
 *   built-in button and keyboard paths. Not fired when a consumer sets `index`/`images` directly.
 *   `detail: { index }` is always the rendered integer index.
 * @event lr-zoom-change - Not emitted by `LyraLightbox` itself -- see the interface doc above.
 *   `detail: { zoom }`.
 * @csspart backdrop - The full-viewport scrim, positioned behind `panel`.
 * @csspart panel - `role="dialog"` while open, `aria-modal="true"`, `tabindex="-1"`. Fills the
 *   padded safe area -- unlike `<lr-dialog>`, it does not shrink-wrap to content, since
 *   maximizing image real estate is the point.
 * @csspart toolbar - Top row: `counter` (start), the `actions` slot wrapper, `close-button` (end).
 * @csspart counter - Visible, localized "Image N of Total" text. Omitted entirely when
 *   `showCounter` is `false`.
 * @csspart live-region - Visually-hidden, `aria-hidden` mirror of the current position. On every
 *   `index` change while open, the spoken copy is appended to the shared light-DOM polite sink,
 *   regardless of trigger (button, keyboard, or a consumer setting `index`/`images` directly),
 *   unless the lightbox or a composed ancestor is excluded from the accessibility tree. The
 *   mirror is decoupled from the visible `counter` so an unrelated re-render never causes a
 *   spurious re-announcement.
 * @csspart actions - Wrapper around the `actions` slot; `hidden` when nothing is slotted.
 * @csspart close-button - The close button. Always rendered -- unlike `<lr-dialog>`'s opt-in
 *   `closable`, a full-screen lightbox has no other built-in chrome, so this is not optional.
 * @csspart stage - Houses the embedded `<lr-pan-zoom>` plus the floating
 *   `previous-button`/`next-button`.
 * @csspart frame - The embedded `<lr-pan-zoom>` element itself.
 * @csspart frame-viewport - The embedded pan-zoom's scrollable viewport.
 * @csspart frame-content - The embedded pan-zoom's transformed content wrapper.
 * @csspart frame-controls - The embedded pan-zoom's zoom controls.
 * @csspart previous-button - Floating, absolutely positioned inside `stage`. Rendered only when
 *   `images.length > 1`.
 * @csspart previous-glyph - The `chevronIcon()` inside `previous-button`, mirrored under RTL.
 * @csspart next-button - Symmetric to `previous-button`.
 * @csspart next-glyph - Symmetric to `previous-glyph`.
 * @csspart caption - The current image's caption text. Only rendered when the current image's
 *   `caption` is non-empty. Its `id` is the `aria-describedby` target on `panel`.
 * @cssprop --lr-lightbox-overlay-color - The backdrop scrim color.
 * @cssprop --lr-lightbox-control-bg - Background for every floating/toolbar icon button.
 * @cssprop --lr-lightbox-control-color - Icon/text color paired with `--lr-lightbox-control-bg`.
 * @status stable
 * @since 4.0.0
 */
export class LyraLightbox extends LyraElement<LyraLightboxEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
    lightboxImagePosition: LYRA_DEFAULT_lightboxImagePosition,
    lightboxLabel: LYRA_DEFAULT_lightboxLabel,
    next: LYRA_DEFAULT_next,
    previous: LYRA_DEFAULT_previous,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, srOnly, styles];

  private _open = false;

  /** Whether the lightbox is open. Post-render writes run the same cancelable lifecycle as
   *  `show()`/`hide()`/`close()`; initial markup is state and emits nothing. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
    if (this.coalesceOpenRequest(normalized)) return;
    if (normalized === this._open) return;
    if (!this.hasUpdated) {
      this.applyOpenState(normalized);
      return;
    }
    if (normalized) void this.show();
    else void this.close('api');
  }

  private _images: readonly LyraLightboxImage[] = EMPTY_LIGHTBOX_IMAGES;

  /** The ordered, bounded, immutable set of images being browsed. Assign a new collection to
   * update it; malformed records are omitted and at most 10,000 candidates are inspected. */
  @property({ attribute: false })
  get images(): readonly LyraLightboxImage[] {
    return this._images;
  }
  set images(value: readonly LyraLightboxImage[]) {
    const old = this._images;
    this._images = snapshotLightboxImages(value);
    this.requestUpdate('images', old);
  }

  /** The currently displayed image. Clamped defensively for rendering (out-of-range/negative/
   *  non-integer never throws) and silently re-synced onto this property (no event) when
   *  `images` shrinks -- mirrors `<lr-carousel>`'s `normalizedIndex()`/`syncSlides()` split. */
  @property({ type: Number, reflect: true }) index = 0;

  /** Wraps prev/next past the ends. Mirrors `<lr-carousel>`'s `loop` 1:1. */
  @property({ type: Boolean, reflect: true }) loop = false;

  /** Dismisses the lightbox on a backdrop click. Opt-in and `false` by default -- mirrors
   *  `<lr-dialog>`'s `lightDismiss` exactly (name, default, no reflect), which in turn matches
   *  `wa-dialog`. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false;

  /** Shows/hides only the visible `part="counter"`. The accessibility `part="live-region"`
   *  announcement remains active so navigation is still conveyed when visual chrome is hidden.
   *  Mirrors `<lr-carousel>`'s `showIndicators` (name shape, no reflect). Uses the shared
   *  parse-only `trueDefaultBooleanConverter` rather than Lit's default presence-based
   *  `type: Boolean` handling, so a plain-HTML consumer with no way to write a `.showCounter`
   *  property binding can still turn this off with `show-counter="false"`. Deliberately not
   *  reflected: nothing styles or queries `[show-counter]`, so the serializing half of a
   *  reflecting converter would be dead code on a modal that already churns attributes. */
  @property({ attribute: 'show-counter', converter: trueDefaultBooleanConverter }) showCounter = true;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.minZoom`. Same default as
   *  `<lr-pan-zoom>` itself. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeMinZoom
  @property({ type: Number, attribute: 'min-zoom' }) minZoom = 0.5;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.maxZoom`. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeMaxZoom
  @property({ type: Number, attribute: 'max-zoom' }) maxZoom = 4;

  /** Passed through to the embedded `<lr-pan-zoom>` as `.zoomStep`. */
  // numeric-guard-exempt: pure pass-through to <lr-pan-zoom>, which already normalizes it via its own safeZoomStep
  @property({ type: Number, attribute: 'zoom-step' }) zoomStep = 0.25;

  /** Host-level `aria-label` override for the panel's accessible name -- wins over the
   *  localized `lightboxLabel` default. Exactly `<lr-pan-zoom>`'s own `accessibleLabel`
   *  pattern (no other label source to arbitrate against here). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private readonly slotPresence = new SlotPresenceController(this);
  @state() private liveText = '';

  @query('lr-pan-zoom') private frameEl?: LyraPanZoom;

  private overlay?: OverlayHandle;
  private announcementSink?: AnnouncementSink;
  private announcementBaseline?: {
    index: number;
    images: readonly LyraLightboxImage[];
  };
  private connectionGeneration = 0;
  private transitionGeneration = 0;
  private openRequestTarget?: boolean;
  private openRequestDuringPreflight?: boolean;
  private readonly captionId = nextId('lightbox-caption');

  /** Clamped, always-valid index for rendering -- never throws on an out-of-range, negative,
   *  non-integer, or non-finite `index`. */
  private currentIndex(): number {
    const count = this.images.length;
    if (count === 0) return 0;
    return finiteCount(this.index, 0, count - 1);
  }

  // Silently re-syncs `index` onto the clamped value with no event -- mirrors
  // <lr-carousel>'s syncSlides() clamp-without-event behavior, e.g. when `images` shrinks out
  // from under the current index.
  private syncImages(): void {
    const current = this.currentIndex();
    if (this.index !== current) this.index = current;
  }

  private changeTo(index: number): void {
    const count = this.images.length;
    if (count === 0 || !Number.isFinite(index)) return;
    const requested = finiteInteger(index, 0);
    const next = this.loop
      ? ((requested % count) + count) % count
      : Math.min(count - 1, Math.max(0, requested));
    if (next === this.currentIndex()) return;
    this.index = next;
    this.emit('lr-index-change', { index: next });
  }

  /** Advances to the next image, respecting `loop`. */
  next: () => void = (): void => this.changeTo(this.currentIndex() + 1);
  /** Moves to the previous image, respecting `loop`. */
  previous: () => void = (): void => this.changeTo(this.currentIndex() - 1);

  /** Jumps to a finite image index. Fractional values are truncated toward zero before
   *  clamping or loop wrapping, so `lr-index-change.detail.index` is always the rendered
   *  integer index. Non-finite values are no-ops. */
  goTo: (index: number) => void = (index: number): void => this.changeTo(index);

  /** Request opening, then resolve once the open panel is rendered. */
  async show(): Promise<void> {
    if (this.coalesceOpenRequest(true) || this._open) return;
    this.beginOpenRequest(true);
    const prevented = this.emit('lr-show', null, { cancelable: true }).defaultPrevented;
    const superseded = this.openRequestWasSuperseded(true);
    this.finishOpenRequest();
    if (prevented || superseded) {
      this.syncOpenAttribute();
      return;
    }
    this.applyOpenState(true);
    const generation = ++this.transitionGeneration;
    await this.updateComplete;
    if (generation === this.transitionGeneration && this._open) this.emit('lr-after-show', null);
  }

  /** Close with the standard API reason. */
  hide(): Promise<void> {
    return this.close('api');
  }

  /**
   * Close the lightbox and return focus to whatever had it before the lightbox opened. `reason`
   * is forwarded as the `lr-lightbox-close` detail -- built-in triggers pass `'escape'`/
   * `'backdrop'`/`'close-button'`; a consumer's own close affordance (e.g. an `actions`-slotted
   * button) should call this directly with its own reason string.
   */
  async close(reason: LyraLightboxCloseReason = 'api'): Promise<void> {
    return this.closeFrom(reason, this);
  }

  private async closeFrom(reason: LyraLightboxCloseReason, source: Element): Promise<void> {
    if (this.coalesceOpenRequest(false) || !this._open) return;
    this.beginOpenRequest(false);
    if (
      this.emit('lr-hide', { source }, { cancelable: true }).defaultPrevented ||
      this.openRequestWasSuperseded(false)
    ) {
      this.finishOpenRequest();
      this.syncOpenAttribute();
      return;
    }
    const event = this.emit('lr-lightbox-close', reason, { cancelable: true });
    if (event.defaultPrevented || this.openRequestWasSuperseded(false)) {
      this.finishOpenRequest();
      this.syncOpenAttribute();
      return;
    }
    this.finishOpenRequest();
    this.applyOpenState(false);
    const generation = ++this.transitionGeneration;
    await this.updateComplete;
    if (generation === this.transitionGeneration && !this._open) this.emit('lr-after-hide', null);
  }

  private coalesceOpenRequest(next: boolean): boolean {
    if (this.openRequestTarget === undefined) return false;
    this.openRequestDuringPreflight = next;
    return true;
  }

  private beginOpenRequest(next: boolean): void {
    this.openRequestTarget = next;
    this.openRequestDuringPreflight = undefined;
  }

  private openRequestWasSuperseded(next: boolean): boolean {
    return this.openRequestDuringPreflight !== undefined &&
      this.openRequestDuringPreflight !== next;
  }

  private finishOpenRequest(): void {
    this.openRequestTarget = undefined;
    this.openRequestDuringPreflight = undefined;
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
    const count = this.images.length;
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
      images: this.images,
    };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('images') || changed.has('index')) {
      this.syncImages();
    }
    // Purely derived from already-current state (images/the just-synced index/strings/locale)
    // with no DOM measurement involved, so this belongs here, not in updated(): setting `liveText`
    // (a reactive property) from updated()/firstUpdated() schedules a *second* update on top of
    // the one that just finished, which Lit's dev-mode console flags ("scheduled an update ...
    // after an update completed") -- mirrors lr-multi-split's/lr-virtual-list's identical
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
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // The first render (including initially-open markup) is state, not a navigation. Each
    // connection captures the current image/index as a baseline, so an update requested while
    // detached stays silent even when its Lit update flushes only after reattachment.
    const isConnectionBaseline =
      this.announcementBaseline?.index === this.currentIndex() &&
      this.announcementBaseline.images === this.images;
    if (
      !isConnectionBaseline &&
      this.open &&
      this.liveText !== '' &&
      isAccessibilityVisible(this) &&
      (changed.has('index') || changed.has('images'))
    ) {
      this.announcementSink?.announce(this.liveText);
    }
    if (this.isConnected) this.captureAnnouncementBaseline();
    if (changed.has('open') && this.open) {
      this.overlay?.focusInitial();
    }
    // Imperative, not a binding -- see the class doc for why this is required for the reset to
    // keep working past the first navigation.
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
    if (this.open && (changed.has('index') || currentSourceChanged)) {
      this.frameEl?.resetView();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const generation = ++this.connectionGeneration;
    const connectionDocument = this.ownerDocument;
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.captureAnnouncementBaseline();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no update in between, so
    // willUpdate never reruns to notice `open` is still true -- restore what it dropped.
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
          this.overlay?.focusInitial();
        }
      });
    }
  }

  override disconnectedCallback(): void {
    const generation = ++this.connectionGeneration;
    const connectionDocument = this.ownerDocument;
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.announcementBaseline = undefined;
    super.disconnectedCallback();
    this.overlay?.suspend();
    if (this.open) {
      // Deferred one microtask so a synchronous reparent (disconnect immediately followed by
      // reconnect) isn't mistaken for a real removal -- mirrors <lr-dialog>'s identical
      // disconnectedCallback rationale.
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
          this.emit('lr-lightbox-close', 'unmount');
          this.emit('lr-after-hide', null);
        }
      });
    }
  }

  private activateOverlay(): void {
    if (this.overlay?.isActive()) return;
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => {
        const panel = this.renderRoot.querySelector('[part="panel"]') ?? this;
        void this.closeFrom('escape', panel);
      },
      onBackdrop: () => {
        const backdrop = this.renderRoot.querySelector('[part="backdrop"]') ?? this;
        void this.closeFrom('backdrop', backdrop);
      },
      // An intentionally safe default action -- a full-screen image grabbing focus should hand
      // it to a predictable, always-present, non-destructive escape hatch first, rather than
      // whatever happens to be first in DOM tab order (which could otherwise be a consumer's own
      // actions-slot content if placed before close-button).
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

  // RTL-aware, exactly mirroring <lr-carousel>'s onViewportKeyDown. Attached on part="panel"
  // itself so it sees keydowns bubbling from anywhere inside, including from within the embedded
  // <lr-pan-zoom>'s own shadow tree. Never conflicts with the frame's own +/-/0/=/_ zoom
  // shortcuts, which don't intercept Arrow/Home/End.
  private onPanelKeyDown = (event: KeyboardEvent): void => {
    if (ownsNavigationKey(event)) return;
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

  override render(): TemplateResult {
    const count = this.images.length;
    const current = this.currentIndex();
    const image = count > 0 ? this.images[current] : undefined;
    const label = this.accessibleLabel ?? this.localize('lightboxLabel');
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
          <div part="actions" ?hidden=${!this.slotPresence.has('actions')}>
            <slot name="actions"></slot>
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
          <lr-pan-zoom
            part="frame"
            exportparts="viewport:frame-viewport,content:frame-content,controls:frame-controls"
            src=${image?.src ?? ''}
            alt=${image?.alt ?? ''}
            .minZoom=${this.minZoom}
            .maxZoom=${this.maxZoom}
            .zoomStep=${this.zoomStep}
            .accessibleLabel=${positionText || null}
            @focus=${(event: Event) => event.stopPropagation()}
            @blur=${(event: Event) => event.stopPropagation()}
            @lr-focus=${(event: Event) => event.stopPropagation()}
            @lr-blur=${(event: Event) => event.stopPropagation()}
          ></lr-pan-zoom>
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
        <span part="live-region" class="sr-only" aria-hidden="true"
          >${this.liveText}</span
        >
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-lightbox': LyraLightbox;
  }
}
