import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  resolveBoundedCanvasAllocation,
  type BoundedCanvasAllocation,
} from '../../../internal/canvas.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { loadQrCodeCached, type QrCodeApi } from './qr-code-loader.js';
import { styles } from './qr-code.styles.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_qrCodeGenerationFailed, LYRA_DEFAULT_qrCodeMissingLibrary } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const DEFAULT_SIZE = 128;
const MIN_SIZE = 1;
/**
 * An untrusted `size` drives both layout and the canvas backing store. The
 * public size remains bounded independently from the stricter backing-store
 * pixel budget below.
 */
const MAX_SIZE = 2048;
/** The pinned WA/SL QR renderers both use a fixed two backing pixels per CSS pixel. */
const QR_BACKING_SCALE = 2;
/** Safety-only ceilings. Ordinary sizes retain the exact fixed 2x upstream geometry. */
const MAX_CANVAS_DIMENSION = 4096;
const MAX_CANVAS_PIXELS = 8_388_608;
/** QR version 40 is 177 modules wide; larger peer output is not a valid QR matrix. */
const MAX_QR_MODULE_COUNT = 177;
const DEFAULT_RADIUS = 0;
const MIN_RADIUS = 0;
const MAX_RADIUS = 0.5;
const DEFAULT_IMAGE_COVERAGE = 0.5;
const DEFAULT_IMAGE_PADDING = 0;
const DEFAULT_ERROR_CORRECTION: LyraQrCodeErrorCorrection = 'H';
const ERROR_CORRECTION_LEVELS: ReadonlySet<string> = new Set(['L', 'M', 'Q', 'H']);
const FALLBACK_FILL = '#000000';
const FALLBACK_BACKGROUND = 'transparent';

export type LyraQrCodeErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/** A generated QR symbol's module (bit) matrix -- the subset of `qrcode`'s own `create()` return
 *  shape this component actually consumes. */
interface QrModules {
  readonly size: number;
  get(row: number, col: number): 0 | 1;
}

type QrCodeState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'ready'; modules: QrModules; image?: HTMLImageElement }
  | { kind: 'error'; message: string };

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

/**
 * Clones the bounded bit matrix consumed by paint. No peer-owned object or getter survives this
 * boundary, so later mutation cannot alter redraws and malformed/hostile shapes fail inside the
 * generation error path rather than during Lit's subsequent update.
 */
function normalizeQrModules(result: unknown): QrModules {
  if (!isObjectLike(result)) throw new TypeError('QR result must be an object.');
  const modules = (result as { modules?: unknown }).modules;
  if (!isObjectLike(modules)) throw new TypeError('QR result has no module matrix.');

  const size = (modules as { size?: unknown }).size;
  const get = (modules as { get?: unknown }).get;
  if (!Number.isSafeInteger(size) || (size as number) < 1 || (size as number) > MAX_QR_MODULE_COUNT) {
    throw new TypeError('QR module count is invalid.');
  }
  if (typeof get !== 'function') throw new TypeError('QR module reader is invalid.');

  const moduleCount = size as number;
  const bits = new Uint8Array(moduleCount * moduleCount);
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      const value = Reflect.apply(get, modules, [row, col]) as unknown;
      if (value !== 0 && value !== 1 && value !== false && value !== true) {
        throw new TypeError('QR module value is invalid.');
      }
      bits[row * moduleCount + col] = value === 1 || value === true ? 1 : 0;
    }
  }

  return Object.freeze({
    size: moduleCount,
    get(row: number, col: number): 0 | 1 {
      if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
      if (row < 0 || col < 0 || row >= moduleCount || col >= moduleCount) return 0;
      return bits[row * moduleCount + col] === 1 ? 1 : 0;
    },
  });
}

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
 * Validates `value` as a syntactically valid CSS `<color>` via two canvas `fillStyle` sentinel
 * round-trips and returns it unchanged when it parses. Two sentinels are required because a valid
 * color can normalize to either sentinel itself (`#010203` and `rgb(1 2 3)` both do); an invalid
 * assignment is the only one that leaves both distinct sentinels unchanged. Falls back to
 * `fallbackHex` (with a one-time `console.warn`, deduplicated per distinct bad value) when neither
 * round-trip accepts the value.
 */
function resolveQrColor(
  value: string,
  fallbackHex: string,
  ctx: CanvasRenderingContext2D,
): string {
  for (const sentinel of ['rgb(1, 2, 3)', 'rgb(4, 5, 6)']) {
    ctx.fillStyle = sentinel;
    const sentinelNormalized = ctx.fillStyle;
    ctx.fillStyle = value;
    if (ctx.fillStyle !== sentinelNormalized) return value;
  }
  warnInvalidColor(value);
  return fallbackHex;
}

/**
 * `<lr-qr-code>` -- encodes `value` as a QR symbol with the optional
 * `qrcode` peer dependency (Reed-Solomon error correction and every other
 * algorithmic step of the QR spec is delegated to that library, never
 * hand-rolled) and draws the resulting module matrix across the full canvas,
 * one square (optionally rounded) cell per module. Like the mirrored WA/SL
 * components, it does not inject a quiet zone; add host CSS `padding` when a
 * scanner or physical output needs one.
 *
 * The stable host is the single semantic owner while a value is loading or
 * rendered. Its accessible name resolves, in order, from a host `aria-label`
 * attribute, `label`, then `value`; the canvas is presentational. The same
 * host publishes `aria-busy="true"` and `"false"`. An empty `value` renders
 * `[part="empty"]` without image semantics.
 *
 * Standard host `color` and `background-color` control foreground and
 * background paint. `--lr-qr-code-fill` and `--lr-qr-code-background` are
 * optional aliases for those host styles; otherwise inherited color and the
 * host's transparent background are preserved. Deprecated `fill` and
 * `background` values still take precedence during their compatibility
 * window. Shoelace migration inserts its historical black/white defaults.
 *
 * The mirrored renderers use a fixed two backing pixels per CSS pixel rather
 * than the live device pixel ratio. Lyra preserves that geometry for ordinary
 * sizes and uniformly reduces only extreme allocations to a bounded pixel
 * budget; CSS size and aspect ratio do not change.
 *
 * Deliberately out of scope for this component, not oversights: a finder-pattern-corner accent
 * color; auto-shrinking to fit a
 * narrow container (this component's `size` is a direct request for a
 * specific rendered pixel density, like `<img width height>` -- the consumer
 * picks a size that fits their layout, this component never second-guesses
 * it, though it still renders correctly at its default size inside a narrow
 * allocation); form association (`value` is caller-supplied display data the
 * user doesn't edit through this component -- no `FormAssociated` mixin, no
 * label/hint/error chrome, no form internals); and playback behavior. Keyboard
 * focus is intentionally absent -- the canvas is a static image
 * standing in for `value`, structurally like `<img>`, not an interactive
 * grid.
 *
 * @customElement lr-qr-code
 * @csspart base - Deprecated in 8.2.3; compatibility name for the outer wrapper; use `qr-code`.
 * @csspart qr-code - The outer wrapper, sized to `size`×`size` CSS px in every state. It is the
 *   same node as `base`.
 * @csspart canvas - The stable QR canvas. It remains hidden but reachable through `.canvas`
 *   while the component is empty, loading, or in an error state.
 * @csspart empty - Shown when `value` is empty.
 * @csspart loading - Shown while the optional `qrcode` peer is loading, the first time it's needed.
 * @csspart error - Visible error shown when the peer is missing, or `value` failed to encode; the
 *   transition is announced through the shared light-DOM assertive region.
 * @cssprop --lr-qr-code-fill - Optional alias for host `color`, used by foreground modules.
 * @cssprop --lr-qr-code-background - Optional alias for host `background-color`, used by the canvas background.
 * @status stable
 * @since 4.0.0
 */
export class LyraQrCode extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    qrCodeGenerationFailed: LYRA_DEFAULT_qrCodeGenerationFailed,
    qrCodeMissingLibrary: LYRA_DEFAULT_qrCodeMissingLibrary,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Starts the shared optional-peer import without generating a QR code. Returns false when the
   * optional peer is unavailable, so applications can decide whether to render their own fallback
   * before connecting an element. */
  static preload(): Promise<boolean> {
    return loadQrCodeCached().then((api) => api !== null);
  }

  /** The data to encode. Empty renders `[part="empty"]` -- no encode is attempted. */
  @property() value = '';

  /** Accessible-name fallback when the host has no `aria-label`; otherwise falls back to `value`
   *  -- see the class doc
   *  comment for the full precedence order. Caller-supplied data, not routed through `localize()`. */
  @property() label = '';

  /** Legacy foreground-module color override. A non-empty value takes precedence over host
   * `color`.
   * @deprecated Use the standard host CSS `color` property. */
  @property() fill = '';

  /** Legacy canvas-background color override. A non-empty value takes precedence over host
   * `background-color`.
   * @deprecated Use the standard host CSS `background-color` property. */
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

  /** The stable canvas used for QR paint. The same node remains reachable across empty, loading,
   * ready, error, reconnect, and redraw transitions. */
  @query('canvas') canvas!: HTMLCanvasElement;

  @state() private loadState: QrCodeState = { kind: 'empty' };
  private errorAnnouncementSink?: AnnouncementSink;
  private statusAnnouncementSink?: AnnouncementSink;
  private pendingLoadingAnnouncement = false;
  private readonly accessibilityInternals?: ElementInternals;

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

  constructor() {
    super();
    // ElementInternals supplies default host semantics without copying an author's `aria-label`
    // onto a second node. DOM shims that do not implement it retain the canvas fallback in
    // render(); constructing the component must never throw there.
    try {
      this.accessibilityInternals = this.attachInternals();
    } catch {
      this.accessibilityInternals = undefined;
    }
    this.syncSemanticOwner();
    // Redraws when prefers-color-scheme flips or an ancestor's theme attribute mutates. The
    // controller registers itself with the host via addController().
    new ThemeWatcher(this, () => this.refreshTheme());
  }

  override connectedCallback(): void {
    // `value` is synchronously observable on both server and client. Initialize the matching
    // honest pending state before Lit's first lifecycle pass so hydration never has to replace an
    // empty branch from inside `willUpdate()`.
    if (this.value && this.loadState.kind === 'empty') this.transitionTo({ kind: 'loading' });
    else this.setAttribute('aria-busy', this.loadState.kind === 'loading' ? 'true' : 'false');
    super.connectedCallback();
    this.syncAnnouncementSinks();
    const IntersectionObserverCtor = this.ownerDocument.defaultView?.IntersectionObserver;
    if (IntersectionObserverCtor) {
      this.intersectionObserver = new IntersectionObserverCtor((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.draw();
      });
      this.intersectionObserver.observe(this);
    } else if (!this.visible) {
      // An earlier owner realm may have marked the code off-screen. Without an observer in this
      // realm, there is nothing to make it visible again, so catch up on skipped redraws now.
      this.visible = true;
      this.draw();
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
    ) this.generate();
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.pendingLoadingAnnouncement = false;
    this.releaseAnnouncementSinks();
    super.disconnectedCallback();
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseAnnouncementSinks();
    this.syncAnnouncementSinks();
  }

  private syncAnnouncementSinks(): void {
    if (!this.isConnected) return;
    if (
      this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument &&
      this.statusAnnouncementSink?.element.ownerDocument === this.ownerDocument
    ) return;
    this.releaseAnnouncementSinks();
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    this.statusAnnouncementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseAnnouncementSinks(): void {
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
    this.statusAnnouncementSink?.release();
    this.statusAnnouncementSink = undefined;
  }

  private transitionTo(next: QrCodeState): void {
    const announcesLoading =
      next.kind === 'loading' &&
      this.loadState.kind !== 'loading' &&
      this.hasUpdated &&
      this.isConnected;
    this.loadState = next;
    this.setAttribute('aria-busy', next.kind === 'loading' ? 'true' : 'false');
    this.syncSemanticOwner();
    if (announcesLoading) this.pendingLoadingAnnouncement = true;
  }

  private syncSemanticOwner(): void {
    const semantic = this.loadState.kind === 'loading' || this.loadState.kind === 'ready';
    if (!this.accessibilityInternals) return;
    this.accessibilityInternals.role = semantic ? 'img' : null;
    // This is a default ARIA value: an explicit host `aria-label` remains authoritative.
    this.accessibilityInternals.ariaLabel = semantic ? this.label || this.value : null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncSemanticOwner();
    if (this.pendingLoadingAnnouncement) {
      this.pendingLoadingAnnouncement = false;
      this.statusAnnouncementSink?.announce(this.localize('loading'));
    }
    if (changed.has('value') || changed.has('errorCorrection') || changed.has('image') || !this.hasUpdated) {
      this.scheduleAfterUpdate(() => {
        this.generate();
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

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Encoding and canvas paint are intentionally client-only, but a non-empty declarative value
    // is already enough information to distinguish pending work from genuine empty data. Seed the
    // honest state before the server render and before the browser's first render alike.
    if (changed.has('value') || changed.has('errorCorrection') || changed.has('image')) {
      this.transitionTo(this.value ? { kind: 'loading' } : { kind: 'empty' });
    }
  }

  /** Re-encodes `value` via the optional `qrcode` peer's `create()` and caches the resulting
   *  module matrix. Redraw-only geometry changes (`size`/`radius`) and theme refreshes never
   *  call this -- see the class doc comment and `updated()`'s dispatch. */
  generate(): void {
    void this.generateCurrentValue();
  }

  private async generateCurrentValue(): Promise<void> {
    const generation = ++this.generation;
    if (!this.value) {
      this.transitionTo({ kind: 'empty' });
      return;
    }
    this.transitionTo({ kind: 'loading' });
    try {
      const api = await this.loadLibrary();
      if (generation !== this.generation || !this.isConnected) return;
      if (!api) {
        const message = this.localize('qrCodeMissingLibrary');
        this.transitionTo({ kind: 'error', message });
        this.errorAnnouncementSink?.announce(message);
        return;
      }
      const imageSource = safeMediaSrc(this.image);
      const result = api.create(this.value, {
        errorCorrectionLevel: imageSource ? 'H' : this.errorCorrection,
      });
      const modules = normalizeQrModules(result);
      if (generation !== this.generation) return;
      this.transitionTo({ kind: 'ready', modules });
      if (imageSource) {
        const image = await this.loadEmbeddedImage(imageSource);
        if (generation !== this.generation || !this.isConnected || !image) return;
        this.transitionTo({ kind: 'ready', modules, image });
      }
    } catch {
      if (generation !== this.generation || !this.isConnected) return;
      const message = this.localize('qrCodeGenerationFailed');
      this.transitionTo({ kind: 'error', message });
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

  /** Redraws canvas content after an upstream token or theme change, reusing the already-
   *  cached module matrix rather than re-encoding `value`. The component automatically observes
   *  ancestor theme-attribute changes and color-scheme changes; this method remains available for
   *  consumer-owned token changes that are not represented by those signals. */
  refreshTheme(): void {
    this.draw();
  }

  private fillColor(ctx: CanvasRenderingContext2D): string {
    const computed = this.ownerDocument.defaultView?.getComputedStyle(this);
    const raw =
      this.fill.trim() ||
      computed?.color?.trim() ||
      FALLBACK_FILL;
    return resolveQrColor(raw, FALLBACK_FILL, ctx);
  }

  private backgroundColor(ctx: CanvasRenderingContext2D): string {
    const computed = this.ownerDocument.defaultView?.getComputedStyle(this);
    const raw =
      this.background.trim() ||
      computed?.backgroundColor?.trim() ||
      FALLBACK_BACKGROUND;
    return resolveQrColor(raw, FALLBACK_BACKGROUND, ctx);
  }

  private draw(): void {
    if (this.loadState.kind !== 'ready') return;
    // Off-screen: skip the per-module fillRect/roundRect loop entirely. Every caller (updated(),
    // refreshTheme()) funnels through here, so gating centrally covers all of them --
    // becoming visible again re-triggers a draw() from the IntersectionObserver callback in
    // connectedCallback(), which catches up on whatever was skipped while off-screen.
    if (!this.visible) return;
    const canvas = this.canvas;
    if (!canvas) return;
    const { modules } = this.loadState;
    const size = this.size;
    const allocation = LyraQrCode.canvasAllocation(size);
    canvas.width = allocation.pixelWidth;
    canvas.height = allocation.pixelHeight;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(allocation.scaleX, allocation.scaleY);

    const background = this.backgroundColor(ctx);
    const fill = this.fillColor(ctx);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);

    const moduleCount = modules.size;
    const moduleSize = size / moduleCount;
    const radiusPx = this.radius * moduleSize;
    // `roundRect` is broadly supported in evergreen engines but guarded defensively for older ones
    // (see the class doc comment's rendering rationale).
    const canRoundRect = typeof ctx.roundRect === 'function';

    ctx.fillStyle = fill;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!modules.get(row, col)) continue;
        const x = col * moduleSize;
        const y = row * moduleSize;
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

  /** Pure allocation seam kept private so tests can cover extreme inputs without creating a
   * multi-megapixel canvas. */
  private static canvasAllocation(cssSize: number): Readonly<BoundedCanvasAllocation> {
    return resolveBoundedCanvasAllocation({
      cssWidth: cssSize,
      cssHeight: cssSize,
      desiredScale: QR_BACKING_SCALE,
      maxDimension: MAX_CANVAS_DIMENSION,
      maxPixels: MAX_CANVAS_PIXELS,
    });
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

  private renderBody(): TemplateResult | typeof nothing {
    switch (this.loadState.kind) {
      case 'empty':
        return html`<div part="empty">${this.localize('noData')}</div>`;
      case 'loading':
        return html`<div part="loading">${this.localize('loading')}</div>`;
      case 'error':
        return html`<div part="error">${this.loadState.message}</div>`;
      case 'ready':
        return nothing;
    }
  }

  override render(): TemplateResult {
    const ready = this.loadState.kind === 'ready';
    const fallbackSemantics = !this.accessibilityInternals && ready;
    return html`<div part="base qr-code" style=${styleMap({ inlineSize: `${this.size}px`, blockSize: `${this.size}px` })}>
      <canvas
        part="canvas"
        ?hidden=${!ready}
        aria-hidden=${this.accessibilityInternals ? 'true' : ready ? nothing : 'true'}
        role=${fallbackSemantics ? 'img' : nothing}
        aria-label=${fallbackSemantics ? this.accessibleName() : nothing}
      ></canvas>
      ${this.renderBody()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-qr-code': LyraQrCode;
  }
}
