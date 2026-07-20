import { html, nothing, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-canvas.class.js';
import { styles } from './flow-controls.styles.js';

interface FlowCanvasLike extends HTMLElement {
  registerCompanion(cb: (snapshot: FlowStructureSnapshot) => void): () => void;
  zoomIn(): void;
  zoomOut(): void;
  fit(options?: { padding?: number }): void;
  minZoom: number;
  maxZoom: number;
  locked: boolean;
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

/** Visual chrome for `<lr-flow-controls>`'s root, mirroring `lr-card`'s `appearance` vocabulary. */
export type FlowControlsAppearance = 'card' | 'plain';

/**
 * `<lr-flow-controls>` — the canvas's button cluster: zoom in/out, fit, and interaction lock, so
 * every flow surface ships the same affordances without hosts rebuilding them. Manipulates only
 * view state, never `nodes`/`edges` — no editing commands live here.
 *
 * @customElement lr-flow-controls
 * @slot - Extra host buttons appended to the cluster, styled by the same group.
 * @csspart base - The `role="group"` wrapper. Drops its floating-surface chrome (border,
 *   background, shadow, padding, radius) under `appearance="plain"`.
 * @csspart zoom-in - Zoom-in button.
 * @csspart zoom-out - Zoom-out button.
 * @csspart fit - Zoom-to-fit button.
 * @csspart lock - Lock/unlock toggle button (omitted when `hideLock`).
 */
export class LyraFlowControls extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Id of the `lr-flow-canvas` this cluster drives. Empty (the default) resolves to the nearest
   *  ancestor canvas -- the slotted-into-a-corner-slot case. Changing it at runtime re-resolves and
   *  re-subscribes; a target that mounts later is picked up too. */
  @property() for = '';
  /** Layout axis of the button cluster. */
  @property({ reflect: true }) orientation: 'vertical' | 'horizontal' = 'vertical';
  /** Omits the lock/unlock toggle button entirely, for canvases that never expose an interaction
   *  lock. */
  @property({ type: Boolean, attribute: 'hide-lock' }) hideLock = false;
  /** Visual chrome, mirroring `lr-card`'s `appearance` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, shadowed floating cluster. `'plain'` removes the border, background, shadow,
   *  padding and corner radius, so a cluster placed in a host toolbar or panel that already draws
   *  its own surface doesn't double the frame. The buttons keep their shared minimum hit area and
   *  their own hover/focus affordances either way. */
  @property({ reflect: true }) appearance: FlowControlsAppearance = 'card';

  @state() private snapshot: FlowStructureSnapshot | null = null;
  @state() private locked = false;
  private canvasEl?: FlowCanvasLike;
  private unsubscribe?: () => void;
  private lockObserver?: MutationObserver;
  /** Watches the root for DOM changes while no canvas has resolved yet, so a `for` target or
   *  ancestor `lr-flow-canvas` that mounts after this element does still gets picked up instead
   *  of leaving every button permanently disabled. Disconnected once a canvas resolves. */
  private canvasWatcher?: MutationObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.resolveAndAttach();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.lockObserver?.disconnect();
    this.lockObserver = undefined;
    this.canvasWatcher?.disconnect();
    this.canvasWatcher = undefined;
    this.canvasEl = undefined;
  }

  // Guarded by `hasUpdated` -- `connectedCallback()` already ran the initial `resolveAndAttach()`
  // before the first render, so only a genuine runtime `for` change (never the first update, where
  // `for` always appears in `changed` alongside every other reactive property) should redo it.
  // Runs from `willUpdate()`, not `updated()`, so the reset lands in the render this same cycle
  // produces instead of synchronously scheduling a second cycle from within `updated()`.
  protected willUpdate(changed: PropertyValues): void {
    if (this.hasUpdated && changed.has('for')) {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.lockObserver?.disconnect();
      this.lockObserver = undefined;
      this.canvasWatcher?.disconnect();
      this.canvasWatcher = undefined;
      this.canvasEl = undefined;
      this.snapshot = null;
      this.locked = false;
      this.resolveAndAttach();
    }
  }

  private resolveCanvas(): FlowCanvasLike | null {
    if (this.for) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const byId = root.getElementById?.(this.for);
      if (byId && byId.tagName.toLowerCase() === tag('flow-canvas')) return byId as unknown as FlowCanvasLike;
    }
    const ancestor = this.closest(tag('flow-canvas'));
    return (ancestor as unknown as FlowCanvasLike) ?? null;
  }

  private resolveAndAttach(): void {
    const canvas = this.resolveCanvas();
    if (!canvas) {
      this.watchForCanvas();
      return;
    }
    this.canvasWatcher?.disconnect();
    this.canvasWatcher = undefined;
    this.canvasEl = canvas;
    this.locked = canvas.locked;
    this.unsubscribe = canvas.registerCompanion((snapshot) => {
      this.snapshot = snapshot;
    });
    this.lockObserver = new MutationObserver(() => {
      this.locked = canvas.locked;
    });
    this.lockObserver.observe(canvas, { attributes: true, attributeFilter: ['locked'] });
  }

  private watchForCanvas(): void {
    if (this.canvasWatcher) return;
    const root = this.getRootNode() as Document | ShadowRoot;
    this.canvasWatcher = new MutationObserver(() => this.resolveAndAttach());
    this.canvasWatcher.observe(root, { childList: true, subtree: true });
  }

  private toggleLock = (): void => {
    if (!this.canvasEl) return;
    this.canvasEl.locked = !this.canvasEl.locked;
  };

  render(): TemplateResult {
    const disabled = !this.canvasEl;
    const zoom = this.snapshot?.viewport.zoom ?? 1;
    const atMin = this.canvasEl ? zoom <= this.canvasEl.minZoom : false;
    const atMax = this.canvasEl ? zoom >= this.canvasEl.maxZoom : false;
    return html`<div part="base" role="group" aria-label=${this.localize('flowControlsLabel')}>
      <button
        part="zoom-in"
        type="button"
        ?disabled=${disabled || atMax}
        aria-label=${this.localize('zoomIn')}
        title=${this.localize('zoomIn')}
        @click=${() => this.canvasEl?.zoomIn()}
      >${plusGlyph()}</button>
      <button
        part="zoom-out"
        type="button"
        ?disabled=${disabled || atMin}
        aria-label=${this.localize('zoomOut')}
        title=${this.localize('zoomOut')}
        @click=${() => this.canvasEl?.zoomOut()}
      >${minusGlyph()}</button>
      <button
        part="fit"
        type="button"
        ?disabled=${disabled}
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
