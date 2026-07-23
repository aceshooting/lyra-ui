import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type { RetrievalChunk, RetrievalScoreBreakdown } from '../../../ai/types.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './retrieval-compare.styles.js';

let retrievalCompareInstance = 0;

export interface RetrievalComparisonSet {
  id: string;
  label: string;
  chunks: RetrievalChunk[];
}

export interface LyraRetrievalCompareEventMap {
  'lr-chunk-select': CustomEvent<{ setId: string; chunk: RetrievalChunk }>;
}

/**
 * `<lr-retrieval-compare>` — a side-by-side retrieval/reranking workbench that makes rank,
 * overlap, and dense/sparse/rerank/final score changes inspectable. It never performs retrieval.
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
 */
export class LyraRetrievalCompare extends LyraElement<LyraRetrievalCompareEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) sets: RetrievalComparisonSet[] = [];
  @property({ type: Number, attribute: 'top-k' }) topK = 10;
  @property({ attribute: 'selected-chunk-id' }) selectedChunkId = '';
  @property() label = '';

  private readonly headingIdPrefix = `lr-retrieval-compare-${++retrievalCompareInstance}`;

  private get effectiveTopK(): number {
    return Math.max(1, finiteCount(this.topK, 10));
  }

  private orderedChunks(set: RetrievalComparisonSet): RetrievalChunk[] {
    return set.chunks
      .map((chunk, index) => ({ chunk, index, rank: this.rank(chunk, index) }))
      .sort((a, b) => a.rank - b.rank || b.chunk.score - a.chunk.score || a.index - b.index)
      .slice(0, this.effectiveTopK)
      .map(({ chunk }) => chunk);
  }

  private rank(chunk: RetrievalChunk, index: number): number {
    return Math.max(1, finiteCount(typeof chunk.rank === 'number' ? chunk.rank : index + 1, index + 1));
  }

  private formatScore(value: number): string {
    return getNumberFormat(this.effectiveLocale, { style: 'percent', maximumFractionDigits: 1 }).format(
      finiteRange(value, 0, 0, 1),
    );
  }

  private overlaps(): Array<{
    left: RetrievalComparisonSet;
    right: RetrievalComparisonSet;
    summary: string;
  }> {
    const summaries: Array<{
      left: RetrievalComparisonSet;
      right: RetrievalComparisonSet;
      summary: string;
    }> = [];
    for (let leftIndex = 0; leftIndex < this.sets.length; leftIndex += 1) {
      const leftSet = this.sets[leftIndex]!;
      const left = new Set(this.orderedChunks(leftSet).map((chunk) => chunk.id));
      for (let rightIndex = leftIndex + 1; rightIndex < this.sets.length; rightIndex += 1) {
        const rightSet = this.sets[rightIndex]!;
        const right = new Set(this.orderedChunks(rightSet).map((chunk) => chunk.id));
        const intersection = [...left].filter((id) => right.has(id)).length;
        const union = new Set([...left, ...right]).size;
        const percent = this.formatScore(union ? intersection / union : 0);
        summaries.push({
          left: leftSet,
          right: rightSet,
          summary: this.localize('retrievalCompareOverlap', undefined, { percent }),
        });
      }
    }
    return summaries;
  }

  private scoreEntries(chunk: RetrievalChunk): Array<[string, number]> {
    const scores: RetrievalScoreBreakdown = chunk.scores ?? { final: chunk.score };
    return [
      [this.localize('retrievalCompareDenseScore'), scores.dense],
      [this.localize('retrievalCompareSparseScore'), scores.sparse],
      [this.localize('retrievalCompareRerankScore'), scores.rerank],
      [this.localize('retrievalCompareFinalScore'), scores.final],
    ].filter((entry): entry is [string, number] => typeof entry[1] === 'number');
  }

  private renderSet = (set: RetrievalComparisonSet, setIndex: number): TemplateResult => {
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
                @click=${() => this.emit('lr-chunk-select', { setId: set.id, chunk })}
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
                      <span part="score"><span>${scoreLabel}</span><span>${this.formatScore(value)}</span></span>
                    `,
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
    const label = this.getAttribute('aria-label') || this.label || this.localize('retrievalCompareLabel');
    if (!this.sets.length) {
      return html`<section part="base" aria-label=${label}>
        <lr-empty part="empty" heading=${this.localize('retrievalCompareEmpty')}></lr-empty>
      </section>`;
    }
    const overlaps = this.overlaps();
    return html`
      <section part="base" aria-label=${label}>
        ${overlaps.map(
          ({ left, right, summary }) =>
            html`<p part="overlap"><span>${left.label}</span><span>${right.label}</span><span>${summary}</span></p>`,
        )}
        <div part="sets">${this.sets.map((set, index) => this.renderSet(set, index))}</div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-retrieval-compare': LyraRetrievalCompare;
  }
}
