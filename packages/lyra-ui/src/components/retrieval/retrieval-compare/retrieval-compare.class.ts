import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type { RetrievalChunk, RetrievalScoreBreakdown } from '../../../ai/types.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './retrieval-compare.styles.js';

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

  private overlap(): string {
    if (this.sets.length < 2) return '';
    const left = new Set(this.orderedChunks(this.sets[0]!).map((chunk) => chunk.id));
    const right = new Set(this.orderedChunks(this.sets[1]!).map((chunk) => chunk.id));
    const intersection = [...left].filter((id) => right.has(id)).length;
    const union = new Set([...left, ...right]).size;
    const percent = this.formatScore(union ? intersection / union : 0);
    return this.localize('retrievalCompareOverlap', undefined, { percent });
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

  private renderSet = (set: RetrievalComparisonSet): TemplateResult => html`
    <section part="set" aria-labelledby=${`set-${set.id}`}>
      <h3 part="set-heading" id=${`set-${set.id}`}>${set.label}</h3>
      <ol part="chunks">
        ${this.orderedChunks(set).map((chunk, index) => {
          const selected = chunk.id === this.selectedChunkId;
          const rank = this.rank(chunk, index);
          return html`
            <li>
              <button
                part=${selected ? 'chunk chunk-selected' : 'chunk'}
                type="button"
                aria-pressed=${selected ? 'true' : 'false'}
                @click=${() => this.emit('lr-chunk-select', { setId: set.id, chunk })}
              >
                <span part="chunk-rank">${this.localize('retrievalCompareRank', undefined, { rank })}</span>
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

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('retrievalCompareLabel');
    if (!this.sets.length) {
      return html`<section part="base" aria-label=${label}>
        <lr-empty part="empty" heading=${this.localize('retrievalCompareEmpty')}></lr-empty>
      </section>`;
    }
    const overlap = this.overlap();
    return html`
      <section part="base" aria-label=${label}>
        ${overlap ? html`<p part="overlap">${overlap}</p>` : nothing}
        <div part="sets">${this.sets.map(this.renderSet)}</div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-retrieval-compare': LyraRetrievalCompare;
  }
}
