import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import type { RetrievalChunk } from '../../../ai/types.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraSpan } from '../../agent-tools/trace-tree/span.js';
import '../../agent-tools/span-waterfall/span-waterfall.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import { styles } from './retrieval-trace.styles.js';

/** One of the five fixed stages a retrieval pipeline moves through, in order. */
export type RetrievalStageKind = 'query-rewrite' | 'embed' | 'retrieve' | 'rerank' | 'filter';

/**
 * Evidence backing one `RetrievalStage`, rendered in that stage's expandable evidence panel.
 * `chunks` reuses `RetrievalChunk` (`src/ai/types.ts`) verbatim -- the same shape a retrieval
 * step already produces -- and renders through `<lr-chunk-inspector>` rather than new chunk
 * markup, mapping `source.id -> sourceId` / `source.name -> title`.
 */
export interface RetrievalStageEvidence {
  /** Free-form text, e.g. the rewritten query string or an embedding model identifier. */
  text?: string;
  /** Chunks this stage produced or retained, in this stage's own order. */
  chunks?: RetrievalChunk[];
  /** Arbitrary stage facts (e.g. filter criteria, embedding dimensions), rendered as a plain key/value list. */
  metadata?: Record<string, unknown>;
}

/**
 * One stage in a retrieval pipeline. Projected to one `LyraSpan` for the internal
 * `<lr-span-waterfall>` timeline -- `id`/`startMs`/`endMs`/`status` map straight across, `kind`
 * maps onto whichever existing `LyraSpan['kind']` fits best (`embed` -> `'embedding'`, `retrieve`
 * -> `'retriever'`, `query-rewrite` -> `'llm'`, `rerank`/`filter` -> `'tool'`), and the visible
 * bar name is `label` (if set) or the stage's own localized default for `kind`.
 */
export interface RetrievalStage {
  id: string;
  kind: RetrievalStageKind;
  /** Overrides the localized default label for `kind` (e.g. a specific embedding-model name). */
  label?: string;
  /** Milliseconds relative to the trace start. */
  startMs: number;
  /** Milliseconds relative to the trace start. Absent while the stage is still running. */
  endMs?: number;
  /** Same vocabulary as `LyraSpan.status`. */
  status: 'pending' | 'running' | 'success' | 'error' | 'denied';
  /** Secondary text under the stage name, e.g. "12 chunks, top score 0.87". */
  detail?: string;
  evidence?: RetrievalStageEvidence;
}

const STAGE_SPAN_KIND: Record<RetrievalStageKind, LyraSpan['kind']> = {
  'query-rewrite': 'llm',
  embed: 'embedding',
  retrieve: 'retriever',
  rerank: 'tool',
  filter: 'tool',
};

/** `this.localize()` key per stage kind. */
const STAGE_LABEL: Record<RetrievalStageKind, { key: string }> = {
  'query-rewrite': { key: 'retrievalStageQueryRewrite' },
  embed: { key: 'retrievalStageEmbed' },
  retrieve: { key: 'retrievalStageRetrieve' },
  rerank: { key: 'retrievalStageRerank' },
  filter: { key: 'retrievalStageFilter' },
};

function hasEvidence(evidence: RetrievalStageEvidence | undefined): evidence is RetrievalStageEvidence {
  if (!evidence) return false;
  return (
    Boolean(evidence.text) ||
    Boolean(evidence.chunks && evidence.chunks.length > 0) ||
    Boolean(evidence.metadata && Object.keys(evidence.metadata).length > 0)
  );
}

function toLyraChunk(chunk: RetrievalChunk): LyraChunk {
  return { id: chunk.id, text: chunk.text, score: chunk.score, sourceId: chunk.source.id, title: chunk.source.name };
}

function formatMetadataValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface LyraRetrievalTraceEventMap {
  'lr-stage-select': CustomEvent<{ id: string }>;
  'lr-stage-toggle': CustomEvent<{ id: string; expanded: boolean }>;
}

/**
 * `<lr-retrieval-trace>` — a retrieval pipeline's stage timeline (query rewriting, embedding,
 * retrieval, reranking, filtering), rendered through `<lr-span-waterfall>`'s existing
 * time-scaled bar rendering, plus a disclosure list below it exposing each stage's evidence:
 * free-form text, retrieved/reranked/filtered chunks via `<lr-chunk-inspector>`, and/or arbitrary
 * stage metadata. Never fetches, ranks, or computes retrieval results itself.
 *
 * @customElement lr-retrieval-trace
 * @event lr-stage-select - A stage's bar was activated in the timeline (click, Enter, Space). `detail: { id }`.
 * @event lr-stage-toggle - A stage's evidence panel was expanded or collapsed (via its own toggle,
 * or implicitly by selecting that stage in the timeline for the first time). `detail: { id, expanded }`.
 * @csspart base - The root wrapper.
 * @csspart timeline - The internal `<lr-span-waterfall>` element.
 * @csspart evidence-list - The wrapper around every stage's evidence disclosure row. Omitted when no stage has evidence.
 * @csspart evidence-row - One stage's evidence disclosure row. Omitted for a stage with no evidence.
 * @csspart evidence-toggle - A stage's evidence disclosure `<button>`.
 * @csspart evidence-toggle-icon - The disclosure button's chevron glyph.
 * @csspart evidence-body - A stage's evidence content wrapper, hidden while collapsed.
 * @csspart evidence-text - A stage's free-form text evidence.
 * @csspart evidence-metadata - A stage's key/value metadata list (a `<dl>`).
 * @csspart evidence-metadata-row - One metadata entry's `<dt>`/`<dd>` pair wrapper, inside `evidence-metadata`.
 * @csspart evidence-metadata-key - One metadata entry's key (a `<dt>`).
 * @csspart evidence-metadata-value - One metadata entry's value (a `<dd>`).
 * @cssprop [--lr-retrieval-trace-active-border=var(--lr-color-brand)] - Border color of the
 *   `[part="evidence-row"]` whose stage matches `activeStageId`.
 */
export class LyraRetrievalTrace extends LyraElement<LyraRetrievalTraceEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The pipeline's stages, in any order -- the internal timeline sorts them by `startMs`. */
  @property({ attribute: false }) stages: RetrievalStage[] = [];
  /** Controlled selection, forwarded verbatim to the internal `<lr-span-waterfall>`'s `activeSpanId`. */
  @property({ attribute: 'active-stage-id' }) activeStageId: string | null = null;
  /** Accessible name for the internal timeline. Falls back to a host `aria-label`, then the timeline's own localized default. */
  @property() label = '';

  /** Ids of stages whose evidence panel is open. Absence means collapsed -- every stage starts collapsed. */
  @state() private expandedStageIds = new Set<string>();

  private readonly evidenceIdBase = nextId('retrieval-trace');

  private stageLabel(stage: RetrievalStage): string {
    if (stage.label) return stage.label;
    return this.localize(STAGE_LABEL[stage.kind].key);
  }

  private toSpans(): LyraSpan[] {
    return this.stages.map(
      (stage): LyraSpan => ({
        id: stage.id,
        name: this.stageLabel(stage),
        kind: STAGE_SPAN_KIND[stage.kind],
        startMs: stage.startMs,
        endMs: stage.endMs,
        status: stage.status,
        detail: stage.detail,
      }),
    );
  }

  private toggleEvidence(id: string): void {
    const expanded = !this.expandedStageIds.has(id);
    const next = new Set(this.expandedStageIds);
    if (expanded) next.add(id);
    else next.delete(id);
    this.expandedStageIds = next;
    this.emit('lr-stage-toggle', { id, expanded });
  }

  private onStageSelect = (e: CustomEvent<{ id: string }>): void => {
    const { id } = e.detail;
    this.emit('lr-stage-select', { id });
    // Selecting a stage in the timeline opens its evidence panel the first time (a "click a
    // stage, see what it did" flow), but never auto-collapses it again on a second click -- the
    // dedicated evidence-toggle button (with its own aria-expanded/aria-controls) is the only
    // control that closes it, so the two affordances stay independently predictable.
    const stage = this.stages.find((s) => s.id === id);
    if (stage && hasEvidence(stage.evidence) && !this.expandedStageIds.has(id)) {
      const next = new Set(this.expandedStageIds);
      next.add(id);
      this.expandedStageIds = next;
      this.emit('lr-stage-toggle', { id, expanded: true });
    }
  };

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('stages')) {
      const ids = new Set(this.stages.map((s) => s.id));
      let pruned: Set<string> | null = null;
      for (const id of this.expandedStageIds) {
        if (!ids.has(id)) {
          pruned ??= new Set(this.expandedStageIds);
          pruned.delete(id);
        }
      }
      if (pruned) this.expandedStageIds = pruned;
    }
  }

  private renderEvidenceBody(evidence: RetrievalStageEvidence): TemplateResult {
    const chunks = evidence.chunks && evidence.chunks.length > 0 ? evidence.chunks.map(toLyraChunk) : [];
    const metaEntries = evidence.metadata ? Object.entries(evidence.metadata) : [];
    return html`
      ${evidence.text ? html`<p part="evidence-text">${evidence.text}</p>` : nothing}
      ${chunks.length > 0 ? html`<lr-chunk-inspector compact .chunks=${chunks}></lr-chunk-inspector>` : nothing}
      ${metaEntries.length > 0
        ? html`<dl part="evidence-metadata">
            ${metaEntries.map(
              ([key, value]) =>
                html`<div part="evidence-metadata-row">
                  <dt part="evidence-metadata-key">${key}</dt>
                  <dd part="evidence-metadata-value">${formatMetadataValue(value)}</dd>
                </div>`,
            )}
          </dl>`
        : nothing}
    `;
  }

  private renderEvidenceRow(stage: RetrievalStage): TemplateResult | typeof nothing {
    if (!hasEvidence(stage.evidence)) return nothing;
    const expanded = this.expandedStageIds.has(stage.id);
    const bodyId = `${this.evidenceIdBase}-${stage.id}`;
    const label = this.stageLabel(stage);
    return html`
      <div part="evidence-row" data-id=${stage.id} ?data-active=${this.activeStageId === stage.id}>
        <button
          part="evidence-toggle"
          type="button"
          aria-expanded=${expanded ? 'true' : 'false'}
          aria-controls=${bodyId}
          @click=${() => this.toggleEvidence(stage.id)}
        >
          <span part="evidence-toggle-icon" aria-hidden="true">${chevronIcon()}</span>
          <span>${this.localize('retrievalTraceEvidenceToggle', undefined, { label })}</span>
        </button>
        <div part="evidence-body" id=${bodyId} ?hidden=${!expanded}>${this.renderEvidenceBody(stage.evidence!)}</div>
      </div>
    `;
  }

  render(): TemplateResult {
    const spans = this.toSpans();
    const hasAnyEvidence = this.stages.some((s) => hasEvidence(s.evidence));
    return html`
      <div part="base">
        <lr-span-waterfall
          part="timeline"
          .spans=${spans}
          .activeSpanId=${this.activeStageId}
          .label=${this.label}
          @lr-span-select=${this.onStageSelect}
        ></lr-span-waterfall>
        ${hasAnyEvidence
          ? html`<div part="evidence-list">${this.stages.map((stage) => this.renderEvidenceRow(stage))}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-retrieval-trace': LyraRetrievalTrace;
  }
}
