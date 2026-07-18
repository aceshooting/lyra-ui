import { html, svg, nothing, type TemplateResult, type PropertyValues, type SVGTemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { getNumberFormat } from '../../internal/intl-cache.js';
import { isRtl } from '../../internal/rtl.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { chevronIcon } from '../../internal/icons.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.class.js';
import '../empty/empty.class.js';
import { styles } from './trace-tree.styles.js';
import type { LyraSpan } from './span.js';

export type { LyraSpan } from './span.js';

interface SpanRow {
  span: LyraSpan;
  depth: number;
  hasChildren: boolean;
  posInSet: number;
  setSize: number;
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
  'lr-span-select': CustomEvent<{ id: string }>;
  'lr-span-toggle': CustomEvent<{ id: string; expanded: boolean }>;
}

/**
 * `<lr-trace-tree>` — a collapsible span hierarchy for one agent/LLM trace
 * (Langfuse/LangSmith run-tree style): kind icon, name, status, an inline
 * duration bar on the shared trace time scale, and optional tokens/cost
 * columns. Consumes the same `LyraSpan[]` as `<lr-span-waterfall>`.
 *
 * @customElement lr-trace-tree
 * @event lr-span-select - `detail: { id }` — a row was activated (click, Enter, Space).
 * @event lr-span-toggle - `detail: { id, expanded }` — a row was expanded or collapsed.
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
 * @csspart live-region - The internal status-announcement live region.
 */
export class LyraTraceTree extends LyraElement<LyraTraceTreeEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Flat span array. Hierarchy is derived from `parentId`; siblings order by `startMs`. */
  @property({ attribute: false }) spans: LyraSpan[] = [];
  /** Controlled selection — the matching row carries `aria-current`/`data-active` and scrolls into view. */
  @property({ attribute: 'active-span-id' }) activeSpanId: string | null = null;
  /** Accessible name for the `role="tree"` element. Falls back to a host `aria-label`, then the localized default. */
  @property() label = '';
  /** Adds tokens-in/tokens-out columns. */
  @property({ type: Boolean, attribute: 'show-tokens' }) showTokens = false;
  /** Adds a cost column, rendering `costText` verbatim. */
  @property({ type: Boolean, attribute: 'show-cost' }) showCost = false;
  /** Suppresses the inline duration bar, for dense/narrow embeddings. */
  @property({ type: Boolean, attribute: 'hide-bars' }) hideBars = false;

  /** Ids of rows explicitly collapsed by the user. Absence means expanded — every row starts expanded. */
  @state() private collapsedIds = new Set<string>();
  @state() private focusedId: string | null = null;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  private previousStatuses = new Map<string, LyraSpan['status']>();
  private pendingAnnouncements: string[] = [];

  private buildRows(): SpanRow[] {
    const byId = new Map(this.spans.map((s) => [s.id, s] as const));
    const childrenOf = new Map<string, LyraSpan[]>();
    const roots: LyraSpan[] = [];
    for (const span of this.spans) {
      const parent = span.parentId != null ? byId.get(span.parentId) : undefined;
      if (parent && parent.id !== span.id) {
        const list = childrenOf.get(parent.id) ?? [];
        list.push(span);
        childrenOf.set(parent.id, list);
      } else {
        roots.push(span);
      }
    }
    const byStart = (a: LyraSpan, b: LyraSpan): number => a.startMs - b.startMs;
    roots.sort(byStart);
    for (const list of childrenOf.values()) list.sort(byStart);

    const rows: SpanRow[] = [];
    const walk = (list: LyraSpan[], depth: number): void => {
      list.forEach((span, index) => {
        const children = childrenOf.get(span.id) ?? [];
        rows.push({ span, depth, hasChildren: children.length > 0, posInSet: index + 1, setSize: list.length });
        if (children.length > 0 && !this.collapsedIds.has(span.id)) walk(children, depth + 1);
      });
    };
    walk(roots, 0);
    return rows;
  }

  private traceExtent(): number {
    let max = 0;
    for (const s of this.spans) max = Math.max(max, s.endMs ?? s.startMs, s.startMs);
    return max || 1;
  }

  private formatDuration(ms: number | undefined): string {
    if (ms == null) return '';
    return ms < 1000
      ? this.localize('durationMilliseconds', undefined, { value: Math.round(ms) })
      : this.localize('durationSeconds', undefined, { value: (ms / 1000).toFixed(1) });
  }

  private formatNumber(n: number): string {
    return getNumberFormat(this.effectiveLocale).format(n);
  }

  private toggleSpan(id: string): void {
    const collapsed = this.collapsedIds.has(id);
    const next = new Set(this.collapsedIds);
    if (collapsed) next.delete(id);
    else next.add(id);
    this.collapsedIds = next;
    // The toggled row stays visible even when it collapses (only its children hide), so re-point
    // roving tabindex here -- otherwise toggling an ancestor other than the currently-focused row
    // can hide that row entirely, leaving no row with tabindex="0" at all.
    this.focusedId = id;
    this.emit('lr-span-toggle', { id, expanded: collapsed });
  }

  /** Expand every collapsible row. Resolves once the update reflecting it has committed. */
  async expandAll(): Promise<void> {
    this.collapsedIds = new Set();
    await this.updateComplete;
  }

  /** Collapse every row that has children. */
  collapseAll(): void {
    const next = new Set<string>();
    const byId = new Map(this.spans.map((s) => [s.id, s] as const));
    const hasChild = new Set(this.spans.filter((s) => s.parentId && byId.has(s.parentId)).map((s) => s.parentId!));
    for (const id of hasChild) next.add(id);
    this.collapsedIds = next;
    // Collapsing everything only ever leaves root-level rows visible -- if the focused row was a
    // now-hidden descendant, re-point roving tabindex to its topmost ancestor (always a root, and
    // always still rendered) rather than leaving it pointed at a row that no longer exists.
    if (this.focusedId != null) {
      let current = byId.get(this.focusedId);
      while (current?.parentId != null && byId.has(current.parentId)) {
        current = byId.get(current.parentId);
      }
      this.focusedId = current?.id ?? null;
    }
  }

  private focusRow(row: SpanRow | undefined): void {
    if (!row) return;
    this.focusedId = row.span.id;
    void this.updateComplete.then(() => {
      (this.renderRoot.querySelector(`[data-id="${CSS.escape(row.span.id)}"]`) as HTMLElement | null)?.focus();
    });
  }

  private selectRow(id: string): void {
    this.focusedId = id;
    this.emit('lr-span-select', { id });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const rows = this.buildRows();
    if (rows.length === 0) return;
    const currentIndex = rows.findIndex((r) => r.span.id === this.focusedId);
    const current = currentIndex >= 0 ? rows[currentIndex] : rows[0];
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
            if (rows[i].depth < current.depth) {
              this.focusRow(rows[i]);
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

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('spans')) {
      const ids = new Set(this.spans.map((s) => s.id));
      let pruned: Set<string> | null = null;
      for (const id of this.collapsedIds) {
        if (!ids.has(id)) {
          pruned ??= new Set(this.collapsedIds);
          pruned.delete(id);
        }
      }
      if (pruned) this.collapsedIds = pruned;
      if (this.focusedId == null || !ids.has(this.focusedId)) {
        this.focusedId = this.activeSpanId && ids.has(this.activeSpanId) ? this.activeSpanId : (this.buildRows()[0]?.span.id ?? null);
      }
      for (const span of this.spans) {
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
      this.previousStatuses = new Map(this.spans.map((s) => [s.id, s.status]));
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('activeSpanId') && this.activeSpanId) {
      this.focusedId = this.activeSpanId;
      const row = this.renderRoot.querySelector(`[data-id="${CSS.escape(this.activeSpanId)}"]`) as HTMLElement | null;
      row?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    if (this.pendingAnnouncements.length > 0) {
      const texts = this.pendingAnnouncements;
      this.pendingAnnouncements = [];
      for (const text of texts) this.liveRegion?.announce(text);
    }
  }

  private renderHeader(): TemplateResult {
    return html`
      <div part="header">
        <span class="col-toggle" aria-hidden="true"></span>
        <span class="col-icon" aria-hidden="true"></span>
        <span part="name">${this.localize('traceTree')}</span>
        ${!this.hideBars ? html`<span class="col-bar" aria-hidden="true"></span>` : nothing}
        <span class="col-duration">${this.localize('duration')}</span>
        ${this.showTokens
          ? html`<span class="col-tokens">${this.localize('tokensIn')}</span><span class="col-tokens">${this.localize('tokensOut')}</span>`
          : nothing}
        ${this.showCost ? html`<span class="col-cost">${this.localize('cost')}</span>` : nothing}
      </div>
    `;
  }

  private renderRow(row: SpanRow): TemplateResult {
    const { span, depth, hasChildren, posInSet, setSize } = row;
    const expanded = hasChildren && !this.collapsedIds.has(span.id);
    const isActive = this.activeSpanId === span.id;
    const rows = this.buildRows();
    const firstId = rows[0]?.span.id;
    const tabbable = this.focusedId === span.id || (this.focusedId == null && span.id === firstId);
    const extent = this.traceExtent();
    const startPct = (span.startMs / extent) * 100;
    const endMs = span.endMs ?? (span.status === 'running' ? extent : span.startMs);
    const widthPct = Math.max(0, ((endMs - span.startMs) / extent) * 100);
    const durationLabel = this.formatDuration(span.endMs != null ? span.endMs - span.startMs : undefined);
    const fragments = [
      span.name,
      this.localize(KIND_LABEL_KEY[span.kind]),
      this.localize(STATUS_LABEL_KEY[span.status]),
      durationLabel,
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
        aria-current=${isActive ? 'true' : nothing}
        aria-label=${fragments.join(' — ')}
        ?data-active=${isActive}
        style=${`padding-inline-start:calc(${depth} * var(--lr-space-l))`}
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
        ${span.detail ? html`<span part="detail">${span.detail}</span>` : nothing}
        <span part="status-text" data-status=${span.status}>${this.localize(STATUS_LABEL_KEY[span.status])}</span>
        ${!this.hideBars
          ? html`<span part="bar-track"
              ><span part="bar" data-status=${span.status} style=${`inset-inline-start:${startPct}%;inline-size:${widthPct}%`}></span
            ></span>`
          : nothing}
        <span part="duration">${durationLabel}</span>
        ${this.showTokens
          ? html`<span part="tokens-in">${span.tokensIn != null ? this.formatNumber(span.tokensIn) : ''}</span>
              <span part="tokens-out">${span.tokensOut != null ? this.formatNumber(span.tokensOut) : ''}</span>`
          : nothing}
        ${this.showCost ? html`<span part="cost">${span.costText ?? ''}</span>` : nothing}
      </div>
    `;
  }

  render(): TemplateResult {
    const rows = this.buildRows();
    return html`
      <div
        part="base"
        role="tree"
        aria-label=${this.label || this.getAttribute('aria-label') || this.localize('traceTree')}
        @keydown=${this.onKeyDown}
      >
        ${rows.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : html`${this.showTokens || this.showCost ? this.renderHeader() : nothing}${rows.map((row) => this.renderRow(row))}`}
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
