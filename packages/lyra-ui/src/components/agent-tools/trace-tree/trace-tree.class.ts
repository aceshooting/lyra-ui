import { html, svg, nothing, type TemplateResult, type PropertyValues, type SVGTemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteCount } from '../../../internal/numbers.js';
import { chevronIcon } from '../../../internal/icons.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './trace-tree.styles.js';
import { MAX_RENDERED_LYRA_SPANS, normalizeLyraSpans, type LyraSpan } from './span.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_accessibleLabelSeparator, LYRA_DEFAULT_collapse, LYRA_DEFAULT_cost, LYRA_DEFAULT_details, LYRA_DEFAULT_duration, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_spanKindAgent, LYRA_DEFAULT_spanKindEmbedding, LYRA_DEFAULT_spanKindLlm, LYRA_DEFAULT_spanKindOther, LYRA_DEFAULT_spanKindRetriever, LYRA_DEFAULT_spanKindTool, LYRA_DEFAULT_spanProjectionLimit, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_tokensIn, LYRA_DEFAULT_tokensOut, LYRA_DEFAULT_traceTree, LYRA_DEFAULT_traceTreeMetricLabel, LYRA_DEFAULT_traceTreeSpanStatus } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraSpan } from './span.js';

interface SpanRow {
  span: LyraSpan;
  depth: number;
  hasChildren: boolean;
  posInSet: number;
  setSize: number;
}

interface SpanHierarchy {
  spans: LyraSpan[];
  byId: Map<string, LyraSpan>;
  childrenOf: Map<string, LyraSpan[]>;
  parentOf: Map<string, string>;
  roots: LyraSpan[];
  truncated: boolean;
}

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function glyph(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" focusable="false">${paths}</svg>
  `;
}
function agentIcon(): SVGTemplateResult {
  return glyph(svg`<rect x="5" y="8" width="14" height="10" rx="2"></rect><circle cx="9.5" cy="13" r="1"></circle><circle cx="14.5" cy="13" r="1"></circle><path d="M12 8V5"></path><circle cx="12" cy="4" r="1"></circle>`);
}
function llmIcon(): SVGTemplateResult {
  return glyph(svg`<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"></path><path d="M18.5 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"></path>`);
}
function toolIcon(): SVGTemplateResult {
  return glyph(svg`<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.3 2.3-2-2z"></path>`);
}
function retrieverIcon(): SVGTemplateResult {
  return glyph(svg`<circle cx="10.5" cy="10.5" r="6.5"></circle><line x1="15.5" y1="15.5" x2="20" y2="20"></line>`);
}
function embeddingIcon(): SVGTemplateResult {
  return glyph(svg`<circle cx="6" cy="6" r="1.6"></circle><circle cx="18" cy="6" r="1.6"></circle><circle cx="6" cy="18" r="1.6"></circle><circle cx="18" cy="18" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><line x1="7.3" y1="7.3" x2="10.8" y2="10.8"></line><line x1="16.7" y1="7.3" x2="13.2" y2="10.8"></line><line x1="7.3" y1="16.7" x2="10.8" y2="13.2"></line><line x1="16.7" y1="16.7" x2="13.2" y2="13.2"></line>`);
}
function otherIcon(): SVGTemplateResult {
  return glyph(svg`<circle cx="12" cy="12" r="8"></circle>`);
}

const KIND_ICON: Record<LyraSpan['kind'], () => SVGTemplateResult> = {
  agent: agentIcon,
  llm: llmIcon,
  tool: toolIcon,
  retriever: retrieverIcon,
  embedding: embeddingIcon,
  other: otherIcon,
};
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

export interface LyraTraceTreeEventMap {
  'lr-span-select': CustomEvent<{ spanId: string }>;
  'lr-span-toggle': CustomEvent<{ spanId: string; expanded: boolean }>;
}

/**
 * `<lr-trace-tree>` — a collapsible span hierarchy for one agent/LLM trace
 * (Langfuse/LangSmith run-tree style): kind icon, name, status, an inline
 * duration bar on the shared trace time scale, and optional tokens/cost
 * columns. Consumes the same `LyraSpan[]` as `<lr-span-waterfall>`.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-trace-tree
 * @event lr-span-select - `detail: { spanId }` — a row was activated (click, Enter, Space).
 * @event lr-span-toggle - `detail: { spanId, expanded }` — a row was expanded or collapsed.
 * @csspart base - The root wrapper (`role="tree"`).
 * @csspart header - The column-header row, rendered only when `showTokens`/`showCost` is on.
 * @csspart row - One span's row (`role="treeitem"`).
 * @csspart toggle - A row's expand/collapse button.
 * @csspart icon - The span-kind icon.
 * @csspart name - The span's name.
 * @csspart detail - The span's secondary text, from `LyraSpan.detail`.
 * @csspart status-text - The visible status label.
 * @csspart duration - The formatted duration text.
 * @csspart tokens-in - The tokens-in column cell (when `showTokens`).
 * @csspart tokens-out - The tokens-out column cell (when `showTokens`).
 * @csspart cost - The cost column cell (when `showCost`).
 * @csspart bar-track - The duration bar's background track.
 * @csspart bar - The duration bar's filled portion.
 * @csspart empty - The empty-state message shown when `spans` is empty.
 * @csspart limit - Localized notice shown when the shared 500-span projection ceiling is reached.
 * @csspart live-region - The internal status-announcement live region.
 * @cssprop [--lr-trace-tree-row-active-bg=var(--lr-color-brand-quiet)] - Background of the active
 *   (`activeSpanId`) row. Shadow Parts forbids an attribute selector after `::part()`, so the active
 *   row could otherwise only be restyled by hijacking the library-wide `--lr-color-brand-quiet` token.
 *   Pairs with `--lr-trace-tree-row-active-color`: set both together, since the defaults assume the
 *   active background stays on the same side of the lightness midpoint as the ambient surface — a
 *   dark tint in light mode needs the matching text color set too, or the row's secondary text drops
 *   below the WCAG AA contrast floor.
 * @cssprop [--lr-trace-tree-row-active-color=var(--lr-color-text)] - Foreground reference for the
 *   active (`activeSpanId`) row. It sets the color of that row's secondary text (`detail`,
 *   `duration`, `tokens-in`, `tokens-out`, `cost`, and the `pending` status label), which is raised
 *   from the quiet token to full-strength text so it clears WCAG AA against the active row's tint.
 *   The semantic status labels keep their own hue but are mixed 25% toward this same value, so
 *   overriding it re-aims every foreground on the row at once rather than leaving the status colors
 *   stranded. See the pairing caveat on `--lr-trace-tree-row-active-bg`.
 * @cssprop [--lr-trace-tree-toggle-hover-bg=var(--lr-color-brand-quiet)] - Toggle hover background.
 * @cssprop [--lr-trace-tree-success-color=var(--lr-color-success)] - Success status text and bar.
 * @cssprop [--lr-trace-tree-error-color=var(--lr-color-danger)] - Error status text and bar.
 * @cssprop [--lr-trace-tree-denied-color=var(--lr-color-warning)] - Denied status text and bar.
 * @cssprop [--lr-trace-tree-running-color=var(--lr-color-brand)] - Running status text and stripe.
 * @cssprop [--lr-trace-tree-pending-color=var(--lr-color-text-quiet)] - Pending status text and bar.
 * @cssprop [--lr-trace-tree-bar-track-bg=var(--lr-color-surface-raised)] - Duration bar track.
 * @cssprop [--lr-trace-tree-max-indent=var(--lr-size-12rem)] - Maximum visual nesting indentation;
 *   semantic `aria-level` remains exact at deeper levels.
 * @cssprop [--lr-trace-tree-running-stripe-bg=var(--lr-color-brand-quiet)] - Running stripe contrast.
 * @status stable
 * @since 4.0.0
 */
export class LyraTraceTree extends LyraElement<LyraTraceTreeEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['spans']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    accessibleLabelSeparator: LYRA_DEFAULT_accessibleLabelSeparator,
    collapse: LYRA_DEFAULT_collapse,
    cost: LYRA_DEFAULT_cost,
    details: LYRA_DEFAULT_details,
    duration: LYRA_DEFAULT_duration,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
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
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    tokensIn: LYRA_DEFAULT_tokensIn,
    tokensOut: LYRA_DEFAULT_tokensOut,
    traceTree: LYRA_DEFAULT_traceTree,
    traceTreeMetricLabel: LYRA_DEFAULT_traceTreeMetricLabel,
    traceTreeSpanStatus: LYRA_DEFAULT_traceTreeSpanStatus,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /**
   * Flat span array. Hierarchy is derived from `parentId`; siblings order by `startMs`.
   * At most 500 unique spans with finite timestamps are rendered. A resolved `activeSpanId` and
   * its nearest ancestor path reserve positions before ordinary input-order rows, so a controlled
   * selection remains current and revealable across the ceiling. Malformed parent cycles are
   * broken into roots so hostile trace data cannot recurse indefinitely. Foreign runtime
   * `kind`/`status` values normalize to `'other'`/`'pending'` before rendering.
   */
  @property({ attribute: false }) spans: readonly LyraSpan[] = [];
  /** Controlled selection — the matching row carries `aria-current`/`data-active` and scrolls into view. */
  @property({ attribute: 'active-span-id' }) activeSpanId: string | null = null;
  /** Accessible name for the `role="tree"` element. Falls back to the localized default; a host
   *  `aria-label` names the host itself and is not cloned onto the independently interactive tree. */
  @property() label = '';
  /** Adds tokens-in/tokens-out columns. */
  @property({ type: Boolean, attribute: 'show-tokens', reflect: true }) showTokens = false;
  /** Adds a cost column, rendering `costText` verbatim. */
  @property({ type: Boolean, attribute: 'show-cost', reflect: true }) showCost = false;
  /** Suppresses the inline duration bar, for dense/narrow embeddings. */
  @property({ type: Boolean, attribute: 'hide-bars', reflect: true }) hideBars = false;

  /** Ids of rows explicitly collapsed by the user. Absence means expanded — every row starts expanded. */
  @state() private collapsedIds = new Set<string>();
  @state() private focusedId: string | null = null;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  private previousStatuses = new Map<string, LyraSpan['status']>();
  private pendingAnnouncements: string[] = [];
  private limitAnnouncementSink?: AnnouncementSink;
  private limitAnnouncementInitialized = false;
  private previouslyTruncated = false;
  private renderedProjectionTruncated = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncLimitAnnouncementSink();
    this.limitAnnouncementInitialized = this.hasUpdated;
    this.previouslyTruncated = this.renderedProjectionTruncated;
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

  private buildHierarchy(): SpanHierarchy {
    const { spans, byId, truncated } = normalizeLyraSpans(this.spans, this.activeSpanId);

    const childrenOf = new Map<string, LyraSpan[]>();
    const parentOf = new Map<string, string>();
    const roots: LyraSpan[] = [];

    const hasCyclicParentChain = (span: LyraSpan): boolean => {
      const visited = new Set<string>([span.id]);
      let parentId = span.parentId;
      while (parentId != null) {
        if (visited.has(parentId)) return true;
        visited.add(parentId);
        parentId = byId.get(parentId)?.parentId;
      }
      return false;
    };

    for (const span of spans) {
      const parent = span.parentId != null && !hasCyclicParentChain(span) ? byId.get(span.parentId) : undefined;
      if (parent && parent.id !== span.id) {
        const list = childrenOf.get(parent.id) ?? [];
        list.push(span);
        childrenOf.set(parent.id, list);
        parentOf.set(span.id, parent.id);
      } else {
        roots.push(span);
      }
    }
    const byStart = (a: LyraSpan, b: LyraSpan): number => a.startMs - b.startMs;
    roots.sort(byStart);
    for (const list of childrenOf.values()) list.sort(byStart);

    return { spans, byId, childrenOf, parentOf, roots, truncated };
  }

  private buildRows(hierarchy = this.buildHierarchy()): SpanRow[] {
    const rows: SpanRow[] = [];
    const stack = [...hierarchy.roots]
      .reverse()
      .map((span, reverseIndex) => ({
        span,
        depth: 0,
        posInSet: hierarchy.roots.length - reverseIndex,
        setSize: hierarchy.roots.length,
      }));
    const visited = new Set<string>();
    while (stack.length > 0 && rows.length < MAX_RENDERED_LYRA_SPANS) {
      const current = stack.pop();
      if (!current || visited.has(current.span.id)) continue;
      visited.add(current.span.id);
      const children = hierarchy.childrenOf.get(current.span.id) ?? [];
      rows.push({ ...current, hasChildren: children.length > 0 });
      if (children.length === 0 || this.collapsedIds.has(current.span.id)) continue;
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index];
        if (child) {
          stack.push({
            span: child,
            depth: current.depth + 1,
            posInSet: index + 1,
            setSize: children.length,
          });
        }
      }
    }
    return rows;
  }

  private traceExtent(spans = this.buildHierarchy().spans): number {
    let max = 0;
    for (const s of spans) max = Math.max(max, s.endMs ?? s.startMs, s.startMs);
    return max || 1;
  }

  private formatDuration(ms: number | undefined): string {
    if (ms == null) return '';
    const number = getNumberFormat(this.effectiveLocale, { maximumFractionDigits: ms < 1000 ? 0 : 1 });
    return ms < 1000
      ? this.localize('durationMilliseconds', undefined, { value: number.format(ms) })
      : this.localize('durationSeconds', undefined, { value: number.format(ms / 1000) });
  }

  private formatNumber(n: number): string {
    return getNumberFormat(this.effectiveLocale).format(finiteCount(n));
  }

  private validTokenMetric(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  private toggleSpan(id: string): void {
    const collapsed = this.collapsedIds.has(id);
    if (!collapsed) {
      this.renderedRowById(id)?.focus();
    }
    const next = new Set(this.collapsedIds);
    if (collapsed) next.delete(id);
    else next.add(id);
    this.collapsedIds = next;
    // The toggled row stays visible even when it collapses (only its children hide), so re-point
    // roving tabindex here -- otherwise toggling an ancestor other than the currently-focused row
    // can hide that row entirely, leaving no row with tabindex="0" at all.
    this.focusedId = id;
    this.emit('lr-span-toggle', { spanId: id, expanded: collapsed });
  }

  /** Expand every collapsible row. Resolves once the update reflecting it has committed. */
  async expandAll(): Promise<void> {
    this.collapsedIds = new Set();
    await this.updateComplete;
  }

  /** Collapse every row that has children. */
  collapseAll(): void {
    const next = new Set<string>();
    const hierarchy = this.buildHierarchy();
    const { byId, parentOf } = hierarchy;
    const hasChild = new Set(hierarchy.childrenOf.keys());
    for (const id of hasChild) next.add(id);
    this.collapsedIds = next;
    // Collapsing everything only ever leaves root-level rows visible -- if the focused row was a
    // now-hidden descendant, re-point roving tabindex to its topmost ancestor (always a root, and
    // always still rendered) rather than leaving it pointed at a row that no longer exists.
    if (this.focusedId != null) {
      let current = byId.get(this.focusedId);
      while (current && parentOf.has(current.id)) {
        current = byId.get(parentOf.get(current.id)!);
      }
      this.focusedId = current?.id ?? null;
      if (current) {
        this.renderedRowById(current.id)?.focus();
      }
    }
  }

  private focusRow(row: SpanRow | undefined): void {
    if (!row) return;
    this.focusedId = row.span.id;
    void this.updateComplete.then(() => {
      this.renderedRowById(row.span.id)?.focus();
    });
  }

  private selectRow(id: string): void {
    this.focusedId = id;
    this.emit('lr-span-select', { spanId: id });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const rows = this.buildRows();
    if (rows.length === 0) return;
    const currentIndex = rows.findIndex((r) => r.span.id === this.focusedId);
    const current = currentIndex >= 0 ? rows[currentIndex] : rows[0];
    if (!current) return; // rows is non-empty (checked above), so this never fires; narrows for the switch below
    const rtl = isRtl(this);
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusRow(rows[Math.min(rows.length - 1, currentIndex + 1)]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusRow(rows[Math.max(0, currentIndex - 1)]);
        break;
      case 'Home':
        e.preventDefault();
        this.focusRow(rows[0]);
        break;
      case 'End':
        e.preventDefault();
        this.focusRow(rows[rows.length - 1]);
        break;
      case expandKey:
        e.preventDefault();
        if (!current.hasChildren) break;
        if (this.collapsedIds.has(current.span.id)) {
          this.toggleSpan(current.span.id);
        } else {
          const child = rows[currentIndex + 1];
          if (child && child.depth > current.depth) this.focusRow(child);
        }
        break;
      case collapseKey:
        e.preventDefault();
        if (current.hasChildren && !this.collapsedIds.has(current.span.id)) {
          this.toggleSpan(current.span.id);
        } else {
          for (let i = currentIndex - 1; i >= 0; i--) {
            const row = rows[i];
            if (row && row.depth < current.depth) {
              this.focusRow(row);
              break;
            }
          }
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.selectRow(current.span.id);
        break;
      default:
        return;
    }
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('spans') || changed.has('activeSpanId') || changed.has('collapsedIds')) {
      const hierarchy = this.buildHierarchy();
      const ids = new Set(hierarchy.byId.keys());
      let pruned: Set<string> | null = null;
      for (const id of this.collapsedIds) {
        if (!ids.has(id)) {
          pruned ??= new Set(this.collapsedIds);
          pruned.delete(id);
        }
      }
      if (pruned) this.collapsedIds = pruned;

      if (
        (changed.has('spans') || changed.has('activeSpanId')) &&
        this.activeSpanId &&
        hierarchy.byId.has(this.activeSpanId)
      ) {
        const revealed = new Set(this.collapsedIds);
        let currentId = this.activeSpanId;
        let changedCollapse = false;
        while (hierarchy.parentOf.has(currentId)) {
          currentId = hierarchy.parentOf.get(currentId)!;
          if (revealed.delete(currentId)) changedCollapse = true;
        }
        if (changedCollapse) this.collapsedIds = revealed;
      }

      const rows = this.buildRows(hierarchy);
      const visibleIds = new Set(rows.map((row) => row.span.id));
      if (this.focusedId == null || !ids.has(this.focusedId)) {
        this.focusedId =
          this.activeSpanId && visibleIds.has(this.activeSpanId) ? this.activeSpanId : (rows[0]?.span.id ?? null);
      }

      if (changed.has('spans')) {
        for (const row of rows) {
          const { span } = row;
          const prev = this.previousStatuses.get(span.id);
          if (prev !== undefined && prev !== span.status) {
            this.pendingAnnouncements.push(
              this.localize('traceTreeSpanStatus', undefined, {
                name: span.name,
                status: this.localize(STATUS_LABEL_KEY[span.status]),
              }),
            );
          }
        }
        this.previousStatuses = new Map(hierarchy.spans.map((span) => [span.id, span.status]));
      }

      const visibleAncestor = (id: string | null): string | null => {
        let current = id ? hierarchy.byId.get(id) : undefined;
        while (current) {
          if (visibleIds.has(current.id)) return current.id;
          current = hierarchy.parentOf.has(current.id)
            ? hierarchy.byId.get(hierarchy.parentOf.get(current.id)!)
            : undefined;
        }
        return null;
      };
      this.focusedId = visibleAncestor(this.activeSpanId) ?? visibleAncestor(this.focusedId) ?? rows[0]?.span.id ?? null;
    }
  }

  private renderedRowById(id: string): HTMLElement | null {
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
    if ((changed.has('activeSpanId') || changed.has('spans') || changed.has('collapsedIds')) && this.activeSpanId) {
      const row = this.renderedRowById(this.activeSpanId);
      if (row) {
        const ownerWindow = row.ownerDocument.defaultView;
        const reducedMotion = !ownerWindow || prefersReducedMotion(ownerWindow);
        row.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }
    if (this.pendingAnnouncements.length > 0) {
      const texts = this.pendingAnnouncements;
      this.pendingAnnouncements = [];
      for (const text of texts) this.liveRegion?.announce(text);
    }
    if (this.limitAnnouncementInitialized && this.renderedProjectionTruncated && !this.previouslyTruncated) {
      this.limitAnnouncementSink?.announce(this.localize('spanProjectionLimit', undefined, {
        count: MAX_RENDERED_LYRA_SPANS,
      }));
    }
    this.limitAnnouncementInitialized = true;
    this.previouslyTruncated = this.renderedProjectionTruncated;
  }

  private renderHeader(): TemplateResult {
    return html`
      <div part="header">
        <span class="col-toggle" aria-hidden="true"></span>
        <span class="col-icon" aria-hidden="true"></span>
        <span part="name">${this.localize('traceTree')}</span>
        <span class="col-detail" aria-hidden="true"></span>
        <span class="col-status" aria-hidden="true"></span>
        ${!this.hideBars ? html`<span class="col-bar" aria-hidden="true"></span>` : nothing}
        <span class="col-duration">${this.localize('duration')}</span>
        ${this.showTokens
          ? html`<span class="col-tokens">${this.localize('tokensIn')}</span><span class="col-tokens">${this.localize('tokensOut')}</span>`
          : nothing}
        ${this.showCost ? html`<span class="col-cost">${this.localize('cost')}</span>` : nothing}
      </div>
    `;
  }

  private renderRow(row: SpanRow, firstId: string | undefined, extent: number): TemplateResult {
    const { span, depth, hasChildren, posInSet, setSize } = row;
    const expanded = hasChildren && !this.collapsedIds.has(span.id);
    const isActive = this.activeSpanId === span.id;
    const tabbable = this.focusedId === span.id || (this.focusedId == null && span.id === firstId);
    const rawStartPct = (span.startMs / extent) * 100;
    const startPct = span.status === 'running' ? Math.min(99, rawStartPct) : rawStartPct;
    const endMs = span.endMs ?? (span.status === 'running' ? extent : span.startMs);
    const widthPct = Math.max(span.status === 'running' ? 1 : 0, ((endMs - span.startMs) / extent) * 100);
    const durationLabel = this.formatDuration(span.endMs != null ? span.endMs - span.startMs : undefined);
    const fragments = [
      span.name,
      span.detail ?? '',
      this.localize(KIND_LABEL_KEY[span.kind]),
      this.localize(STATUS_LABEL_KEY[span.status]),
      durationLabel,
      this.showTokens && this.validTokenMetric(span.tokensIn)
        ? this.localize('traceTreeMetricLabel', undefined, {
            label: this.localize('tokensIn'),
            value: this.formatNumber(span.tokensIn),
          })
        : '',
      this.showTokens && this.validTokenMetric(span.tokensOut)
        ? this.localize('traceTreeMetricLabel', undefined, {
            label: this.localize('tokensOut'),
            value: this.formatNumber(span.tokensOut),
          })
        : '',
      this.showCost && span.costText
        ? this.localize('traceTreeMetricLabel', undefined, {
            label: this.localize('cost'),
            value: span.costText,
          })
        : '',
    ].filter(Boolean);

    return html`
      <div
        part="row"
        role="treeitem"
        data-id=${span.id}
        tabindex=${tabbable ? '0' : '-1'}
        aria-level=${depth + 1}
        aria-posinset=${posInSet}
        aria-setsize=${setSize}
        aria-expanded=${hasChildren ? String(expanded) : nothing}
        aria-current=${String(isActive)}
        aria-label=${fragments.join(this.localize('accessibleLabelSeparator'))}
        ?data-active=${isActive}
        style=${`--_lr-trace-tree-depth:${depth}`}
        @click=${() => this.selectRow(span.id)}
        @focus=${() => {
          this.focusedId = span.id;
        }}
      >
        <button
          part="toggle"
          type="button"
          tabindex="-1"
          aria-hidden="true"
          ?hidden=${!hasChildren}
          @mousedown=${(e: MouseEvent) => e.preventDefault()}
          @click=${(e: Event) => {
            e.stopPropagation();
            if (hasChildren) this.toggleSpan(span.id);
          }}
        >
          ${hasChildren ? chevronIcon() : nothing}
        </button>
        <span part="icon">${KIND_ICON[span.kind]()}</span>
        <span part="name">${span.name}</span>
        <span part="detail">${span.detail ?? ''}</span>
        <span part="status-text" data-status=${span.status}>${this.localize(STATUS_LABEL_KEY[span.status])}</span>
        ${!this.hideBars
          ? html`<span part="bar-track"
              ><span part="bar" data-status=${span.status} style=${`inset-inline-start:${startPct}%;inline-size:${widthPct}%`}></span
            ></span>`
          : nothing}
        <span part="duration">${durationLabel}</span>
        ${this.showTokens
          ? html`<span part="tokens-in">${this.validTokenMetric(span.tokensIn) ? this.formatNumber(span.tokensIn) : ''}</span>
              <span part="tokens-out">${this.validTokenMetric(span.tokensOut) ? this.formatNumber(span.tokensOut) : ''}</span>`
          : nothing}
        ${this.showCost ? html`<span part="cost">${span.costText ?? ''}</span>` : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const hierarchy = this.buildHierarchy();
    this.renderedProjectionTruncated = hierarchy.truncated;
    const rows = this.buildRows(hierarchy);
    const firstId = rows[0]?.span.id;
    const extent = this.traceExtent(hierarchy.spans);
    return html`
      <div
        part="base"
        role="tree"
        aria-label=${this.label || this.localize('traceTree')}
        @keydown=${this.onKeyDown}
      >
        ${rows.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : html`${this.showTokens || this.showCost ? this.renderHeader() : nothing}${rows.map((row) => this.renderRow(row, firstId, extent))}`}
        ${hierarchy.truncated
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
    'lr-trace-tree': LyraTraceTree;
  }
}
