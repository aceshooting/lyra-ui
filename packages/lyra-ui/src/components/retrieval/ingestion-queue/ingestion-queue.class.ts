import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type TemplateResult,
  type SVGTemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  firstByRetrievalIdentity,
  isNonBlankIdentity,
  isRecord,
} from '../retrieval-identity.js';
import { readOwnDataValue } from '../../../internal/data-descriptors.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  acquireAnnouncementSink,
  AnnouncementSinkController,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import type { LyraPageSource, LyraPageResult, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController, type SourcePageState } from '../../../internal/source-page-controller.js';
import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import {
  getListFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import { closeIcon } from '../../../internal/icons.js';
import type {
  CancelEventDetail,
  DocumentRef,
  RetryEventDetail,
} from '../../../ai/types.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
// The registering barrels (not the bare *.class.js modules) -- this side effect is what actually
// defines <lr-badge>/<lr-progress-bar>/<lr-empty>/<lr-virtual-list> as custom elements by the
// time this component's render() references them.
import { styles } from './ingestion-queue.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_ingestionAttemptCount, LYRA_DEFAULT_ingestionCancelWithContext, LYRA_DEFAULT_ingestionChunkCount, LYRA_DEFAULT_ingestionEmbeddedOfTotal, LYRA_DEFAULT_ingestionItemProgressLabel, LYRA_DEFAULT_ingestionQueueEmpty, LYRA_DEFAULT_ingestionQueueInputLimit, LYRA_DEFAULT_ingestionQueueLabel, LYRA_DEFAULT_ingestionRetryWithContext, LYRA_DEFAULT_ingestionStageCancelled, LYRA_DEFAULT_ingestionStageChunking, LYRA_DEFAULT_ingestionStageDone, LYRA_DEFAULT_ingestionStageEmbedding, LYRA_DEFAULT_ingestionStageExtracting, LYRA_DEFAULT_ingestionStageFailed, LYRA_DEFAULT_ingestionStageIndexing, LYRA_DEFAULT_ingestionStageQueued, LYRA_DEFAULT_ingestionStageUnknown, LYRA_DEFAULT_ingestionStageUploading, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_loading, LYRA_DEFAULT_retry, LYRA_DEFAULT_tableLoadFailed } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/**
 * A document's position in the ingestion pipeline. `'queued'` through `'indexing'` are the
 * in-flight stages (in pipeline order); `'done'`, `'failed'`, and `'cancelled'` are terminal.
 */
export type IngestionStage =
  | 'queued'
  | 'uploading'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'done'
  | 'failed'
  | 'cancelled';

type RenderedIngestionStage = IngestionStage | 'unknown';

const INGESTION_STAGES: ReadonlySet<IngestionStage> = new Set([
  'queued',
  'uploading',
  'extracting',
  'chunking',
  'embedding',
  'indexing',
  'done',
  'failed',
  'cancelled',
]);

function normalizedStage(stage: unknown): RenderedIngestionStage {
  return INGESTION_STAGES.has(stage as IngestionStage)
    ? (stage as IngestionStage)
    : 'unknown';
}

/** In-flight stages that render a progress indicator and remain cancelable. `'queued'` is also
 *  cancelable (see `CANCELABLE_STAGES`) but has nothing yet to show progress *of*. */
const ACTIVE_STAGES: readonly IngestionStage[] = [
  'uploading',
  'extracting',
  'chunking',
  'embedding',
  'indexing',
];

/** Every non-terminal stage -- the set a `lr-cancel` request is offered for. */
const CANCELABLE_STAGES: readonly IngestionStage[] = [
  'queued',
  ...ACTIVE_STAGES,
];

function badgeVariantForStage(stage: RenderedIngestionStage): BadgeVariant {
  switch (stage) {
    case 'done':
      return 'success';
    case 'failed':
      return 'danger';
    case 'queued':
    case 'cancelled':
    case 'unknown':
      return 'neutral';
    default:
      return 'brand';
  }
}

/**
 * One document moving through the ingestion pipeline. `document` reuses the shared `DocumentRef`
 * shape (`src/ai/types.ts`) rather than a divergent `name`/`mimeType` pair of its own, so a caller
 * populating this queue from the same source list a `DocumentRef`-typed retrieval/knowledge-base
 * view already holds needs no adapter.
 */
export interface IngestionQueueItem {
  /** Stable id, echoed back in `lr-retry`/`lr-cancel` event details. */
  id: string;
  document: DocumentRef;
  stage: IngestionStage;
  /** 0-100 within the current stage. Omitted (or non-finite) renders an indeterminate indicator --
   *  only meaningful while `stage` is one of the active (non-`'queued'`, non-terminal) stages. */
  progress?: number;
  /** Total chunks produced, once chunking has run. */
  chunkCount?: number;
  /** Chunks embedded so far, out of `chunkCount`. Rendered only alongside a defined `chunkCount`. */
  embeddedChunkCount?: number;
  /** Retry attempts already made (0/undefined = never retried). */
  attempts?: number;
  /** Failure detail, rendered only while `stage === 'failed'`. */
  error?: string;
}

/** Provider query for the unfiltered, provider-ordered ingestion queue. */
export interface IngestionQueueSourceQuery {
  readonly [key: string]: never;
}
export type IngestionQueueSource = LyraPageSource<IngestionQueueItem, IngestionQueueSourceQuery>;
const SOURCE_QUERY: IngestionQueueSourceQuery = Object.freeze({});

/** `lr-retry`'s `detail` -- extends the shared `RetryEventDetail` (`src/ai/types.ts`) with the
 *  `itemId` identifying *which* queue item the request is about; `attempt` is the attempt number
 *  about to be made: the displayed nonnegative finite-integer attempt count plus one, matching
 *  `RetryEventDetail.attempt`'s own semantics verbatim. */
export interface IngestionRetryEventDetail extends RetryEventDetail {
  itemId: string;
}

/** `lr-cancel`'s `detail` -- extends the shared `CancelEventDetail` (`src/ai/types.ts`) with the
 *  `itemId` identifying *which* queue item the request is about. This component never supplies a
 *  `reason` itself; it is left for a host wrapping the cancel affordance with its own prompt. */
export interface IngestionCancelEventDetail extends CancelEventDetail {
  itemId: string;
}

export interface LyraIngestionQueueEventMap {
  'lr-retry': CustomEvent<IngestionRetryEventDetail>;
  'lr-cancel': CustomEvent<IngestionCancelEventDetail>;
}

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

// Same shape as `<lr-attachment-chip>`'s local `retryIcon()` -- duplicated rather than imported
// (independently consumable components) but kept visually identical so a retry affordance reads
// the same wherever it shows up in the library.
function retryIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
  `;
}

const DEFAULT_VIRTUALIZE_AT = 100;

/**
 * `<lr-ingestion-queue>` — a controlled list of documents moving through an ingestion pipeline
 * (upload → text extraction → chunking → embedding → indexing), each row showing its stage,
 * progress, chunk/embedding counts, and a retry or cancel affordance. Presentation only: this
 * component runs no ingestion itself, persists nothing, and never mutates `items` -- retrying or
 * cancelling a row fires a controlled `lr-retry`/`lr-cancel` request event and waits for the host
 * to supply an updated `items` array, the same request/response convention `<lr-thread-list>`'s
 * `lr-thread-pin`/`-archive`/`-delete` events already establish.
 *
 * Above `virtualizeAt` items, the list renders through an internal `<lr-virtual-list>` instead of a
 * plain keyed list (same precedent as `<lr-thread-list>`'s data mode, and the same exclusive `>`
 * bound `<lr-chunk-inspector>`/`<lr-retrieval-results>`/`<lr-neighbor-list>` apply to their own
 * `virtualize-at`) -- identical row markup and behavior either way, keyed by `id`.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Blank item ids and later duplicates are ignored before failure state, counts, virtualization,
 * rendering, or actions. The first item for an id wins. Missing and unrecognized runtime `stage`
 * values render as a localized, neutral, inert unknown state so a newer backend stage never
 * becomes a blank or misleadingly actionable row.
 * Nonstring failure details use the localized failed-stage label before rendering and fresh
 * failure announcements. Omitted details stay omitted; historical failures remain silent on mount.
 *
 * Input retains the first 10,000 queue items; the limit note reports the assigned source count.
 * Closed display fields are copied after identity admission, so nested records do not consume the
 * shared 50,000-value deep-copy budget. Replace the collection to publish source-record changes.
 *
 * With dataSource, sourcePage (zero-based) and sourcePageSize (1..500, default 100) address the
 * complete provider queue. sourceTotal is null while pending or failed, then the exact global
 * record total. The source takes precedence over items; removing it restores legacy data.
 * Source rows copy closed display fields, with at most 65,536 aggregate text UTF-16 units per row;
 * malformed required records fail visibly rather than silently omit rows. Query callbacks own
 * their execution cost. Same-source assignment or requestUpdate() refreshes; named paints reuse
 * the current page. Source/revision/refresh/teardown revokes old work. Historical failed rows do
 * not announce on source browsing, refresh or reconnect, even with announce. Row retry/cancel
 * events still request host actions; provider-load retry only reloads the current page.
 *
 * @csspart source-status - Provider loading/error text.
 * @csspart source-retry - Retry the current provider page.
 * @csspart source-pagination - Provider page navigation.
 * @customElement lr-ingestion-queue
 * @event lr-retry - A row's retry affordance was activated (only rendered for `stage="failed"`
 *   rows). `detail: { itemId, attempt }` -- `attempt` is the attempt number about to be made.
 * @event lr-cancel - A row's cancel affordance was activated (rendered for every non-terminal
 *   row). `detail: { itemId, reason }` -- `reason` is always `undefined` from this component.
 * @csspart base - The one stable root shell across empty, populated, and virtualized states. It is
 *   the named region unless a non-empty host `aria-label` makes the host the sole overall owner.
 * @csspart limit - Notice that only the first 10,000 queue items were retained.
 * @csspart list - The unnamed row container (`role="list"`), including the composed
 *   `<lr-virtual-list>` host in virtualized mode. Its surrounding `base` region owns the queue name.
 * @csspart empty - The `<lr-empty>` zero-items state.
 * @csspart item - One queue item row; carries `data-stage`. When virtualized, reached from this
 *   component's own stylesheet via `lr-virtual-list::part(item)` (renders inside the internal
 *   `<lr-virtual-list>`'s own shadow root, not this component's).
 * @csspart item-header - The row's name/stage-badge line.
 * @csspart item-name - The document's `name`.
 * @csspart item-stage - The row's `<lr-badge>` showing the localized stage label; its `variant`
 *   tracks `stage`.
 * @csspart item-progress - The row's `<lr-progress-bar>`, only rendered for an active (uploading
 *   through indexing) stage.
 * @csspart item-meta - Wrapper around the chunk-count/embedding-status/attempt-count text.
 * @csspart item-chunk-count - The chunk count, only rendered once `chunkCount` is set.
 * @csspart item-embedding-status - The "N of M chunks embedded" text, only rendered once both
 *   `chunkCount` and `embeddedChunkCount` are set.
 * @csspart item-attempts - The attempt count, only rendered once `attempts` is greater than 0.
 * @csspart item-error - The failure message, only rendered for `stage="failed"` with `error` set.
 * @csspart failure-live - The visually hidden, `aria-hidden` mirror of the last announced batch of
 *   fresh failures — those that transition or are added after mount; historical failed rows remain
 *   visible but are not re-announced. The announcement itself lands in the shared light-DOM
 *   assertive region (`acquireAnnouncementSink()` in `internal/announcer.ts`), because a live
 *   region inside a shadow root is not reliably announced; this part is a styling/inspection
 *   surface only.
 * @csspart item-actions - Wrapper around the retry/cancel buttons.
 * @csspart retry-button - Fires `lr-retry`. Only rendered for `stage="failed"` rows.
 * @csspart cancel-button - Fires `lr-cancel`. Only rendered for non-terminal rows.
 * @cssprop [--lr-ingestion-queue-max-height=none] - Non-virtualized mode only: caps how tall the
 *   list grows before it scrolls internally. Has no effect once virtualized -- the internal
 *   `<lr-virtual-list>`'s own viewport keeps its independent, fixed default height (retheme it
 *   directly via `<lr-ingestion-queue>`'s own `lr-virtual-list { --lr-virtual-list-height: ... }`
 *   if needed).
 * @status stable
 * @since 4.1.0
 */
export class LyraIngestionQueue extends LyraElement<LyraIngestionQueueEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    cancel: LYRA_DEFAULT_cancel,
    ingestionAttemptCount: LYRA_DEFAULT_ingestionAttemptCount,
    ingestionCancelWithContext: LYRA_DEFAULT_ingestionCancelWithContext,
    ingestionChunkCount: LYRA_DEFAULT_ingestionChunkCount,
    ingestionEmbeddedOfTotal: LYRA_DEFAULT_ingestionEmbeddedOfTotal,
    ingestionItemProgressLabel: LYRA_DEFAULT_ingestionItemProgressLabel,
    ingestionQueueEmpty: LYRA_DEFAULT_ingestionQueueEmpty,
    ingestionQueueInputLimit: LYRA_DEFAULT_ingestionQueueInputLimit,
    ingestionQueueLabel: LYRA_DEFAULT_ingestionQueueLabel,
    ingestionRetryWithContext: LYRA_DEFAULT_ingestionRetryWithContext,
    ingestionStageCancelled: LYRA_DEFAULT_ingestionStageCancelled,
    ingestionStageChunking: LYRA_DEFAULT_ingestionStageChunking,
    ingestionStageDone: LYRA_DEFAULT_ingestionStageDone,
    ingestionStageEmbedding: LYRA_DEFAULT_ingestionStageEmbedding,
    ingestionStageExtracting: LYRA_DEFAULT_ingestionStageExtracting,
    ingestionStageFailed: LYRA_DEFAULT_ingestionStageFailed,
    ingestionStageIndexing: LYRA_DEFAULT_ingestionStageIndexing,
    ingestionStageQueued: LYRA_DEFAULT_ingestionStageQueued,
    ingestionStageUnknown: LYRA_DEFAULT_ingestionStageUnknown,
    ingestionStageUploading: LYRA_DEFAULT_ingestionStageUploading,
    loading: LYRA_DEFAULT_loading,
    retry: LYRA_DEFAULT_retry,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
    untitledSource: LYRA_DEFAULT_untitledSource,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly identityCollectionProperties = Object.freeze(['items']);

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'items',
  ]);

  static override styles = [LyraElement.styles, styles, srOnly];

  /** The queue to render, in display order. Controlled and never mutated by this component --
   *  pass a new array (e.g. as ingestion progresses) to update it. Assign a new array to update: mutating an array and assigning it again does not. */
  @property({ attribute: false }) items: readonly IngestionQueueItem[] = [];

  private _dataSource?: IngestionQueueSource;
  private sourceEpoch = 0;
  private sourceSyncing = false;
  private sourceInputs?: readonly unknown[];
  private sourceSize?: number;
  private sourceResult?: LyraPageResult<IngestionQueueItem>;
  private sourceRows: readonly IngestionQueueItem[] = [];
  private readonly sourceItemIdentities = new WeakSet<IngestionQueueItem>();
  @state() private sourceStateVersion = 0;
  private readonly sourcePages = new SourcePageController<IngestionQueueItem, IngestionQueueSourceQuery>(this, {
    normalizeRecord: (record, isCurrent) => this.projectSourceItem(record, isCurrent),
    validateMetadata: () => {},
    onChange: () => { this.sourceStateVersion++; },
  });

  /** Full queue provider. A present invalid source fails visibly; undefined restores items.
   * Reassign even the same source or call requestUpdate() to publish a new provider snapshot. */
  @property({ attribute: false })
  get dataSource(): IngestionQueueSource | undefined { return this._dataSource; }
  set dataSource(value: IngestionQueueSource | undefined) {
    const previous = this._dataSource; this._dataSource = value; this.sourceEpoch++;
    this.requestUpdate('dataSource', previous);
  }
  /** Zero-based provider page; only used with dataSource. */
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Provider page size, normalized to 1..500. A size change resets the source page to 0. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact total of the current provider queue, or null before a valid response or without a source. */
  get sourceTotal(): number | null { return this.sourceMode ? this.sourcePages.state.result?.total ?? null : null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }
  private get sourceFailed(): boolean {
    return this.sourceMode && !this.sourcePages.state.pending && !this.sourcePages.state.result;
  }
  private get sourceBlocked(): boolean {
    return this.sourceMode && (!this.isConnected || this.sourcePages.state.pending || this.sourceFailed);
  }

  private projectSourceItem(record: LyraSourceRecord<unknown>, isCurrent: () => boolean): LyraSourceRecord<IngestionQueueItem> {
    const assertCurrent = (): void => { if (!isCurrent()) throw new TypeError('Obsolete source record'); };
    const descriptorOf = (target: object, key: PropertyKey) => {
      assertCurrent();
      const descriptor = getOwnDataDescriptor(target, key);
      assertCurrent();
      return descriptor;
    };
    assertCurrent();
    const field = (value: unknown, key: string): unknown => {
      if (!isRecord(value)) throw new TypeError('Invalid source item');
      const descriptor = descriptorOf(value, key);
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new TypeError('Invalid source field');
      return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
    };
    let units = 0;
    const text = (value: unknown, required = false): string | undefined => {
      if (value === undefined && !required) return undefined;
      if (typeof value !== 'string' || value.length > 65_536 || (units += value.length) > 65_536) throw new TypeError('Invalid source text');
      return value;
    };
    const raw = record.value;
    const id = text(field(raw, 'id'), true)!;
    const rawDocument = field(raw, 'document');
    const documentId = text(field(rawDocument, 'id'), true)!;
    if (id !== record.key || !isNonBlankIdentity(documentId)) throw new TypeError('Invalid source identity');
    const document = Object.freeze({ id: documentId, name: text(field(rawDocument, 'name'), true)!,
      mimeType: text(field(rawDocument, 'mimeType')), uri: text(field(rawDocument, 'uri')), version: text(field(rawDocument, 'version')) });
    const stage = text(field(raw, 'stage'));
    const errorValue = field(raw, 'error');
    const error = errorValue == null ? undefined : text(typeof errorValue === 'string' ? errorValue : this.localize('ingestionStageFailed'));
    const numbers: Record<string, number> = {};
    for (const key of ['progress', 'chunkCount', 'embeddedChunkCount', 'attempts']) {
      const value = field(raw, key);
      if (value !== undefined) { if (typeof value !== 'number') throw new TypeError('Invalid source number'); numbers[key] = value; }
    }
    const value = Object.freeze({ id, document, stage, error, ...numbers }) as IngestionQueueItem;
    assertCurrent();
    this.sourceItemIdentities.add(value);
    if (errorValue != null && typeof errorValue !== 'string') this.fallbackFailureItems.add(value);
    assertCurrent();
    return { key: record.key, order: record.order, value };
  }

  private syncSource(): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    try {
      if (!this.sourceMode) {
        if (this.sourceInputs) this.sourcePages.bind(undefined);
        this.sourceInputs = undefined; this.sourceSize = undefined; this.sourceResult = undefined;
        this.sourceRows = []; return;
      }
      const source = this.dataSource!;
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      let page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      if (this.sourceSize !== undefined && this.sourceSize !== size) { page = 0; this.sourcePage = 0; }
      this.sourceSize = size;
      const revision = source.revision;
      const inputs = [source, revision, this.sourceEpoch, this.effectiveLocale, size, page];
      if (this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index])) return;
      this.sourceInputs = inputs; this.sourceRows = []; this.sourceResult = undefined;
      this.sourcePages.bind({ source, revision, epoch: this.sourceEpoch, locale: this.effectiveLocale });
      void this.sourcePages.request(SOURCE_QUERY, page, size);
    } catch {
      this.sourcePages.bind(undefined); this.sourceRows = []; this.sourceResult = undefined;
    } finally { this.sourceSyncing = false; }
  }

  private acceptSourcePage(): void {
    const result = this.sourcePages.state.result;
    if (!result || result === this.sourceResult) return;
    this.sourceResult = result; this.sourceRows = result.rows.map(record => record.value);
    if (this.sourcePage !== this.sourcePages.state.page) {
      this.sourceSyncing = true; this.sourcePage = this.sourcePages.state.page; this.sourceSyncing = false;
      this.sourceInputs = this.sourceInputs ? [...this.sourceInputs.slice(0, -1), this.sourcePages.state.page] : undefined;
    }
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize'].includes(String(args[0]))) this.syncSource();
    super.requestUpdate(...args);
  }

  private onSourcePage = (event: CustomEvent<{ page: number }>): void => {
    event.stopPropagation(); if (!this.sourceBlocked) this.sourcePage = event.detail.page - 1;
  };
  private onSourceRetry(source: IngestionQueueSource | undefined, state: SourcePageState<IngestionQueueItem>): void {
    if (!this.isConnected || !this.sourceMode || !this.sourceFailed || this.dataSource !== source || this.sourcePages.state !== state) return;
    this.sourceInputs = undefined; this.syncSource(); this.sourceStateVersion++;
  }

  /** Accessible name for the stable region when the host has no `aria-label`; defaults to
   *  localized `ingestionQueueLabel`. An explicitly empty host label stays empty, and so does an
   *  explicitly empty `label`. */
  @property() label?: string;

  /** Above this item count, the list renders through an internal `<lr-virtual-list>`. Exclusive,
   *  like every other `virtualize-at` in this family: exactly this many items still render as a
   *  plain list. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt =
    DEFAULT_VIRTUALIZE_AT;

  /** Opts this queue into announcing the failures it already carries when it first mounts, through
   *  the same shared assertive region, the same list formatting and the same caller-supplied
   *  `item.error` text a later failure uses. Leave unset for a queue that is part of the page a
   *  user is arriving on: those rows render in document order and repeating them is noise. Set it
   *  when the queue is created in response to a user action — a retried ingestion run that mounts
   *  a fresh queue already holding `stage: 'failed'` rows would otherwise never speak them. Read
   *  once per element lifetime: a later reconnection or adoption stages the same rows again rather
   *  than replaying the announcement, and later failures announce either way. Remove any host
   *  `role="status"`/`role="alert"` hand-added before this property existed once it is set --
   *  otherwise the initial failures are announced twice, through the native role and again
   *  through the shared sink. */
  @property({ type: Boolean, reflect: true }) announce = false;

  @state() private failureLiveText = '';
  private isMounting = true;
  /** True once the `announce` opt-in has spoken the mount-time failures, so a reconnection (which
   *  resets `isMounting`) stages them as history instead of replaying them. */
  private initialFailuresAnnounced = false;
  /** Handle on the shared light-DOM assertive region failures actually announce through -- a
   *  region rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores
   *  one outright), so `[part="failure-live"]` is only an `aria-hidden` mirror. */
  private sink?: AnnouncementSink;
  private readonly limitAnnouncements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private limitInitialized = false;
  private previouslyInputTruncated = false;

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.limitAnnouncements.adopted();
    this.sourcePages.adopted();
    this.sourceStatusInitialized = false;
  }

  private inputLimitText(): string {
    const truncation = publicCollectionTruncation(this, 'items');
    const number = getNumberFormat(this.effectiveLocale);
    return truncation ? this.localize('ingestionQueueInputLimit', undefined, {
      count: number.format(truncation.retained), total: number.format(truncation.source),
    }) : '';
  }

  private sourceStatusInitialized = false;
  private previousSourceStatus = '';
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.sourceMode) {
      const status = this.sourceFailed ? this.localize('tableLoadFailed')
        : this.sourcePages.state.pending ? this.localize('loading') : '';
      if (this.sourceStatusInitialized && status && status !== this.previousSourceStatus) this.limitAnnouncements.announcePolite(status);
      this.sourceStatusInitialized = true; this.previousSourceStatus = status;
      return;
    }
    this.sourceStatusInitialized = false; this.previousSourceStatus = '';
    const inputTruncated = publicCollectionTruncation(this, 'items') !== undefined;
    if (this.limitInitialized && inputTruncated && !this.previouslyInputTruncated) {
      this.limitAnnouncements.announcePolite(this.inputLimitText());
    }
    this.limitInitialized = true;
    this.previouslyInputTruncated = inputTruncated;
  }

  private renderInputLimit(): TemplateResult | typeof nothing {
    const text = this.inputLimitText();
    return text ? html`<p part="limit" role="note">${text}</p>` : nothing;
  }

  /** `virtualizeAt`, normalized to a finite non-negative integer (falling back to the property's
   *  own default) -- a raw `NaN` (e.g. an invalid `virtualize-at` attribute) would otherwise make
   *  `items.length > virtualizeAt` always false, silently disabling virtualization instead of
   *  falling back to the default threshold. */
  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, DEFAULT_VIRTUALIZE_AT);
  }

  private readonly fallbackFailureItems = new WeakSet<IngestionQueueItem>();

  private normalizeItems(value: unknown): IngestionQueueItem[] {
    const rows: IngestionQueueItem[] = [];
    for (const valueItem of Array.isArray(value) ? value : []) {
      try {
        if (!isRecord(valueItem)) continue;
        const id = readOwnDataValue(valueItem, 'id');
        const source = readOwnDataValue(valueItem, 'document');
        if (!isNonBlankIdentity(id) || !isRecord(source)) continue;
        const documentId = readOwnDataValue(source, 'id');
        const name = readOwnDataValue(source, 'name');
        if (!isNonBlankIdentity(documentId) || typeof name !== 'string') continue;
        const document = Object.freeze(Object.fromEntries(['id', 'name', 'mimeType', 'uri', 'version']
          .map(key => [key, readOwnDataValue(source, key)]).filter(([, field]) => field !== undefined))) as unknown as DocumentRef;
        const fields = Object.fromEntries(['stage', 'progress', 'chunkCount', 'embeddedChunkCount', 'attempts']
          .map(key => [key, readOwnDataValue(valueItem, key)]).filter(([, field]) => field !== undefined));
        const error = readOwnDataValue(valueItem, 'error');
        const row = Object.freeze({ ...fields, id, document,
          ...(error === undefined ? {} : { error: error === null || typeof error === 'string' ? error : this.localize('ingestionStageFailed') }),
        }) as IngestionQueueItem;
        if (error != null && typeof error !== 'string') this.fallbackFailureItems.add(row);
        rows.push(row);
      } catch { continue; }
    }
    return firstByRetrievalIdentity(rows, item => item.id);
  }

  // Memoizes the normalized view for as long as neither input actually changed.
  // `<lr-virtual-list>` keys its own O(n) offset/measurement-cache rebuild on the *reference*
  // identity of the `items` array it is handed, so returning a freshly-allocated array on every
  // render made every unrelated update (a locale-independent property, an internal @state
  // change) rebuild the whole virtualized list and drop measured row heights.
  private normalizedItemsCache?: {
    source: unknown;
    locale: string;
    failureText: string;
    result: IngestionQueueItem[];
  };

  private get normalizedItems(): IngestionQueueItem[] {
    const cached = this.normalizedItemsCache;
    if (
      cached &&
      cached.source === this.items &&
      cached.locale === this.effectiveLocale &&
      cached.failureText === this.localize('ingestionStageFailed')
    )
      return cached.result;
    const result = this.normalizeItems(this.items);
    this.normalizedItemsCache = {
      source: this.items,
      locale: this.effectiveLocale,
      failureText: this.localize('ingestionStageFailed'),
      result,
    };
    return result;
  }

  // A stable key; `renderItem` is fresh per render so a strings or locale change repaints the rows.
  private readonly ingestionItemKey = (item: unknown): string =>
    (item as IngestionQueueItem).id;

  override connectedCallback(): void {
    super.connectedCallback();
    // Acquired on connect, not on the first failure: assistive tech has to have been observing a
    // live region *before* text arrives for the change to be announced at all.
    this.sink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.failureLiveText = '';
    this.sourceStatusInitialized = false;
    this.previousSourceStatus = '';
    this.isMounting = true;
    this.sink?.release();
    this.sink = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncSource();
    if (this.sourceMode) { this.acceptSourcePage(); this.failureLiveText = ''; this.isMounting = true; return; }
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (wasMounting) {
      // Opted-in mount-time failures go through the one existing announcement path below, so the
      // list formatting, the mirrored `[part="failure-live"]` text and the assertive urgency all
      // resolve exactly as they would for a later failure. Guarded by its own flag rather than
      // `isMounting`, which `disconnectedCallback()` resets: a reconnection stages the same rows
      // as history instead of replaying them.
      if (this.announce && !this.initialFailuresAnnounced) {
        this.initialFailuresAnnounced = true;
        this.announceFailures(
          this.normalizedItems.flatMap((item) =>
            item.stage === 'failed' && item.error ? [item.error] : []
          )
        );
      }
      return;
    }
    if (!changed.has('items')) return;

    const previousItems = this.normalizedItemsCache?.result ?? [];
    const previousById = new Map(previousItems.map((item) => [item.id, item]));
    this.announceFailures(
      this.normalizedItems.flatMap((item) => {
        if (item.stage !== 'failed' || !item.error) return [];
        const previous = previousById.get(item.id);
        const previousError = previous && this.fallbackFailureItems.has(previous)
          ? this.localize('ingestionStageFailed') : previous?.error;
        return !previous ||
          previous.stage !== 'failed' ||
          previousError !== item.error
          ? [item.error]
          : [];
      })
    );
  }

  /** Formats `freshErrors` into the mirrored live text and speaks it. The single announcement path
   *  both the mount-time `announce` opt-in and every later `items` write share. */
  private announceFailures(freshErrors: readonly string[]): void {
    this.failureLiveText = freshErrors.length
      ? getListFormat(this.effectiveLocale, { type: 'conjunction' }).format(
          freshErrors
        )
      : '';
    // Announced from the computation, not from a rendered text change: the shared region appends
    // each announcement as its own node, so an identical repeat (the same row failing the same way
    // twice) is read again instead of being a silent no-op.
    if (this.failureLiveText !== '') this.sink?.announce(this.failureLiveText);
  }

  private stageLabel(stage: RenderedIngestionStage): string {
    switch (stage) {
      case 'queued':
        return this.localize('ingestionStageQueued');
      case 'uploading':
        return this.localize('ingestionStageUploading');
      case 'extracting':
        return this.localize('ingestionStageExtracting');
      case 'chunking':
        return this.localize('ingestionStageChunking');
      case 'embedding':
        return this.localize('ingestionStageEmbedding');
      case 'indexing':
        return this.localize('ingestionStageIndexing');
      case 'done':
        return this.localize('ingestionStageDone');
      case 'failed':
        return this.localize('ingestionStageFailed');
      case 'cancelled':
        return this.localize('ingestionStageCancelled');
      case 'unknown':
        return this.localize('ingestionStageUnknown');
    }
  }

  private chunkCountText(count: number): string {
    const safeCount = finiteCount(count);
    return this.localize('ingestionChunkCount', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(safeCount),
      pluralCount: safeCount,
    });
  }

  private normalizedAttempts(item: IngestionQueueItem): number {
    return finiteCount(item.attempts ?? 0, 0, Number.MAX_SAFE_INTEGER - 1);
  }

  /** The internal virtual list's scroll and range events are not part of this component's surface. */
  private readonly stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private onRetryClick(item: IngestionQueueItem): void {
    if ((this.sourceMode || this.sourceItemIdentities.has(item)) && (!this.sourceMode || this.sourceBlocked || !this.sourceRows.includes(item))) return;
    this.emit('lr-retry', {
      itemId: item.id,
      attempt: this.normalizedAttempts(item) + 1,
    });
  }

  private onCancelClick(item: IngestionQueueItem): void {
    if ((this.sourceMode || this.sourceItemIdentities.has(item)) && (!this.sourceMode || this.sourceBlocked || !this.sourceRows.includes(item))) return;
    this.emit('lr-cancel', { itemId: item.id });
  }

  private itemTemplate = (
    item: IngestionQueueItem,
    ownRole: boolean
  ): TemplateResult => {
    const stage = normalizedStage(item.stage);
    const stageLabel = this.stageLabel(stage);
    const name = item.document.name.trim()
      ? item.document.name
      : this.localize('untitledSource');
    const showProgress = stage !== 'unknown' && ACTIVE_STAGES.includes(stage);
    const canRetry = stage === 'failed';
    const canCancel = stage !== 'unknown' && CANCELABLE_STAGES.includes(stage);
    const attempts = this.normalizedAttempts(item);
    const hasMeta =
      item.chunkCount !== undefined ||
      item.embeddedChunkCount !== undefined ||
      attempts > 0;
    const indeterminate =
      item.progress === undefined || !Number.isFinite(item.progress);

    return html`
      <div
        part="item"
        role=${ownRole ? 'listitem' : nothing}
        data-stage=${stage}
      >
        <div part="item-header">
          <span part="item-name" title=${name}>${name}</span>
          <lr-badge part="item-stage" variant=${badgeVariantForStage(stage)}
            >${stageLabel}</lr-badge
          >
        </div>
        ${showProgress
          ? html`<lr-progress-bar
              part="item-progress"
              .value=${item.progress ?? 0}
              ?indeterminate=${indeterminate}
              aria-label=${this.localize(
                'ingestionItemProgressLabel',
                undefined,
                {
                  name,
                  stage: stageLabel,
                }
              )}
            ></lr-progress-bar>`
          : nothing}
        ${hasMeta
          ? html`<div part="item-meta">
              ${item.chunkCount !== undefined
                ? html`<span part="item-chunk-count"
                    >${this.chunkCountText(item.chunkCount)}</span
                  >`
                : nothing}
              ${item.chunkCount !== undefined &&
              item.embeddedChunkCount !== undefined
                ? html`<span part="item-embedding-status"
                    >${this.localize('ingestionEmbeddedOfTotal', undefined, {
                      embedded: getNumberFormat(this.effectiveLocale).format(
                        finiteCount(item.embeddedChunkCount)
                      ),
                      total: getNumberFormat(this.effectiveLocale).format(
                        finiteCount(item.chunkCount)
                      ),
                    })}</span
                  >`
                : nothing}
              ${attempts > 0
                ? html`<span part="item-attempts"
                    >${this.localize('ingestionAttemptCount', undefined, {
                      count: getNumberFormat(this.effectiveLocale).format(
                        attempts
                      ),
                    })}</span
                  >`
                : nothing}
            </div>`
          : nothing}
        ${stage === 'failed' && item.error
          ? html`<p part="item-error">${this.fallbackFailureItems.has(item) ? this.localize('ingestionStageFailed') : item.error}</p>`
          : nothing}
        ${canRetry || canCancel
          ? html`<div part="item-actions">
              ${canRetry
                ? html`<button
                    part="retry-button"
                    type="button"
                    aria-label=${this.localize(
                      'ingestionRetryWithContext',
                      undefined,
                      {
                        label: name,
                      }
                    )}
                    @click=${() => this.onRetryClick(item)}
                  >
                    ${retryIcon()}<span>${this.localize('retry')}</span>
                  </button>`
                : nothing}
              ${canCancel
                ? html`<button
                    part="cancel-button"
                    type="button"
                    aria-label=${this.localize(
                      'ingestionCancelWithContext',
                      undefined,
                      {
                        label: name,
                      }
                    )}
                    @click=${() => this.onCancelClick(item)}
                  >
                    ${closeIcon()}<span>${this.localize('cancel')}</span>
                  </button>`
                : nothing}
            </div>`
          : nothing}
      </div>
    `;
  };

  private renderRows(items: readonly IngestionQueueItem[]): TemplateResult {
    const virtualized = items.length > this.effectiveVirtualizeAt;
    return virtualized
          ? html`<lr-virtual-list
              part="list"
              exportparts="item:item, item-header:item-header, item-name:item-name, item-stage:item-stage, item-progress:item-progress, item-meta:item-meta, item-chunk-count:item-chunk-count, item-embedding-status:item-embedding-status, item-attempts:item-attempts, item-error:item-error, item-actions:item-actions, retry-button:retry-button, cancel-button:cancel-button"
              .items=${items}
              .renderItem=${(item: unknown) =>
                this.itemTemplate(item as IngestionQueueItem, false)}
              .keyFunction=${this.ingestionItemKey}
              @lr-virtual-scroll=${this.stopOwnedEvent}
              @lr-visible-range-change=${this.stopOwnedEvent}
            ></lr-virtual-list>`
          : html`<div part="list" role="list">
              ${repeat(
                items,
                (item) => item.id,
                (item) => this.itemTemplate(item, true)
              )}
            </div>`;
  }

  private renderSource(): TemplateResult {
    const failed = this.sourceFailed;
    const retrySource = this.dataSource;
    const retryState = this.sourcePages.state;
    const pending = this.sourcePages.state.pending;
    const label = retrievalSemanticLabel(this, this.label == null ? this.localize('ingestionQueueLabel') : this.label);
    return html`<div part="base" role=${retrievalSemanticRole(this, 'region') ?? nothing} aria-label=${label ?? nothing} aria-busy=${pending ? 'true' : 'false'}>
      ${failed || pending ? html`<p part="source-status">${this.localize(failed ? 'tableLoadFailed' : 'loading')}</p>` : nothing}
      ${failed ? html`<button type="button" part="source-retry" @click=${() => this.onSourceRetry(retrySource, retryState)}>${this.localize('retry')}</button>` : nothing}
      ${failed || pending ? nothing : this.sourceRows.length ? this.renderRows(this.sourceRows) : html`<div part="list"><lr-empty part="empty" heading=${this.localize('ingestionQueueEmpty')}></lr-empty></div>`}
      <lr-pagination part="source-pagination" format="compact" .page=${finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1}
        .pageSize=${finiteInteger(this.sourcePageSize, 100, 1, 500)} .total=${this.sourceTotal ?? -1} .disabled=${this.sourceBlocked || this.sourceTotal === null}
        .strings=${this.strings} @lr-page-change=${this.onSourcePage} @lr-before-page-change=${this.stopOwnedEvent} @lr-activate=${this.stopOwnedEvent}
        @focus=${this.stopOwnedEvent} @blur=${this.stopOwnedEvent}></lr-pagination>
    </div>`;
  }

  override render(): TemplateResult {
    if (this.sourceMode) return this.renderSource();
    const items = this.normalizedItems;
    const ariaLabel = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('ingestionQueueLabel') : this.label
    );
    const regionRole = retrievalSemanticRole(this, 'region');

    if (items.length === 0) {
      return html`<div
        part="base"
        role=${regionRole ?? nothing}
        aria-label=${ariaLabel ?? nothing}
      >
        ${this.renderInputLimit()}
        <div part="failure-live" class="sr-only" aria-hidden="true">
          ${this.failureLiveText}
        </div>
        <div part="list">
          <lr-empty
            part="empty"
            heading=${this.localize('ingestionQueueEmpty')}
          ></lr-empty>
        </div>
      </div>`;
    }

    return html`
      <div
        part="base"
        role=${regionRole ?? nothing}
        aria-label=${ariaLabel ?? nothing}
      >
        ${this.renderInputLimit()}
        <div part="failure-live" class="sr-only" aria-hidden="true">
          ${this.failureLiveText}
        </div>
        ${this.renderRows(items)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-ingestion-queue': LyraIngestionQueue;
  }
}
