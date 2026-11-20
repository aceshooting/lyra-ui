import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { captureComposedFocusRepair, applyComposedFocusRepair, type ComposedFocusRepairSnapshot } from '../../../internal/focus-navigation.js';
import { tag } from '../../../internal/prefix.js';
import { loadLazyChildren } from '../../../internal/lazy-children.js';
import { devWarnOnce } from '../../../internal/dev-warning.js';
import { projectIngestionPresentation, ingestionActionKey, type IngestionPresentationProjection,
  type IngestionQueueAction, type IngestionQueueStagePresentation, type IngestionItemActionEventDetail } from './ingestion-queue-presentation.js';
export type { IngestionQueueAction, IngestionQueueStagePresentation, IngestionItemActionEventDetail } from './ingestion-queue-presentation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import {
  firstByRetrievalIdentity,
  isNonBlankIdentity,
  isRecord,
} from '../retrieval-identity.js';
import { readOwnDataValue } from '../../../internal/data-descriptors.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  AnnouncementSinkController,
} from '../../../internal/announcer.js';
import type { LyraPageSource, LyraPageResult, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController, type SourcePageState } from '../../../internal/source-page-controller.js';
import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { finiteCount } from '../../../internal/numbers.js';
import { displayedSourcePage, normalizeSourcePage, normalizeSourcePageSize } from '../../../internal/source-paging.js';
import {
  getListFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import { closeIcon, retryIcon } from '../../../internal/icons.js';
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
import { blankNumberConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_ingestionActionWithContext, LYRA_DEFAULT_ingestionAttemptCount, LYRA_DEFAULT_ingestionCancelWithContext, LYRA_DEFAULT_ingestionChunkCount, LYRA_DEFAULT_ingestionEmbeddedOfTotal, LYRA_DEFAULT_ingestionItemProgressLabel, LYRA_DEFAULT_ingestionQueueActionLimit, LYRA_DEFAULT_ingestionQueueEmpty, LYRA_DEFAULT_ingestionQueueInputLimit, LYRA_DEFAULT_ingestionQueueLabel, LYRA_DEFAULT_ingestionRetryWithContext, LYRA_DEFAULT_ingestionStageCancelled, LYRA_DEFAULT_ingestionStageChunking, LYRA_DEFAULT_ingestionStageDone, LYRA_DEFAULT_ingestionStageEmbedding, LYRA_DEFAULT_ingestionStageExtracting, LYRA_DEFAULT_ingestionStageFailed, LYRA_DEFAULT_ingestionStageIndexing, LYRA_DEFAULT_ingestionStageQueued, LYRA_DEFAULT_ingestionStageUnknown, LYRA_DEFAULT_ingestionStageUploading, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings/retrieval.generated.js';
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
  | 'cancelled'
  | 'custom';

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
  'custom',
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
const DEFAULT_RETRY_ACTIONS: readonly IngestionQueueAction[] = Object.freeze([Object.freeze({ type: 'retry' })]);
const DEFAULT_CANCEL_ACTIONS: readonly IngestionQueueAction[] = Object.freeze([Object.freeze({ type: 'cancel' })]);
const NO_ACTIONS: readonly IngestionQueueAction[] = Object.freeze([]);

function badgeVariantForStage(stage: RenderedIngestionStage): BadgeVariant {
  switch (stage) {
    case 'done':
      return 'success';
    case 'failed':
      return 'danger';
    case 'queued':
    case 'cancelled':
    case 'unknown':
    case 'custom':
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
  /** Caller-localized display for stage='custom'. Invalid metadata leaves an inert Unknown stage. */
  customStage?: IngestionQueueStagePresentation;
  /** Explicit replacement action list. Omit for existing stage-derived Retry/Cancel; [] hides all. */
  actions?: readonly IngestionQueueAction[];
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
  'lr-item-action': CustomEvent<IngestionItemActionEventDetail>;
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
 * stage='custom' uses bounded caller-supplied customStage text/tone/progress and derives no actions.
 * An explicit actions list replaces defaults; built-ins retain lifecycle eligibility and custom
 * actions emit requests only. Publish a new collection/source revision to change availability;
 * the host remains responsible for every operation and server authorization.
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
 * @event lr-item-action - A current enabled custom action was activated. Frozen detail: { itemId, actionId }.
 * @csspart item-action-button - A host-defined native row action; also forwarded when virtualized.
 * @csspart item-action-limit - Visible notice when a row's action list exceeds the inspected prefix.
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
 * @cssprop [--lr-ingestion-queue-action-hover-color=var(--lr-color-brand)] - Border and label color of a hovered or pressed retry/item action button.
 * @cssprop [--lr-ingestion-queue-action-active-bg=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed background of the retry/item action buttons.
 * @cssprop [--lr-ingestion-queue-cancel-hover-color=var(--lr-color-danger)] - Border and label color of a hovered or pressed cancel button.
 * @cssprop [--lr-ingestion-queue-cancel-active-bg=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed background of the cancel button.
 * @status stable
 * @since 4.1.0
 */
export class LyraIngestionQueue extends LyraElement<LyraIngestionQueueEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    cancel: LYRA_DEFAULT_cancel,
    ingestionActionWithContext: LYRA_DEFAULT_ingestionActionWithContext,
    ingestionAttemptCount: LYRA_DEFAULT_ingestionAttemptCount,
    ingestionCancelWithContext: LYRA_DEFAULT_ingestionCancelWithContext,
    ingestionChunkCount: LYRA_DEFAULT_ingestionChunkCount,
    ingestionEmbeddedOfTotal: LYRA_DEFAULT_ingestionEmbeddedOfTotal,
    ingestionItemProgressLabel: LYRA_DEFAULT_ingestionItemProgressLabel,
    ingestionQueueActionLimit: LYRA_DEFAULT_ingestionQueueActionLimit,
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
  protected static override readonly immutableEventDetails = Object.freeze(['lr-item-action']);
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
  private readonly presentations = new WeakMap<IngestionQueueItem, IngestionPresentationProjection>();
  private actionFocusRepair?: { snapshot: ComposedFocusRepairSnapshot; itemId: string; actionIndex: number; rowIndex: number };
  private focusRepairGeneration = 0;
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
  @property({ converter: blankNumberConverter(0), attribute: 'source-page' }) sourcePage = 0;
  /** Provider page size, normalized to 1..500. A size change resets the source page to 0. */
  @property({ converter: blankNumberConverter(100), attribute: 'source-page-size' }) sourcePageSize = 100;
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
    const presentation = projectIngestionPresentation(raw as object, stage, isCurrent, 65_536 - units);
    const value = Object.freeze({ id, document, stage, error, ...numbers,
      ...(presentation.customStage ? { customStage: presentation.customStage } : {}),
      ...(presentation.actions === undefined ? {} : { actions: presentation.actions }),
    }) as IngestionQueueItem;
    this.presentations.set(value, presentation);
    assertCurrent();
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
      const size = normalizeSourcePageSize(this.sourcePageSize);
      let page = normalizeSourcePage(this.sourcePage, size);
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
  @property({ converter: blankNumberConverter(DEFAULT_VIRTUALIZE_AT), attribute: 'virtualize-at' }) virtualizeAt =
    DEFAULT_VIRTUALIZE_AT;

  /** Opts this queue into announcing the failures it already carries when it first mounts, through
   *  the same shared assertive region, the same list formatting and the same caller-supplied
   *  `item.error` text a later failure uses. Leave unset for a queue that is part of the page a
   *  user is arriving on: those rows render in document order and repeating them is noise. Set it
   *  when the queue is created in response to a user action — a retried ingestion run that mounts
   *  a fresh queue already holding `stage: 'failed'` rows would otherwise never speak them. Read
   *  once per element lifetime: a later reconnection or adoption stages the same rows again rather
   *  than replaying the announcement, and later failures announce either way. Remove any host
   *  `role="status"`/`role="alert"` hand-added once it is set --
   *  otherwise the initial failures are announced twice, through the native role and again
   *  through the shared sink. */
  @property({ type: Boolean, reflect: true }) announce = false;

  @state() private failureLiveText = '';
  private isMounting = true;
  /** True once the `announce` opt-in has spoken the mount-time failures, so a reconnection (which
   *  resets `isMounting`) stages them as history instead of replaying them. */
  private initialFailuresAnnounced = false;
  /** Shared light-DOM live regions (polite limits, assertive failures) announce through -- a
   *  region rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores
   *  one outright), so `[part="failure-live"]` is only an `aria-hidden` mirror. */
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite', 'assertive'] });
  private limitInitialized = false;
  private previouslyInputTruncated = false;

  override adoptedCallback(): void {
    this.detached.flush();
    this.focusRepairGeneration++;
    this.actionFocusRepair = undefined;
    super.adoptedCallback();
    this.announcements.adopted();
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
  private childRegistration?: Promise<unknown>;

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    await this.childRegistration;
    return complete;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.childRegistration = loadLazyChildren('ingestion-queue', this.renderRoot) ?? this.childRegistration;
    this.restoreActionFocus();
    if (this.sourceMode) {
      const status = this.sourceFailed ? this.localize('tableLoadFailed')
        : this.sourcePages.state.pending ? this.localize('loading') : '';
      if (this.sourceStatusInitialized && status && status !== this.previousSourceStatus) this.announcements.announcePolite(status);
      this.sourceStatusInitialized = true; this.previousSourceStatus = status;
      return;
    }
    this.sourceStatusInitialized = false; this.previousSourceStatus = '';
    const inputTruncated = publicCollectionTruncation(this, 'items') !== undefined;
    if (this.limitInitialized && inputTruncated && !this.previouslyInputTruncated) {
      this.announcements.announcePolite(this.inputLimitText());
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
        const presentation = projectIngestionPresentation(valueItem, fields['stage'], () => this.items === value && !this.sourceMode);
        const row = Object.freeze({ ...fields, id, document,
          ...(error === undefined ? {} : { error: error === null || typeof error === 'string' ? error : this.localize('ingestionStageFailed') }),
          ...(presentation.customStage ? { customStage: presentation.customStage } : {}),
          ...(presentation.actions === undefined ? {} : { actions: presentation.actions }),
        }) as IngestionQueueItem;
        this.presentations.set(row, presentation);
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
    const moved = this.detached.cancel();
    super.connectedCallback();
    if (!moved && this.hasUpdated) this.requestUpdate();
  }

  /** A same-task DOM move keeps the accepted page and its announced status; a real disconnect resets them. */
  private readonly detached = new DeferredTeardown(() => {
    this.failureLiveText = '';
    this.sourceStatusInitialized = false;
    this.previousSourceStatus = '';
    this.isMounting = true;
  });

  override disconnectedCallback(): void {
    this.focusRepairGeneration++;
    this.actionFocusRepair = undefined;
    super.disconnectedCallback();
    this.detached.schedule();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncSource();
    if (this.sourceMode) { this.acceptSourcePage(); this.captureActionFocus(); this.failureLiveText = ''; this.isMounting = true; return; }
    this.captureActionFocus();
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
    if (this.failureLiveText !== '') this.announcements.announceAssertive(this.failureLiveText);
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
      case 'custom':
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

  private itemStage(item: IngestionQueueItem): RenderedIngestionStage {
    const stage = normalizedStage(item.stage);
    return stage === 'custom' && !item.customStage ? 'unknown' : stage;
  }

  private rowActions(item: IngestionQueueItem): readonly IngestionQueueAction[] {
    const stage = this.itemStage(item);
    if (stage === 'unknown') return NO_ACTIONS;
    const actions = item.actions ?? (stage === 'failed' ? DEFAULT_RETRY_ACTIONS
      : CANCELABLE_STAGES.includes(stage) ? DEFAULT_CANCEL_ACTIONS : NO_ACTIONS);
    return actions.filter(action => action.type === 'custom' ||
      (action.type === 'retry' ? stage === 'failed' : CANCELABLE_STAGES.includes(stage)));
  }

  private currentRows(): readonly IngestionQueueItem[] {
    return this.sourceMode ? this.sourceRows : this.normalizedItems;
  }

  private activateRowAction(item: IngestionQueueItem, action: IngestionQueueAction): void {
    if (!this.isConnected || (this.sourceMode && this.sourceBlocked) ||
      !this.currentRows().includes(item) || !this.rowActions(item).includes(action) || action.disabled) return;
    if (action.type === 'retry') this.emit('lr-retry', { itemId: item.id, attempt: this.normalizedAttempts(item) + 1 });
    else if (action.type === 'cancel') this.emit('lr-cancel', { itemId: item.id });
    else if (action.type === 'custom') this.emit('lr-item-action', Object.freeze({ itemId: item.id, actionId: action.id }));
  }

  private renderedActionButtons(): HTMLButtonElement[] {
    const virtual = this.renderRoot.querySelector<HTMLElement>(tag('virtual-list'));
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('button[data-ingestion-action]'),
      ...(virtual?.shadowRoot?.querySelectorAll<HTMLButtonElement>('button[data-ingestion-action]') ?? [])];
  }

  private captureActionFocus(): void {
    const active = deepActiveElementIn(this.ownerDocument);
    if (!active?.hasAttribute('data-ingestion-action')) return;
    const rendered = this.renderedActionButtons();
    if (!rendered.includes(active as HTMLButtonElement)) return;
    const itemId = active.getAttribute('data-ingestion-item')!;
    const key = active.getAttribute('data-ingestion-action')!;
    const rows = this.currentRows();
    const current = rows.find(row => row.id === itemId);
    if (current && this.rowActions(current).some(action => ingestionActionKey(action) === key && !action.disabled)) return;
    const snapshot = captureComposedFocusRepair(this, active as HTMLElement);
    if (!snapshot) return;
    const siblings = rendered.filter(button => button.getAttribute('data-ingestion-item') === itemId);
    const renderedIds = [...new Set(rendered.map(button => button.getAttribute('data-ingestion-item')))];
    this.focusRepairGeneration++;
    this.actionFocusRepair = { snapshot, itemId, actionIndex: Math.max(0, siblings.indexOf(active as HTMLButtonElement)),
      rowIndex: Math.max(0, renderedIds.indexOf(itemId)) };
  }

  private restoreActionFocus(): void {
    const pending = this.actionFocusRepair;
    this.actionFocusRepair = undefined;
    if (!pending) return;
    const generation = this.focusRepairGeneration;
    void this.updateComplete.then(async () => {
      const virtual = this.renderRoot.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>(tag('virtual-list'));
      if (virtual) await virtual.updateComplete;
      if (!this.isConnected || generation !== this.focusRepairGeneration) return;
      const available = this.renderedActionButtons().filter(button => !button.disabled);
      const sameRow = available.filter(button => button.getAttribute('data-ingestion-item') === pending.itemId);
      const target = sameRow[Math.min(pending.actionIndex, sameRow.length - 1)];
      const ids = [...new Set(available.map(button => button.getAttribute('data-ingestion-item')))];
      const nearId = ids[Math.min(pending.rowIndex, ids.length - 1)];
      const nearby = available.filter(button => button.getAttribute('data-ingestion-item') === nearId);
      const list = this.renderRoot.querySelector<HTMLElement>('[part="list"]');
      const virtualBase = virtual?.shadowRoot?.querySelector<HTMLElement>('[part="base"]');
      applyComposedFocusRepair(pending.snapshot, [target, ...sameRow, ...nearby, virtualBase, list]);
    });
  }

  private renderRowAction(item: IngestionQueueItem, action: IngestionQueueAction, name: string): TemplateResult {
    const custom = action.type === 'custom';
    const part = custom ? 'item-action-button' : action.type === 'retry' ? 'retry-button' : 'cancel-button';
    const label = custom ? action.label : this.localize(action.type === 'retry' ? 'retry' : 'cancel');
    const accessibleName = custom ? this.localize('ingestionActionWithContext', undefined, { action: label, label: name })
      : this.localize(action.type === 'retry' ? 'ingestionRetryWithContext' : 'ingestionCancelWithContext', undefined, { label: name });
    return html`<button part=${part} type="button" ?disabled=${action.disabled === true}
      data-ingestion-item=${item.id} data-ingestion-action=${ingestionActionKey(action)}
      aria-label=${accessibleName} @click=${() => this.activateRowAction(item, action)}
      >${custom ? nothing : action.type === 'retry' ? retryIcon() : closeIcon()}<span>${label}</span></button>`;
  }

  private renderActionLimit(item: IngestionQueueItem, name: string): TemplateResult | typeof nothing {
    const limit = this.presentations.get(item)?.actionLimit;
    if (!limit) return nothing;
    devWarnOnce(`lyra-ingestion-action-limit:${this.localName}`, `<${this.localName}>: a row retained ${limit.retained} of ${limit.source} actions; only the first 32 action positions are inspected.`);
    const number = getNumberFormat(this.effectiveLocale);
    return html`<p part="item-action-limit" role="note">${this.localize('ingestionQueueActionLimit', undefined,
      { count: number.format(limit.retained), total: number.format(limit.source), label: name })}</p>`;
  }

  private itemTemplate = (
    item: IngestionQueueItem,
    ownRole: boolean
  ): TemplateResult => {
    const stage = this.itemStage(item);
    const stageLabel = stage === 'custom' ? item.customStage!.label : this.stageLabel(stage);
    const name = item.document.name.trim()
      ? item.document.name
      : this.localize('untitledSource');
    const showProgress = stage === 'custom' ? item.customStage!.showProgress === true : ACTIVE_STAGES.includes(stage as IngestionStage);
    const actions = this.rowActions(item);
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
          <lr-badge part="item-stage" variant=${stage === 'custom' ? item.customStage!.variant ?? 'neutral' : badgeVariantForStage(stage)}
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
        ${actions.length
          ? html`<div part="item-actions">${repeat(actions, ingestionActionKey, action => this.renderRowAction(item, action, name))}</div>`
          : nothing}
        ${this.renderActionLimit(item, name)}
      </div>
    `;
  };

  private renderRows(items: readonly IngestionQueueItem[]): TemplateResult {
    const virtualized = items.length > this.effectiveVirtualizeAt;
    return virtualized
          ? html`<lr-virtual-list
              part="list"
              exportparts="item:item, item-header:item-header, item-name:item-name, item-stage:item-stage, item-progress:item-progress, item-meta:item-meta, item-chunk-count:item-chunk-count, item-embedding-status:item-embedding-status, item-attempts:item-attempts, item-error:item-error, item-actions:item-actions, retry-button:retry-button, cancel-button:cancel-button, item-action-button:item-action-button, item-action-limit:item-action-limit"
              .items=${items}
              .renderItem=${(item: unknown) =>
                this.itemTemplate(item as IngestionQueueItem, false)}
              .keyFunction=${this.ingestionItemKey}
              @lr-virtual-scroll=${this.stopOwnedEvent}
              @lr-visible-range-change=${this.stopOwnedEvent}
            ></lr-virtual-list>`
          : html`<div part="list" role="list" tabindex="-1">
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
      ${failed || pending ? nothing : this.sourceRows.length ? this.renderRows(this.sourceRows) : html`<div part="list" tabindex="-1"><lr-empty part="empty" heading=${this.localize('ingestionQueueEmpty')}></lr-empty></div>`}
      <lr-pagination part="source-pagination" format="compact" .page=${displayedSourcePage(this.sourcePage)}
        .pageSize=${normalizeSourcePageSize(this.sourcePageSize)} .total=${this.sourceTotal ?? -1} .disabled=${this.sourceBlocked || this.sourceTotal === null}
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
        <div part="list" tabindex="-1">
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
