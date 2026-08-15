import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteRatio, finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './span-waterfall.styles.js';
import { MAX_RENDERED_LYRA_SPANS, normalizeLyraSpans, type LyraSpan } from '../trace-tree/span.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_accessibleLabelSeparator, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_spanKindAgent, LYRA_DEFAULT_spanKindEmbedding, LYRA_DEFAULT_spanKindLlm, LYRA_DEFAULT_spanKindOther, LYRA_DEFAULT_spanKindRetriever, LYRA_DEFAULT_spanKindTool, LYRA_DEFAULT_spanProjectionLimit, LYRA_DEFAULT_spanStartedAtOffset, LYRA_DEFAULT_spanWaterfall, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
  if (!Number.isFinite(step) || step <= 0) return [start, end];
  const first = Math.ceil(start / step) * step;
  if (!Number.isFinite(first)) return [start, end];
  const ticks: number[] = [];
  // Index-based and explicitly bounded: additive stepping can stop making forward progress near
  // Number.MAX_VALUE and would otherwise hang the render loop forever.
  for (let index = 0; index <= count + 2; index++) {
    const value = first + index * step;
    if (!Number.isFinite(value) || value > end + step / 2) break;
    const rounded = Math.round(value / step) * step;
    if (Number.isFinite(rounded) && (ticks.length === 0 || rounded > ticks[ticks.length - 1]!)) {
      ticks.push(rounded);
    }
  }
  return ticks;
}

interface ViewWindow {
  start: number;
  end: number;
}

export interface LyraSpanWaterfallEventMap {
  'lr-span-select': CustomEvent<{ spanId: string }>;
}

/**
 * `<lr-span-waterfall>` — the horizontal-timeline projection of the same
 * `LyraSpan[]` `<lr-trace-tree>` consumes: a time axis, one row per span
 * in start order, status-toned bars (Langfuse timeline / Temporal
 * event-history style).
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-span-waterfall
 * @event lr-span-select - `detail: { spanId }` — a bar/row was activated (click, Enter, Space).
 * @csspart base - The root wrapper.
 * @csspart axis - The time-ruler row, hidden when `hideAxis`.
 * @csspart tick - One axis tick mark.
 * @csspart tick-label - An axis tick's formatted duration label.
 * @csspart row - One span's row.
 * @csspart name - The span's name (the row's name gutter).
 * @csspart bar-track - The bar's positioning track.
 * @csspart bar - The interactive, focusable status-toned bar (`role` via `<button>`), with a
 *   24px minimum target in both axes even when its duration would paint more narrowly.
 * @csspart meta - Secondary row info (status/duration), shown inline under 480px.
 * @csspart status-text - The visible status label.
 * @csspart duration - The formatted duration text.
 * @csspart empty - The empty-state message shown when `spans` is empty.
 * @csspart limit - Localized notice shown when the shared 500-span projection ceiling is reached.
 * @csspart live-region - The internal focus/status-announcement live region.
 * @cssprop [--lr-span-waterfall-name-width=8rem] - Width of the name gutter column.
 * @cssprop [--lr-span-waterfall-stripe-speed=var(--lr-duration-ambient)] - Animation duration for a
 *   `running` span's striped bar. The fallback is the bare-duration `--lr-duration-ambient`, not the
 *   `--lr-transition-ambient` duration+easing shorthand, which would be invalid in an
 *   `animation-duration` slot.
 * @cssprop [--lr-span-waterfall-row-active-bg=var(--lr-color-brand-quiet)] - Background of the active
 *   (`activeSpanId`) row. Shadow Parts forbids an attribute selector after `::part()`, so the active
 *   row could otherwise only be restyled by hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-span-waterfall-success-color=var(--lr-color-success)] - Success bar fill.
 * @cssprop [--lr-span-waterfall-error-color=var(--lr-color-danger)] - Error bar fill.
 * @cssprop [--lr-span-waterfall-denied-color=var(--lr-color-warning)] - Denied bar fill.
 * @cssprop [--lr-span-waterfall-running-color=var(--lr-color-brand)] - Running stripe foreground.
 * @cssprop [--lr-span-waterfall-running-stripe-color=var(--lr-color-brand-quiet)] - Running stripe background.
 * @cssprop [--lr-span-waterfall-pending-border-color=var(--lr-color-border-strong)] - Pending bar border.
 * @status stable
 * @since 4.0.0
 */
export class LyraSpanWaterfall extends LyraElement<LyraSpanWaterfallEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['spans']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    accessibleLabelSeparator: LYRA_DEFAULT_accessibleLabelSeparator,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    spanKindAgent: LYRA_DEFAULT_spanKindAgent,
    spanKindEmbedding: LYRA_DEFAULT_spanKindEmbedding,
    spanKindLlm: LYRA_DEFAULT_spanKindLlm,
    spanKindOther: LYRA_DEFAULT_spanKindOther,
    spanKindRetriever: LYRA_DEFAULT_spanKindRetriever,
    spanKindTool: LYRA_DEFAULT_spanKindTool,
    spanProjectionLimit: LYRA_DEFAULT_spanProjectionLimit,
    spanStartedAtOffset: LYRA_DEFAULT_spanStartedAtOffset,
    spanWaterfall: LYRA_DEFAULT_spanWaterfall,
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Identical contract to `<lr-trace-tree>.spans`; rows sort by `startMs` (ties keep array order).
   *  The controlled `activeSpanId` reserves a position inside the shared 500-row ceiling. Foreign
   *  runtime `kind`/`status` values normalize to `'other'`/`'pending'` before rendering. */
  @property({ attribute: false }) spans: readonly LyraSpan[] = [];
  @property({ attribute: 'active-span-id' }) activeSpanId: string | null = null;
  /** Visible time window in trace-relative ms (same non-negative, trace-relative vocabulary as
   *  `LyraSpan.startMs`/`endMs` -- never a wall-clock timestamp). Both `null` (the default) fits
   *  the whole trace; a non-null NaN (e.g. an unparsable attribute) is normalized the same way as
   *  `null` by `viewWindow()` rather than poisoning the axis/bar math with NaN. */
  @property({ type: Number, attribute: 'view-start-ms' }) viewStartMs: number | null = null;
  @property({ type: Number, attribute: 'view-end-ms' }) viewEndMs: number | null = null;
  @property({ type: Boolean, attribute: 'hide-axis' }) hideAxis = false;
  @property() label = '';

  private focusedId: string | null = null;
  private sortedSource?: readonly LyraSpan[];
  private sortedActiveSpanId: string | null = null;
  private sortedCache: LyraSpan[] = [];
  private sortedCacheTruncated = false;
  private limitAnnouncementSink?: AnnouncementSink;
  private limitAnnouncementInitialized = false;
  private previouslyTruncated = false;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncLimitAnnouncementSink();
    this.limitAnnouncementInitialized = this.hasUpdated;
    this.previouslyTruncated = this.sortedCacheTruncated;
  }

  override disconnectedCallback(): void {
    this.limitAnnouncementSink?.release();
    this.limitAnnouncementSink = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.limitAnnouncementSink?.release();
    this.limitAnnouncementSink = undefined;
    this.syncLimitAnnouncementSink();
  }

  private syncLimitAnnouncementSink(): void {
    if (!this.isConnected || this.limitAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.limitAnnouncementSink?.release();
    this.limitAnnouncementSink = acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
  }

  private sortedSpans(): LyraSpan[] {
    if (this.sortedSource === this.spans && this.sortedActiveSpanId === this.activeSpanId) return this.sortedCache;
    this.sortedSource = this.spans;
    this.sortedActiveSpanId = this.activeSpanId;
    const projection = normalizeLyraSpans(this.spans, this.activeSpanId);
    this.sortedCacheTruncated = projection.truncated;
    this.sortedCache = projection.spans
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s.startMs - b.s.startMs || a.i - b.i)
      .map((x) => x.s);
    return this.sortedCache;
  }

  private viewWindow(): ViewWindow {
    const extentEnd = this.sortedSpans().reduce((m, s) => Math.max(m, s.endMs ?? s.startMs, s.startMs), 0);
    const fallbackEnd = Math.max(extentEnd, 1);
    // `null` means "fit the whole trace"; a non-null-but-NaN value (a bad attribute) falls back
    // to that same default instead of flowing NaN into axisTicks()/barGeometry(). Both bounds are
    // trace-relative ms, so never negative (min 0), mirroring `LyraSpan.startMs`'s own contract.
    const start = this.viewStartMs == null
      ? 0
      : finiteRange(this.viewStartMs, 0, 0, Number.MAX_SAFE_INTEGER - 1);
    const end = this.viewEndMs == null
      ? fallbackEnd
      : finiteRange(this.viewEndMs, fallbackEnd, 0, Number.MAX_SAFE_INTEGER);
    // A caller-supplied window with end <= start (inverted or degenerate) still needs *some*
    // positive width to render/position bars sanely -- widen to a minimal 1ms window rather than
    // swapping start/end (unlike `<lr-time-range>`'s handle-drag case, swapping here would
    // silently reverse which side of the timeline is being viewed).
    return { start, end: end > start ? end : start + 1 };
  }

  private barGeometry(span: LyraSpan, view: ViewWindow): { startPct: number; widthPct: number; visible: boolean } {
    const endMs = span.endMs ?? (span.status === 'running' ? view.end : span.startMs);
    const visible = span.startMs <= view.end && endMs >= view.start;
    const clampedStart = Math.max(view.start, span.startMs);
    const clampedEnd = Math.min(view.end, Math.max(endMs, span.startMs));
    const startPct = finiteRatio(clampedStart, view.start, view.end) * 100;
    const endPct = finiteRatio(clampedEnd, view.start, view.end) * 100;
    return { startPct, widthPct: Math.max(0, endPct - startPct), visible };
  }

  private formatDuration(ms: number | undefined): string {
    if (ms == null || !Number.isFinite(ms)) return '';
    const milliseconds = Math.max(0, ms);
    return milliseconds < 1000
      ? getNumberFormat(this.effectiveLocale, {
          style: 'unit',
          unit: 'millisecond',
          unitDisplay: 'short',
          maximumFractionDigits: 0,
        }).format(milliseconds)
      : getNumberFormat(this.effectiveLocale, {
          style: 'unit',
          unit: 'second',
          unitDisplay: 'short',
          maximumFractionDigits: 1,
        }).format(milliseconds / 1000);
  }

  private focusRow(span: LyraSpan | undefined): void {
    if (!span) return;
    const previous = this.renderRoot.querySelector<HTMLElement>('[part="bar"][tabindex="0"]');
    this.focusedId = span.id;
    this.announceFocus(span);
    previous?.setAttribute('tabindex', '-1');
    const next = this.renderedBarById(span.id);
    next?.setAttribute('tabindex', '0');
    next?.focus();
  }

  private announceFocus(span: LyraSpan): void {
    const parts = [
      span.name,
      this.localize(KIND_LABEL_KEY[span.kind]),
      this.localize(STATUS_LABEL_KEY[span.status]),
      this.localize('spanStartedAtOffset', undefined, {
        value: this.formatDuration(span.startMs) || this.localize('durationMilliseconds', undefined, { value: 0 }),
      }),
    ];
    if (span.endMs != null) parts.push(this.formatDuration(span.endMs - span.startMs));
    this.liveRegion?.announce(parts.join(this.localize('accessibleLabelSeparator')), { force: true });
  }

  private selectRow(id: string): void {
    this.focusedId = id;
    this.emit('lr-span-select', { spanId: id });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const view = this.viewWindow();
    const rows = this.sortedSpans().filter((span) => this.barGeometry(span, view).visible);
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
        // safe: rows is non-empty (guarded above) and idx is clamped to [0, rows.length-1].
        this.selectRow(rows[idx]!.id);
        break;
      default:
        return;
    }
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('spans') || changed.has('activeSpanId')) {
      this.sortedSource = undefined;
    }
    if (
      changed.has('spans')
      || changed.has('viewStartMs')
      || changed.has('viewEndMs')
      || changed.has('activeSpanId')
    ) {
      const view = this.viewWindow();
      const ids = new Set(
        this.sortedSpans().filter((span) => this.barGeometry(span, view).visible).map((span) => span.id),
      );
      if (this.focusedId == null || !ids.has(this.focusedId)) {
        this.focusedId =
          this.activeSpanId && ids.has(this.activeSpanId)
            ? this.activeSpanId
            : (this.sortedSpans()[0]?.id ?? null);
      }
      if (this.focusedId !== null && !ids.has(this.focusedId)) {
        this.focusedId = this.sortedSpans().find((span) => ids.has(span.id))?.id ?? null;
      }
      if (changed.has('activeSpanId') && this.activeSpanId && ids.has(this.activeSpanId)) {
        this.focusedId = this.activeSpanId;
      }
    }
  }

  private renderedBarById(id: string): HTMLElement | null {
    const ownerCss = this.ownerDocument.defaultView?.CSS;
    if (typeof ownerCss?.escape === 'function') {
      return this.renderRoot.querySelector<HTMLElement>(`[data-id="${ownerCss.escape(id)}"]`);
    }
    return (
      Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[data-id]')).find(
        (element) => element.dataset['id'] === id,
      ) ?? null
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('activeSpanId') && this.activeSpanId) {
      const bar = this.renderedBarById(this.activeSpanId);
      if (bar && !bar.hidden) {
        const ownerWindow = bar.ownerDocument.defaultView;
        const reducedMotion = !ownerWindow || prefersReducedMotion(ownerWindow);
        bar.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }
    if (this.limitAnnouncementInitialized && this.sortedCacheTruncated && !this.previouslyTruncated) {
      this.limitAnnouncementSink?.announce(this.localize('spanProjectionLimit', undefined, {
        count: MAX_RENDERED_LYRA_SPANS,
      }));
    }
    this.limitAnnouncementInitialized = true;
    this.previouslyTruncated = this.sortedCacheTruncated;
  }

  private renderAxis(view: ViewWindow): TemplateResult {
    const ticks = axisTicks(view.start, view.end);
    return html`
      <div part="axis" aria-hidden="true">
        ${ticks.map((t) => {
          const pct = finiteRatio(t, view.start, view.end) * 100;
          if (pct < 0 || pct > 100) return nothing;
          return html`<span
            part="tick"
            data-edge=${pct > 95 ? 'end' : nothing}
            style=${`inset-inline-start:${pct}%`}
            ><span part="tick-label">${this.formatDuration(t)}</span></span
          >`;
        })}
      </div>
    `;
  }

  private renderRow(
    span: LyraSpan,
    view: ViewWindow,
    posInSet: number,
    setSize: number,
    firstId: string | undefined,
  ): TemplateResult {
    const { startPct, widthPct, visible } = this.barGeometry(span, view);
    const isActive = this.activeSpanId === span.id;
    const tabbable = visible && (this.focusedId === span.id || (this.focusedId == null && firstId === span.id));
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
            ?hidden=${!visible}
            tabindex=${tabbable ? '0' : '-1'}
            aria-current=${isActive ? 'true' : 'false'}
            aria-label=${fragments.join(this.localize('accessibleLabelSeparator'))}
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

  override render(): TemplateResult {
    const rows = this.sortedSpans();
    const view = this.viewWindow();
    const firstId = rows.find((span) => this.barGeometry(span, view).visible)?.id;
    return html`
      <div
        part="base"
        role="list"
        aria-label=${this.label || this.localize('spanWaterfall')}
        @keydown=${this.onKeyDown}
      >
        ${!this.hideAxis && rows.length > 0 ? this.renderAxis(view) : nothing}
        ${rows.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : rows.map((span, index) => this.renderRow(span, view, index + 1, rows.length, firstId))}
        ${this.sortedCacheTruncated
          ? html`<p part="limit" role="note">${this.localize('spanProjectionLimit', undefined, {
              count: MAX_RENDERED_LYRA_SPANS,
            })}</p>`
          : nothing}
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
