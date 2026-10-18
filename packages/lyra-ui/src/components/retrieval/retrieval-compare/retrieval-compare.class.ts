import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { activeElementIn, shadowFocusTarget } from '../../../internal/active-element.js';
import { repeat } from 'lit/directives/repeat.js';
import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type {
  RetrievalChunk,
  RetrievalScoreBreakdown,
} from '../../../ai/types.js';
import { nextId } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { isRovingTargetAvailable, resolveListMove } from '../../../internal/list-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  firstByRetrievalIdentity,
  isValidRetrievalChunk,
} from '../retrieval-identity.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './retrieval-compare.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_retrievalCompareDenseScore, LYRA_DEFAULT_retrievalCompareEmpty, LYRA_DEFAULT_retrievalCompareFinalScore, LYRA_DEFAULT_retrievalCompareInputLimit, LYRA_DEFAULT_retrievalCompareLabel, LYRA_DEFAULT_retrievalCompareOverlap, LYRA_DEFAULT_retrievalCompareRank, LYRA_DEFAULT_retrievalCompareRerankScore, LYRA_DEFAULT_retrievalCompareResultLimit, LYRA_DEFAULT_retrievalCompareSparseScore, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_next, LYRA_DEFAULT_paginationApplied, LYRA_DEFAULT_paginationFirstPage, LYRA_DEFAULT_paginationLabel, LYRA_DEFAULT_paginationLastPage, LYRA_DEFAULT_previous } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const COMPARISON_PAGE_SIZE = 8;
const MAX_COMPARISON_RESULTS = 100;

interface ComparisonOverlap { readonly left: string; readonly right: string; readonly ratio: number; }
interface RankedComparison { readonly topK: number; readonly chunks: RetrievalChunk[]; readonly total: number; readonly ranks: ReadonlyMap<RetrievalChunk, number>; }

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
 * @csspart overlap - Pairwise top-k Jaccard overlap for the current page of at most eight sets.
 * @csspart input-limit - The input-admission loss notice.
 * @csspart result-limit - Retained/result counts for a column's top-k subset.
 * @csspart pagination - Internal comparison page controls.
 * @csspart page-status - Localized current page and page count.
 * @csspart page-button - One page navigation button.
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
    next: LYRA_DEFAULT_next,
    paginationApplied: LYRA_DEFAULT_paginationApplied,
    paginationFirstPage: LYRA_DEFAULT_paginationFirstPage,
    paginationLabel: LYRA_DEFAULT_paginationLabel,
    paginationLastPage: LYRA_DEFAULT_paginationLastPage,
    previous: LYRA_DEFAULT_previous,
    retrievalCompareDenseScore: LYRA_DEFAULT_retrievalCompareDenseScore,
    retrievalCompareEmpty: LYRA_DEFAULT_retrievalCompareEmpty,
    retrievalCompareFinalScore: LYRA_DEFAULT_retrievalCompareFinalScore,
    retrievalCompareInputLimit: LYRA_DEFAULT_retrievalCompareInputLimit,
    retrievalCompareLabel: LYRA_DEFAULT_retrievalCompareLabel,
    retrievalCompareOverlap: LYRA_DEFAULT_retrievalCompareOverlap,
    retrievalCompareRank: LYRA_DEFAULT_retrievalCompareRank,
    retrievalCompareRerankScore: LYRA_DEFAULT_retrievalCompareRerankScore,
    retrievalCompareResultLimit: LYRA_DEFAULT_retrievalCompareResultLimit,
    retrievalCompareSparseScore: LYRA_DEFAULT_retrievalCompareSparseScore,
    untitledSource: LYRA_DEFAULT_untitledSource,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  @state() private page = 0;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private canonicalSource?: readonly RetrievalComparisonSet[];
  private canonicalSets: RetrievalComparisonSet[] = [];
  private readonly rankedBySet = new WeakMap<RetrievalComparisonSet, RankedComparison>();
  private comparisonDeps?: readonly unknown[];
  private visibleSets: readonly RetrievalComparisonSet[] = [];
  private visibleOrdered = new Map<string, RetrievalChunk[]>();
  private visibleOverlaps: readonly ComparisonOverlap[] = [];
  private pendingFocus?: { setId?: string; chunkId?: string; pageAction?: string; origin: Element };

  private readonly rovingChunkBySet = new Map<string, string>();

  private onChunkKeyDown(event: KeyboardEvent, index: number, count: number): void {
    const buttons = (event.currentTarget as HTMLElement).closest('[part="chunks"]')
      ?.querySelectorAll<HTMLButtonElement>('[part~="chunk"]');
    const next = resolveListMove(event, {
      count, current: index, orientation: 'vertical',
      isAvailable: (candidate) => Boolean(buttons?.[candidate] && isRovingTargetAvailable(buttons[candidate]!)),
    });
    if (next === null) return;
    event.preventDefault();
    buttons?.[next]?.focus();
  }
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['sets']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-chunk-select',
  ]);

  /** Named retrieval sets, shown in internal pages of eight columns; pairwise overlap covers
   * only the current page. Every admitted set remains reachable through page controls. */
  @property({ attribute: false }) sets: readonly RetrievalComparisonSet[] = [];
  /** Maximum ranked chunks shown from each set, ordered by effective rank (an explicit `rank`,
   *  else input position) and then score. Rendering is capped at 100 per set. */
  @property({ type: Number, attribute: 'top-k' }) topK = 10;
  /** Controlled chunk id highlighted across every set that contains it. */
  @property({ attribute: 'selected-chunk-id' }) selectedChunkId = '';
  /** Semantic level of each result-set heading; `none` keeps the visible text without heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '3';
  /** Fallback name for the comparison region. Omitting it falls back to a localized default; an
   *  explicit empty string clears it. A non-empty host `aria-label` makes the host the sole
   *  overall owner; an explicitly empty host label stays empty on the region. */
  @property() label?: string;
  /** Density on the shared size scale. `s` (and the smaller `xs`/`2xs`) tightens chunk-button padding; `m` (the default) and larger keep the full padding. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Container treatment, in the shared `LyraFrame` vocabulary. `'card'` (the default) keeps each compared chunk's bordered, filled button. `'plain'` removes the border, background and corner radius from every compared chunk button, for use inside an already-bordered container. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  private readonly headingIdPrefix = nextId('retrieval-compare');

  private get effectiveTopK(): number {
    return Math.min(MAX_COMPARISON_RESULTS, Math.max(1, finiteCount(this.topK, 10)));
  }

  private get normalizedSets(): RetrievalComparisonSet[] {
    if (this.canonicalSource !== this.sets) {
      this.canonicalSource = this.sets;
      this.canonicalSets = firstByRetrievalIdentity(Array.isArray(this.sets) ? this.sets : [], set => set.id);
      const ids = new Set(this.canonicalSets.map(set => set.id));
      for (const id of this.rovingChunkBySet.keys()) if (!ids.has(id)) this.rovingChunkBySet.delete(id);
    }
    return this.canonicalSets;
  }

  private orderedChunks(set: RetrievalComparisonSet): RetrievalChunk[] {
    const cached = this.rankedBySet.get(set);
    if (cached?.topK === this.effectiveTopK) return cached.chunks;
    const ranked = firstByRetrievalIdentity(
      Array.isArray(set.chunks) ? set.chunks.filter(isValidRetrievalChunk) : [], chunk => chunk.id,
    ).map((chunk, index) => ({ chunk, index, rank: this.rank(chunk, index) }))
      .sort((a, b) => a.rank - b.rank || b.chunk.score - a.chunk.score || a.index - b.index);
    const visible = ranked.slice(0, this.effectiveTopK);
    const chunks = visible.map(({ chunk }) => chunk);
    this.rankedBySet.set(set, { topK: this.effectiveTopK, chunks, total: ranked.length,
      ranks: new Map(visible.map(entry => [entry.chunk, entry.rank])) });
    return chunks;
  }

  private updateComparison(): void {
    const sets = this.normalizedSets;
    this.page = Math.min(this.page, Math.max(0, Math.ceil(sets.length / COMPARISON_PAGE_SIZE) - 1));
    const deps = [sets, this.effectiveTopK, this.page];
    if (this.comparisonDeps && deps.every((value, index) => value === this.comparisonDeps![index])) return;
    this.comparisonDeps = deps;
    this.visibleSets = sets.slice(this.page * COMPARISON_PAGE_SIZE, (this.page + 1) * COMPARISON_PAGE_SIZE);
    this.visibleOrdered = new Map(this.visibleSets.map(set => [set.id, this.orderedChunks(set)]));
    this.visibleOverlaps = this.overlaps(this.visibleSets, this.visibleOrdered);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('sets') || changed.has('topK') || changed.has('page')) {
      const focused = shadowFocusTarget(this) as HTMLElement | null;
      const setId = focused?.closest<HTMLElement>('[data-set-id]')?.dataset['setId'];
      const chunkId = focused?.dataset['chunkId'];
      const pageAction = focused?.dataset['pageAction'];
      if (focused && pageAction) this.pendingFocus = { pageAction, origin: focused };
      if (focused && setId && chunkId && (changed.has('sets') || changed.has('topK'))) {
        const index = this.normalizedSets.findIndex(set => set.id === setId);
        if (index >= 0) this.page = Math.floor(index / COMPARISON_PAGE_SIZE);
        this.pendingFocus = { setId, chunkId, origin: focused };
      }
      if (this.hasUpdated && changed.has('sets') && publicCollectionTruncation(this, 'sets'))
        this.announcements.announcePolite(this.localize('retrievalCompareInputLimit'));
    }
    this.updateComparison();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingFocus;
    this.pendingFocus = undefined;
    if (!pending) return;
    const current = shadowFocusTarget(this);
    const outer = activeElementIn(this.ownerDocument);
    if ((current && current !== pending.origin) || (outer && outer !== this && outer !== this.ownerDocument.body)) return;
    if (pending.pageAction) {
      const pages = [...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-page-action]:not(:disabled)') ?? [])];
      const page = pages.find(button => button.dataset['pageAction'] === pending.pageAction) ?? pages[0];
      if (page) { if (current !== page) page.focus(); return; }
    }
    const buttons = [...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-chunk-id]') ?? [])];
    const target = buttons.find(button => button.dataset['chunkId'] === pending.chunkId &&
      button.closest<HTMLElement>('[data-set-id]')?.dataset['setId'] === pending.setId) ?? buttons[0] ?? this.shadowRoot?.querySelector<HTMLElement>('[part="base"]');
    if (current !== target) target?.focus();
  }

  override adoptedCallback(): void { super.adoptedCallback(); this.announcements.adopted(); }
  override disconnectedCallback(): void { this.pendingFocus = undefined; super.disconnectedCallback(); }

  private changePage(page: number): void {
    this.page = Math.max(0, Math.min(page, Math.ceil(this.normalizedSets.length / COMPARISON_PAGE_SIZE) - 1));
    this.announcements.announcePolite(this.pageText());
  }

  private pageText(): string {
    const format = getNumberFormat(this.effectiveLocale);
    return this.localize('paginationApplied', undefined, { page: format.format(this.page + 1),
      totalPages: format.format(Math.ceil(this.normalizedSets.length / COMPARISON_PAGE_SIZE)) });
  }

  private renderPagination(): TemplateResult | typeof nothing {
    const pages = Math.ceil(this.normalizedSets.length / COMPARISON_PAGE_SIZE);
    return pages > 1 ? html`<div part="pagination" role="group" aria-label=${this.localize('paginationLabel')}>
      <button part="page-button" data-page-action="first" type="button" ?disabled=${this.page === 0} @click=${() => this.changePage(0)}>${this.localize('paginationFirstPage')}</button>
      <button part="page-button" data-page-action="previous" type="button" ?disabled=${this.page === 0} @click=${() => this.changePage(this.page - 1)}>${this.localize('previous')}</button>
      <span part="page-status">${this.pageText()}</span>
      <button part="page-button" data-page-action="next" type="button" ?disabled=${this.page >= pages - 1} @click=${() => this.changePage(this.page + 1)}>${this.localize('next')}</button>
      <button part="page-button" data-page-action="last" type="button" ?disabled=${this.page >= pages - 1} @click=${() => this.changePage(pages - 1)}>${this.localize('paginationLastPage')}</button>
    </div>` : nothing;
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

  private overlaps(sets: readonly RetrievalComparisonSet[], ordered: ReadonlyMap<string, RetrievalChunk[]>): ComparisonOverlap[] {
    const summaries: ComparisonOverlap[] = [];
    const identities = sets.map(set => new Set((ordered.get(set.id) ?? []).map(chunk => chunk.id)));
    for (let leftIndex = 0; leftIndex < sets.length; leftIndex++) {
      const left = identities[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < sets.length; rightIndex++) {
        const right = identities[rightIndex]!;
        let intersection = 0;
        for (const id of left) if (right.has(id)) intersection++;
        const union = left.size + right.size - intersection;
        summaries.push({ left: sets[leftIndex]!.label, right: sets[rightIndex]!.label, ratio: union ? intersection / union : 0 });
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
    setIndex: number,
    chunks: readonly RetrievalChunk[]
  ): TemplateResult => {
    const headingId = `${this.headingIdPrefix}-set-${setIndex}`;
    const level = resolveHeadingLevel(this.headingLevel);
    const remembered = this.rovingChunkBySet.get(set.id);
    const rovingChunkId = chunks.some((chunk) => chunk.id === remembered) ? remembered : chunks[0]?.id;
    return html`
      <section part="set" data-set-id=${set.id} aria-labelledby=${headingId}>
        <div part="set-heading" id=${headingId} role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${set.label}</div>
        <ol part="chunks">
          ${repeat(chunks, chunk => chunk.id, (chunk, index) => {
            const selected = chunk.id === this.selectedChunkId;
            const rank = this.rankedBySet.get(set)?.ranks.get(chunk) ?? this.rank(chunk, index);
            const chunkPart = selected ? 'chunk chunk-selected' : 'chunk';
            const id = `${headingId}-chunk-${index}`;
            return html`
              <li>
                <button
                  part=${chunkPart}
                  data-chunk-id=${chunk.id}
                  type="button"
                  tabindex=${chunk.id === rovingChunkId ? '0' : '-1'}
                  @focus=${() => {
                    this.rovingChunkBySet.set(set.id, chunk.id);
                    if (chunk.id !== rovingChunkId) this.requestUpdate();
                  }}
                  @keydown=${(event: KeyboardEvent) => this.onChunkKeyDown(event, index, chunks.length)}
                  aria-pressed=${selected ? 'true' : 'false'}
                  aria-labelledby="${id}-rank ${id}-title"
                  aria-describedby="${id}-text ${id}-scores"
                  @click=${() =>
                    this.emit('lr-chunk-select', { setId: set.id, chunk })}
                >
                  <span part="chunk-rank" id="${id}-rank"
                    >${this.localize('retrievalCompareRank', undefined, {
                      rank: getNumberFormat(this.effectiveLocale).format(rank),
                    })}</span
                  >
                  <strong part="chunk-title" id="${id}-title"
                    >${chunk.source.name || this.localize('untitledSource')}</strong
                  >
                  <span part="chunk-text" id="${id}-text">${chunk.text}</span>
                  <span part="scores" id="${id}-scores">
                    ${this.scoreEntries(chunk).map(
                      ([scoreLabel, value]) => html`
                        <span part="score"
                          ><span>${scoreLabel}</span>
                          <span>${this.formatScore(value)}</span></span
                        >
                      `
                    )}
                  </span>
                </button>
              </li>
            `;
          })}
        </ol>
        ${(this.rankedBySet.get(set)?.total ?? 0) > chunks.length ? html`<p part="result-limit" role="note">${this.localize('retrievalCompareResultLimit', undefined, {
          shown: getNumberFormat(this.effectiveLocale).format(chunks.length),
          total: getNumberFormat(this.effectiveLocale).format(this.rankedBySet.get(set)!.total),
        })}</p>` : nothing}
      </section>
    `;
  };

  override render(): TemplateResult {
    this.updateComparison();
    const sets = this.visibleSets;
    const inputLimit = publicCollectionTruncation(this, 'sets')
      ? html`<p part="input-limit" role="note">${this.localize('retrievalCompareInputLimit')}</p>` : nothing;
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('retrievalCompareLabel') : this.label
    );
    const role = retrievalSemanticRole(this, 'region');
    if (!sets.length) {
      return html`<section
        part="base"
        tabindex="-1"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        ${inputLimit}
        <lr-empty
          part="empty"
          heading=${this.localize('retrievalCompareEmpty')}
        ></lr-empty>
      </section>`;
    }
    return html`
      <section
        part="base"
        tabindex="-1"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        ${inputLimit}
        ${this.renderPagination()}
        ${this.visibleOverlaps.map(summary => html`<p part="overlap">${this.localize('retrievalCompareOverlap', undefined, {
          left: summary.left, right: summary.right, percent: this.formatScore(summary.ratio),
        })}</p>`)}
        <div part="sets">
          ${repeat(sets, set => set.id, (set, index) =>
            this.renderSet(set, this.page * COMPARISON_PAGE_SIZE + index, this.visibleOrdered.get(set.id) ?? [])
          )}
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
