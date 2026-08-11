import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { loadQrCodeCached, type QrCodeApi } from './qr-code-loader.js';
import { styles } from './qr-code.styles.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_qrCodeGenerationFailed, LYRA_DEFAULT_qrCodeMissingLibrary } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const DEFAULT_SIZE = 128;
const MIN_SIZE = 1;
/**
 * An untrusted `size` drives the canvas backing-store allocation directly
 * (`size * devicePixelRatio` per side, i.e. RGBA pixel data on the order of
 * `4 * (size * dpr) ** 2` bytes). Keeping it within this bound avoids an
 * attacker- or typo-supplied value turning a single QR code into an
 * unbounded allocation.
 */
const MAX_SIZE = 2048;
const DEFAULT_RADIUS = 0;
const MIN_RADIUS = 0;
const MAX_RADIUS = 0.5;
const DEFAULT_IMAGE_COVERAGE = 0.5;
const DEFAULT_IMAGE_PADDING = 0;
const DEFAULT_ERROR_CORRECTION: LyraQrCodeErrorCorrection = 'H';
const ERROR_CORRECTION_LEVELS: ReadonlySet<string> = new Set(['L', 'M', 'Q', 'H']);
/**
 * The optional `qrcode` peer's own default renderer bakes a 4-module light
 * margin around the symbol (its `renderer/utils.js`, `margin` defaults to
 * `4`). Reproduced here so this component is scannable out of the box with
 * zero consumer configuration -- not a public property (an ambient host CSS
 * `padding` adds further breathing room on top of this, but is not a
 * substitute for it).
 */
const QUIET_ZONE_MODULES = 4;
const FALLBACK_FILL = '#000000';
const FALLBACK_BACKGROUND = '#ffffff';

export type LyraQrCodeErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/** A generated QR symbol's module (bit) matrix -- the subset of `qrcode`'s own `create()` return
 *  shape this component actually consumes. */
interface QrModules {
  size: number;
  get(row: number, col: number): number;
}

type QrCodeState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'ready'; modules: QrModules; image?: HTMLImageElement }
  | { kind: 'error'; message: string };

function normalizeErrorCorrection(value: string): LyraQrCodeErrorCorrection {
  const upper = value.toUpperCase();
  return (ERROR_CORRECTION_LEVELS.has(upper) ? upper : DEFAULT_ERROR_CORRECTION) as LyraQrCodeErrorCorrection;
}

const errorCorrectionConverter = {
  fromAttribute(value: string | null): LyraQrCodeErrorCorrection {
    return value === null ? DEFAULT_ERROR_CORRECTION : normalizeErrorCorrection(value);
  },
};

const warnedInvalidColors = new Set<string>();

function warnInvalidColor(value: string): void {
  if (warnedInvalidColors.has(value)) return;
  warnedInvalidColors.add(value);
  console.warn(
    `<lr-qr-code> could not parse "${value}" as a CSS ` +
      'color; falling back to the default.',
  );
}

/**
 * Validates `value` as a syntactically valid CSS `<color>` via a canvas `fillStyle` sentinel
 * round-trip (mirrors `LyraHeatmap`'s `resolveRgb()`) and returns it unchanged when it parses --
 * `ctx.fillStyle` already accepts the full CSS color grammar natively, so no hex/RGB decomposition
 * is needed here, only a validity check. Falls back to `fallbackHex` (with a one-time
 * `console.warn`, deduplicated per distinct bad value) when it doesn't.
 */
function resolveQrColor(
  value: string,
  fallbackHex: string,
  ctx: CanvasRenderingContext2D,
): string {
  const sentinel = 'rgb(1, 2, 3)';
  ctx.fillStyle = sentinel;
  const sentinelNormalized = ctx.fillStyle;
  ctx.fillStyle = value;
  if (ctx.fillStyle === sentinelNormalized && value.trim() !== sentinel) {
    warnInvalidColor(value);
    return fallbackHex;
  }
  return value;
}

/**
 * `<lr-qr-code>` -- encodes `value` as a QR symbol with the optional
 * `qrcode` peer dependency (Reed-Solomon error correction and every other
 * algorithmic step of the QR spec is delegated to that library, never
 * hand-rolled) and draws the resulting module matrix onto a canvas itself,
 * one square (optionally rounded) cell per module, with a light quiet-zone
 * margin baked in around the symbol so it stays scannable out of the box
 * with zero consumer configuration. Extra host CSS `padding` around the
 * element adds further breathing room on top of that baked-in margin, but is
 * not required for baseline scannability.
 *
 * The canvas -- not the host -- owns `role="img"` and the accessible name,
 * since it is the one meaningful descendant here (mirrors
 * `lr-file-icon`'s single-image pattern rather than the composite-group
 * pattern used by `lr-heatmap`/`lr-word-cloud`). The accessible name
 * resolves, in order: a host `aria-label` attribute (forwarded onto the canvas),
 * then `label`, then `value` itself. An empty `value` renders
 * `[part="empty"]` instead of an `img`-role element -- there is nothing to
 * encode or name.
 *
 * `--lr-qr-code-fill`/`--lr-qr-code-background` (dark/light modules)
 * default to `--lr-color-text`/`--lr-color-surface`, which -- like every
 * semantic token in this library -- flip under a dark theme. That means the
 * *default* rendering under a dark theme is a polarity-inverted QR code
 * (light modules on a dark background) rather than the conventional
 * dark-on-light. Contrast itself stays strong in both themes (these are the
 * app's own high-contrast text/surface pair), so human legibility is
 * unaffected -- only third-party barcode *scanner* robustness across
 * less-tolerant scanning apps is the residual, consumer-overridable risk. A
 * consumer needing guaranteed cross-scanner compatibility regardless of page
 * theme should pin `--lr-qr-code-fill: #000` / `--lr-qr-code-background:
 * #fff` explicitly at the point of use.
 *
 * Deliberately out of scope for this component, not oversights: a finder-pattern-corner accent
 * color; auto-shrinking to fit a
 * narrow container (this component's `size` is a direct request for a
 * specific rendered pixel density, like `<img width height>` -- the consumer
 * picks a size that fits their layout, this component never second-guesses
 * it, though it still renders correctly at its default size inside a narrow
 * allocation); form association (`value` is caller-supplied display data the
 * user doesn't edit through this component -- no `FormAssociated` mixin, no
 * label/hint/error chrome, no `ElementInternals`); and any
 * motion/`prefers-reduced-motion` branch (nothing here animates). Keyboard
 * focus is likewise intentionally absent -- the canvas is a static image
 * standing in for `value`, structurally like `<img>`, not an interactive
 * grid.
 *
 * @customElement lr-qr-code
 * @csspart base - Compatibility name for the outer wrapper; use `qr-code`.
 * @csspart qr-code - The outer wrapper, sized to `size`×`size` CSS px in every state. It is the
 *   same node as `base`.
 * @csspart canvas - The rendered QR code canvas.
 * @csspart empty - Shown when `value` is empty.
 * @csspart loading - Shown while the optional `qrcode` peer is loading, the first time it's needed.
 * @csspart error - Visible error shown when the peer is missing, or `value` failed to encode; the
 *   transition is announced through the shared light-DOM assertive region.
 * @cssprop [--lr-qr-code-fill=var(--lr-color-text)] - Dark/foreground module color.
 * @cssprop [--lr-qr-code-background=var(--lr-color-surface)] - Light/background module color, including the quiet zone.
 * @status stable
 * @since 4.0.0
 */
export class LyraQrCode extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    qrCodeGenerationFailed: LYRA_DEFAULT_qrCodeGenerationFailed,
    qrCodeMissingLibrary: LYRA_DEFAULT_qrCodeMissingLibrary,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The data to encode. Empty renders `[part="empty"]` -- no encode is attempted. */
  @property() value = '';

  /** Accessible-name fallback when the host has no `aria-label`; otherwise falls back to `value`
   *  -- see the class doc
   *  comment for the full precedence order. Caller-supplied data, not routed through `localize()`. */
  @property() label = '';

  /** Mapped foreground module color. A non-empty value takes precedence over
   *  `--lr-qr-code-fill`. */
  @property() fill = '';

  /** Mapped canvas background color. A non-empty value takes precedence over
   *  `--lr-qr-code-background`. */
  @property() background = '';

  /** Safe media URL for an optional centered logo/image. */
  @property() image: string | null = null;

  /** Optional CSS color painted behind the centered image and its padding. */
  @property({ attribute: 'image-background' }) imageBackground: string | null = null;

  /** Fraction of the QR canvas side available to the embedded image, clamped to `[0, 1]`. */
  @property({ type: Number, attribute: 'image-coverage' }) imageCoverage: number | null = null;

  /** CSS-pixel padding inside the embedded image's coverage box, clamped to fit. */
  @property({ type: Number, attribute: 'image-padding' }) imagePadding: number | null = null;

  private _size = DEFAULT_SIZE;

  /** CSS-px side length of the square canvas, clamped to `[1, 2048]`. */
  @property({ type: Number })
  get size(): number {
    return this._size;
  }

  set size(value: number) {
    const oldValue = this._size;
    this._size = finiteRange(value, DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
    this.requestUpdate('size', oldValue);
  }

  private _radius = DEFAULT_RADIUS;

  /** Per-module corner radius, as a fraction of one module's side length -- `0` (default) for
   *  square modules, `0.5` for fully round/pill modules. Clamped to `[0, 0.5]`. */
  @property({ type: Number })
  get radius(): number {
    return this._radius;
  }

  set radius(value: number) {
    const oldValue = this._radius;
    this._radius = finiteRange(value, DEFAULT_RADIUS, MIN_RADIUS, MAX_RADIUS);
    this.requestUpdate('radius', oldValue);
  }

  private _errorCorrection: LyraQrCodeErrorCorrection = DEFAULT_ERROR_CORRECTION;

  /** QR error-correction level. Normalized (upper-cased, validated against `L`/`M`/`Q`/`H`,
   *  falling back to `H`) on every assignment, attribute or property, so it's never a transient
   *  garbage value. */
  @property({ attribute: 'error-correction', converter: errorCorrectionConverter })
  get errorCorrection(): LyraQrCodeErrorCorrection {
    return this._errorCorrection;
  }

  set errorCorrection(value: LyraQrCodeErrorCorrection) {
    const oldValue = this._errorCorrection;
    this._errorCorrection = normalizeErrorCorrection(value);
    this.requestUpdate('errorCorrection', oldValue);
  }

  @query('canvas') private canvasEl?: HTMLCanvasElement;

  @state() private loadState: QrCodeState = { kind: 'empty' };
  private errorAnnouncementSink?: AnnouncementSink;

  // Gates draw() while scrolled off-screen, same shape as <lr-chart>'s own visibility gate --
  // a page rendering many <lr-qr-code>s (e.g. a scrollable list of badge/ticket codes) never
  // pays the per-module fillRect/roundRect redraw cost for ones currently out of view. Defaults
  // `true` so a not-yet-observed element (or an environment with no IntersectionObserver) draws
  // immediately, matching today's behavior exactly.
  @state() private visible = true;
  private intersectionObserver?: IntersectionObserver;

  /** Injectable loader seam -- overridden directly by tests with a synchronous fake instead of
   *  needing the real `qrcode` package to load in the test browser (mirrors `LyraPdfViewer`'s
   *  `loadLibrary` field). */
  private loadLibrary: () => Promise<QrCodeApi | null> = loadQrCodeCached;
  private generation = 0;

  private dprQuery?: MediaQueryList;

  constructor() {
    super();
    // Redraws when prefers-color-scheme flips or an ancestor's theme attribute mutates. The
    // controller registers itself with the host via addController().
    new ThemeWatcher(this, () => this.refreshTheme());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncErrorAnnouncementSink();
    this.watchDpr();
    const IntersectionObserverCtor = this.ownerDocument.defaultView?.IntersectionObserver;
    if (IntersectionObserverCtor) {
      this.intersectionObserver = new IntersectionObserverCtor((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.draw();
      });
      this.intersectionObserver.observe(this);
    }
    // If an in-flight peer result settled while detached, generate() correctly discarded it at
    // the post-await `isConnected` guard and left the visible state at `loading`. Reconnects do
    // not inherently re-run updated(), so explicitly restart that discarded work. A still-pending
    // old attempt is harmless: the new generation token supersedes it.
    if (
      this.hasUpdated &&
      this.value &&
      (this.loadState.kind === 'loading' ||
        (this.image && this.loadState.kind === 'ready' && !this.loadState.image))
    ) void this.generate();
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.releaseErrorAnnouncementSink();
    this.stopWatchingDpr();
    super.disconnectedCallback();
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
  }

  adoptedCallback(): void {
    this.releaseErrorAnnouncementSink();
    this.syncErrorAnnouncementSink();
  }

  private syncErrorAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseErrorAnnouncementSink();
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseErrorAnnouncementSink(): void {
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
  }

  private watchDpr(): void {
    // A MediaQueryList's `matches` is fixed at creation time, so crossing the DPR threshold it
    // was built for means building a fresh one for the new ratio -- remove the previous
    // instance's listener first, or it leaks.
    this.stopWatchingDpr();
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow) return;
    this.dprQuery = ownerWindow.matchMedia(
      `(resolution: ${ownerWindow.devicePixelRatio}dppx)`,
    );
    this.dprQuery.addEventListener('change', this.onDprChange);
  }

  private stopWatchingDpr(): void {
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = undefined;
  }

  private onDprChange = (): void => {
    this.watchDpr();
    this.draw();
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('errorCorrection') || changed.has('image') || !this.hasUpdated) {
      this.scheduleAfterUpdate(() => {
        void this.generate();
      });
      return;
    }
    if (
      this.loadState.kind === 'ready' &&
      (changed.has('size') ||
        changed.has('radius') ||
        changed.has('fill') ||
        changed.has('background') ||
        changed.has('imageBackground') ||
        changed.has('imageCoverage') ||
        changed.has('imagePadding') ||
        changed.has('loadState'))
    ) {
      this.draw();
    }
  }

  /** Re-encodes `value` via the optional `qrcode` peer's `create()` and caches the resulting
   *  module matrix. Redraw-only geometry changes (`size`/`radius`) and theme/DPR refreshes never
   *  call this -- see the class doc comment and `updated()`'s dispatch. */
  async generate(): Promise<void> {
    const generation = ++this.generation;
    if (!this.value) {
      this.loadState = { kind: 'empty' };
      return;
    }
    this.loadState = { kind: 'loading' };
    const api = await this.loadLibrary();
    if (generation !== this.generation || !this.isConnected) return;
    if (!api) {
      const message = this.localize('qrCodeMissingLibrary');
      this.loadState = { kind: 'error', message };
      this.errorAnnouncementSink?.announce(message);
      return;
    }
    try {
      const imageSource = safeMediaSrc(this.image);
      const result = api.create(this.value, {
        errorCorrectionLevel: imageSource ? 'H' : this.errorCorrection,
      }) as { modules: QrModules };
      if (generation !== this.generation) return;
      this.loadState = { kind: 'ready', modules: result.modules };
      if (imageSource) {
        const image = await this.loadEmbeddedImage(imageSource);
        if (generation !== this.generation || !this.isConnected || !image) return;
        this.loadState = { kind: 'ready', modules: result.modules, image };
      }
    } catch {
      if (generation !== this.generation) return;
      const message = this.localize('qrCodeGenerationFailed');
      this.loadState = { kind: 'error', message };
      this.errorAnnouncementSink?.announce(message);
    }
  }

  private async loadEmbeddedImage(src: string): Promise<HTMLImageElement | undefined> {
    const ImageCtor = this.ownerDocument.defaultView?.Image;
    if (!ImageCtor) return undefined;
    const image = new ImageCtor();
    image.decoding = 'async';
    const loaded = await new Promise<boolean>((resolve) => {
      image.addEventListener('load', () => resolve(true), { once: true });
      image.addEventListener('error', () => resolve(false), { once: true });
      image.src = src;
    });
    return loaded && image.naturalWidth > 0 && image.naturalHeight > 0 ? image : undefined;
  }

  /** Redraws canvas content after an upstream token, theme, or DPR change, reusing the already-
   *  cached module matrix rather than re-encoding `value`. The component automatically observes
   *  ancestor theme-attribute changes and color-scheme changes; this method remains available for
   *  consumer-owned token changes that are not represented by those signals. */
  refreshTheme(): void {
    this.draw();
  }

  private fillColor(ctx: CanvasRenderingContext2D): string {
    const raw =
      this.fill.trim() ||
      this.ownerDocument.defaultView
        ?.getComputedStyle(this)
        .getPropertyValue('--lr-qr-code-fill')
        .trim() ||
      FALLBACK_FILL;
    return resolveQrColor(raw, FALLBACK_FILL, ctx);
  }

  private backgroundColor(ctx: CanvasRenderingContext2D): string {
    const raw =
      this.background.trim() ||
      this.ownerDocument.defaultView
        ?.getComputedStyle(this)
        .getPropertyValue('--lr-qr-code-background')
        .trim() ||
      FALLBACK_BACKGROUND;
    return resolveQrColor(raw, FALLBACK_BACKGROUND, ctx);
  }

  private draw(): void {
    if (this.loadState.kind !== 'ready') return;
    // Off-screen: skip the per-module fillRect/roundRect loop entirely. Every caller (updated(),
    // onDprChange, refreshTheme()) funnels through here, so gating centrally covers all of them --
    // becoming visible again re-triggers a draw() from the IntersectionObserver callback in
    // connectedCallback(), which catches up on whatever was skipped while off-screen.
    if (!this.visible) return;
    const canvas = this.canvasEl;
    if (!canvas) return;
    const { modules } = this.loadState;
    const dpr = this.ownerDocument.defaultView?.devicePixelRatio || 1;
    const size = this.size;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const background = this.backgroundColor(ctx);
    const fill = this.fillColor(ctx);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);

    const moduleCount = modules.size;
    if (moduleCount <= 0) return;
    const moduleSize = size / (moduleCount + QUIET_ZONE_MODULES * 2);
    const offset = QUIET_ZONE_MODULES * moduleSize;
    const radiusPx = this.radius * moduleSize;
    // `roundRect` is broadly supported in evergreen engines but guarded defensively for older ones
    // (see the class doc comment's rendering rationale).
    const canRoundRect = typeof ctx.roundRect === 'function';

    ctx.fillStyle = fill;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!modules.get(row, col)) continue;
        const x = offset + col * moduleSize;
        const y = offset + row * moduleSize;
        if (this.radius > 0 && canRoundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, moduleSize, moduleSize, radiusPx);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, moduleSize, moduleSize);
        }
      }
    }
    if (this.loadState.image) this.drawEmbeddedImage(ctx, this.loadState.image, size);
  }

  private drawEmbeddedImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    size: number,
  ): void {
    const coverage = finiteRange(
      this.imageCoverage ?? DEFAULT_IMAGE_COVERAGE,
      DEFAULT_IMAGE_COVERAGE,
      0,
      1,
    );
    const boxSize = size * coverage;
    if (boxSize <= 0) return;
    const padding = finiteRange(
      this.imagePadding ?? DEFAULT_IMAGE_PADDING,
      DEFAULT_IMAGE_PADDING,
      0,
      boxSize / 2,
    );
    const contentSize = boxSize - padding * 2;
    const boxStart = (size - boxSize) / 2;
    if (this.imageBackground?.trim()) {
      ctx.fillStyle = resolveQrColor(
        this.imageBackground.trim(),
        this.backgroundColor(ctx),
        ctx,
      );
      ctx.fillRect(boxStart, boxStart, boxSize, boxSize);
    }
    if (contentSize <= 0) return;
    const scale = Math.min(contentSize / image.naturalWidth, contentSize / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  }

  private accessibleName(): string {
    return this.getAttribute('aria-label') ?? (this.label || this.value);
  }

  private renderBody(): TemplateResult {
    switch (this.loadState.kind) {
      case 'empty':
        return html`<div part="empty">${this.localize('noData')}</div>`;
      case 'loading':
        return html`<div part="loading">${this.localize('loading')}</div>`;
      case 'error':
        return html`<div part="error">${this.loadState.message}</div>`;
      case 'ready':
        return html`<canvas part="canvas" role="img" aria-label=${this.accessibleName()}></canvas>`;
    }
  }

  override render(): TemplateResult {
    return html`<div part="base qr-code" style=${styleMap({ inlineSize: `${this.size}px`, blockSize: `${this.size}px` })}>
      ${this.renderBody()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-qr-code': LyraQrCode;
  }
}
