import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteNumber, finiteRatio, finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { formatShortDuration } from '../../../internal/duration.js';
import { styles } from './span-waterfall.styles.js';
import { MAX_RENDERED_LYRA_SPANS, normalizeLyraSpans, type LyraSpan } from '../trace-tree/span.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_accessibleLabelSeparator, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_spanKindAgent, LYRA_DEFAULT_spanKindEmbedding, LYRA_DEFAULT_spanKindLlm, LYRA_DEFAULT_spanKindOther, LYRA_DEFAULT_spanKindRetriever, LYRA_DEFAULT_spanKindTool, LYRA_DEFAULT_spanProjectionLimit, LYRA_DEFAULT_spanStartedAtOffset, LYRA_DEFAULT_spanWaterfall, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusIncomplete, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_tokensIn, LYRA_DEFAULT_tokensOut } from '../../../internal/default-strings.generated.js';
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
  incomplete: 'statusIncomplete',
  unknown: 'statusUnknown',
};
/** success->success, error->danger, denied->warning, running->accent, pending and incomplete->neutral outline. */
const STATUS_TONE: Record<LyraSpan['status'], string> = {
  success: 'success',
  error: 'danger',
  denied: 'warning',
  running: 'accent',
  pending: 'neutral',
  incomplete: 'neutral',
  unknown: 'neutral',
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
 * Public collection properties take bounded readonly snapshots. `spans` keeps admitted item
 * identities only long enough for the shared descriptor-safe projection to copy its closed
 * display schema; later rendering never re-reads an admitted source row. Create a new collection
 * and reassign it after changes; mutating the assigned array does not update the view.
 *
 * The time axis always scales to the whole trace, including spans the 500-row ceiling drops, so a
 * truncated tail never stretches the surviving bars across the track.
 *
 * @customElement lr-span-waterfall
 * @event lr-span-select - `detail: { spanId }` — a bar/row was activated (click, Enter, Space).
 * @csspart base - The root wrapper.
 * @csspart axis - The time-ruler row, hidden when `without-axis` is set.
 * @csspart tick - One axis tick mark.
 * @csspart tick-label - An axis tick's formatted duration label.
 * @csspart row - One span's row.
 * @csspart name - The span's name (the row's name gutter).
 * @csspart bar-track - The bar's positioning track.
 * @csspart bar - The interactive, focusable status-toned bar (`role` via `<button>`), with the
 *   shared `--lr-icon-button-size` minimum target in both axes even when its duration would paint
 *   more narrowly.
 * @csspart meta - Secondary row info (status/duration), shown inline under 480px.
 * @csspart status-text - The visible status label.
 * @csspart duration - The formatted duration text.
 * @csspart empty - The empty-state message shown when `spans` is empty.
 * @csspart limit - Localized notice shown when the shared 500-span projection ceiling is reached.
 * @cssprop [--lr-span-waterfall-name-width=8rem] - Width of the name gutter column.
 * @cssprop [--lr-span-waterfall-stripe-speed=var(--lr-duration-ambient)] - Animation duration for a
 *   `running` span's striped bar. The fallback is the bare-duration `--lr-duration-ambient`, not the
 *   `--lr-transition-ambient` duration+easing shorthand, which would be invalid in an
 *   `animation-duration` slot.
 * @cssprop [--lr-span-waterfall-row-active-bg=var(--lr-color-brand-quiet)] - Background of the active
 *   (`activeSpanId`) row. Shadow Parts forbids an attribute selector after `::part()`, so the active
 *   row could otherwise only be restyled by hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-span-waterfall-row-active-color=var(--lr-color-text)] - Status and duration text colour
 *   of the active row.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    accessibleLabelSeparator: LYRA_DEFAULT_accessibleLabelSeparator,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
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
    statusIncomplete: LYRA_DEFAULT_statusIncomplete,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    tokensIn: LYRA_DEFAULT_tokensIn,
    tokensOut: LYRA_DEFAULT_tokensOut,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['spans']);
  /** Span sources can carry opaque provider metadata; the shared normalizer copies only its closed
   * display schema once, so cloning each whole source record would both lose opaque identity and
   * create an unsafe second traversal. */
  protected static override readonly identityCollectionProperties = Object.freeze(['spans']);

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
  /** Hides the time-ruler row (`[part="axis"]`). */
  @property({ type: Boolean, attribute: 'without-axis' }) withoutAxis = false;
  /** Accessible name of the list. Omission localizes the default; any supplied string, including
   *  `''`, is used verbatim. A host `aria-label` wins. */
  @property() label?: string;

  private focusedId: string | null = null;
  private sortedSource?: readonly LyraSpan[];
  private sortedActiveSpanId: string | null = null;
  private sortedCache: LyraSpan[] = [];
  private sortedCacheTruncated = false;
  /** Trace extent measured before the projection cap, so a truncated tail cannot shrink the axis. */
  private sortedCacheExtentEndMs = 0;
  private axisSignature = '';
  private axisObserver?: ResizeObserver;
  private observedAxis?: Element;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private limitAnnouncementInitialized = false;
  private previouslyTruncated = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.limitAnnouncementInitialized = this.hasUpdated;
    this.previouslyTruncated = this.sortedCacheTruncated;
    if (this.hasUpdated) {
      this.observeAxis();
      this.fitAxisLabels();
    }
  }

  override disconnectedCallback(): void {
    this.axisObserver?.disconnect();
    this.axisObserver = undefined;
    this.observedAxis = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  private sortedSpans(): LyraSpan[] {
    if (this.sortedSource === this.spans && this.sortedActiveSpanId === this.activeSpanId) return this.sortedCache;
    this.sortedSource = this.spans;
    this.sortedActiveSpanId = this.activeSpanId;
    const projection = normalizeLyraSpans(this.spans, this.activeSpanId);
    this.sortedCacheTruncated = projection.truncated;
    this.sortedCacheExtentEndMs = projection.extentEndMs;
    this.sortedCache = projection.spans
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s.startMs - b.s.startMs || a.i - b.i)
      .map((x) => x.s);
    return this.sortedCache;
  }

  private viewWindow(): ViewWindow {
    // The extent comes from the projection's pre-cap measurement, never from the rendered rows:
    // past MAX_RENDERED_LYRA_SPANS the surviving rows are the EARLIEST ones, so reducing over them
    // shortened the axis to the truncated head and stretched every bar to fill the track -- a 1s
    // span in a 10s trace drew at 100% width with nothing to indicate it.
    this.sortedSpans();
    const fallbackEnd = Math.max(finiteNumber(this.sortedCacheExtentEndMs, 0), 1);
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
    return formatShortDuration(this.localize.bind(this), this.effectiveLocale, ms);
  }

  private projectionLimitText(): string {
    return this.localize('spanProjectionLimit', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_LYRA_SPANS),
    });
  }

  private focusRow(span: LyraSpan | undefined): void {
    if (!span) return;
    const previous = this.renderRoot.querySelector<HTMLElement>('[part="bar"][tabindex="0"]');
    this.focusedId = span.id;
    previous?.setAttribute('tabindex', '-1');
    const next = this.renderedBarById(span.id);
    next?.setAttribute('tabindex', '0');
    next?.focus();
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
        const reducedMotion = !ownerWindow || prefersReducedMotion(this);
        bar.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }
    if (this.limitAnnouncementInitialized && this.sortedCacheTruncated && !this.previouslyTruncated) {
      this.announcements.announcePolite(this.projectionLimitText());
    }
    this.limitAnnouncementInitialized = true;
    this.previouslyTruncated = this.sortedCacheTruncated;
    this.observeAxis();
    const view = this.viewWindow();
    const axisSignature = `${view.start}|${view.end}|${this.effectiveLocale}`;
    if (axisSignature !== this.axisSignature) {
      this.axisSignature = axisSignature;
      this.fitAxisLabels();
    }
  }

  private observeAxis(): void {
    const axis = this.renderRoot.querySelector('[part="axis"]') ?? undefined;
    if (axis === this.observedAxis) return;
    this.axisObserver?.disconnect();
    this.observedAxis = axis;
    const ResizeObserverCtor = this.ownerDocument.defaultView?.ResizeObserver;
    if (!axis || !ResizeObserverCtor) return;
    this.axisObserver ??= new ResizeObserverCtor(() => this.fitAxisLabels());
    this.axisObserver.observe(axis);
  }

  /** Re-anchors a tick label that would leave the axis at its inline-end edge and hides any label
   *  that would overprint its neighbour; the terminal label wins over the interior label it collides
   *  with. */
  private fitAxisLabels(): void {
    const axis = this.renderRoot.querySelector<HTMLElement>('[part="axis"]');
    if (!axis) return;
    const ticks = Array.from(axis.querySelectorAll<HTMLElement>('[part="tick"]'));
    const labels = ticks.map((tick) => tick.querySelector<HTMLElement>('[part="tick-label"]')!);
    for (const tick of ticks) tick.removeAttribute('data-fit');
    for (const label of labels) label.removeAttribute('data-collapsed');
    const axisRect = axis.getBoundingClientRect();
    if (axisRect.width <= 0) return;
    const rtl = this.ownerDocument.defaultView?.getComputedStyle(axis).direction === 'rtl';
    // Inline position runs right-to-left under rtl; normalise so start <= end along the inline axis.
    const span = (rect: DOMRect) => (rtl ? { start: -rect.right, end: -rect.left } : { start: rect.left, end: rect.right });
    const axisSpan = span(axisRect);
    const rects = labels.map((label) => label.getBoundingClientRect());
    ticks.forEach((tick, index) => {
      if (span(rects[index]!).end > axisSpan.end + 0.5) tick.setAttribute('data-fit', 'end');
    });
    const placed = labels
      .map((label) => {
        const { start, end } = span(label.getBoundingClientRect());
        return { label, start, end };
      })
      .sort((a, b) => a.start - b.start);
    const kept: typeof placed = [];
    placed.forEach((entry, index) => {
      const isTerminal = index === placed.length - 1;
      while (kept.length > 1 && isTerminal && entry.start < kept[kept.length - 1]!.end) {
        kept.pop()!.label.setAttribute('data-collapsed', '');
      }
      const previous = kept[kept.length - 1];
      if (previous && entry.start < previous.end) {
        entry.label.setAttribute('data-collapsed', '');
      } else {
        kept.push(entry);
      }
    });
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
      this.localize('spanStartedAtOffset', undefined, {
        value: this.formatDuration(span.startMs) || this.localize('durationMilliseconds', undefined, { value: 0 }),
      }),
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
            style=${`--_lr-span-waterfall-start:${startPct}%;--_lr-span-waterfall-width:${widthPct}%`}
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
        aria-label=${hostAriaLabel(this) ?? this.label ?? this.localize('spanWaterfall')}
        @keydown=${this.onKeyDown}
      >
        ${!this.withoutAxis && rows.length > 0 ? this.renderAxis(view) : nothing}
        ${rows.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : repeat(rows, (span) => span.id, (span, index) => this.renderRow(span, view, index + 1, rows.length, firstId))}
      </div>
      ${this.sortedCacheTruncated
        ? html`<p part="limit" role="note">${this.projectionLimitText()}</p>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-span-waterfall': LyraSpanWaterfall;
  }
}
