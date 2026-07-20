import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { loadQrCodeCached, type QrCodeApi } from './qr-code-loader.js';
import { styles } from './qr-code.styles.js';

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
  | { kind: 'ready'; modules: QrModules }
  | { kind: 'error'; message: string };

function normalizeErrorCorrection(value: string): LyraQrCodeErrorCorrection {
  const upper = value.toUpperCase();
  return (ERROR_CORRECTION_LEVELS.has(upper) ? upper : DEFAULT_ERROR_CORRECTION) as LyraQrCodeErrorCorrection;
}

const errorCorrectionConverter = {
  fromAttribute(value: string | null): LyraQrCodeErrorCorrection {
    return value === null ? DEFAULT_ERROR_CORRECTION : normalizeErrorCorrection(value);
  },
  toAttribute(value: LyraQrCodeErrorCorrection): string {
    return normalizeErrorCorrection(value);
  },
};

const warnedInvalidColors = new Set<string>();

function warnInvalidColor(value: string): void {
  if (warnedInvalidColors.has(value)) return;
  warnedInvalidColors.add(value);
  console.warn(
    `<lr-qr-code> could not parse "${value}" (set via --lr-qr-code-fill/-background) as a CSS ` +
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
function resolveQrColor(value: string, fallbackHex: string): string {
  const ctx = getScratchCtx();
  if (!ctx) return fallbackHex;
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
 * resolves, in order: `label`, then a host `aria-label` attribute (forwarded
 * onto the canvas), then `value` itself. An empty `value` renders
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
 * Deliberately out of scope for this component, not oversights: logo/image
 * embedding; a finder-pattern-corner accent color; auto-shrinking to fit a
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
 * @csspart base - The outer wrapper, sized to `size`×`size` CSS px in every state.
 * @csspart canvas - The rendered QR code canvas.
 * @csspart empty - Shown when `value` is empty.
 * @csspart loading - Shown while the optional `qrcode` peer is loading, the first time it's needed.
 * @csspart error - Shown when the peer is missing, or `value` failed to encode.
 * @cssprop [--lr-qr-code-fill=var(--lr-color-text)] - Dark/foreground module color.
 * @cssprop [--lr-qr-code-background=var(--lr-color-surface)] - Light/background module color, including the quiet zone.
 */
export class LyraQrCode extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The data to encode. Empty renders `[part="empty"]` -- no encode is attempted. */
  @property() value = '';

  /** Accessible-name override. Falls back through `aria-label` then `value` -- see the class doc
   *  comment for the full precedence order. Caller-supplied data, not routed through `localize()`. */
  @property() label = '';

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
  private colorSchemeQuery?: MediaQueryList;
  private themeObserver?: MutationObserver;
  private themeRefreshQueued = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.watchDpr();
    this.watchTheme();
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.draw();
      });
      this.intersectionObserver.observe(this);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.colorSchemeQuery?.removeEventListener('change', this.onColorSchemeChange);
    this.themeObserver?.disconnect();
    this.themeObserver = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
  }

  private watchDpr(): void {
    // A MediaQueryList's `matches` is fixed at creation time, so crossing the DPR threshold it
    // was built for means building a fresh one for the new ratio -- remove the previous
    // instance's listener first, or it leaks.
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }

  private onDprChange = (): void => {
    this.watchDpr();
    this.draw();
  };

  private onColorSchemeChange = (): void => {
    this.refreshTheme();
  };

  private queueThemeRefresh = (): void => {
    if (this.themeRefreshQueued) return;
    this.themeRefreshQueued = true;
    queueMicrotask(() => {
      this.themeRefreshQueued = false;
      if (this.isConnected) this.refreshTheme();
    });
  };

  private watchTheme(): void {
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.colorSchemeQuery = view.matchMedia?.('(prefers-color-scheme: dark)');
    this.colorSchemeQuery?.addEventListener('change', this.onColorSchemeChange);

    if (typeof MutationObserver === 'undefined') return;
    const targets: Element[] = [this];
    let parent = this.parentElement;
    while (parent) {
      targets.push(parent);
      parent = parent.parentElement;
    }
    this.themeObserver = new MutationObserver(this.queueThemeRefresh);
    for (const target of targets) {
      this.themeObserver.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'],
      });
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('errorCorrection') || !this.hasUpdated) {
      this.scheduleAfterUpdate(() => {
        void this.generate();
      });
      return;
    }
    if (
      this.loadState.kind === 'ready' &&
      (changed.has('size') || changed.has('radius') || changed.has('loadState'))
    ) {
      this.draw();
    }
  }

  /** Re-encodes `value` via the optional `qrcode` peer's `create()` and caches the resulting
   *  module matrix. Redraw-only geometry changes (`size`/`radius`) and theme/DPR refreshes never
   *  call this -- see the class doc comment and `updated()`'s dispatch. */
  private async generate(): Promise<void> {
    const generation = ++this.generation;
    if (!this.value) {
      this.loadState = { kind: 'empty' };
      return;
    }
    this.loadState = { kind: 'loading' };
    const api = await this.loadLibrary();
    if (generation !== this.generation || !this.isConnected) return;
    if (!api) {
      this.loadState = { kind: 'error', message: this.localize('qrCodeMissingLibrary') };
      return;
    }
    try {
      const result = api.create(this.value, { errorCorrectionLevel: this.errorCorrection }) as { modules: QrModules };
      if (generation !== this.generation) return;
      this.loadState = { kind: 'ready', modules: result.modules };
    } catch {
      if (generation !== this.generation) return;
      this.loadState = { kind: 'error', message: this.localize('qrCodeGenerationFailed') };
    }
  }

  /** Redraws canvas content after an upstream token, theme, or DPR change -- reuses the already-
   *  cached module matrix rather than re-encoding `value`. No global theme-broadcast event exists
   *  in lyra-ui to subscribe to automatically; call this from a consumer's own theme-toggle handler. */
  refreshTheme(): void {
    this.draw();
  }

  private fillColor(): string {
    const raw = getComputedStyle(this).getPropertyValue('--lr-qr-code-fill').trim() || FALLBACK_FILL;
    return resolveQrColor(raw, FALLBACK_FILL);
  }

  private backgroundColor(): string {
    const raw = getComputedStyle(this).getPropertyValue('--lr-qr-code-background').trim() || FALLBACK_BACKGROUND;
    return resolveQrColor(raw, FALLBACK_BACKGROUND);
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
    const dpr = window.devicePixelRatio || 1;
    const size = this.size;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const background = this.backgroundColor();
    const fill = this.fillColor();
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
  }

  private accessibleName(): string {
    return this.label || this.getAttribute('aria-label') || this.value;
  }

  private renderBody(): TemplateResult {
    switch (this.loadState.kind) {
      case 'empty':
        return html`<div part="empty">${this.localize('noData')}</div>`;
      case 'loading':
        return html`<div part="loading">${this.localize('loading')}</div>`;
      case 'error':
        return html`<div part="error" role="alert">${this.loadState.message}</div>`;
      case 'ready':
        return html`<canvas part="canvas" role="img" aria-label=${this.accessibleName()}></canvas>`;
    }
  }

  render(): TemplateResult {
    return html`<div part="base" style=${styleMap({ inlineSize: `${this.size}px`, blockSize: `${this.size}px` })}>
      ${this.renderBody()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-qr-code': LyraQrCode;
  }
}
