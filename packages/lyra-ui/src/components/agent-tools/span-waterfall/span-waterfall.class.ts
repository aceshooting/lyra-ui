import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteRange } from '../../../internal/numbers.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './span-waterfall.styles.js';
import type { LyraSpan } from '../trace-tree/span.js';

export type { LyraSpan } from '../trace-tree/span.js';

const KIND_LABEL_KEY: Record<LyraSpan['kind'], string> = {
  agent: 'spanKindAgent',
  llm: 'spanKindLlm',
  tool: 'spanKindTool',
  retriever: 'spanKindRetriever',
  embedding: 'spanKindEmbedding',
  other: 'spanKindOther',
};
const STATUS_LABEL_KEY: Record<LyraSpan['status'], string> = {
  pending: 'statusPending',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusError',
  denied: 'statusDenied',
};
/** success->success, error->danger, denied->warning, running->accent, pending->neutral outline. */
const STATUS_TONE: Record<LyraSpan['status'], string> = {
  success: 'success',
  error: 'danger',
  denied: 'warning',
  running: 'accent',
  pending: 'neutral',
};

/** Nice-numbers step (1/2/5 x 10^n) for axis tick spacing — the same small
 *  algorithm used by this library's own chart axis code, duplicated locally
 *  rather than imported since that implementation is a private module
 *  function there, not a shared export. */
function niceStep(span: number, count: number): number {
  if (span <= 0) return 1;
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const niceResidual = residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10;
  return niceResidual * magnitude;
}

function axisTicks(start: number, end: number, count = 5): number[] {
  const step = niceStep(end - start, count);
  if (step <= 0) return [start];
  const first = Math.ceil(start / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

interface ViewWindow {
  start: number;
  end: number;
}

export interface LyraSpanWaterfallEventMap {
  'lr-span-select': CustomEvent<{ id: string }>;
}

/**
 * `<lr-span-waterfall>` — the horizontal-timeline projection of the same
 * `LyraSpan[]` `<lr-trace-tree>` consumes: a time axis, one row per span
 * in start order, status-toned bars (Langfuse timeline / Temporal
 * event-history style).
 *
 * @customElement lr-span-waterfall
 * @event lr-span-select - `detail: { id }` — a bar/row was activated (click, Enter, Space).
 * @csspart base - The root wrapper.
 * @csspart axis - The time-ruler row, hidden when `hideAxis`.
 * @csspart tick - One axis tick mark.
 * @csspart tick-label - An axis tick's formatted duration label.
 * @csspart row - One span's row.
 * @csspart name - The span's name (the row's name gutter).
 * @csspart bar-track - The bar's positioning track.
 * @csspart bar - The interactive, focusable status-toned bar (`role` via `<button>`).
 * @csspart meta - Secondary row info (status/duration), shown inline under 480px.
 * @csspart status-text - The visible status label.
 * @csspart duration - The formatted duration text.
 * @csspart empty - The empty-state message shown when `spans` is empty.
 * @csspart live-region - The internal focus/status-announcement live region.
 * @cssprop [--lr-span-waterfall-name-width=8rem] - Width of the name gutter column.
 * @cssprop [--lr-span-waterfall-stripe-speed] - Animation duration for a `running` span's striped bar; defaults to `--lr-transition-ambient`.
 */
export class LyraSpanWaterfall extends LyraElement<LyraSpanWaterfallEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Identical contract to `<lr-trace-tree>.spans`; rows sort by `startMs` (ties keep array order). */
  @property({ attribute: false }) spans: LyraSpan[] = [];
  @property({ attribute: 'active-span-id' }) activeSpanId: string | null = null;
  /** Visible time window in trace-relative ms (same non-negative, trace-relative vocabulary as
   *  `LyraSpan.startMs`/`endMs` -- never a wall-clock timestamp). Both `null` (the default) fits
   *  the whole trace; a non-null NaN (e.g. an unparsable attribute) is normalized the same way as
   *  `null` by `viewWindow()` rather than poisoning the axis/bar math with NaN. */
  @property({ type: Number, attribute: 'view-start-ms' }) viewStartMs: number | null = null;
  @property({ type: Number, attribute: 'view-end-ms' }) viewEndMs: number | null = null;
  @property({ type: Boolean, attribute: 'hide-axis' }) hideAxis = false;
  @property() label = '';

  @state() private focusedId: string | null = null;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private sortedSpans(): LyraSpan[] {
    return this.spans
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s.startMs - b.s.startMs || a.i - b.i)
      .map((x) => x.s);
  }

  private viewWindow(): ViewWindow {
    const extentEnd = this.spans.reduce((m, s) => Math.max(m, s.endMs ?? s.startMs, s.startMs), 0);
    const fallbackEnd = Math.max(extentEnd, 1);
    // `null` means "fit the whole trace"; a non-null-but-NaN value (a bad attribute) falls back
    // to that same default instead of flowing NaN into axisTicks()/barGeometry(). Both bounds are
    // trace-relative ms, so never negative (min 0), mirroring `LyraSpan.startMs`'s own contract.
    const start = this.viewStartMs == null ? 0 : finiteRange(this.viewStartMs, 0, 0);
    const end = this.viewEndMs == null ? fallbackEnd : finiteRange(this.viewEndMs, fallbackEnd, 0);
    // A caller-supplied window with end <= start (inverted or degenerate) still needs *some*
    // positive width to render/position bars sanely -- widen to a minimal 1ms window rather than
    // swapping start/end (unlike `<lr-time-range>`'s handle-drag case, swapping here would
    // silently reverse which side of the timeline is being viewed).
    return { start, end: end > start ? end : start + 1 };
  }

  private barGeometry(span: LyraSpan, view: ViewWindow): { startPct: number; widthPct: number } {
    const spanWidth = view.end - view.start || 1;
    const endMs = span.endMs ?? (span.status === 'running' ? view.end : span.startMs);
    const clampedStart = Math.max(view.start, span.startMs);
    const clampedEnd = Math.min(view.end, Math.max(endMs, span.startMs));
    const startPct = Math.max(0, Math.min(100, ((clampedStart - view.start) / spanWidth) * 100));
    const widthPct = Math.max(0, Math.min(100 - startPct, ((clampedEnd - clampedStart) / spanWidth) * 100));
    return { startPct, widthPct };
  }

  private formatDuration(ms: number | undefined): string {
    if (ms == null) return '';
    return ms < 1000
      ? this.localize('durationMilliseconds', undefined, { value: Math.round(ms) })
      : this.localize('durationSeconds', undefined, { value: (ms / 1000).toFixed(1) });
  }

  private focusRow(span: LyraSpan | undefined): void {
    if (!span) return;
    this.focusedId = span.id;
    this.announceFocus(span);
    void this.updateComplete.then(() => {
      (this.renderRoot.querySelector(`[data-id="${CSS.escape(span.id)}"]`) as HTMLElement | null)?.focus();
    });
  }

  private announceFocus(span: LyraSpan): void {
    const parts = [
      span.name,
      this.localize(KIND_LABEL_KEY[span.kind]),
      this.localize(STATUS_LABEL_KEY[span.status]),
      this.localize('spanStartedAtOffset', undefined, { value: this.formatDuration(span.startMs) || '0ms' }),
    ];
    if (span.endMs != null) parts.push(this.formatDuration(span.endMs - span.startMs));
    this.liveRegion?.announce(parts.join(' — '), { force: true });
  }

  private selectRow(id: string): void {
    this.focusedId = id;
    this.emit('lr-span-select', { id });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const rows = this.sortedSpans();
    if (rows.length === 0) return;
    const currentIndex = rows.findIndex((s) => s.id === this.focusedId);
    const idx = currentIndex >= 0 ? currentIndex : 0;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusRow(rows[Math.min(rows.length - 1, idx + 1)]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusRow(rows[Math.max(0, idx - 1)]);
        break;
      case 'Home':
        e.preventDefault();
        this.focusRow(rows[0]);
        break;
      case 'End':
        e.preventDefault();
        this.focusRow(rows[rows.length - 1]);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.selectRow(rows[idx].id);
        break;
      default:
        return;
    }
  };

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('spans')) {
      const ids = new Set(this.spans.map((s) => s.id));
      if (this.focusedId == null || !ids.has(this.focusedId)) {
        this.focusedId = this.activeSpanId && ids.has(this.activeSpanId) ? this.activeSpanId : (this.sortedSpans()[0]?.id ?? null);
      }
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('activeSpanId') && this.activeSpanId) {
      this.focusedId = this.activeSpanId;
      const bar = this.renderRoot.querySelector(`[data-id="${CSS.escape(this.activeSpanId)}"]`) as HTMLElement | null;
      bar?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  private renderAxis(view: ViewWindow): TemplateResult {
    const ticks = axisTicks(view.start, view.end);
    const span = view.end - view.start || 1;
    return html`
      <div part="axis" aria-hidden="true">
        ${ticks.map((t) => {
          const pct = ((t - view.start) / span) * 100;
          if (pct < 0 || pct > 100) return nothing;
          return html`<span part="tick" style=${`inset-inline-start:${pct}%`}
            ><span part="tick-label">${this.formatDuration(t)}</span></span
          >`;
        })}
      </div>
    `;
  }

  private renderRow(span: LyraSpan, view: ViewWindow, posInSet: number, setSize: number): TemplateResult {
    const { startPct, widthPct } = this.barGeometry(span, view);
    const isActive = this.activeSpanId === span.id;
    const rows = this.sortedSpans();
    const tabbable = this.focusedId === span.id || (this.focusedId == null && rows[0]?.id === span.id);
    const durationLabel = span.endMs != null ? this.formatDuration(span.endMs - span.startMs) : '';
    const fragments = [
      span.name,
      this.localize(KIND_LABEL_KEY[span.kind]),
      this.localize(STATUS_LABEL_KEY[span.status]),
      durationLabel,
    ].filter(Boolean);
    return html`
      <div part="row" role="listitem" aria-posinset=${posInSet} aria-setsize=${setSize} ?data-active=${isActive}>
        <span part="name">${span.name}</span>
        <span part="bar-track">
          <button
            part="bar"
            type="button"
            data-id=${span.id}
            data-tone=${STATUS_TONE[span.status]}
            data-status=${span.status}
            tabindex=${tabbable ? '0' : '-1'}
            aria-current=${isActive ? 'true' : nothing}
            aria-label=${fragments.join(' — ')}
            style=${`inset-inline-start:${startPct}%;inline-size:${widthPct}%`}
            @click=${() => this.selectRow(span.id)}
            @focus=${() => {
              this.focusedId = span.id;
            }}
          ></button>
        </span>
        <span part="meta">
          <span part="status-text" data-status=${span.status}>${this.localize(STATUS_LABEL_KEY[span.status])}</span>
          ${durationLabel ? html`<span part="duration">${durationLabel}</span>` : nothing}
        </span>
      </div>
    `;
  }

  render(): TemplateResult {
    const rows = this.sortedSpans();
    const view = this.viewWindow();
    return html`
      <div
        part="base"
        role="list"
        aria-label=${this.label || this.getAttribute('aria-label') || this.localize('spanWaterfall')}
        @keydown=${this.onKeyDown}
      >
        ${!this.hideAxis && rows.length > 0 ? this.renderAxis(view) : nothing}
        ${rows.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : rows.map((span, index) => this.renderRow(span, view, index + 1, rows.length))}
      </div>
      <lr-live-region part="live-region" mode="polite"></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-span-waterfall': LyraSpanWaterfall;
  }
}
