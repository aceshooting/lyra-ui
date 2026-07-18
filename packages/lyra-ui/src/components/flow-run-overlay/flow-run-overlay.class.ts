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
 * `<lyra-flow-run-overlay>` — execution-state presentation for a `lyra-flow-canvas`: pushes a
 * `FlowRunDecorations` map into the resolved canvas (the canvas itself renders the node/edge paint)
 * and renders a compact run-summary strip. Does not execute, poll, or time anything — pure pushed
 * state; `durationMs` is host-computed.
 *
 * @customElement lyra-flow-run-overlay
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

  // Deviation from the plan brief (documented per this task's execution instructions): the brief's
  // literal code calls `announceTransitions()` from `updated()` (i.e. after this same cycle's
  // `render()` has already committed). `announceTransitions()` force-flushes into the reactive
  // `liveText` state, so a property set there is a *second* `requestUpdate()` -- by that point
  // `isUpdatePending` has already been reset to `false` (Lit's own `update()` clears it before
  // `updated()`/`firstUpdated()` run), so the state write starts a brand-new, independently-promised
  // update cycle rather than folding into the one in flight. A test that only does
  // `el.prop = x; await el.updateComplete;` captures *that* getter's promise synchronously (before
  // the nested cycle even exists) and so resolves before the nested cycle's `render()` commits,
  // leaving `[part="live-region"]` still showing the pre-transition text -- reproduced by this
  // component's own "announces a step status transition" test failing with `''` instead of the
  // announced string. Calling it from `willUpdate()` instead computes the derived `liveText` state
  // *before* `render()` for the *same* cycle -- Lit's own documented use for `willUpdate()` -- so the
  // announcement is visible in the exact `render()` pass `updateComplete` is already waiting on, with
  // no extra cycle and no dev-mode "scheduled an update after an update completed" warning.
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
        '<lyra-flow-run-overlay> is overwriting <lyra-flow-canvas>.decorations set by something else; mixing this element with direct decorations writes is unsupported.',
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

  // Deviation from the plan brief (documented per this task's execution instructions): the brief's
  // literal code interpolates `this.statusLabel(decoration.status)` (the *localized, capitalized*
  // caption, e.g. "Success") into `flowRunStepStatus`. This component's own test asserts the raw
  // lower-case status literal instead (`'Fetch data: success'`), and `statusLabel()`'s capitalized
  // caption can never produce that string for any locale whose `statusSuccess` default is `'Success'`
  // -- reproduced by this component's own "announces a step status transition" test failing with
  // "Fetch data: Success" (capital S) instead. Passing `decoration.status` directly here (as opposed
  // to also trying `localize('statusSuccess', decoration.status, ...)`, which would use the raw
  // status as a *fallback* and silently defeat any `registerLyraLocale()` override per this repo's
  // own localize() convention) matches the test and keeps the visible per-status count spans in
  // `render()` -- which still go through `statusLabel()` -- as the only localized/capitalized surface.
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

  // Deviation from the plan brief (documented per this task's execution instructions): the brief's
  // literal code filters to `nodeIds` read fresh off `this.canvasEl.nodes` at render time, to exclude
  // stale decoration entries for node ids no longer on the canvas. But nothing re-renders *this*
  // element when only the *canvas's* `nodes` array changes (unlike a `registerCompanion()`-based
  // sibling such as `lyra-flow-minimap`, which trades an extra rAF of latency for exactly that
  // reactivity -- see its own tests' explicit `await new Promise((r) => requestAnimationFrame(r))`
  // after setting canvas `nodes`, which this component's own test file has no equivalent of). A host
  // that sets `.decorations` before -- or in the same tick as -- the canvas's `nodes` (the common
  // "mount fully wired" case exercised by this component's own tests) would therefore see the
  // filtered summary permanently stuck at whatever `nodes` happened to resolve to at this element's
  // own first render (typically `[]`, since `<lyra-flow-run-overlay>` and `<lyra-flow-canvas>` are
  // independent custom elements with no ordering guarantee), never updating again -- reproduced by
  // this component's own "renders the ... summary" test failing with "0 of 0" instead of "1 of 2".
  // Tallying directly over `this.decorations` (this element's own pushed-in state, matching the
  // class's own "pure pushed state" contract) instead of cross-element `canvasEl.nodes` membership
  // sidesteps the whole timing dependency; `announceTransitions()` below still reads `canvasEl.nodes`
  // for its node-label lookup, which is safe because that one is read live at the moment of an actual
  // `decorations` change on *this* element (this element's own update cycle), not cached from a
  // possibly-long-past render.
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
    const { done, total, counts } = this.summary();
    return html`<div part="base" role="group" aria-label=${label}>
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
    'lyra-flow-run-overlay': LyraFlowRunOverlay;
  }
}
