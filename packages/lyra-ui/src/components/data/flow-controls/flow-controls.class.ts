import { html, nothing, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import type { LyraFrame } from '../../../internal/variants.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-types.js';
import { FlowCanvasCompanionController } from '../flow-canvas/flow-companion-controller.js';
import { styles } from './flow-controls.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_flowControlsLabel, LYRA_DEFAULT_flowLockCanvas, LYRA_DEFAULT_zoomIn, LYRA_DEFAULT_zoomOut, LYRA_DEFAULT_zoomToFit } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


interface FlowCanvasLike extends HTMLElement {
  registerCompanion(cb: (snapshot: FlowStructureSnapshot) => void): () => void;
  zoomIn(): void;
  zoomOut(): void;
  fit(options?: { padding?: number }): void;
  locked: boolean;
}

function isFlowCanvasLike(element: HTMLElement): element is FlowCanvasLike {
  const candidate = element as Partial<FlowCanvasLike>;
  return (
    typeof candidate.registerCompanion === 'function' &&
    typeof candidate.zoomIn === 'function' &&
    typeof candidate.zoomOut === 'function' &&
    typeof candidate.fit === 'function' &&
    typeof candidate.locked === 'boolean'
  );
}

const GLYPH_VIEW_BOX = '0 0 24 24';
const GLYPH_STROKE_WIDTH = '1.75';

// Each glyph is authored as its own real `svg\`...\`` tagged template and composed into the
// shared outer <svg> as an `SVGTemplateResult` child -- interpolating one svg-tagged template
// into another is Lit's normal, supported nesting. Taking the inner markup as a plain string and
// splicing it in by casting a `[inner]` array to `TemplateStringsArray` is rejected by lit-html
// at render time ("Internal Error: expected template strings to be an array with a 'raw' field"):
// it tracks genuine tagged-template-literal call sites via their frozen `strings` object identity
// to guard against exactly that "fake the template strings" pattern (its own error message names
// it as equivalent to `unsafeHtml`). This also matches the repo's existing icon convention (see
// `internal/icons.ts`'s local `icon()` wrapper, and `rating.class.ts`/`attachment-chip.class.ts`).
function glyphSvg(inner: SVGTemplateResult): SVGTemplateResult {
  return svg`<svg
    width="1em"
    height="1em"
    viewBox=${GLYPH_VIEW_BOX}
    fill="none"
    stroke="currentColor"
    stroke-width=${GLYPH_STROKE_WIDTH}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >${inner}</svg>`;
}

const plusGlyph = () =>
  glyphSvg(svg`<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>`);
const minusGlyph = () => glyphSvg(svg`<line x1="5" y1="12" x2="19" y2="12"></line>`);
const fitGlyph = () =>
  glyphSvg(svg`
    <polyline points="9 3 3 3 3 9"></polyline>
    <polyline points="15 3 21 3 21 9"></polyline>
    <polyline points="3 15 3 21 9 21"></polyline>
    <polyline points="21 15 21 21 15 21"></polyline>
  `);
const lockClosedGlyph = () =>
  glyphSvg(svg`<rect x="4" y="11" width="16" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>`);
const lockOpenGlyph = () =>
  glyphSvg(svg`<rect x="4" y="11" width="16" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 7.4-2"></path>`);

/**
 * `<lr-flow-controls>` — the canvas's button cluster: zoom in/out, fit, and interaction lock, so
 * every flow surface ships the same affordances without hosts rebuilding them. Manipulates only
 * view state, never `nodes`/`edges` — no editing commands live here. Zoom-button availability comes
 * from the canvas companion snapshot's finite, sorted effective bounds, never its raw public bound
 * inputs.
 *
 * @customElement lr-flow-controls
 * @slot - Extra host buttons appended to the cluster. A slotted `<button>` picks up the same
 *   treatment as the built-in controls through a `::slotted(button)` rule — the shared
 *   `--lr-icon-button-size` hit-area floor, the chrome-less transparent box, and the same
 *   hover/press/disabled/focus-visible affordances. Only the slotted element itself is styled, not
 *   the consumer's markup inside it.
 * @csspart base - The `role="group"` wrapper. Drops its floating-surface chrome (border,
 *   background, shadow, padding, radius) under `frame="plain"`.
 * @csspart zoom-in - Zoom-in button.
 * @csspart zoom-out - Zoom-out button.
 * @csspart fit - Zoom-to-fit button.
 * @csspart lock - Lock/unlock toggle button (omitted when `hideLock`).
 * @cssprop [--lr-flow-controls-lock-active-color=var(--lr-color-brand)] - Pressed lock-button
 *   foreground.
 * @status stable
 * @since 4.0.0
 */
export class LyraFlowControls extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    flowControlsLabel: LYRA_DEFAULT_flowControlsLabel,
    flowLockCanvas: LYRA_DEFAULT_flowLockCanvas,
    zoomIn: LYRA_DEFAULT_zoomIn,
    zoomOut: LYRA_DEFAULT_zoomOut,
    zoomToFit: LYRA_DEFAULT_zoomToFit,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Id of the `lr-flow-canvas` this cluster drives. Empty (the default) resolves to the nearest
   *  ancestor canvas -- the slotted-into-a-corner-slot case. Changing it at runtime re-resolves and
   *  re-subscribes; a target that mounts later is picked up too. */
  @property() for = '';
  /** Layout axis of the button cluster. */
  private _orientation: LyraOrientation = 'vertical';
  @property({ reflect: true })
  get orientation(): LyraOrientation {
    return this._orientation;
  }
  set orientation(value: LyraOrientation) {
    const previous = this._orientation;
    const next: LyraOrientation = value === 'horizontal' ? 'horizontal' : 'vertical';
    this._orientation = next;
    if (next !== previous || value !== next) this.requestUpdate('orientation', previous);
  }
  /** Omits the lock/unlock toggle button entirely, for canvases that never expose an interaction
   *  lock. */
  @property({ type: Boolean, attribute: 'hide-lock' }) hideLock = false;
  /** Container treatment, in the shared `LyraFrame` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, shadowed floating cluster. `'plain'` removes the border, background, shadow,
   *  padding and corner radius, so a cluster placed in a host toolbar or panel that already draws
   *  its own surface doesn't double the frame. The buttons keep their shared minimum hit area and
   *  their own hover/focus affordances either way. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  @state() private snapshot: FlowStructureSnapshot | null = null;
  @state() private locked = false;
  private canvasEl?: FlowCanvasLike;
  private unsubscribe?: () => void;
  private readonly companionController = new FlowCanvasCompanionController<FlowCanvasLike>(
    this,
    isFlowCanvasLike,
    (next) => this.attachCanvas(next),
  );

  override connectedCallback(): void {
    super.connectedCallback();
    this.companionController.connect();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.companionController.disconnect();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.companionController.adopt();
  }

  // Guarded by `hasUpdated` -- `connectedCallback()` already ran the initial `resolveAndAttach()`
  // before the first render, so only a genuine runtime `for` change (never the first update, where
  // `for` always appears in `changed` alongside every other reactive property) should redo it.
  // Runs from `willUpdate()`, not `updated()`, so the reset lands in the render this same cycle
  // produces instead of synchronously scheduling a second cycle from within `updated()`.
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && changed.has('for')) {
      this.companionController.targetIdChanged();
    }
  }

  private attachCanvas(canvas: FlowCanvasLike | null): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.snapshot = null;
    this.locked = false;
    this.canvasEl = canvas ?? undefined;
    if (!canvas) return;
    this.locked = canvas.locked;
    this.unsubscribe = canvas.registerCompanion((snapshot) => {
      if (!this.isConnected || this.canvasEl !== canvas) return;
      this.snapshot = snapshot;
      this.locked = snapshot.locked;
    });
  }

  private toggleLock = (): void => {
    if (!this.canvasEl) return;
    const locked = !this.canvasEl.locked;
    this.canvasEl.locked = locked;
    // The authoritative snapshot follows on the canvas's next coalesced frame. Reflect this
    // control's own committed action immediately so aria-pressed never lags a click by a frame.
    this.locked = locked;
  };

  override render(): TemplateResult {
    const disabled = !this.canvasEl;
    const viewport = this.snapshot?.viewport;
    const atMin = viewport ? viewport.zoom <= viewport.minZoom : false;
    const atMax = viewport ? viewport.zoom >= viewport.maxZoom : false;
    return html`<div
      part="base"
      role="group"
      aria-label=${hostAriaLabel(this) ?? this.localize('flowControlsLabel')}
    >
      <button
        part="zoom-in"
        type="button"
        ?disabled=${disabled || this.locked || atMax}
        aria-label=${this.localize('zoomIn')}
        title=${this.localize('zoomIn')}
        @click=${() => this.canvasEl?.zoomIn()}
      >${plusGlyph()}</button>
      <button
        part="zoom-out"
        type="button"
        ?disabled=${disabled || this.locked || atMin}
        aria-label=${this.localize('zoomOut')}
        title=${this.localize('zoomOut')}
        @click=${() => this.canvasEl?.zoomOut()}
      >${minusGlyph()}</button>
      <button
        part="fit"
        type="button"
        ?disabled=${disabled || this.locked}
        aria-label=${this.localize('zoomToFit')}
        title=${this.localize('zoomToFit')}
        @click=${() => this.canvasEl?.fit()}
      >${fitGlyph()}</button>
      ${this.hideLock
        ? nothing
        : html`<button
            part="lock"
            type="button"
            ?disabled=${disabled}
            aria-pressed=${this.locked ? 'true' : 'false'}
            aria-label=${this.localize('flowLockCanvas')}
            title=${this.localize('flowLockCanvas')}
            @click=${this.toggleLock}
          >${this.locked ? lockClosedGlyph() : lockOpenGlyph()}</button>`}
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-flow-controls': LyraFlowControls;
  }
}
