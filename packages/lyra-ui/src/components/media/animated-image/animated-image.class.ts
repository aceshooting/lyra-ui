import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { playIcon, pauseIcon } from '../../../internal/icons.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { styles } from './animated-image.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_animatedImageDefaultAlt, LYRA_DEFAULT_pauseWithContext, LYRA_DEFAULT_playWithContext } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MAX_FROZEN_FRAME_DIMENSION = 8192;
const MAX_FROZEN_FRAME_PIXELS = 16_777_216;

export interface LyraAnimatedImageEventMap {
  'lr-load': CustomEvent<undefined>;
  'lr-error': CustomEvent<undefined>;
  'lr-play': CustomEvent<undefined>;
  'lr-pause': CustomEvent<undefined>;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<undefined>;
  'lr-focus': CustomEvent<undefined>;
}

/**
 * `<lr-animated-image>` -- displays an animated GIF/APNG/WebP with a
 * play/pause control, defaulting to a frozen first frame both at rest and
 * automatically under `prefers-reduced-motion: reduce` (unless the page
 * author explicitly opts back in via `respect-reduced-motion="false"`), so
 * motion is never forced on a user who asked for less of it.
 *
 * **Freeze-frame mechanism.** The live `<img>`'s `load` event handler
 * synchronously draws the just-loaded image to `[part="canvas"]` (a
 * DPR-aware `drawImage()`, the same pattern `<lr-heatmap>` uses for its own
 * canvas sizing) before any animation frames have had a chance to advance.
 * That captured frame is what pausing always reverts to -- it is not
 * re-captured on every pause, only once per successful `src` load. Both
 * `[part="image"]` and `[part="canvas"]` stay mounted at all times (never
 * `display: none`/removed) so the browser's native decode loop keeps running
 * even while visually covered by the frozen canvas; only opacity and
 * `aria-hidden` swap between them, driven by the effective `playing` state.
 *
 * **`play` vs. `playing`.** `play` is the caller's intent (settable and
 * reflected). `playing` is the read-only, reflected effect
 * after reduced-motion arbitration: `play && !(respectReducedMotion &&
 * <OS prefers-reduced-motion: reduce>)`. A page can set `.play = true` while
 * reduced motion still keeps the visual frozen -- `lr-play`/`lr-pause`
 * only fire on a real transition of the resolved `playing` value, never on a
 * `play` assignment that reduced motion blocks from taking visible effect.
 *
 * **Safety.** `src` is re-validated through `safeMediaSrc()` (the same
 * allowlist `<lr-media-card>` uses) before it is ever assigned to the real
 * `<img src>`. An empty `src` renders no `src` attribute and is not an
 * error; a non-empty `src` that fails the check is treated exactly like a
 * native image decode failure -- `lr-error` fires and no request is ever
 * attempted.
 *
 * **Decorative-only is not supported.** An explicit `alt=""` still falls
 * back to the localized `animatedImageDefaultAlt` string rather than staying
 * empty/presentational -- the same deliberate tradeoff `<lr-media-card>`'s
 * `imgAlt` getter already makes for its own `alt`/`filename` fallback chain.
 *
 * Deliberately no label/hint/error chrome -- this is not a form-associated
 * control (nothing resembling a value the user submits).
 *
 * @customElement lr-animated-image
 * @slot play-icon - Decorative custom play glyph shown while frozen/paused. Rendered in an inert,
 *   aria-hidden, pointer-transparent sibling layer over the play/pause button.
 * @slot pause-icon - Decorative custom pause glyph shown while playing. Rendered through the same
 *   inert sibling layer.
 * @event lr-load - The live `<img>` finished loading. Fires again on every successful subsequent `src` change.
 * @event lr-error - The live `<img>` failed to load, or `src` was non-empty but failed the safe-URL check. Never fires for an empty `src`.
 * @event lr-play - The effective `playing` state transitioned `false` -> `true`.
 * @event lr-pause - The effective `playing` state transitioned `true` -> `false` (including a reduced-motion change forcing a freeze while `play` stays `true`).
 * @event {FocusEvent} blur - Relayed once from the internal play/pause button as a bubbling,
 *   composed native event.
 * @event {FocusEvent} focus - Relayed once from the internal play/pause button as a bubbling,
 *   composed native event.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @csspart base - Root wrapper; positioning context for `control-box`.
 * @csspart image - The live `<img>`.
 * @csspart canvas - The frozen-frame `<canvas>`, shown in place of `image` while not playing.
 * @csspart control-box - The container that surrounds and backgrounds the play/pause button. Only rendered once loaded and error-free.
 * @csspart play-button - The `<button type="button">` inside `control-box` that toggles `play`.
 * @cssprop --lr-animated-image-control-box-size - The size of `control-box`. Defaults to `var(--lr-icon-button-size)`.
 * @cssprop --lr-animated-image-icon-size - The size of the play/pause icons. Defaults to `calc(var(--lr-icon-button-size) * 0.35)`.
 * @cssprop --control-box-size - Upstream-compatible alias for `--lr-animated-image-control-box-size`.
 * @cssprop --icon-size - Upstream-compatible alias for `--lr-animated-image-icon-size`.
 * @cssprop --lr-animated-image-max-height - Caps the rendered media's block-size. Defaults to `var(--lr-size-20rem)`.
 * @status stable
 * @since 4.0.0
 */
export class LyraAnimatedImage extends LyraElement<LyraAnimatedImageEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    animatedImageDefaultAlt: LYRA_DEFAULT_animatedImageDefaultAlt,
    pauseWithContext: LYRA_DEFAULT_pauseWithContext,
    playWithContext: LYRA_DEFAULT_playWithContext,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The path to the image to load. Always re-validated against a
   *  safe-scheme allowlist before use -- see the class doc. */
  @property() src = '';

  /** A description of the image used by assistive devices. Falls back to
   *  the localized `animatedImageDefaultAlt` when empty -- see the class doc. */
  @property() alt = '';

  /** Requests animated playback. Distinct from the read-only `playing`
   *  effect -- see the class doc's "`play` vs. `playing`" section. */
  @property({ type: Boolean, reflect: true }) play = false;

  /** When `true` (default) and the platform reports
   *  `prefers-reduced-motion: reduce`, playback stays frozen and
   *  `[part="play-button"]` is disabled regardless of `play`. Set to `false`
   *  to let `play` take effect even under a reduced-motion preference -- a
   *  deliberate, page-author-level override. */
  @property({
    type: Boolean,
    reflect: true,
    attribute: 'respect-reduced-motion',
    converter: trueDefaultBooleanConverter,
  })
  respectReducedMotion = true;

  /** Accessible-name override for `[part="play-button"]`. Maps to the
   *  host's `aria-label` attribute and, once set, wins verbatim over the
   *  computed per-state Play/Pause label in both play and pause states --
   *  it does not itself vary by state. Never touches `[part="image"]`'s
   *  `alt` / `[part="canvas"]`'s `aria-label`, which stay independently
   *  sourced from `alt`. A consumer wanting state-sensitive custom wording
   *  without losing the Play/Pause distinction should override the
   *  `playWithContext`/`pauseWithContext`/`animatedImageDefaultAlt` strings
   *  instead. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  @state() private hasLoaded = false;
  @state() private hasError = false;

  private _playing = false;
  private mediaQuery?: MediaQueryList;

  @query('[part="image"]') private imageEl?: HTMLImageElement;
  @query('[part="canvas"]') private canvasEl?: HTMLCanvasElement;
  @query('[part="play-button"]') private playButtonEl?: HTMLButtonElement;

  /** Lit's server renderer constructs the element without a browser-owned document. */
  private get ownerWindow(): Window | null {
    return (this.ownerDocument as Document | undefined)?.defaultView ?? null;
  }

  /** The effective playing state after reduced-motion arbitration -- also
   *  reflected as a `playing` host attribute. Read-only; control playback
   *  via `play`. */
  get playing(): boolean {
    return this._playing;
  }
  // Kept as a no-op setter (rather than omitted) so `el.playing = x` doesn't
  // throw in this strict-mode class body -- assigning has no defined
  // effect, per the class doc; control playback via `.play` instead.
  set playing(_value: boolean) {}

  override connectedCallback(): void {
    super.connectedCallback();
    this.mediaQuery = this.ownerWindow?.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.mediaQuery?.addEventListener('change', this.onMotionPreferenceChange);
    // A preference change while detached cannot deliver an event to this instance. Re-run the
    // same arbitration on every connection so `playing` never reflects the stale pre-detach
    // preference after a reparent/reinsert.
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.mediaQuery?.removeEventListener('change', this.onMotionPreferenceChange);
    this.mediaQuery = undefined;
    super.disconnectedCallback();
  }

  private onMotionPreferenceChange = (): void => {
    // Picks up a live OS-level preference change while already connected --
    // recomputed in willUpdate() below, not read directly off this event.
    this.requestUpdate();
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('src')) {
      this.hasLoaded = false;
      this.hasError = false;
      const trimmed = this.src.trim();
      // An empty src never asked for anything to load -- not an error. A
      // non-empty src that fails the safe-URL check never reaches the real
      // <img src> sink, so its failure has to be reported here instead of
      // waiting on a native `error` event that will never fire.
      if (trimmed !== '' && safeMediaSrc(this.src) === null) {
        this.hasError = true;
        this.emit('lr-error');
      }
    }

    const nextPlaying = this.play && !(
      this.respectReducedMotion && prefersReducedMotion(this.ownerWindow)
    );
    if (nextPlaying !== this._playing) {
      this._playing = nextPlaying;
      this.toggleAttribute('playing', nextPlaying);
      this.emit(nextPlaying ? 'lr-play' : 'lr-pause');
    }
    // Private CSS-only hook (see the stylesheet) -- keeps the live <img>
    // visible while still loading or after a decode failure, independent of
    // the `playing` attribute above.
    this.toggleAttribute('data-loaded', this.hasLoaded);
  }

  private get effectiveAlt(): string {
    return this.alt || this.localize('animatedImageDefaultAlt');
  }

  private get toggleLabel(): string {
    if (this.accessibleLabel) return this.accessibleLabel;
    const name = this.effectiveAlt;
    return this.playing
      ? this.localize('pauseWithContext', undefined, { name })
      : this.localize('playWithContext', undefined, { name });
  }

  private onImageLoad = (): void => {
    this.hasError = false;
    this.hasLoaded = true;
    const img = this.imageEl;
    const canvas = this.canvasEl;
    if (img && canvas) {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const dpr = this.ownerWindow?.devicePixelRatio || 1;
      const requestedWidth = width * dpr;
      const requestedHeight = height * dpr;
      const dimensionScale = Math.min(
        1,
        MAX_FROZEN_FRAME_DIMENSION / Math.max(1, requestedWidth),
        MAX_FROZEN_FRAME_DIMENSION / Math.max(1, requestedHeight),
      );
      const pixelScale = Math.min(
        1,
        Math.sqrt(MAX_FROZEN_FRAME_PIXELS / Math.max(1, requestedWidth * requestedHeight)),
      );
      const backingScale = Math.min(dimensionScale, pixelScale);
      const backingWidth = Math.max(1, Math.floor(requestedWidth * backingScale));
      const backingHeight = Math.max(1, Math.floor(requestedHeight * backingScale));
      // Setting width/height resets any prior transform, so a fresh
      // ctx.scale() below is always relative to an untransformed canvas --
      // safe to call again on every subsequent src's own load.
      canvas.width = backingWidth;
      canvas.height = backingHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(backingWidth / Math.max(1, width), backingHeight / Math.max(1, height));
        ctx.drawImage(img, 0, 0, width, height);
      }
    }
    this.emit('lr-load');
  };

  private onImageError = (): void => {
    this.hasLoaded = false;
    this.hasError = true;
    this.emit('lr-error');
  };

  private onToggleClick = (): void => {
    this.play = !this.play;
  };

  /** Focus the play/pause control. */
  override focus(options?: FocusOptions): void {
    this.playButtonEl?.focus(options);
  }

  /** Blur the play/pause control. */
  override blur(): void {
    this.playButtonEl?.blur();
  }

  /** Activate the play/pause control. */
  override click(): void {
    this.playButtonEl?.click();
  }

  private onControlFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onControlBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  override render(): TemplateResult {
    const src = safeMediaSrc(this.src);
    const alt = this.effectiveAlt;
    // The single condition both the stylesheet's [data-loaded]:not([playing])
    // rule and the aria-hidden bindings below key off of -- kept as one
    // local so the two never drift out of sync with each other.
    const frozen = this.hasLoaded && !this.playing;
    const showControls = this.hasLoaded && !this.hasError;
    const disabled = this.respectReducedMotion && prefersReducedMotion(this.ownerWindow);

    return html`
      <div part="base">
        <img
          part="image"
          src=${src ?? nothing}
          alt=${alt}
          aria-hidden=${frozen ? 'true' : nothing}
          @load=${this.onImageLoad}
          @error=${this.onImageError}
        />
        <canvas
          part="canvas"
          role="img"
          aria-label=${alt}
          tabindex="-1"
          aria-hidden=${frozen ? nothing : 'true'}
        ></canvas>
        ${showControls
          ? html`
              <div part="control-box">
                <button
                  part="play-button"
                  type="button"
                  aria-label=${this.toggleLabel}
                  ?disabled=${disabled}
                  @click=${this.onToggleClick}
                  @focus=${this.onControlFocus}
                  @blur=${this.onControlBlur}
                ></button>
                <span class="icon" aria-hidden="true" inert ?hidden=${this.playing}>
                  <slot name="play-icon">${playIcon()}</slot>
                </span>
                <span class="icon" aria-hidden="true" inert ?hidden=${!this.playing}>
                  <slot name="pause-icon">${pauseIcon()}</slot>
                </span>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-animated-image': LyraAnimatedImage;
  }
}
