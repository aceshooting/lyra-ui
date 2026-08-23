import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type {
  RetrievalChunk,
  RetrievalScoreBreakdown,
} from '../../../ai/types.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  firstByRetrievalIdentity,
  isValidRetrievalChunk,
} from '../retrieval-identity.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './retrieval-compare.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_retrievalCompareDenseScore, LYRA_DEFAULT_retrievalCompareEmpty, LYRA_DEFAULT_retrievalCompareFinalScore, LYRA_DEFAULT_retrievalCompareLabel, LYRA_DEFAULT_retrievalCompareOverlap, LYRA_DEFAULT_retrievalCompareRank, LYRA_DEFAULT_retrievalCompareRerankScore, LYRA_DEFAULT_retrievalCompareSparseScore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

let retrievalCompareInstance = 0;

export interface RetrievalComparisonSet {
  id: string;
  label: string;
  chunks: RetrievalChunk[];
}

export interface LyraRetrievalCompareEventMap {
  'lr-chunk-select': CustomEvent<LyraEventDetailSnapshot<{ setId: string; chunk: RetrievalChunk }>>;
}

/**
 * `<lr-retrieval-compare>` — a side-by-side retrieval/reranking workbench that makes rank,
 * overlap, and dense/sparse/rerank/final score changes inspectable. It never performs retrieval.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Blank set ids and later duplicates are ignored before overlap, rendering, or activation. Within
 * each retained set, blank chunk ids and later duplicates are likewise ignored. First records win.
 *
 * @customElement lr-retrieval-compare
 * @event lr-chunk-select - A result was activated. `detail: { setId, chunk }`.
 * @csspart base - The named comparison region.
 * @csspart overlap - The pairwise top-k Jaccard overlap summary.
 * @csspart sets - Horizontally scrollable set grid.
 * @csspart set - One result-set column.
 * @csspart set-heading - A caller-supplied result-set label.
 * @csspart chunks - One ranked list.
 * @csspart chunk - A selectable chunk row.
 * @csspart chunk-selected - The selected chunk row.
 * @csspart chunk-rank - The effective rank.
 * @csspart chunk-title - The source title.
 * @csspart chunk-text - Retrieved text.
 * @csspart scores - Score-breakdown list.
 * @csspart score - One named score.
 * @csspart empty - The empty state.
 * @cssprop [--lr-retrieval-compare-selected-border=var(--lr-color-brand)] - Border color marking
 *   a selected `[part~="chunk"]` row.
 * @status stable
 * @since 7.0.0
 */
export class LyraRetrievalCompare extends LyraElement<LyraRetrievalCompareEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    retrievalCompareDenseScore: LYRA_DEFAULT_retrievalCompareDenseScore,
    retrievalCompareEmpty: LYRA_DEFAULT_retrievalCompareEmpty,
    retrievalCompareFinalScore: LYRA_DEFAULT_retrievalCompareFinalScore,
    retrievalCompareLabel: LYRA_DEFAULT_retrievalCompareLabel,
    retrievalCompareOverlap: LYRA_DEFAULT_retrievalCompareOverlap,
    retrievalCompareRank: LYRA_DEFAULT_retrievalCompareRank,
    retrievalCompareRerankScore: LYRA_DEFAULT_retrievalCompareRerankScore,
    retrievalCompareSparseScore: LYRA_DEFAULT_retrievalCompareSparseScore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['sets']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-chunk-select',
  ]);

  /** Named retrieval result sets rendered side by side. */
  @property({ attribute: false }) sets: readonly RetrievalComparisonSet[] = [];
  /** Maximum ranked chunks shown from each set after stable score ordering. */
  @property({ type: Number, attribute: 'top-k' }) topK = 10;
  /** Controlled chunk id highlighted across every set that contains it. */
  @property({ attribute: 'selected-chunk-id' }) selectedChunkId = '';
  /** Fallback name for the comparison region. Omitting it falls back to a localized default; an
   *  explicit empty string clears it. A non-empty host `aria-label` makes the host the sole
   *  overall owner; an explicitly empty host label stays empty on the region. */
  @property() label?: string;

  private readonly headingIdPrefix = `lr-retrieval-compare-${++retrievalCompareInstance}`;

  private get effectiveTopK(): number {
    return Math.max(1, finiteCount(this.topK, 10));
  }

  private get normalizedSets(): RetrievalComparisonSet[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.sets) ? this.sets : [],
      (set) => set.id
    );
  }

  private orderedChunks(set: RetrievalComparisonSet): RetrievalChunk[] {
    return firstByRetrievalIdentity(
      Array.isArray(set.chunks) ? set.chunks.filter(isValidRetrievalChunk) : [],
      (chunk) => chunk.id
    )
      .map((chunk, index) => ({ chunk, index, rank: this.rank(chunk, index) }))
      .sort(
        (a, b) =>
          a.rank - b.rank || b.chunk.score - a.chunk.score || a.index - b.index
      )
      .slice(0, this.effectiveTopK)
      .map(({ chunk }) => chunk);
  }

  private rank(chunk: RetrievalChunk, index: number): number {
    return Math.max(
      1,
      finiteCount(
        typeof chunk.rank === 'number' ? chunk.rank : index + 1,
        index + 1
      )
    );
  }

  private formatScore(value: number): string {
    return getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(finiteRange(value, 0, 0, 1));
  }

  private overlaps(sets: readonly RetrievalComparisonSet[]): string[] {
    const summaries: string[] = [];
    for (let leftIndex = 0; leftIndex < sets.length; leftIndex += 1) {
      const leftSet = sets[leftIndex]!;
      const left = new Set(
        this.orderedChunks(leftSet).map((chunk) => chunk.id)
      );
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < sets.length;
        rightIndex += 1
      ) {
        const rightSet = sets[rightIndex]!;
        const right = new Set(
          this.orderedChunks(rightSet).map((chunk) => chunk.id)
        );
        const intersection = [...left].filter((id) => right.has(id)).length;
        const union = new Set([...left, ...right]).size;
        const percent = this.formatScore(union ? intersection / union : 0);
        summaries.push(
          this.localize('retrievalCompareOverlap', undefined, {
            left: leftSet.label,
            right: rightSet.label,
            percent,
          })
        );
      }
    }
    return summaries;
  }

  private scoreEntries(chunk: RetrievalChunk): Array<[string, number]> {
    const scores: RetrievalScoreBreakdown = chunk.scores ?? {
      final: chunk.score,
    };
    return [
      [this.localize('retrievalCompareDenseScore'), scores.dense],
      [this.localize('retrievalCompareSparseScore'), scores.sparse],
      [this.localize('retrievalCompareRerankScore'), scores.rerank],
      [this.localize('retrievalCompareFinalScore'), scores.final],
    ].filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number'
    );
  }

  private renderSet = (
    set: RetrievalComparisonSet,
    setIndex: number
  ): TemplateResult => {
    const headingId = `${this.headingIdPrefix}-set-${setIndex}`;
    return html`
      <section part="set" aria-labelledby=${headingId}>
        <h3 part="set-heading" id=${headingId}>${set.label}</h3>
        <ol part="chunks">
          ${this.orderedChunks(set).map((chunk, index) => {
            const selected = chunk.id === this.selectedChunkId;
            const rank = this.rank(chunk, index);
            const chunkPart = selected ? 'chunk chunk-selected' : 'chunk';
            return html`
              <li>
                <button
                  part=${chunkPart}
                  type="button"
                  aria-pressed=${selected ? 'true' : 'false'}
                  @click=${() =>
                    this.emit('lr-chunk-select', { setId: set.id, chunk })}
                >
                  <span part="chunk-rank"
                    >${this.localize('retrievalCompareRank', undefined, {
                      rank: getNumberFormat(this.effectiveLocale).format(rank),
                    })}</span
                  >
                  <strong part="chunk-title">${chunk.source.name}</strong>
                  <span part="chunk-text">${chunk.text}</span>
                  <span part="scores">
                    ${this.scoreEntries(chunk).map(
                      ([scoreLabel, value]) => html`
                        <span part="score"
                          ><span>${scoreLabel}</span
                          ><span>${this.formatScore(value)}</span></span
                        >
                      `
                    )}
                  </span>
                </button>
              </li>
            `;
          })}
        </ol>
      </section>
    `;
  };

  override render(): TemplateResult {
    const sets = this.normalizedSets;
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('retrievalCompareLabel') : this.label
    );
    const role = retrievalSemanticRole(this, 'region');
    if (!sets.length) {
      return html`<section
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        <lr-empty
          part="empty"
          heading=${this.localize('retrievalCompareEmpty')}
        ></lr-empty>
      </section>`;
    }
    const overlaps = this.overlaps(sets);
    return html`
      <section
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        ${overlaps.map((summary) => html`<p part="overlap">${summary}</p>`)}
        <div part="sets">
          ${sets.map((set, index) => this.renderSet(set, index))}
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-retrieval-compare': LyraRetrievalCompare;
  }
}
