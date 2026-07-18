import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { tag } from '../../internal/prefix.js';
import { srOnly } from '../../internal/a11y.js';
import { Announcer } from '../../internal/announcer.js';
import type { FlowRunDecorations, FlowRunStatus } from '../flow-canvas/flow-canvas.class.js';
import { styles } from './flow-run-overlay.styles.js';

const ALL_STATUSES: FlowRunStatus[] = ['pending', 'running', 'success', 'error', 'denied'];
const DONE_STATUSES = new Set<FlowRunStatus>(['success', 'error', 'denied']);

interface FlowCanvasLike extends HTMLElement {
  decorations: FlowRunDecorations | null;
  nodes: { id: string; data?: Record<string, unknown> }[];
}

/**
 * `<lr-flow-run-overlay>` — execution-state presentation for a `lr-flow-canvas`: pushes a
 * `FlowRunDecorations` map into the resolved canvas (the canvas itself renders the node/edge paint)
 * and renders a compact run-summary strip. Does not execute, poll, or time anything — pure pushed
 * state; `durationMs` is host-computed.
 *
 * @customElement lr-flow-run-overlay
 * @slot - Extra host chrome appended to the strip (e.g. a cancel button or a usage badge).
 * @csspart base - The root wrapper.
 * @csspart summary - The "{done} of {total} steps complete" line.
 * @csspart count - One per status present (text + tone dot, never color-only).
 * @csspart live-region - The step-transition announcement.
 */
export class LyraFlowRunOverlay extends LyraElement {
  static styles = [LyraElement.styles, styles, srOnly];

  @property() for = '';
  @property({ attribute: false }) decorations: FlowRunDecorations = {};
  @property({ type: Boolean, attribute: 'hide-summary' }) hideSummary = false;
  @property() label = '';

  @state() private liveText = '';
  private readonly announcer = new Announcer({ onFlush: (text) => (this.liveText = text) });
  private canvasEl?: FlowCanvasLike;
  /** The exact `FlowRunDecorations` object reference this element itself last wrote into the
   *  canvas -- lets `applyDecorations()`/`disconnectedCallback()` tell "still ours" from "someone
   *  else wrote a different value since" by identity, not deep equality. */
  private lastWrittenDecorations: FlowRunDecorations | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.canvasEl = this.resolveCanvas() ?? undefined;
    this.applyDecorations();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.canvasEl && this.canvasEl.decorations === this.lastWrittenDecorations) {
      this.canvasEl.decorations = null;
    }
    this.canvasEl = undefined;
  }

  // `announceTransitions()` runs from `willUpdate()`, not `updated()`: it force-flushes into the
  // reactive `liveText` state, and a state write from `updated()` (after this cycle's `render()`
  // has committed and `isUpdatePending` has been reset -- Lit's own `update()` clears it before
  // `updated()`/`firstUpdated()` run) starts a brand-new, independently-promised update cycle
  // rather than folding into the one in flight. A caller that does
  // `el.prop = x; await el.updateComplete;` captures that getter's promise synchronously (before
  // the nested cycle even exists) and so resolves before the nested cycle's `render()` commits,
  // observing `[part="live-region"]` still showing the pre-transition text. Computing the derived
  // `liveText` state *before* `render()` of the *same* cycle -- Lit's own documented use for
  // `willUpdate()` -- makes the announcement visible in the exact `render()` pass `updateComplete`
  // is already waiting on, with no extra cycle and no dev-mode "scheduled an update after an
  // update completed" warning.
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('decorations')) {
      this.announceTransitions(changed.get('decorations') as FlowRunDecorations | undefined);
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('decorations')) {
      this.applyDecorations();
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

  private applyDecorations(): void {
    if (!this.canvasEl) return;
    const current = this.canvasEl.decorations;
    if (this.lastWrittenDecorations !== null && current !== null && current !== this.lastWrittenDecorations) {
      console.warn(
        '<lr-flow-run-overlay> is overwriting <lr-flow-canvas>.decorations set by something else; mixing this element with direct decorations writes is unsupported.',
      );
    }
    this.canvasEl.decorations = this.decorations;
    this.lastWrittenDecorations = this.decorations;
  }

  private statusLabel(status: FlowRunStatus): string {
    if (status === 'pending') return this.localize('statusPending');
    if (status === 'running') return this.localize('statusRunning');
    if (status === 'success') return this.localize('statusSuccess');
    if (status === 'error') return this.localize('statusError');
    return this.localize('statusDenied');
  }

  // The announcement interpolates `decoration.status` -- the raw lower-case status literal -- into
  // `flowRunStepStatus` rather than `statusLabel()`'s localized, capitalized caption: the
  // announcement's whole sentence is owned by the `flowRunStepStatus` template (a locale override
  // replaces the sentence, status wording included). Routing the status through
  // `localize('statusSuccess', decoration.status, ...)` would pass the raw status as a *fallback*
  // and silently defeat any `registerLyraLocale()` override per this repo's localize() convention,
  // so it is interpolated as a plain value instead; the visible per-status count spans in
  // `render()` -- which still go through `statusLabel()` -- remain the localized/capitalized surface.
  private announceTransitions(previous: FlowRunDecorations | undefined): void {
    if (!previous) return; // first assignment -- nothing to compare against, no spam on mount
    for (const [id, decoration] of Object.entries(this.decorations)) {
      if (previous[id]?.status === decoration.status) continue;
      const node = this.canvasEl?.nodes.find((n) => n.id === id);
      const label = typeof node?.data?.label === 'string' ? node.data.label : id;
      this.announcer.announce(
        this.localize('flowRunStepStatus', undefined, { label, status: decoration.status }),
        { force: true },
      );
    }
  }

  // The tally runs directly over `this.decorations` (this element's own pushed-in state, matching
  // the class's "pure pushed state" contract) rather than filtering to node ids read fresh off
  // `this.canvasEl.nodes` at render time. Nothing re-renders *this* element when only the
  // *canvas's* `nodes` array changes (unlike a `registerCompanion()`-based sibling such as
  // `lr-flow-minimap`, which trades an extra rAF of latency for exactly that reactivity), and
  // `<lr-flow-run-overlay>`/`<lr-flow-canvas>` are independent custom elements with no
  // upgrade-ordering guarantee -- a canvas-membership filter would leave the summary permanently
  // stuck at whatever `nodes` happened to resolve to at this element's own first render (typically
  // `[]`, i.e. "0 of 0"), never updating again. `announceTransitions()` above still reads
  // `canvasEl.nodes` for its node-label lookup, which is safe because that one is read live at the
  // moment of an actual `decorations` change on *this* element (this element's own update cycle),
  // not cached from a possibly-long-past render.
  private summary(): { done: number; total: number; counts: Record<FlowRunStatus, number> } {
    const counts: Record<FlowRunStatus, number> = { pending: 0, running: 0, success: 0, error: 0, denied: 0 };
    let total = 0;
    let done = 0;
    for (const decoration of Object.values(this.decorations)) {
      total++;
      counts[decoration.status]++;
      if (DONE_STATUSES.has(decoration.status)) done++;
    }
    return { done, total, counts };
  }

  render(): TemplateResult {
    const label = this.label || this.localize('flowRunOverlayLabel');
    const ariaLabel = this.getAttribute('aria-label') || label;
    const { done, total, counts } = this.summary();
    return html`<div part="base" role="group" aria-label=${ariaLabel}>
      ${this.hideSummary
        ? ''
        : html`
            <div part="summary">${this.localize('flowRunSummary', undefined, { done, total })}</div>
            ${ALL_STATUSES.filter((s) => counts[s] > 0).map(
              (s) => html`<span part="count" data-status=${s}><span class="tone-dot"></span>${this.statusLabel(s)}: ${counts[s]}</span>`,
            )}
          `}
      <div part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true">${this.liveText}</div>
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-flow-run-overlay': LyraFlowRunOverlay;
  }
}
