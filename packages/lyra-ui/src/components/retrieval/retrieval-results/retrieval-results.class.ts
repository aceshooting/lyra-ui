import type { LyraPageSource, LyraPageResult, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { readOwnDataValue } from '../../../internal/data-descriptors.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import { collectionSupport, publicCollectionTruncation, writeNormalizedOwnedCollection, snapshotEventDetail } from '../../../internal/collection-snapshot.js';
import { projectRetrievalChunk } from './retrieval-results-model.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  firstByRetrievalIdentity,
  canonicalIdentityList,
} from '../retrieval-identity.js';
import { finiteCount, finiteRange, finiteInteger } from '../../../internal/numbers.js';
import type { DocumentLocator, RetrievalChunk } from '../../../ai/types.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraVirtualListGroup } from '../../layout/virtual-list/virtual-list.class.js';
import { styles } from './retrieval-results.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
import { renderRetrievalMetadata } from '../retrieval-metadata.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { announceAfterFirstPaint } from '../retrieval-announcements.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraScoreThresholds } from '../../../internal/score-tiers.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chunkInspectorEmpty, LYRA_DEFAULT_chunkInspectorLabel, LYRA_DEFAULT_retrievalResultsInputLimit, LYRA_DEFAULT_retrievalResultsSelectRowOrdinal, LYRA_DEFAULT_untitledSource, LYRA_DEFAULT_valueTruncated } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_loadMore, LYRA_DEFAULT_loading, LYRA_DEFAULT_retry, LYRA_DEFAULT_sourceSelectionFailed, LYRA_DEFAULT_sourceSelectionLoading, LYRA_DEFAULT_tableLoadFailed, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraScoreThresholds } from '../../../internal/score-tiers.js';
/** The deprecated `lr-select`'s detail: the complete updated selection, both as bare ids and as one
 *  deterministic canonical `RetrievalChunk` record per id (`lr-selection-change` carries the same as
 *  `selectedChunkIds`). This contract is independent of the visible `without-dedupe` projection:
 *  duplicate rows never duplicate derived selection records. */
export interface RetrievalResultsSelectDetail {
  chunkIds: string[];
  chunks: RetrievalChunk[];
}

export interface LyraRetrievalResultsEventMap {
  'lr-selection-change': CustomEvent<
    LyraEventDetailSnapshot<{ selectedChunkIds: string[]; chunks: RetrievalChunk[] }>
  >;
  /** @deprecated Use `lr-selection-change`. */
  'lr-select': CustomEvent<
    LyraEventDetailSnapshot<RetrievalResultsSelectDetail>
  >;
  'lr-load-more': CustomEvent<null>;
  'lr-chunk-open': CustomEvent<
    LyraEventDetailSnapshot<{
      chunkId: string;
      sourceId: string;
      anchor?: DocumentLocator;
    }>
  >;
}

export type RetrievalResultsGrouping = 'source' | 'custom' | 'none';
export type RetrievalResultsPresentation = 'compact' | 'expanded';

/** Query semantics apply to the complete provider collection before paging. */
export interface RetrievalResultsSourceQuery {
  readonly sort: 'score' | 'none';
  readonly withoutDedupe: boolean;
  readonly grouping: RetrievalResultsGrouping;
  readonly groupBy: LyraRetrievalResults['groupBy'];
  readonly groupLabel: LyraRetrievalResults['groupLabel'];
  readonly groupOrder: LyraRetrievalResults['groupOrder'];
}
export type RetrievalResultsSource = LyraPageSource<RetrievalChunk, RetrievalResultsSourceQuery>;

/** `RetrievalChunk` -> `lr-chunk-inspector`'s own `LyraChunk` display-row shape, per the mapping
 *  `RetrievalChunk`'s own doc comment (`src/ai/types.ts`) already specifies: `source.id -> sourceId`,
 *  `source.name -> title`. A structured `locator` is forwarded as `anchor`; page locators also
 *  supply the inspector's visible `page` without guessing at arbitrary metadata. */
function toLyraChunk(chunk: RetrievalChunk): LyraChunk {
  return {
    id: chunk.id,
    text: chunk.text,
    score: chunk.score,
    sourceId: chunk.source.id,
    title: chunk.source.name,
    anchor: chunk.locator,
    page: chunk.locator?.kind === 'page' ? chunk.locator.page : undefined,
  };
}


function safeScore(score: number): number {
  return finiteRange(score, 0, 0, 1);
}

/**
 * `<lr-retrieval-results>` — the orchestration-level ranked-chunk-list surface: takes raw
 * `RetrievalChunk[]` (the shared retrieval-and-grounding type from `src/ai/types.ts`) and adds
 * everything a single retrieval call's result set needs beyond what one chunk's own rendering
 * provides -- canonical identity handling, optional grouping by source, multi-selection,
 * pagination/infinite loading, and a compact/expanded presentation switch -- while composing
 * existing primitives for
 * every part that already has one, never re-implementing chunk/score/source rendering itself.
 *
 * **Composition, not reinvention.** Each rendered row wraps exactly one chunk in an internal
 * `<lr-chunk-inspector>` (fed a single-element `chunks` array), reusing its score bar/tier
 * coloring, title+page rendering, expandable text, and dense `size="s"` rows verbatim -- this
 * component never hand-rolls chunk-card markup. `metadata` (arbitrary `Record<string, unknown>`,
 * which no existing primitive renders) is the one genuinely new bit of presentation here, shown as
 * a plain key/value list in `expanded` presentation only. Large result sets are windowed through an
 * internal `<lr-virtual-list>`, exactly like `<lr-thread-list>`'s own data-mode rendering -- each
 * row's rendered content therefore lives inside `<lr-virtual-list>`'s own shadow root, not this
 * component's, whenever virtualization is active (see that component's own doc for why).
 *
 * **Controlled component.** `chunks`/`selectedChunkIds`/`loading`/`errorText`/`hasMore` are all
 * host-owned;
 * without a dataSource, this component never fetches, retries, or mutates its own copy of `chunks`. Selecting a row
 * updates `selectedChunkIds` locally *then* emits `lr-selection-change` (the same "update own copy, then
 * emit; reassign to control" convention `<lr-source-picker>` already uses) so a host can either
 * accept the update as-is or override it before the next render.
 *
 * **Identity.** Blank chunk ids and later duplicates are always omitted first-wins before sorting,
 * grouping, selection, rendering, or events. The `without-dedupe` switch is retained for
 * compatibility but cannot reintroduce ambiguous duplicate identities. **Grouping**
 * (`grouping="source"`) buckets the canonical, score-sorted list by `source.id`, each bucket
 * ordered by its own best-scoring chunk first, and always renders through the internal
 * `<lr-virtual-list>` (regardless of `virtualize-at`) so group headers have a single rendering path
 * — `<lr-thread-list>`'s own date-bucket grouping takes the identical approach.
 *
 * **Pagination.** While virtualized, `has-more`/`loading` are forwarded straight to the internal
 * `<lr-virtual-list>`, which fires `lr-load-more` itself on scroll-near-bottom (re-emitted here
 * unchanged). Below the virtualization threshold (a short, non-grouped list), scrolling near the
 * bottom isn't a meaningful gesture, so a `[part="load-more"]` button takes its place instead,
 * showing a spinner in place of the button while `loading` is true.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * Input retains the first 10,000 results; the limit note reports the assigned source count.
 * Closed display fields are copied after identity admission, so nested records do not consume the
 * shared 50,000-value deep-copy budget. Replace the collection to publish source-record changes.
 *
 * With dataSource, the provider owns global sorting, deduplication, grouping and page totals.
 * Each page retains at most 500 records; required rendered text is bounded to 65,536 UTF-16 units
 * per record and locator paths to 500 segments. Oversized records fail visibly without truncating
 * their full text. Group labels come from globally computed provider metadata, never partial-page
 * callbacks. sourceTotal is unknown until an accepted response; legacy hasMore is inactive.
 * withoutDedupe permits distinct occurrence keys while row selection and events retain canonical
 * value.id. Canonical lookup must return key===value.id and complete records in global order.
 * Up to 10,000 explicit selected IDs resolve in sequential batches of at most 500; page/query/retry
 * changes retain their independent cache. Failed selection remains pending user intent until
 * retried, without partial events. External assignments and reconnect reconciliation are silent.
 * Active IDs locate once; manual page navigation does not reapply an unchanged active ID.
 * Same-source assignment or requestUpdate() refreshes; named paints retain pages and selection.
 * Source selection events freeze the complete record sequence and projected record fields while
 * retaining opaque metadata identity. Legacy events retain their complete-detail deep snapshot
 * and its existing failure budget. Removing dataSource restores the legacy chunks route.
 *
 * @csspart source-status - Provider loading or failure text.
 * @csspart source-retry - Failed provider page retry button.
 * @csspart source-pagination - Provider page navigation.
 * @csspart source-selection-status - Canonical selected-record loading or failure text.
 * @csspart source-selection-retry - Failed canonical selection lookup retry button.
 * @customElement lr-retrieval-results
 * @event lr-selection-change - The selected-chunk set changed. `detail: { selectedChunkIds, chunks }` —
 * `selectedChunkIds` is the complete updated selection (not just the toggled id), `chunks` the
 * matching canonical `RetrievalChunk` records.
 * @event lr-select - Deprecated alias of `lr-selection-change` (`detail: { chunkIds, chunks }`),
 * dispatched right after it.
 * @event lr-load-more - More results were requested — via the internal `<lr-virtual-list>`'s own
 * scroll-near-bottom detection while virtualized, or the built-in `[part="load-more"]` button
 * otherwise. Only ever fires while `has-more` is true and `loading` is false.
 * @event lr-chunk-open - A row's title/open button was activated, forwarded verbatim from the
 * per-row `<lr-chunk-inspector>`'s own `lr-chunk-open`; the inspector's `lr-chunk-toggle` and the
 * virtual list's scroll events stay inside. `detail: { chunkId, sourceId, anchor? }` — the
 * event a host routes into `<lr-document-viewer>`.
 * @csspart base - The outer container and programmatic focus fallback when a controlled
 * collection/state transition removes every focused result action.
 * @csspart error - The neutral, visible error message shown while `errorText` is non-empty. New
 *   non-empty errors are announced through a shared assertive light-DOM region; initial and
 *   reconnect content is not replayed unless `announce` is set, which reads the state present at
 *   first mount once.
 * @csspart spinner - The initial-load `<lr-spinner>`, shown while `loading` is true and `chunks`
 * is still empty.
 * @csspart empty - The `<lr-empty>` wrapper, shown when `chunks` is empty and neither `errorText` nor
 * `loading` is set. A later transition into this settled state is announced through a shared
 * polite light-DOM region; initial and reconnect content is not replayed unless `announce` is set,
 * which reads the state present at first mount once.
 * @csspart row - One result row's wrapper. Below the virtualization threshold this is a plain,
 * directly-styleable element in this component's own shadow root; while virtualized it is exported
 * from the internal `<lr-virtual-list>`'s own `row` part instead (`::part(row)` still reaches it
 * either way).
 * @csspart group-header - Exported from the internal `<lr-virtual-list>`'s `group` part —
 * grouped/virtualized mode only.
 * @csspart select - The per-row `<lr-checkbox>`, omitted entirely while `withoutSelection` is set.
 * @csspart row-body - The wrapper around a row's `<lr-chunk-inspector>` plus its optional
 * metadata list; carries `data-selected` while that row is selected.
 * @csspart row-body-selected - Additional part on a selected `row-body`. State is exposed as a
 * second part name because Shadow Parts forbids an attribute selector after `::part()` —
 * `::part(row-body)[data-selected]` is invalid CSS, and while virtualized `::part()` is the only
 * way in. A state part is a second token in the same `part` attribute, so a `[part~="…"]` (not
 * `[part="…"]`) selector is the one that matches inside a tree.
 * @csspart limit - Notice that only the first 10,000 input results were retained.
 * @csspart metadata - The `<dl>` of a chunk's `metadata` entries — omitted entirely when a chunk
 * has no `metadata`, or while `presentation="compact"`.
 * @csspart metadata-entry - One metadata key/value pair's wrapper.
 * @csspart metadata-term - The `<dt>` carrying a metadata key. Named separately because
 * `::part()` matches one element and cannot be followed into its subtree.
 * @csspart metadata-value - The `<dd>` carrying a metadata value.
 * @csspart chunk - The per-row `<lr-chunk-inspector>`'s own `chunk` row.
 * @csspart chunk-current - The row `<lr-chunk-inspector>`'s current-chunk state part.
 * @csspart chunk-score - The row chunk's percent-score line.
 * @csspart chunk-score-current - The current row chunk's score line.
 * @csspart chunk-score-bar - The row chunk's score bar track.
 * @csspart chunk-score-fill - The row chunk's score bar fill.
 * @csspart chunk-score-fill-success - The row chunk's score fill in the high-score tier.
 * @csspart chunk-score-fill-warning - The row chunk's score fill in the medium-score tier.
 * @csspart chunk-score-fill-danger - The row chunk's score fill in the low-score tier.
 * @csspart chunk-open-button - The row chunk's title/open `<button>`.
 * @csspart chunk-title - The row chunk's visible title text.
 * @csspart chunk-text - The row chunk's text preview (`presentation="expanded"` only).
 * @csspart chunk-text-clamped - The row chunk's text preview while still collapsed.
 * @csspart chunk-toggle - The row chunk's "Show more"/"Show less" button.
 * @csspart load-more-row - The wrapper around the non-virtualized-mode pagination footer.
 * @csspart load-more - The "Load more" button itself (non-virtualized mode, `loading` false).
 * @cssprop [--lr-retrieval-results-selected-border=var(--lr-color-brand)] - Inline-start border
 *   color marking a selected `[part="row-body"]`. A border rather than a fill by design (see the
 *   styles file), so recoloring it carries no contrast risk for the row's own text.
 * @status stable
 * @since 4.1.0
 */
export class LyraRetrievalResults extends LyraElement<LyraRetrievalResultsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chunkInspectorEmpty: LYRA_DEFAULT_chunkInspectorEmpty,
    chunkInspectorLabel: LYRA_DEFAULT_chunkInspectorLabel,
    loadMore: LYRA_DEFAULT_loadMore,
    loading: LYRA_DEFAULT_loading,
    retrievalResultsInputLimit: LYRA_DEFAULT_retrievalResultsInputLimit,
    retrievalResultsSelectRowOrdinal: LYRA_DEFAULT_retrievalResultsSelectRowOrdinal,
    retry: LYRA_DEFAULT_retry,
    sourceSelectionFailed: LYRA_DEFAULT_sourceSelectionFailed,
    sourceSelectionLoading: LYRA_DEFAULT_sourceSelectionLoading,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
    untitledSource: LYRA_DEFAULT_untitledSource,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
    valueTruncated: LYRA_DEFAULT_valueTruncated,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly identityCollectionProperties = Object.freeze(['chunks']);

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'chunks',
    'selectedChunkIds',
    'groupOrder',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-selection-change',
    'lr-select',
    'lr-chunk-open',
  ]);

  /** Canonical source records are frozen projections with opaque metadata. Legacy details are
   * detached as one complete snapshot before entering this identity-preserving envelope. */
  protected static override readonly identityEventDetailCollectionItems = Object.freeze({
    'lr-selection-change': Object.freeze(['chunks']),
    'lr-select': Object.freeze(['chunks']),
  });

  private _dataSource?: RetrievalResultsSource;
  private sourceEpoch = 0;
  private sourceVersion = 0;
  private sourceLifecycle = 0;
  private sourceSyncing = false;
  private sourceInputs?: readonly unknown[];
  private sourceQueryInputs?: readonly unknown[];
  private sourceResult?: LyraPageResult<RetrievalChunk>;
  private sourceRows: readonly RetrievalChunk[] = [];
  private sourceGroups: LyraVirtualListGroup[] = [];
  private sourceSelectionInputs?: readonly unknown[];
  private sourceSelectionEvent?: readonly string[];
  private sourceSelectionFailed = false;
  private sourceActiveInputs?: readonly unknown[];
  private sourceReveal?: { id: string; version: number };
  private sourceAdapter?: { original: RetrievalResultsSource; adapter: RetrievalResultsSource };
  private readonly sourceRowKeys = new WeakMap<RetrievalChunk, string>();
  @state() private sourceStateVersion = 0;
  private readonly sourcePages = new SourcePageController<RetrievalChunk, RetrievalResultsSourceQuery>(this, {
    normalizeRecord: (record, isCurrent) => this.projectSourceChunk(record, isCurrent),
    validateMetadata: (result, query) => this.validateSourcePage(result, query),
    onChange: () => { this.sourceStateVersion++; },
  });

  /** Full-source provider; a present invalid source fails visibly instead of using chunks.
   * Reassign the same provider or call requestUpdate() to refresh its revision/cache. */
  @property({ attribute: false })
  get dataSource(): RetrievalResultsSource | undefined { return this._dataSource; }
  set dataSource(value: RetrievalResultsSource | undefined) {
    const old = this._dataSource; this._dataSource = value; this.sourceEpoch++;
    this.requestUpdate('dataSource', old);
  }
  /** Zero-based provider page. */
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Provider records per page, normalized to 1..500; changing size resets page 0. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Current query total, or null before success/without a source. */
  get sourceTotal(): number | null { return this.sourceMode ? this.sourcePages.state.result?.total ?? null : null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }
  private get sourceBlocked(): boolean { return this.sourceMode && (!this.isConnected || !!this.errorText || this.sourcePages.state.pending || !this.sourcePages.state.result); }
  private get sourceSelectionBlocked(): boolean { return this.sourceBlocked || (this.sourceMode && (this.sourcePages.state.selectionPending || this.sourceSelectionFailed)); }

  private projectSourceChunk(record: LyraSourceRecord<unknown>, isCurrent: () => boolean): LyraSourceRecord<RetrievalChunk> {
    let units = 0;
    const read = (input: object, key: string): unknown => {
      if (!isCurrent()) throw new Error('Obsolete source chunk');
      const value = readOwnDataValue(input, key);
      if (!isCurrent()) throw new Error('Obsolete source chunk');
      return value;
    };
    const fields = (input: unknown, keys: readonly string[]): Record<string, unknown> => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid source chunk');
      const copy: Record<string, unknown> = {};
      for (const key of keys) {
        const value = read(input, key);
        if (typeof value === 'string') {
          units += value.length;
          if (value.length > 65_536 || units > 65_536) throw new RangeError('Source chunk text too large');
        }
        if (value !== undefined) copy[key] = value;
      }
      return copy;
    };
    const raw = fields(record.value, ['id', 'text', 'score', 'metadata', 'rank', 'queryId', 'stage', 'traceId', 'scores']);
    raw['source'] = fields(read(record.value as object, 'source'), ['id', 'name', 'mimeType', 'uri', 'version']);
    const locator = read(record.value as object, 'locator');
    if (locator !== undefined) {
      const projected = fields(locator, ['kind', 'page', 'quote', 'prefix', 'suffix', 'id', 'start', 'end', 'sheet', 'range', 'cfi']);
      for (const key of ['kind', 'quote', 'prefix', 'suffix', 'id', 'sheet', 'range', 'cfi']) {
        if (projected[key] !== undefined && typeof projected[key] !== 'string') throw new TypeError('Invalid source locator text');
      }
      for (const key of ['page', 'start', 'end']) {
        if (projected[key] !== undefined && (typeof projected[key] !== 'number' || !Number.isFinite(projected[key]))) throw new TypeError('Invalid source locator number');
      }
      const rect = read(locator as object, 'rect');
      if (rect !== undefined) {
        const coordinates = fields(rect, ['x', 'y', 'width', 'height']);
        for (const key of ['x', 'y', 'width', 'height']) {
          if (typeof coordinates[key] !== 'number' || !Number.isFinite(coordinates[key])) throw new TypeError('Invalid source locator rectangle');
        }
        projected['rect'] = coordinates;
      }
      const path = read(locator as object, 'path');
      if (path !== undefined) {
        if (!Array.isArray(path)) throw new TypeError('Invalid source locator path');
        const length = read(path, 'length');
        if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 500) throw new RangeError('Source locator path too large');
        projected['path'] = Array.from({ length }, (_, index) => {
          const value = read(path, String(index));
          if (typeof value !== 'string' && typeof value !== 'number') throw new TypeError('Invalid source locator path');
          if (typeof value === 'string') { units += value.length; if (units > 65_536) throw new RangeError('Source chunk text too large'); }
          return value;
        });
      }
      raw['locator'] = projected;
    }
    const scores = raw['scores'];
    if (scores && typeof scores === 'object' && !Array.isArray(scores)) raw['scores'] = fields(scores, ['dense', 'sparse', 'rerank', 'final']);
    const value = projectRetrievalChunk(raw);
    if (!isCurrent()) throw new Error('Obsolete source chunk');
    if (!value) throw new TypeError('Invalid source chunk');
    this.sourceRowKeys.set(value, record.key);
    return { key: record.key, order: record.order, value };
  }

  private validateSourcePage(result: LyraPageResult<RetrievalChunk>, query: RetrievalResultsSourceQuery): void {
    if (!query.withoutDedupe && result.rows.some(record => record.key !== record.value.id)) throw new TypeError('Invalid canonical source identity');
    if (query.grouping === 'none') { if (result.groups?.length) throw new TypeError('Unexpected source groups'); return; }
    if (!result.groups) throw new TypeError('Missing source groups');
    if (!result.rows.length) return;
    const size = this.sourcePages.state.pageSize;
    const start = Math.min(this.sourcePages.state.page, Math.floor((result.total - 1) / size)) * size;
    const end = start + result.rows.length;
    let covered = start; let previousEnd = -1;
    for (const group of result.groups) {
      if (group.startIndex < previousEnd || Math.max(start, group.startIndex) !== covered) throw new TypeError('Invalid source group coverage');
      previousEnd = group.startIndex + group.itemCount;
      covered = Math.min(end, previousEnd);
    }
    if (covered !== end) throw new TypeError('Incomplete source groups');
  }

  private canonicalSourceAdapter(source: RetrievalResultsSource): RetrievalResultsSource {
    if (this.sourceAdapter?.original === source) return this.sourceAdapter.adapter;
    if (!source || typeof source.query !== 'function' || typeof source.lookup !== 'function' || typeof source.locate !== 'function') throw new TypeError('Invalid source');
    const adapter: RetrievalResultsSource = {
      revision: source.revision,
      query: request => source.query(request),
      locate: (key, query, context) => source.locate(key, query, context),
      lookup: async (keys, context) => {
        const records = await source.lookup(keys, context);
        if (!Array.isArray(records) || records.length > 500) throw new TypeError('Invalid canonical lookup');
        for (let index = 0; index < records.length; index++) {
          const record = readOwnDataValue(records, String(index));
          const key = readOwnDataValue(record as object, 'key');
          const value = readOwnDataValue(record as object, 'value');
          if (key !== readOwnDataValue(value as object, 'id')) throw new TypeError('Invalid canonical lookup identity');
        }
        return records;
      },
    };
    this.sourceAdapter = { original: source, adapter }; return adapter;
  }

  private syncSource(force = false): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    try {
      if (!this.sourceMode) {
        if (this.sourceInputs) { this.sourceVersion++; this.focusRestoreGeneration++; this.sourcePages.bind(undefined); this.processedChunksCache = undefined; }
        this.sourceInputs = undefined; this.sourceQueryInputs = undefined; this.sourceResult = undefined;
        this.sourceRows = []; this.sourceGroups = []; this.sourceSelectionInputs = undefined; this.sourceSelectionEvent = undefined;
        this.sourceActiveInputs = undefined; this.sourceReveal = undefined; return;
      }
      const source = this.dataSource!;
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      let page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      const queryInputs = [this.sort, this.withoutDedupe, this.grouping, this.groupBy, this.groupLabel, this.groupOrder, size];
      if (this.hasUpdated && this.sourceQueryInputs && queryInputs.some((value, index) => value !== this.sourceQueryInputs![index])) { page = 0; this.sourcePage = 0; }
      this.sourceQueryInputs = queryInputs;
      const inputs = [source, source.revision, this.sourceEpoch, this.effectiveLocale, ...queryInputs, page];
      if (!force && this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index])) return;
      if (!this.sourceInputs || inputs.slice(0, 3).some((value, index) => value !== this.sourceInputs![index])) {
        this.sourceSelectionInputs = undefined; this.sourceSelectionEvent = undefined;
      }
      this.sourceInputs = inputs; this.sourceVersion++; this.focusRestoreGeneration++;
      this.sourceRows = []; this.sourceGroups = []; this.sourceResult = undefined; this.sourceReveal = undefined;
      this.expandedChunkIds = [];
      this.sourcePages.bind({ source: this.canonicalSourceAdapter(source), revision: source.revision, epoch: this.sourceEpoch, locale: this.effectiveLocale });
      const query: RetrievalResultsSourceQuery = Object.freeze({ sort: this.sort, withoutDedupe: this.withoutDedupe,
        grouping: this.grouping, groupBy: this.groupBy, groupLabel: this.groupLabel, groupOrder: this.groupOrder });
      void this.sourcePages.request(query, page, size);
    } catch {
      this.sourcePages.bind(undefined); this.sourceRows = []; this.sourceGroups = []; this.sourceResult = undefined;
    } finally { this.sourceSyncing = false; }
  }

  private syncSourceSelection(): void {
    if (!this.sourceMode || !this.isConnected || !this.sourceAdapter || !this.sourceInputs) return;
    const ids = this.selectedChunkIds;
    const source = this.dataSource!;
    const epoch = this.sourceEpoch; const revision = source.revision;
    const inputs = [source, revision, epoch, ids];
    if (this.sourceSelectionInputs && inputs.every((value, index) => value === this.sourceSelectionInputs![index])) return;
    this.sourceSelectionInputs = inputs; this.sourceSelectionFailed = false;
    const owner = this.ownerDocument; const lifecycle = this.sourceLifecycle;
    const canonicalIds = canonicalIdentityList(ids);
    void this.sourcePages.resolveSelection(canonicalIds).then(records => {
      const completedRevision = source.revision;
      if (completedRevision !== revision || lifecycle !== this.sourceLifecycle || !this.isConnected || this.ownerDocument !== owner || this.dataSource !== source || this.sourceEpoch !== epoch || this.selectedChunkIds !== ids) return;
      if (!records) { this.sourceSelectionFailed = true; this.sourceStateVersion++; return; }
      const retained = new Set(records.map(record => record.key));
      const accepted = canonicalIds.filter(id => retained.has(id));
      const report = this.sourceSelectionEvent === ids;
      this.sourceSelectionEvent = undefined;
      if (accepted.length !== ids.length) this.selectedChunkIds = accepted;
      const committed = this.selectedChunkIds;
      if (report) {
        const chunks = records.map(record => record.value);
        this.emit('lr-selection-change', { selectedChunkIds: [...committed], chunks });
        const aliasRevision = source.revision;
        if (aliasRevision === revision && lifecycle === this.sourceLifecycle && this.isConnected && this.ownerDocument === owner && this.dataSource === source && this.sourceEpoch === epoch && this.selectedChunkIds === committed) this.emit('lr-select', { chunkIds: [...committed], chunks });
      }
      this.sourceStateVersion++;
    });
  }

  private acceptSourcePage(): void {
    const result = this.sourcePages.state.result;
    if (!result || result === this.sourceResult) return;
    this.sourceResult = result; this.sourceRows = result.rows.map(record => record.value);
    const start = this.sourcePages.state.page * this.sourcePages.state.pageSize;
    this.sourceGroups = (result.groups ?? []).map(group => ({ key: group.key, label: group.label, startIndex: Math.max(0, group.startIndex - start) }));
    if (this.sourcePage !== this.sourcePages.state.page) {
      this.sourceSyncing = true; this.sourcePage = this.sourcePages.state.page; this.sourceSyncing = false;
      this.sourceInputs = this.sourceInputs ? [...this.sourceInputs.slice(0, -1), this.sourcePages.state.page] : undefined;
    }
    const reveal = this.sourceReveal; this.sourceReveal = undefined;
    if (reveal?.version === this.sourceVersion) this.revealSourceActive(reveal.id, reveal.version);
  }

  private syncSourceActive(): void {
    if (!this.activeChunkId) { this.sourceActiveInputs = undefined; return; }
    if (this.sourceBlocked) return;
    const source = this.dataSource!; const id = this.activeChunkId;
    const inputs = [source, source.revision, this.sourceEpoch, this.effectiveLocale, ...(this.sourceQueryInputs ?? []), id];
    if (this.sourceActiveInputs && inputs.every((value, index) => value === this.sourceActiveInputs![index])) return;
    this.sourceActiveInputs = inputs;
    const version = this.sourceVersion; const owner = this.ownerDocument;
    void this.sourcePages.locate(id).then(index => {
      if (index === null || !this.isConnected || this.ownerDocument !== owner || !this.sourceMode || this.dataSource !== source || this.sourceVersion !== version || this.activeChunkId !== id) return;
      const page = Math.floor(index / finiteInteger(this.sourcePageSize, 100, 1, 500));
      if (page === this.sourcePage) { this.revealSourceActive(id, version); return; }
      this.sourcePage = page; this.sourceReveal = { id, version: this.sourceVersion };
    });
  }

  private revealSourceActive(id: string, version: number): void {
    const owner = this.ownerDocument;
    void this.updateComplete.then(async () => {
      const list = this.renderRoot.querySelector<LyraVirtualList>(tag('virtual-list'));
      if (!list) return;
      await list.updateComplete;
      if (!this.isConnected || this.ownerDocument !== owner || !this.sourceMode || this.sourceBlocked || this.sourceVersion !== version || this.activeChunkId !== id || list !== this.renderRoot.querySelector(tag('virtual-list'))) return;
      const index = this.sourceRows.findIndex(chunk => chunk.id === id);
      if (index >= 0) list.scrollToIndex(index, { align: 'auto', behavior: 'auto' });
    });
  }

  private currentSourceRow(chunk: RetrievalChunk): boolean {
    return !(this.sourceMode || this.sourceRowKeys.has(chunk)) || (this.sourceMode && !this.sourceBlocked && this.sourceRows.includes(chunk));
  }

  private invalidateSourceLifecycle(): void {
    this.sourceLifecycle++; this.sourceVersion++; this.focusRestoreGeneration++;
    this.sourceSelectionInputs = undefined; this.sourceSelectionEvent = undefined;
    this.sourceActiveInputs = undefined; this.sourceReveal = undefined;
    this.sourceStatusInitialized = false; this.sourceStatus = '';
  }

  override adoptedCallback(): void {
    this.invalidateSourceLifecycle(); this.sourcePages.adopted(); super.adoptedCallback();
  }

  /** The raw (not deduplicated/sorted/grouped) result set. Host-owned. Assign a new array to update: mutating an array and assigning it again does not. */
  @property({ attribute: false }) chunks: readonly RetrievalChunk[] = [];

  /** Controlled selection, by chunk `id`. The component updates its own copy on toggle *then*
   *  emits `lr-selection-change`; reassign to control. An id with no matching chunk is harmless -- it simply
   *  never renders a checked row. */
  @property({ attribute: false }) selectedChunkIds: readonly string[] = [];

  /** Omits the per-row `<lr-checkbox>`. */
  @property({ type: Boolean, attribute: 'without-selection', reflect: true })
  withoutSelection = false;

  /** Legacy chunks remain first-wins. In source mode, permits distinct occurrence keys for rows
   * sharing a canonical value.id; selection and active IDs still use the canonical ID. */
  @property({ type: Boolean, attribute: 'without-dedupe', reflect: true })
  withoutDedupe = false;

  /** `'score'` (default) sorts the canonical list descending by `score`; `'none'` preserves
   *  `chunks`' own given order. */
  @property() sort: 'score' | 'none' = 'score';

  /** `'source'` buckets rows under a header per `source.id` (always rendered through the internal
   *  `<lr-virtual-list>`, regardless of `virtualize-at`); `'custom'` buckets them under whatever key
   *  `groupBy` returns; `'none'` (default) is a flat ranked list. */
  @property() grouping: RetrievalResultsGrouping = 'none';

  /** `grouping="custom"`: derives an arbitrary group id for every visible chunk (a date bucket, a
   *  relevance tier, a domain-specific bucket). Left unset, `'custom'` degrades to a flat list
   *  rather than inventing a key, so the built-in identity/sort/virtualization pipeline stays usable
   *  either way. Mirrors `<lr-thread-list>`'s identical escape hatch. */
  @property({ attribute: false }) groupBy?: (chunk: RetrievalChunk) => string;

  /** `grouping="custom"`: renders a group's header label from its id and the chunks in it. Left
   *  unset, the group id is shown verbatim. */
  @property({ attribute: false }) groupLabel?: (
    id: string,
    chunks: RetrievalChunk[]
  ) => string;

  /** `grouping="custom"`: explicit group-id order, or a comparator. Ids missing from an array
   *  follow in their first-seen order. */
  @property({ attribute: false }) groupOrder?:
    | readonly string[]
    | ((a: string, b: string) => number);

  /** `'expanded'` (default) shows each chunk's full `<lr-chunk-inspector>` row (score bar, text
   *  preview with its own expand toggle) plus any `metadata`; `'compact'` shows title + score bar
   *  only, on both. */
  @property() presentation: RetrievalResultsPresentation = 'expanded';

  /** Forwarded verbatim to every per-row `<lr-chunk-inspector>`'s own `thresholds`. */
  @property({ attribute: false }) thresholds: LyraScoreThresholds = {
    high: 0.75,
    medium: 0.5,
  };

  /** Above this many rows (after identity canonicalization, before grouping), rendering switches
   *  from a plain list to the internal `<lr-virtual-list>`. Grouped mode always virtualizes
   *  regardless of this value. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 50;

  /** Marks the chunk currently open in a viewer -- forwarded to each per-row `<lr-chunk-inspector>`
   *  and to the internal `<lr-virtual-list>` (which scrolls the matching row into view). */
  @property({ attribute: 'active-chunk-id' }) activeChunkId = '';

  /** Marks retrieval as pending, selecting the initial spinner or load-more progress state. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** While virtualized, forwarded to the internal `<lr-virtual-list>` so scrolling near the bottom
   *  fires `lr-load-more`; otherwise shows the built-in `[part="load-more"]` footer. */
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore =
    false;

  /** Non-empty replaces the entire result view with a neutral, visible error message -- caller-
   *  supplied text, not routed through `localize()` (the same stance `<lr-document-preview>`'s own
   *  `error-text` takes for the same reason: this is app/network data, not library copy). New
   *  non-empty values are announced through a shared assertive light-DOM region; initial and
   *  reconnect content is not replayed unless `announce` is set. */
  @property({ attribute: 'error-text' }) errorText = '';

  /** Opts this panel into announcing the state it is already presenting the first time it mounts:
   *  the verbatim `errorText` assertively, or, with no error and nothing loading, the localized
   *  empty-result message politely. Set it where the panel is rendered in response to a retrieval
   *  the user just ran and nothing else reports the outcome; leave it unset for a panel that is
   *  part of the page a user is arriving on, whose visible error or empty state is already read
   *  in document order. Read once, when the panel first mounts: a later reconnection or adoption
   *  stages the existing state again rather than replaying it, and later transitions are
   *  announced either way. A panel that already has chunks announces nothing -- rendered results
   *  are ordinary content. Remove any host `role="status"`/`role="alert"` hand-added before this
   *  property existed once it is set -- otherwise the initial state is announced twice, through
   *  the native role and again through the shared sink. */
  @property({ type: Boolean, reflect: true }) announce = false;

  /** Fallback name for the results region. Omitting it falls back to the localized
   *  `chunkInspectorLabel` ("Retrieved chunks") -- reused rather than a new key, since it already
   *  says exactly what this region is. An explicit empty string clears the fallback. A non-empty
   *  host `aria-label` makes the host the sole overall owner; an explicitly empty host label stays
   *  empty on the region. */
  @property() label?: string;

  /** Chunk ids whose text is expanded, owned here so a row keeps it across scrolling and re-sorting. */
  @state() private expandedChunkIds: readonly string[] = [];
  private pendingFocusTarget: string | 'base' | undefined;
  private previousProcessedChunkIds: string[] = [];
  private focusRestoreGeneration = 0;
  private isMounting = true;
  private initialStateAnnounced = false;
  private connectionGeneration = 0;
  private errorAnnouncementSink?: AnnouncementSink;
  private emptyAnnouncementSink?: AnnouncementSink;
  private readonly retrievalChunkKey = (item: unknown): string => this.sourceRowKeys.get(item as RetrievalChunk) ?? (item as RetrievalChunk).id;
  private wasEmptyPresented = false;
  // Memoizes `computeProcessedChunks()` (identity + sort + group) for the current render cycle.
  // `willUpdate()` refreshes it exactly once whenever an input it actually depends on (`chunks`,
  // `withoutDedupe`, `sort`, `grouping`) changed, so `updated()` and `render()` each read the same
  // already-computed result instead of independently repeating the full identity/sort/group work.
  private processedChunksCache?: {
    chunks: readonly RetrievalChunk[];
    groups: LyraVirtualListGroup[];
  };
  private processedGroupingLocaleSignature = '';
  private explicitRefresh = false;

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) { this.explicitRefresh = true; this.sourceEpoch = (this.sourceEpoch ?? 0) + 1; }
    if (args[0] === 'selectedChunkIds') this.sourceSelectionEvent = undefined;
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize', 'sort', 'withoutDedupe', 'grouping', 'groupBy', 'groupLabel', 'groupOrder'].includes(String(args[0]))) this.syncSource();
    super.requestUpdate(...args);
  }

  private canonicalSource?: readonly RetrievalChunk[];
  private canonicalCache: RetrievalChunk[] = [];
  private canonicalById = new Map<string, RetrievalChunk>();
  private canonicalOrder = new Map<string, number>();
  private ordinalSource?: readonly RetrievalChunk[];
  private ordinalById = new Map<string, number>();
  private limitInitialized = false;
  private previouslyInputTruncated = false;

  private inputLimitText(): string {
    if (this.sourceMode) return '';
    const truncation = publicCollectionTruncation(this, 'chunks');
    const number = getNumberFormat(this.effectiveLocale);
    return truncation ? this.localize('retrievalResultsInputLimit', undefined, {
      count: number.format(truncation.retained), total: number.format(truncation.source),
    }) : '';
  }

  private renderInputLimit(): TemplateResult | typeof nothing {
    const text = this.inputLimitText();
    return text ? html`<p part="limit" role="note">${text}</p>` : nothing;
  }


  override connectedCallback(): void {
    super.connectedCallback();
    this.errorAnnouncementSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    this.emptyAnnouncementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    const generation = ++this.connectionGeneration;
    void announceAfterFirstPaint(
      this,
      () => generation === this.connectionGeneration,
      () => {
        if (!this.announce || this.initialStateAnnounced) return;
        this.initialStateAnnounced = true;
        this.announcePresentedState();
      }
    );
  }

  override disconnectedCallback(): void {
    this.invalidateSourceLifecycle();
    this.isMounting = true;
    this.connectionGeneration += 1;
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
    this.emptyAnnouncementSink?.release();
    this.emptyAnnouncementSink = undefined;
    this.wasEmptyPresented = false;
    super.disconnectedCallback();
  }

  private deepActiveElement(): Element | null {
    return deepActiveElementIn(this.isConnected ? this.shadowRoot : null);
  }

  private chunkAnchor(start: Element | null): Element | null {
    let current = start;
    while (current && current !== this) {
      if (current.hasAttribute('data-chunk-id')) return current;
      if (current.parentElement) {
        current = current.parentElement;
        continue;
      }
      const root = current.getRootNode();
      current =
        root.nodeType === 11 && 'host' in root
          ? (root as ShadowRoot).host
          : null;
    }
    return null;
  }

  private renderedChunkIds(): string[] {
    const roots: ParentNode[] = [this.renderRoot];
    const virtualList = this.renderRoot.querySelector(tag('virtual-list'));
    if (virtualList?.shadowRoot) roots.push(virtualList.shadowRoot);
    return roots.flatMap((root) =>
      [...root.querySelectorAll(`${tag('chunk-inspector')}[data-chunk-id]`)]
        .map((element) => element.getAttribute('data-chunk-id'))
        .filter((id): id is string => id !== null)
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    this.syncSource();
    if (this.sourceMode) { this.acceptSourcePage(); this.syncSourceSelection(); this.syncSourceActive(); return; }
    const refresh = this.explicitRefresh;
    this.explicitRefresh = false;
    const groupingLocaleSignature =
      this.grouping === 'source'
        ? `${this.effectiveLocale}\u0000${this.localize('untitledSource')}`
        : '';
    // Only the identity/sort/group inputs actually affect the processed chunk pipeline --
    // an unrelated update (e.g. `selectedChunkIds`, `presentation`) leaves the cache as-is.
    if (
      this.processedChunksCache === undefined ||
      refresh ||
      changed.has('chunks') ||
      changed.has('withoutDedupe') ||
      changed.has('sort') ||
      changed.has('grouping') ||
      changed.has('groupBy') ||
      changed.has('groupLabel') ||
      changed.has('groupOrder') ||
      groupingLocaleSignature !== this.processedGroupingLocaleSignature
    ) {
      this.processedGroupingLocaleSignature = groupingLocaleSignature;
      this.processedChunksCache = this.computeProcessedChunks();
    }
    if (changed.has('chunks')) {
      const present = new Set(this.processedChunks.chunks.map((chunk) => chunk.id));
      const kept = this.expandedChunkIds.filter((id) => present.has(id));
      if (kept.length !== this.expandedChunkIds.length) this.expandedChunkIds = kept;
    }
    if (changed.has('chunks') || changed.has('selectedChunkIds')) {
      const normalized = this.normalizedSelectedChunkIds();
      if (
        normalized.length !== this.selectedChunkIds.length ||
        normalized.some((id, index) => id !== this.selectedChunkIds[index])
      ) {
        // A `chunks` reassignment dropping previously-selected ids is a self-mutation of public
        // state (`selectedChunkIds`), not just an internal cache repair -- without `lr-selection-change`, a
        // host's own external copy of `selectedChunkIds` silently diverges with no way to resync.
        // Skipped on `selectedChunkIds` alone (an explicit controlled write already reflects the
        // caller's own intent) and on the very first update (nothing to resync yet).
        const shouldAnnounce = this.hasUpdated && changed.has('chunks');
        writeNormalizedOwnedCollection(this, 'selectedChunkIds', () => {
          this.selectedChunkIds = normalized;
        });
        if (shouldAnnounce) this.reportSelection(normalized);
      }
    }
    if (
      !changed.has('chunks') &&
      !changed.has('withoutDedupe') &&
      !changed.has('sort') &&
      !changed.has('grouping') &&
      !changed.has('groupBy') &&
      !changed.has('groupLabel') &&
      !changed.has('groupOrder') &&
      !changed.has('presentation') &&
      !changed.has('withoutSelection') &&
      !changed.has('virtualizeAt') &&
      !changed.has('loading') &&
      !changed.has('errorText')
    ) {
      return;
    }
    const anchor = this.chunkAnchor(this.deepActiveElement());
    const focusedId = anchor?.getAttribute('data-chunk-id');
    if (!focusedId) return;
    const previousIds = this.previousProcessedChunkIds.length
      ? this.previousProcessedChunkIds
      : this.renderedChunkIds();
    const focusedIndex = Math.max(0, previousIds.indexOf(focusedId));
    const nextChunks = this.errorText ? [] : this.processedChunks.chunks;
    if (nextChunks.length === 0) {
      this.pendingFocusTarget = 'base';
      return;
    }
    const survivingIndex = nextChunks.findIndex(
      (chunk) => chunk.id === focusedId
    );
    const nextIndex =
      survivingIndex >= 0
        ? survivingIndex
        : Math.min(focusedIndex, nextChunks.length - 1);
    this.pendingFocusTarget = nextChunks[nextIndex]!.id;
  }

  private sourceStatusInitialized = false;
  private sourceStatus = '';

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (this.sourceMode) {
      const status = this.sourcePages.state.pending ? this.localize('loading') : !this.sourcePages.state.result ? this.localize('tableLoadFailed')
        : this.sourcePages.state.selectionPending ? this.localize('sourceSelectionLoading') : this.sourceSelectionFailed ? this.localize('sourceSelectionFailed') : '';
      if (this.sourceStatusInitialized && status && status !== this.sourceStatus) this.emptyAnnouncementSink?.announce(status);
      this.sourceStatusInitialized = true; this.sourceStatus = status; return;
    }
    const inputTruncated = publicCollectionTruncation(this, 'chunks') !== undefined;
    if (this.limitInitialized && inputTruncated && !this.previouslyInputTruncated) {
      this.emptyAnnouncementSink?.announce(this.inputLimitText());
    }
    this.limitInitialized = true;
    this.previouslyInputTruncated = inputTruncated;

    const wasMounting = this.isMounting;
    this.isMounting = false;
    // Either live branch below retires the still-pending opt-in mount announcement: without the
    // latch, a transition landing between the first update and the deferred frame would be read
    // twice.
    if (
      !wasMounting &&
      changed.has('errorText') &&
      this.errorText !== '' &&
      this.isConnected
    ) {
      this.initialStateAnnounced = true;
      this.errorAnnouncementSink?.announce(this.errorText);
    }
    const emptyPresented =
      !this.loading &&
      this.errorText === '' &&
      this.processedChunks.chunks.length === 0;
    if (
      !wasMounting &&
      !this.wasEmptyPresented &&
      emptyPresented &&
      this.isConnected
    ) {
      this.initialStateAnnounced = true;
      this.emptyAnnouncementSink?.announce(
        this.localize('chunkInspectorEmpty')
      );
    }
    this.wasEmptyPresented = emptyPresented;
    this.previousProcessedChunkIds = this.errorText
      ? []
      : this.processedChunks.chunks.map((chunk) => chunk.id);
    const generation = ++this.focusRestoreGeneration;
    const target = this.pendingFocusTarget;
    if (target === undefined) return;
    this.pendingFocusTarget = undefined;
    void this.restoreControlledFocus(target, generation);
  }

  /** Announce whichever state this panel is presenting right now, at that state's own urgency.
   *  `errorText` wins, mirroring the render branch order; a panel still `loading`, or one already
   *  showing chunks, has no announcement to make. */
  private announcePresentedState(): void {
    if (this.sourceMode) return;
    if (this.errorText !== '') {
      this.errorAnnouncementSink?.announce(this.errorText);
      return;
    }
    if (!this.loading && this.processedChunks.chunks.length === 0)
      this.emptyAnnouncementSink?.announce(
        this.localize('chunkInspectorEmpty')
      );
  }

  private async restoreControlledFocus(
    target: string | 'base',
    generation: number
  ): Promise<void> {
    await this.updateComplete;
    if (generation !== this.focusRestoreGeneration || !this.isConnected) return;
    if (target === 'base') {
      this.renderRoot.querySelector<HTMLElement>('[part="base"]')?.focus();
      return;
    }
    const virtualList = this.renderRoot.querySelector<
      HTMLElement & { updateComplete?: Promise<unknown> }
    >(tag('virtual-list'));
    await virtualList?.updateComplete;
    if (generation !== this.focusRestoreGeneration || !this.isConnected) return;
    const roots: ParentNode[] = [this.renderRoot];
    if (virtualList?.shadowRoot) roots.push(virtualList.shadowRoot);
    const candidates = roots.flatMap((root) => [
      ...root.querySelectorAll<HTMLElement>('[data-chunk-id]'),
    ]);
    const checkbox = candidates.find(
      (element) =>
        element.localName === tag('checkbox') &&
        element.getAttribute('data-chunk-id') === target
    );
    if (checkbox) {
      checkbox.focus();
      return;
    }
    const inspector = candidates.find(
      (element) =>
        element.localName === tag('chunk-inspector') &&
        element.getAttribute('data-chunk-id') === target
    ) as (HTMLElement & { updateComplete?: Promise<unknown> }) | undefined;
    await inspector?.updateComplete;
    if (generation !== this.focusRestoreGeneration || !this.isConnected) return;
    inspector?.shadowRoot
      ?.querySelector<HTMLButtonElement>('[part="open-button"]')
      ?.focus();
  }

  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 50);
  }

  /** Keeps the first valid occurrence for every nonblank chunk id. */
  private canonicalChunks(): RetrievalChunk[] {
    if (this.canonicalSource !== this.chunks) {
      this.canonicalSource = this.chunks;
      this.canonicalCache = firstByRetrievalIdentity(this.chunks.flatMap(value => projectRetrievalChunk(value) ?? []), chunk => chunk.id);
      this.canonicalById = new Map(this.canonicalCache.map(chunk => [chunk.id, chunk]));
      this.canonicalOrder = new Map(this.canonicalCache.map((chunk, index) => [chunk.id, index]));
    }
    return this.canonicalCache;
  }

  private normalizedSelectedChunkIds(): string[] {
    if (this.canonicalSource !== this.chunks) this.canonicalChunks();
    return canonicalIdentityList(this.selectedChunkIds).filter((id) =>
      this.canonicalById.has(id)
    );
  }

  // Reads the memoized result `willUpdate()` refreshes -- always fresh by the time `updated()` or
  // `render()` runs, since `willUpdate()` always runs first in the same update cycle. The
  // `??=` fallback only matters before the component's first `willUpdate()` has ever run (e.g. a
  // direct call from a test), so it can never observably return stale data.
  private get processedChunks(): {
    chunks: readonly RetrievalChunk[];
    groups: LyraVirtualListGroup[];
  } {
    if (this.sourceMode) return { chunks: this.sourceRows, groups: this.sourceGroups };
    return (this.processedChunksCache ??= this.computeProcessedChunks());
  }

  private computeProcessedChunks(): {
    chunks: readonly RetrievalChunk[];
    groups: LyraVirtualListGroup[];
  } {
    const canonical = this.canonicalChunks();
    const sorted =
      this.sort === 'score'
        ? [...canonical].sort((a, b) => safeScore(b.score) - safeScore(a.score))
        : canonical;
    if (this.grouping === 'source') {
      return this.bucketed(
        sorted,
        (chunk) => chunk.source.id,
        (_id, groupChunks) =>
          groupChunks[0]!.source.name || this.localize('untitledSource')
      );
    }
    // An unset groupBy degrades to the flat list rather than collapsing every row into one invented
    // bucket, so switching grouping on before the callback is wired changes nothing visible.
    if (this.grouping === 'custom' && this.groupBy) {
      const groupBy = this.groupBy;
      return this.bucketed(
        sorted,
        groupBy,
        (id, groupChunks) => this.groupLabel?.(id, groupChunks) ?? id
      );
    }
    return { chunks: sorted, groups: [] };
  }

  /** Group-id order: a comparator sorts the first-seen ids; an explicit array leads, with any
   *  first-seen id it omits following in its own order (never dropped, which would silently hide
   *  rows). */
  private orderedGroupKeys(grouped: Map<string, RetrievalChunk[]>): string[] {
    const firstSeen = [...grouped.keys()];
    if (this.grouping !== 'custom' || !this.groupOrder) return firstSeen;
    if (typeof this.groupOrder === 'function')
      return firstSeen.sort(this.groupOrder);
    const ordered = [...new Set(this.groupOrder)].filter((id) =>
      grouped.has(id)
    );
    const listed = new Set(ordered);
    return [...ordered, ...firstSeen.filter((id) => !listed.has(id))];
  }

  private bucketed(
    sorted: readonly RetrievalChunk[],
    keyOf: (chunk: RetrievalChunk) => string,
    labelOf: (id: string, chunks: RetrievalChunk[]) => string
  ): { chunks: RetrievalChunk[]; groups: LyraVirtualListGroup[] } {
    const grouped = new Map<string, RetrievalChunk[]>();
    for (const chunk of sorted) {
      const key = keyOf(chunk);
      const existing = grouped.get(key);
      if (existing) existing.push(chunk);
      else grouped.set(key, [chunk]);
    }
    const rows: RetrievalChunk[] = [];
    const groups: LyraVirtualListGroup[] = [];
    for (const key of this.orderedGroupKeys(grouped)) {
      const groupChunks = grouped.get(key);
      if (!groupChunks || groupChunks.length === 0) continue;
      groups.push({
        key,
        label: labelOf(key, groupChunks),
        startIndex: rows.length,
      });
      rows.push(...groupChunks);
    }
    return { chunks: rows, groups };
  }

  /** The row checkbox is internal selection chrome: its toggle proposal and every alias of its
   *  commit stay inside, and `lr-selection-change` is the one host-level report of the interaction. */
  private stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private reportSelection(chunkIds: string[]): void {
    if (this.canonicalSource !== this.chunks) this.canonicalChunks();
    const chunks = [...new Set(chunkIds)].flatMap(id => this.canonicalById.get(id) ?? [])
      .sort((a, b) => this.canonicalOrder.get(a.id)! - this.canonicalOrder.get(b.id)!);
    // Preserve the legacy whole-detail copy budget, including null on exhaustion. Provider
    // selection instead supplies its already-projected records through the frozen envelope.
    this.emit('lr-selection-change', snapshotEventDetail(
      { selectedChunkIds: chunkIds, chunks }, this.ownerDocument.defaultView
    ) as { selectedChunkIds: string[]; chunks: RetrievalChunk[] });
    this.emit('lr-select', snapshotEventDetail(
      { chunkIds, chunks }, this.ownerDocument.defaultView
    ) as RetrievalResultsSelectDetail);
  }

  private toggleSelect(chunk: RetrievalChunk): void {
    if (!this.currentSourceRow(chunk) || this.sourceSelectionBlocked) return;
    if (this.sourceMode) {
      const next = new Set(this.selectedChunkIds);
      if (next.has(chunk.id)) next.delete(chunk.id); else if (next.size < 10_000) next.add(chunk.id);
      this.selectedChunkIds = [...next]; this.sourceSelectionEvent = this.selectedChunkIds;
      return;
    }
    const next = new Set(this.normalizedSelectedChunkIds());
    if (next.has(chunk.id)) next.delete(chunk.id);
    else next.add(chunk.id);
    this.selectedChunkIds = [...next];
    this.reportSelection(this.selectedChunkIds as string[]);
  }

  /** The inspector's `lr-toggle` twin of `lr-chunk-toggle` stays inside the list. */
  private stopRowToggle = (event: Event): void => {
    event.stopPropagation();
  };

  private onChunkToggle = (
    event: CustomEvent<{ chunkId: string; expanded: boolean }>
  ): void => {
    event.stopPropagation();
    const { chunkId, expanded } = event.detail;
    const rest = this.expandedChunkIds.filter((id) => id !== chunkId);
    this.expandedChunkIds = expanded ? [...rest, chunkId] : rest;
  };

  /** One stable one-element array per chunk, so a row's inspector keeps its input across updates. */
  private readonly rowChunks = new WeakMap<RetrievalChunk, LyraChunk[]>();

  private rowChunksFor(chunk: RetrievalChunk): LyraChunk[] {
    let row = this.rowChunks.get(chunk);
    if (!row) this.rowChunks.set(chunk, (row = [toLyraChunk(chunk)]));
    return row;
  }

  private renderMetadata(
    metadata?: Record<string, unknown>
  ): TemplateResult | typeof nothing {
    return renderRetrievalMetadata(metadata, this.effectiveLocale, this.localize('valueInvalid'), this.localize('valueTruncated'));
  }

  private selectedMembership?: { source: readonly string[]; ids: ReadonlySet<string> };

  private isChunkSelected(id: string): boolean {
    const source = this.selectedChunkIds;
    if (source.length === 0 || this.processedChunks.chunks.length <= 1) {
      this.selectedMembership = undefined;
      return source.includes(id);
    }
    if (this.selectedMembership?.source !== source) {
      this.selectedMembership = { source, ids: new Set(source) };
    }
    return this.selectedMembership.ids.has(id);
  }

  // Shared by both rendering paths (flat list and `<lr-virtual-list>`'s `renderItem`), exactly like
  // `<lr-chunk-inspector>`'s own `renderChunk` and `<lr-thread-list>`'s own `renderRow`. Returns
  // only the row's *content* (checkbox + body) -- the surrounding `role="listitem"`/`part="row"`
  // wrapper is supplied by whichever caller renders it, since `<lr-virtual-list>` already supplies
  // its own per-row wrapper when virtualized and a second, nested one would double up `part="row"`
  // within the same shadow tree and duplicate `role="listitem"` semantics.
  private renderRow = (item: unknown, index: number, total: number): TemplateResult => {
    const chunk = item as RetrievalChunk;
    const selected = this.isChunkSelected(chunk.id);
    const rowLabel = chunk.source.name || this.localize('untitledSource');
    return html`
      ${!this.withoutSelection
        ? html`<lr-checkbox
            part="select"
            data-chunk-id=${chunk.id}
            .checked=${selected}
            .disabled=${this.sourceSelectionBlocked}
            aria-label=${this.localize('retrievalResultsSelectRowOrdinal', undefined, {
              index: getNumberFormat(this.effectiveLocale).format(index + 1),
              total: getNumberFormat(this.effectiveLocale).format(total),
              label: rowLabel,
            })}
            @lr-checkbox-toggle-request=${this.stopOwnedEvent}
            @input=${this.stopOwnedEvent}
            @lr-input=${this.stopOwnedEvent}
            @change=${this.stopOwnedEvent}
            @lr-change=${(event: Event) => {
              event.stopPropagation();
              this.toggleSelect(chunk);
            }}
          ></lr-checkbox>`
        : nothing}
      <div
        part=${selected ? 'row-body row-body-selected' : 'row-body'}
        ?data-selected=${selected}
      >
        <lr-chunk-inspector
          data-chunk-id=${chunk.id}
          exportparts="chunk:chunk, chunk-current:chunk-current, score:chunk-score, score-current:chunk-score-current, score-bar:chunk-score-bar, score-fill:chunk-score-fill, score-fill-success:chunk-score-fill-success, score-fill-warning:chunk-score-fill-warning, score-fill-danger:chunk-score-fill-danger, open-button:chunk-open-button, title:chunk-title, text:chunk-text, text-clamped:chunk-text-clamped, toggle:chunk-toggle"
          .chunks=${this.rowChunksFor(chunk)}
          .expandedChunkIds=${this.expandedChunkIds}
          .thresholds=${this.thresholds}
          size=${this.presentation === 'compact' ? 's' : 'm'}
          .activeChunkId=${this.activeChunkId}
          .ordinalIndex=${index + 1}
          .ordinalTotal=${total}
          label=${rowLabel}
          @lr-chunk-open=${(
            e: CustomEvent<{
              chunkId: string;
              sourceId: string;
              anchor?: DocumentLocator;
            }>
          ) => {
            // lr-chunk-inspector's own lr-chunk-open bubbles+composes (LyraElement.emit()'s
            // defaults) -- without stopping it here it would keep bubbling straight through this
            // component under the same name, right behind the correctly-shaped re-emit below.
            e.stopPropagation();
            if (this.currentSourceRow(chunk)) this.emit('lr-chunk-open', e.detail);
          }}
          @lr-chunk-toggle=${(event: CustomEvent<{ chunkId: string; expanded: boolean }>) => { event.stopPropagation(); if (this.currentSourceRow(chunk)) this.onChunkToggle(event); }}
          @lr-toggle=${this.stopRowToggle}
        ></lr-chunk-inspector>
        ${this.presentation === 'expanded'
          ? this.renderMetadata(chunk.metadata)
          : nothing}
      </div>
    `;
  };

  private legacyLoadMoreHandler(): (event: Event) => void {
    const chunks = this.chunks;
    const version = this.sourceVersion;
    return event => {
      event.stopPropagation();
      if (!this.isConnected || this.sourceMode || this.sourceVersion !== version ||
          this.chunks !== chunks || !this.hasMore || this.loading || this.errorText ||
          (event.currentTarget as Node | null)?.getRootNode() !== this.renderRoot) return;
      this.emit('lr-load-more');
    };
  }

  private renderLoadMoreFooter(): TemplateResult | typeof nothing {
    if (!this.hasMore) return nothing;
    return html`
      <div part="load-more-row">
        ${this.loading
          ? html`<lr-spinner part="spinner"></lr-spinner>`
          : html`<button
              type="button"
              part="load-more"
              @click=${this.legacyLoadMoreHandler()}
            >
              ${this.localize('loadMore')}
            </button>`}
      </div>
    `;
  }

  private renderSource(): TemplateResult {
    const state = this.sourcePages.state; const source = this.dataSource; const version = this.sourceVersion;
    const current = () => this.isConnected && this.sourceMode && this.dataSource === source && this.sourcePages.state === state && this.sourceVersion === version;
    const rows = this.sourceRows;
    return html`<div part="base" tabindex="-1" role=${retrievalSemanticRole(this, 'group') ?? nothing}
      aria-label=${retrievalSemanticLabel(this, this.label ?? this.localize('chunkInspectorLabel')) ?? nothing}>
      ${this.errorText ? html`<div part="error">${this.errorText}</div>` : state.pending ? html`<p part="source-status">${this.localize('loading')}</p>`
        : !state.result ? html`<p part="source-status">${this.localize('tableLoadFailed')} <button type="button" part="source-retry" @click=${() => {
          if (current()) { this.syncSource(true); this.sourceStateVersion++; }
        }}>${this.localize('retry')}</button></p>`
        : !rows.length ? html`<lr-empty part="empty" heading=${this.localize('chunkInspectorEmpty')}></lr-empty>`
        : html`<lr-virtual-list
          exportparts="row:row, group:group-header, select:select, row-body:row-body, row-body-selected:row-body-selected, metadata:metadata, metadata-entry:metadata-entry, metadata-term:metadata-term, metadata-value:metadata-value, chunk:chunk, chunk-current:chunk-current, chunk-score:chunk-score, chunk-score-current:chunk-score-current, chunk-score-bar:chunk-score-bar, chunk-score-fill:chunk-score-fill, chunk-score-fill-success:chunk-score-fill-success, chunk-score-fill-warning:chunk-score-fill-warning, chunk-score-fill-danger:chunk-score-fill-danger, chunk-open-button:chunk-open-button, chunk-title:chunk-title, chunk-text:chunk-text, chunk-text-clamped:chunk-text-clamped, chunk-toggle:chunk-toggle"
          .items=${rows} .groups=${this.sourceGroups}
          .keyFunction=${this.retrievalChunkKey}
          .renderItem=${(item: unknown, index: number) => this.renderRow(item, state.page * state.pageSize + index, state.result!.total)}
          @lr-load-more=${this.stopOwnedEvent} @lr-virtual-scroll=${this.stopOwnedEvent} @lr-visible-range-change=${this.stopOwnedEvent}
        ></lr-virtual-list>`}
      ${state.selectionPending || this.sourceSelectionFailed ? html`<p part="source-selection-status">${this.localize(state.selectionPending ? 'sourceSelectionLoading' : 'sourceSelectionFailed')}
        ${this.sourceSelectionFailed ? html`<button type="button" part="source-selection-retry" @click=${() => {
          if (current()) { this.sourceSelectionInputs = undefined; this.syncSourceSelection(); }
        }}>${this.localize('retry')}</button>` : nothing}</p>` : nothing}
      <lr-pagination part="source-pagination" format="compact" .strings=${this.strings}
        .page=${finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1} .pageSize=${finiteInteger(this.sourcePageSize, 100, 1, 500)}
        .total=${this.sourceTotal ?? -1} .disabled=${this.sourceBlocked || this.sourceTotal === null}
        @lr-page-change=${(event: CustomEvent<{ page: number }>) => { event.stopPropagation(); if (!this.sourceBlocked) this.sourcePage = event.detail.page - 1; }}
        @lr-before-page-change=${this.stopOwnedEvent} @lr-activate=${this.stopOwnedEvent} @focus=${this.stopOwnedEvent} @blur=${this.stopOwnedEvent}
      ></lr-pagination>
    </div>`;
  }

  override render(): TemplateResult {
    if (this.selectedMembership?.source !== this.selectedChunkIds || this.errorText || this.chunks.length <= 1) {
      this.selectedMembership = undefined;
    }
    if (this.sourceMode) return this.renderSource();
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('chunkInspectorLabel') : this.label
    );
    const groupRole = retrievalSemanticRole(this, 'group');

    if (this.errorText) {
      return html`<div part="base" tabindex="-1">
        ${this.renderInputLimit()}
        <div part="error">${this.errorText}</div>
      </div>`;
    }

    const processed = this.processedChunks;
    if (processed.chunks.length <= 1) this.selectedMembership = undefined;
    if (processed.chunks.length === 0) {
      if (this.loading) {
        return html`<div part="base" tabindex="-1">
          ${this.renderInputLimit()}
          <lr-spinner part="spinner"></lr-spinner>
        </div>`;
      }
      return html`<div part="base" tabindex="-1">
        ${this.renderInputLimit()}
        <lr-empty
          part="empty"
          heading=${this.localize('chunkInspectorEmpty')}
        ></lr-empty>
      </div>`;
    }

    // Any grouped render goes through the virtual list regardless of `virtualize-at` -- it owns the
    // sticky group headers -- so this reads the computed groups rather than re-testing `grouping`,
    // which would have to be extended again for every new grouping mode.
    const useVirtualList =
      processed.groups.length > 0 ||
      processed.chunks.length > this.effectiveVirtualizeAt;
    // `renderRow()` reads controlled selection and presentation state. Keep this wrapper fresh so
    // virtualized visible rows receive those state changes without reassigning the guarded item
    // collection (which would rebuild its offsets).
    if (this.ordinalSource !== processed.chunks) {
      this.ordinalSource = processed.chunks;
      this.ordinalById = new Map(processed.chunks.map((chunk, index) => [chunk.id, index]));
    }
    const ordinalById = this.ordinalById;
    const renderVirtualRow = (item: unknown): TemplateResult =>
      this.renderRow(item, ordinalById.get((item as RetrievalChunk).id) ?? 0, processed.chunks.length);
    return html`
      <div
        part="base"
        role=${groupRole ?? nothing}
        tabindex="-1"
        aria-label=${label ?? nothing}
      >
        ${this.renderInputLimit()}
        ${useVirtualList
          ? html`<lr-virtual-list
              exportparts="row:row, group:group-header, select:select, row-body:row-body, row-body-selected:row-body-selected, metadata:metadata, metadata-entry:metadata-entry, metadata-term:metadata-term, metadata-value:metadata-value, chunk:chunk, chunk-current:chunk-current, chunk-score:chunk-score, chunk-score-current:chunk-score-current, chunk-score-bar:chunk-score-bar, chunk-score-fill:chunk-score-fill, chunk-score-fill-success:chunk-score-fill-success, chunk-score-fill-warning:chunk-score-fill-warning, chunk-score-fill-danger:chunk-score-fill-danger, chunk-open-button:chunk-open-button, chunk-title:chunk-title, chunk-text:chunk-text, chunk-text-clamped:chunk-text-clamped, chunk-toggle:chunk-toggle"
              .items=${processed.chunks}
              .renderItem=${renderVirtualRow}
              .keyFunction=${this.retrievalChunkKey}
              .groups=${processed.groups}
              .activeItemId=${this.activeChunkId || ''}
              ?loading=${this.loading}
              ?has-more=${this.hasMore}
              @lr-load-more=${this.legacyLoadMoreHandler()}
              @lr-virtual-scroll=${this.stopOwnedEvent}
              @lr-visible-range-change=${this.stopOwnedEvent}
            ></lr-virtual-list>`
          : html`<div role="list">
                ${processed.chunks.map(
                  (c) =>
                    html`<div part="row" role="listitem">
                      ${this.renderRow(c, ordinalById.get(c.id) ?? 0, processed.chunks.length)}
                    </div>`
                )}
              </div>
              ${this.renderLoadMoreFooter()}`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-retrieval-results': LyraRetrievalResults;
  }
}
