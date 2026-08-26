import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { chevronIcon } from '../../../internal/icons.js';
import type { RetrievalChunk } from '../../../ai/types.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraSpan } from '../../agent-tools/trace-tree/span.js';
import '../../agent-tools/span-waterfall/span-waterfall.class.js';
import '../chunk-inspector/chunk-inspector.class.js';
import {
  firstByRetrievalIdentity,
  isValidRetrievalChunk,
} from '../retrieval-identity.js';
import { styles } from './retrieval-trace.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_expand, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_retrievalStageEmbed, LYRA_DEFAULT_retrievalStageFilter, LYRA_DEFAULT_retrievalStageQueryRewrite, LYRA_DEFAULT_retrievalStageRerank, LYRA_DEFAULT_retrievalStageRetrieve, LYRA_DEFAULT_retrievalTraceEvidenceToggle, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** One of the five fixed stages a retrieval pipeline moves through, in order. */
export type RetrievalStageKind =
  | 'query-rewrite'
  | 'embed'
  | 'retrieve'
  | 'rerank'
  | 'filter';

/**
 * Evidence backing one `RetrievalStage`, rendered in that stage's expandable evidence panel.
 * `chunks` reuses `RetrievalChunk` (`src/ai/types.ts`) verbatim -- the same shape a retrieval
 * step already produces -- and renders through `<lr-chunk-inspector>` rather than new chunk
 * markup, mapping `source.id -> sourceId` / `source.name -> title` and preserving the optional
 * document `locator` as the inspector's `anchor` (plus visible `page` for page locators).
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

/** Runtime boundary for a stage's evidence chunks -- mirrors retrieval-compare.class.ts's
 *  `orderedChunks` filter so a malformed or non-array `chunks` degrades to an empty list instead
 *  of crashing `toLyraChunk`. */
function validChunks(evidence: RetrievalStageEvidence | undefined): RetrievalChunk[] {
  return Array.isArray(evidence?.chunks)
    ? evidence.chunks.filter(isValidRetrievalChunk)
    : [];
}

function hasEvidence(
  evidence: RetrievalStageEvidence | undefined
): evidence is RetrievalStageEvidence {
  if (!evidence) return false;
  return (
    Boolean(evidence.text) ||
    validChunks(evidence).length > 0 ||
    Boolean(evidence.metadata && Object.keys(evidence.metadata).length > 0)
  );
}

function toLyraChunk(chunk: RetrievalChunk): LyraChunk {
  return {
    id: chunk.id,
    text: chunk.text,
    score: chunk.score,
    sourceId: chunk.source.id,
    title: chunk.source.name,
    ...(chunk.locator ? { anchor: chunk.locator } : {}),
    ...(chunk.locator?.kind === 'page' ? { page: chunk.locator.page } : {}),
  };
}

export interface LyraRetrievalTraceEventMap {
  'lr-stage-select': CustomEvent<{ stageId: string }>;
  'lr-stage-toggle': CustomEvent<{ stageId: string; expanded: boolean }>;
  'lr-stage-chunk-action': CustomEvent<LyraEventDetailSnapshot<LyraRetrievalTraceChunkActionDetail>>;
}

/** Stage-correlated replacement for nested chunk-inspector events. */
export type LyraRetrievalTraceChunkActionDetail =
  | {
      stageId: string;
      action: 'open';
      chunkId: string;
      sourceId: string;
      anchor?: NonNullable<LyraChunk['anchor']>;
    }
  | { stageId: string; action: 'expand'; chunkId: string; expanded: boolean };

/**
 * `<lr-retrieval-trace>` — a retrieval pipeline's stage timeline (query rewriting, embedding,
 * retrieval, reranking, filtering), rendered through `<lr-span-waterfall>`'s existing
 * time-scaled bar rendering, plus a disclosure list below it exposing each stage's evidence:
 * free-form text, retrieved/reranked/filtered chunks via `<lr-chunk-inspector>`, and/or arbitrary
 * stage metadata. Never fetches, ranks, or computes retrieval results itself.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-retrieval-trace
 * @event lr-stage-select - A stage's bar was activated in the timeline (click, Enter, Space). `detail: { stageId }`.
 * @event lr-stage-toggle - A stage's evidence panel was expanded or collapsed (via its own toggle,
 * or implicitly by selecting that stage in the timeline for the first time). `detail: { stageId, expanded }`.
 * @event lr-stage-chunk-action - A chunk inside a stage was opened or expanded. The discriminated
 *   detail always includes `stageId` and `action`, so consumers never infer ownership from DOM ancestry.
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
 * @csspart chunk-inspector - The stage-owned chunk inspector; its generic child actions are
 *   stopped and re-emitted as `lr-stage-chunk-action`.
 * @cssprop [--lr-retrieval-trace-active-border=var(--lr-color-brand)] - Border color of the
 *   `[part="evidence-row"]` whose stage matches `activeStageId`.
 * @status stable
 * @since 4.1.0
 */
export class LyraRetrievalTrace extends LyraElement<LyraRetrievalTraceEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    expand: LYRA_DEFAULT_expand,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    retrievalStageEmbed: LYRA_DEFAULT_retrievalStageEmbed,
    retrievalStageFilter: LYRA_DEFAULT_retrievalStageFilter,
    retrievalStageQueryRewrite: LYRA_DEFAULT_retrievalStageQueryRewrite,
    retrievalStageRerank: LYRA_DEFAULT_retrievalStageRerank,
    retrievalStageRetrieve: LYRA_DEFAULT_retrievalStageRetrieve,
    retrievalTraceEvidenceToggle: LYRA_DEFAULT_retrievalTraceEvidenceToggle,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['stages']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-stage-chunk-action',
  ]);

  /** The pipeline's stages, in any order -- the internal timeline sorts them by `startMs`. */
  @property({ attribute: false }) stages: readonly RetrievalStage[] = [];
  /** Controlled selection, forwarded verbatim to the internal `<lr-span-waterfall>`'s `activeSpanId`. */
  @property({ attribute: 'active-stage-id' }) activeStageId: string | null =
    null;
  /** Accessible name for the internal timeline. A host `aria-label` independently names the
   *  trace as a whole; an empty value falls back to the timeline's localized default. */
  @property() label = '';

  /** Ids of stages whose evidence panel is open. Absence means collapsed -- every stage starts collapsed. */
  @state() private expandedStageIds = new Set<string>();

  private readonly evidenceDomIdPrefix = nextId('retrieval-trace-evidence');

  /** `stages`, deduped to the first stage for each nonblank `id` -- keeps the timeline (which
   *  `<lr-span-waterfall>` already dedupes internally) and the evidence list (rendered one row
   *  per entry here) in agreement, and keeps `expandedStageIds`/`activeStageId` comparisons keyed
   *  by an id that identifies exactly one stage. */
  private get normalizedStages(): RetrievalStage[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.stages) ? this.stages : [],
      (stage) => stage.id
    );
  }

  private stageLabel(stage: RetrievalStage): string {
    if (typeof stage.label === 'string' && stage.label) return stage.label;
    const entry = STAGE_LABEL[stage.kind];
    return entry ? this.localize(entry.key) : String(stage.kind);
  }

  private toSpans(): LyraSpan[] {
    return this.normalizedStages.map(
      (stage): LyraSpan => ({
        id: stage.id,
        name: this.stageLabel(stage),
        kind: STAGE_SPAN_KIND[stage.kind] ?? 'tool',
        startMs: stage.startMs,
        endMs: stage.endMs,
        status: stage.status,
        detail: stage.detail,
      })
    );
  }

  private toggleEvidence(stageId: string): void {
    const expanded = !this.expandedStageIds.has(stageId);
    const next = new Set(this.expandedStageIds);
    if (expanded) next.add(stageId);
    else next.delete(stageId);
    this.expandedStageIds = next;
    this.emit('lr-stage-toggle', { stageId, expanded });
  }

  private onStageSelect = (e: CustomEvent<{ spanId: string }>): void => {
    e.stopPropagation();
    const { spanId: stageId } = e.detail;
    this.emit('lr-stage-select', { stageId });
    // Selecting a stage in the timeline opens its evidence panel the first time (a "click a
    // stage, see what it did" flow), but never auto-collapses it again on a second click -- the
    // dedicated evidence-toggle button (with its own aria-expanded/aria-controls) is the only
    // control that closes it, so the two affordances stay independently predictable.
    const stage = this.normalizedStages.find((s) => s.id === stageId);
    if (
      stage &&
      hasEvidence(stage.evidence) &&
      !this.expandedStageIds.has(stageId)
    ) {
      const next = new Set(this.expandedStageIds);
      next.add(stageId);
      this.expandedStageIds = next;
      this.emit('lr-stage-toggle', { stageId, expanded: true });
    }
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('stages')) {
      const ids = new Set(this.normalizedStages.map((s) => s.id));
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

  private renderEvidenceBody(stage: RetrievalStage): TemplateResult {
    const evidence = stage.evidence!;
    const chunks = validChunks(evidence).map(toLyraChunk);
    const metaEntries = evidence.metadata
      ? Object.entries(evidence.metadata)
      : [];
    return html`
      ${evidence.text
        ? html`<p part="evidence-text">${evidence.text}</p>`
        : nothing}
      ${chunks.length > 0
        ? html`<lr-chunk-inspector
            part="chunk-inspector"
            compact
            .chunks=${chunks}
            @lr-chunk-open=${(
              event: CustomEvent<{
                chunkId: string;
                sourceId: string;
                anchor?: NonNullable<LyraChunk['anchor']>;
              }>
            ) => {
              event.stopPropagation();
              this.emit('lr-stage-chunk-action', {
                stageId: stage.id,
                action: 'open',
                ...event.detail,
              });
            }}
            @lr-expand=${(
              event: CustomEvent<{ chunkId: string; expanded: boolean }>
            ) => {
              event.stopPropagation();
              this.emit('lr-stage-chunk-action', {
                stageId: stage.id,
                action: 'expand',
                ...event.detail,
              });
            }}
          ></lr-chunk-inspector>`
        : nothing}
      ${metaEntries.length > 0
        ? html`<dl part="evidence-metadata">
            ${metaEntries.map(
              ([key, value]) =>
                html`<div part="evidence-metadata-row">
                  <dt part="evidence-metadata-key">${key}</dt>
                  <dd part="evidence-metadata-value">
                    ${this.formatMetadataValue(value)}
                  </dd>
                </div>`
            )}
          </dl>`
        : nothing}
    `;
  }

  private formatMetadataValue(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'boolean')
      return String(value);
    if (typeof value === 'number') {
      return getNumberFormat(this.effectiveLocale).format(
        finiteNumber(value, 0)
      );
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private renderEvidenceRow(
    stage: RetrievalStage,
    occurrenceIndex: number
  ): TemplateResult | typeof nothing {
    if (!hasEvidence(stage.evidence)) return nothing;
    const expanded = this.expandedStageIds.has(stage.id);
    // The occurrence index keeps repeated references to the exact same caller object distinct;
    // the per-instance prefix keeps parallel trace instances distinct without exposing a raw
    // caller-controlled stage id in the DOM.
    const bodyId = `${this.evidenceDomIdPrefix}-${occurrenceIndex}`;
    const label = this.stageLabel(stage);
    return html`
      <div
        part="evidence-row"
        data-id=${stage.id}
        ?data-active=${this.activeStageId === stage.id}
      >
        <button
          part="evidence-toggle"
          type="button"
          aria-expanded=${expanded ? 'true' : 'false'}
          aria-controls=${bodyId}
          @click=${() => this.toggleEvidence(stage.id)}
        >
          <span part="evidence-toggle-icon" aria-hidden="true"
            >${chevronIcon()}</span
          >
          <span
            >${this.localize('retrievalTraceEvidenceToggle', undefined, {
              label,
            })}</span
          >
        </button>
        <div part="evidence-body" id=${bodyId} ?hidden=${!expanded}>
          ${this.renderEvidenceBody(stage)}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const spans = this.toSpans();
    const hasAnyEvidence = this.normalizedStages.some((s) =>
      hasEvidence(s.evidence)
    );
    // A host aria-label names this composed trace. Forward only the distinct timeline label; the
    // nested waterfall supplies its own localized purpose when this remains empty.
    const label = this.label;
    return html`
      <div part="base">
        <lr-span-waterfall
          part="timeline"
          .spans=${spans}
          .activeSpanId=${this.activeStageId}
          .label=${label}
          @lr-span-select=${this.onStageSelect}
        ></lr-span-waterfall>
        ${hasAnyEvidence
          ? html`<div part="evidence-list">
              ${this.normalizedStages.map((stage, index) =>
                this.renderEvidenceRow(stage, index)
              )}
            </div>`
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
