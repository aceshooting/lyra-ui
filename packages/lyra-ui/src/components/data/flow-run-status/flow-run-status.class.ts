import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  Announcer,
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import type { FlowRunDecorations } from '../flow-canvas/flow-types.js';
import { snapshotFlowDecorations } from '../flow-canvas/flow-model.js';
import { FlowCanvasCompanionController } from '../flow-canvas/flow-companion-controller.js';
import { styles } from './flow-run-status.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_flowRunStatusCount, LYRA_DEFAULT_flowRunStatusLabel, LYRA_DEFAULT_flowRunStepStatus, LYRA_DEFAULT_flowRunSummary, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const ALL_STATUSES: readonly LyraToolStatus[] = ['pending', 'running', 'success', 'error', 'denied'];
const DONE_STATUSES = new Set<LyraToolStatus>(['success', 'error', 'denied']);

interface FlowCanvasLike extends HTMLElement {
  decorations: FlowRunDecorations | null;
  readonly nodes: readonly { readonly id: string; readonly data?: Readonly<Record<string, unknown>> }[];
}

function isFlowCanvasLike(element: HTMLElement): element is FlowCanvasLike {
  const candidate = element as Partial<FlowCanvasLike>;
  return 'decorations' in candidate && Array.isArray(candidate.nodes);
}

/**
 * `<lr-flow-run-status>` — execution-state presentation for a `lr-flow-canvas`: pushes a
 * `FlowRunDecorations` map into the resolved canvas (the canvas itself renders the node/edge paint)
 * and renders a compact run-summary strip. Does not execute, poll, or time anything — pure pushed
 * state; `durationMs` is host-computed.
 *
 * @customElement lr-flow-run-status
 * @slot - Extra host chrome appended to the strip (e.g. a cancel button or a usage badge).
 * @csspart base - The root wrapper. Drops its floating-surface chrome under `frame="plain"`.
 * @csspart summary - The "{done} of {total} steps complete" line.
 * @csspart count - One per status present (text + tone dot, never color-only).
 * @csspart live-region - The visually-hidden, `aria-hidden` mirror of the last step-transition
 *   announcement. The announcement itself lands in the shared light-DOM polite region
 *   (`acquireAnnouncementSink()` in `internal/announcer.ts`), because a live region inside a shadow
 *   root is not reliably announced; this part is a styling/inspection surface only.
 * @cssprop [--lr-flow-status-color=var(--lr-color-border-strong)] - Count-dot color
 *   when no execution status is set.
 * @cssprop [--lr-flow-status-pending-color=var(--lr-color-border-strong)] - Pending
 *   count-dot color.
 * @cssprop [--lr-flow-status-running-color=var(--lr-color-brand)] - Running count-dot color.
 * @cssprop [--lr-flow-status-success-color=var(--lr-color-success)] - Success count-dot color.
 * @cssprop [--lr-flow-status-error-color=var(--lr-color-danger)] - Error count-dot color.
 * @cssprop [--lr-flow-status-denied-color=var(--lr-color-warning)] - Denied count-dot color.
 * @status stable
 * @since 4.0.0
 */
export class LyraFlowRunStatus extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    flowRunStatusCount: LYRA_DEFAULT_flowRunStatusCount,
    flowRunStatusLabel: LYRA_DEFAULT_flowRunStatusLabel,
    flowRunStepStatus: LYRA_DEFAULT_flowRunStepStatus,
    flowRunSummary: LYRA_DEFAULT_flowRunSummary,
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  @property() for = '';
  private _decorations: FlowRunDecorations = Object.freeze({});
  /** Detached, deeply frozen decoration snapshot. Invalid status entries are omitted. */
  @property({ attribute: false })
  get decorations(): FlowRunDecorations {
    return this._decorations;
  }
  set decorations(value: FlowRunDecorations) {
    const previous = this._decorations;
    this._decorations = snapshotFlowDecorations(value);
    this.requestUpdate('decorations', previous);
  }
  @property({ type: Boolean, attribute: 'hide-summary' }) hideSummary = false;
  @property() label = '';
  /** Container treatment, in the shared `LyraFrame` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, shadowed floating strip. `'plain'` removes the border, background, shadow,
   *  padding and corner radius, so a summary strip dropped directly into a host toolbar that
   *  already draws its own frame doesn't double it. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  @state() private liveText = '';
  private readonly announcer = new Announcer({
    onFlush: (text) => {
      this.sink?.announce(text);
      this.liveText = text;
    },
  });
  /** Handle on the shared light-DOM live region every flush actually announces through -- a region
   *  rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores one
   *  outright), so `[part="live-region"]` is only an `aria-hidden` mirror. */
  private sink?: AnnouncementSink;
  private canvasEl?: FlowCanvasLike;
  private readonly companionController = new FlowCanvasCompanionController<FlowCanvasLike>(
    this,
    isFlowCanvasLike,
    (next) => this.attachCanvas(next),
  );
  /** The exact `FlowRunDecorations` object reference this element itself last wrote into the
   *  canvas -- lets `applyDecorations()`/`disconnectedCallback()` tell "still ours" from "someone
   *  else wrote a different value since" by identity, not deep equality. */
  private lastWrittenDecorations: FlowRunDecorations | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    // Acquired on connect, not on the first announcement: assistive tech has to have been
    // observing a live region *before* text arrives for the change to be announced at all.
    this.syncSink();
    this.companionController.connect();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.companionController.disconnect();
    this.announcer.cancel();
    this.sink?.release();
    this.sink = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    this.syncSink();
    this.companionController.adopt();
  }

  private syncSink(): void {
    if (this.sink?.element.ownerDocument === this.ownerDocument) return;
    this.sink?.release();
    this.sink = this.isConnected
      ? acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this })
      : undefined;
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
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && changed.has('for')) this.companionController.targetIdChanged();
    if (changed.has('decorations')) {
      this.announceTransitions(changed.get('decorations') as FlowRunDecorations | undefined);
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('decorations')) {
      this.applyDecorations();
    }
  }

  private attachCanvas(next: FlowCanvasLike | null): void {
    if (this.canvasEl && this.canvasEl.decorations === this.lastWrittenDecorations) {
      this.canvasEl.decorations = null;
    }
    this.canvasEl = next ?? undefined;
    this.lastWrittenDecorations = null;
    this.applyDecorations();
  }

  private applyDecorations(): void {
    if (!this.canvasEl) return;
    const current = this.canvasEl.decorations;
    if (this.lastWrittenDecorations !== null && current !== null && current !== this.lastWrittenDecorations) {
      console.warn(
        '<lr-flow-run-status> is overwriting <lr-flow-canvas>.decorations set by something else; mixing this element with direct decorations writes is unsupported.',
      );
    }
    this.canvasEl.decorations = this.decorations;
    // Canvas snapshots inputs again at its own ownership boundary; track that settled public
    // reference, not this component's source snapshot, for identity-safe release/overwrite checks.
    this.lastWrittenDecorations = this.canvasEl.decorations;
  }

  private statusLabel(status: LyraToolStatus): string {
    if (status === 'pending') return this.localize('statusPending');
    if (status === 'running') return this.localize('statusRunning');
    if (status === 'success') return this.localize('statusSuccess');
    if (status === 'error') return this.localize('statusError');
    return this.localize('statusDenied');
  }

  private announceTransitions(previous: FlowRunDecorations | undefined): void {
    if (!previous) return; // first assignment -- nothing to compare against, no spam on mount
    const messages: string[] = [];
    for (const [id, decoration] of Object.entries(this.decorations)) {
      if (previous[id]?.status === decoration.status) continue;
      const node = this.canvasEl?.nodes.find((n) => n.id === id);
      const label = typeof node?.data?.['label'] === 'string' ? node.data['label'] : id;
      messages.push(
        this.localize('flowRunStepStatus', undefined, {
          label,
          status: this.statusLabel(decoration.status),
        }),
      );
    }
    if (messages.length > 0) {
      this.announcer.announce(
        getListFormat(this.effectiveLocale, { type: 'conjunction', style: 'long' }).format(messages),
        { force: true },
      );
    }
  }

  // The tally runs directly over `this.decorations` (this element's own pushed-in state, matching
  // the class's "pure pushed state" contract) rather than filtering to node ids read fresh off
  // `this.canvasEl.nodes` at render time. Nothing re-renders *this* element when only the
  // *canvas's* `nodes` array changes (unlike a `registerCompanion()`-based sibling such as
  // `lr-flow-minimap`, which trades an extra rAF of latency for exactly that reactivity), and
  // `<lr-flow-run-status>`/`<lr-flow-canvas>` are independent custom elements with no
  // upgrade-ordering guarantee -- a canvas-membership filter would leave the summary permanently
  // stuck at whatever `nodes` happened to resolve to at this element's own first render (typically
  // `[]`, i.e. "0 of 0"), never updating again. `announceTransitions()` above still reads
  // `canvasEl.nodes` for its node-label lookup, which is safe because that one is read live at the
  // moment of an actual `decorations` change on *this* element (this element's own update cycle),
  // not cached from a possibly-long-past render.
  private summary(): { done: number; total: number; counts: Record<LyraToolStatus, number> } {
    const counts: Record<LyraToolStatus, number> = { pending: 0, running: 0, success: 0, error: 0, denied: 0 };
    let total = 0;
    let done = 0;
    for (const decoration of Object.values(this.decorations)) {
      total++;
      counts[decoration.status]++;
      if (DONE_STATUSES.has(decoration.status)) done++;
    }
    return { done, total, counts };
  }

  override render(): TemplateResult {
    const label = this.label || this.localize('flowRunStatusLabel');
    const ariaLabel = this.getAttribute('aria-label') || label;
    const { done, total, counts } = this.summary();
    const number = getNumberFormat(this.effectiveLocale);
    return html`<div part="base" role="group" aria-label=${ariaLabel}>
      ${this.hideSummary
        ? ''
        : html`
            <div part="summary">${this.localize('flowRunSummary', undefined, {
              done: number.format(done),
              total: number.format(total),
            })}</div>
            ${ALL_STATUSES.filter((s) => counts[s] > 0).map(
              (s) => html`<span part="count" data-status=${s}><span class="tone-dot"></span>${this.localize(
                'flowRunStatusCount',
                undefined,
                { status: this.statusLabel(s), count: number.format(counts[s]) },
              )}</span>`,
            )}
          `}
      <div part="live-region" class="sr-only" aria-hidden="true">${this.liveText}</div>
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-flow-run-status': LyraFlowRunStatus;
  }
}
