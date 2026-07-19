import { html, nothing, svg, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getPluralRules } from '../../../internal/intl-cache.js';
import { closeIcon } from '../../../internal/icons.js';
import type { CancelEventDetail, DocumentRef, RetryEventDetail } from '../../../ai/types.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
// The registering barrels (not the bare *.class.js modules) -- this side effect is what actually
// defines <lr-badge>/<lr-progress-bar>/<lr-empty>/<lr-virtual-list> as custom elements by the
// time this component's render() references them.
import '../../overlays/badge/badge.js';
import '../../overlays/progress/progress-bar.js';
import '../../overlays/empty/empty.js';
import '../../layout/virtual-list/virtual-list.js';
import { styles } from './ingestion-queue.styles.js';

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

/** In-flight stages that render a progress indicator and remain cancelable. `'queued'` is also
 *  cancelable (see `CANCELABLE_STAGES`) but has nothing yet to show progress *of*. */
const ACTIVE_STAGES: readonly IngestionStage[] = ['uploading', 'extracting', 'chunking', 'embedding', 'indexing'];

/** Every non-terminal stage -- the set a `lr-cancel` request is offered for. */
const CANCELABLE_STAGES: readonly IngestionStage[] = ['queued', ...ACTIVE_STAGES];

function badgeVariantForStage(stage: IngestionStage): BadgeVariant {
  switch (stage) {
    case 'done':
      return 'success';
    case 'failed':
      return 'danger';
    case 'queued':
    case 'cancelled':
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

/** `lr-retry`'s `detail` -- extends the shared `RetryEventDetail` (`src/ai/types.ts`) with the
 *  `itemId` identifying *which* queue item the request is about; `attempt` is the attempt number
 *  about to be made (`(item.attempts ?? 0) + 1`), matching `RetryEventDetail.attempt`'s own
 *  semantics verbatim. */
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

const DEFAULT_VIRTUALIZE_THRESHOLD = 100;

/**
 * `<lr-ingestion-queue>` — a controlled list of documents moving through an ingestion pipeline
 * (upload → text extraction → chunking → embedding → indexing), each row showing its stage,
 * progress, chunk/embedding counts, and a retry or cancel affordance. Presentation only: this
 * component runs no ingestion itself, persists nothing, and never mutates `items` -- retrying or
 * cancelling a row fires a controlled `lr-retry`/`lr-cancel` request event and waits for the host
 * to supply an updated `items` array, the same request/response convention `<lr-thread-list>`'s
 * `lr-thread-pin`/`-archive`/`-delete` events already establish.
 *
 * At or above `virtualizeThreshold` items, the list renders through an internal
 * `<lr-virtual-list>` instead of a plain keyed list (same precedent as `<lr-thread-list>`'s data
 * mode and `<lr-activity-feed>`'s `virtualizeThreshold`) -- identical row markup and behavior
 * either way, keyed by `id`.
 *
 * @customElement lr-ingestion-queue
 * @event lr-retry - A row's retry affordance was activated (only rendered for `stage="failed"`
 *   rows). `detail: { itemId, attempt }` -- `attempt` is the attempt number about to be made.
 * @event lr-cancel - A row's cancel affordance was activated (rendered for every non-terminal
 *   row). `detail: { itemId, reason }` -- `reason` is always `undefined` from this component.
 * @csspart base - The root region.
 * @csspart list - The row container in non-virtualized mode (`role="list"`).
 * @csspart empty - The `<lr-empty>` zero-items state.
 * @csspart item - One queue item row; carries `data-stage`. When virtualized, reached from this
 *   component's own stylesheet via `lr-virtual-list::part(item)` (renders inside the internal
 *   `<lr-virtual-list>`'s own shadow root, not this component's).
 * @csspart item-header - The row's name/stage-badge line.
 * @csspart item-name - The document's `name`.
 * @csspart item-progress - The row's `<lr-progress-bar>`, only rendered for an active (uploading
 *   through indexing) stage.
 * @csspart item-meta - Wrapper around the chunk-count/embedding-status/attempt-count text.
 * @csspart item-chunk-count - The chunk count, only rendered once `chunkCount` is set.
 * @csspart item-embedding-status - The "N of M chunks embedded" text, only rendered once both
 *   `chunkCount` and `embeddedChunkCount` are set.
 * @csspart item-attempts - The attempt count, only rendered once `attempts` is greater than 0.
 * @csspart item-error - The failure message, only rendered for `stage="failed"` with `error` set.
 * @csspart item-actions - Wrapper around the retry/cancel buttons.
 * @csspart retry-button - Fires `lr-retry`. Only rendered for `stage="failed"` rows.
 * @csspart cancel-button - Fires `lr-cancel`. Only rendered for non-terminal rows.
 * @cssprop [--lr-ingestion-queue-max-height=none] - Non-virtualized mode only: caps how tall the
 *   list grows before it scrolls internally. Has no effect once virtualized -- the internal
 *   `<lr-virtual-list>`'s own viewport keeps its independent, fixed default height (retheme it
 *   directly via `<lr-ingestion-queue>`'s own `lr-virtual-list { --lr-virtual-list-height: ... }`
 *   if needed).
 */
export class LyraIngestionQueue extends LyraElement<LyraIngestionQueueEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The queue to render, in display order. Controlled and never mutated by this component --
   *  pass a new array (e.g. as ingestion progresses) to update it. */
  @property({ attribute: false }) items: IngestionQueueItem[] = [];

  /** Accessible name for the region. Defaults to the localized `ingestionQueueLabel`. A host
   *  `aria-label` attribute wins over both. */
  @property() label = '';

  /** At/above this item count, the list renders through an internal `<lr-virtual-list>`. */
  @property({ type: Number, attribute: 'virtualize-threshold' }) virtualizeThreshold = DEFAULT_VIRTUALIZE_THRESHOLD;

  /** `virtualizeThreshold`, normalized to a finite non-negative integer (falling back to the
   *  property's own default) -- a raw `NaN` (e.g. an invalid `virtualize-threshold` attribute)
   *  would otherwise make `items.length >= virtualizeThreshold` always false, silently disabling
   *  virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeThreshold(): number {
    return finiteCount(this.virtualizeThreshold, DEFAULT_VIRTUALIZE_THRESHOLD);
  }

  private get isVirtualized(): boolean {
    return this.items.length >= this.effectiveVirtualizeThreshold;
  }

  private stageLabel(stage: IngestionStage): string {
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
    }
  }

  private chunkCountText(count: number): string {
    const plural = getPluralRules(this.effectiveLocale).select(count) !== 'one';
    return plural
      ? this.localize('ingestionChunkCountPlural', undefined, { count })
      : this.localize('ingestionChunkCount', undefined, { count });
  }

  private onRetryClick(item: IngestionQueueItem): void {
    this.emit<IngestionRetryEventDetail>('lr-retry', { itemId: item.id, attempt: (item.attempts ?? 0) + 1 });
  }

  private onCancelClick(item: IngestionQueueItem): void {
    this.emit<IngestionCancelEventDetail>('lr-cancel', { itemId: item.id });
  }

  private itemTemplate = (item: IngestionQueueItem, ownRole: boolean): TemplateResult => {
    const stageLabel = this.stageLabel(item.stage);
    const showProgress = ACTIVE_STAGES.includes(item.stage);
    const canRetry = item.stage === 'failed';
    const canCancel = CANCELABLE_STAGES.includes(item.stage);
    const hasMeta =
      item.chunkCount !== undefined || item.embeddedChunkCount !== undefined || (item.attempts ?? 0) > 0;
    const indeterminate = item.progress === undefined || !Number.isFinite(item.progress);

    return html`
      <div part="item" role=${ownRole ? 'listitem' : nothing} data-stage=${item.stage}>
        <div part="item-header">
          <span part="item-name" title=${item.document.name}>${item.document.name}</span>
          <lr-badge part="item-stage" variant=${badgeVariantForStage(item.stage)}>${stageLabel}</lr-badge>
        </div>
        ${showProgress
          ? html`<lr-progress-bar
              part="item-progress"
              .value=${item.progress ?? 0}
              ?indeterminate=${indeterminate}
              accessible-label=${this.localize('ingestionItemProgressLabel', undefined, {
                name: item.document.name,
                stage: stageLabel,
              })}
            ></lr-progress-bar>`
          : nothing}
        ${hasMeta
          ? html`<div part="item-meta">
              ${item.chunkCount !== undefined
                ? html`<span part="item-chunk-count">${this.chunkCountText(item.chunkCount)}</span>`
                : nothing}
              ${item.chunkCount !== undefined && item.embeddedChunkCount !== undefined
                ? html`<span part="item-embedding-status"
                    >${this.localize('ingestionEmbeddedOfTotal', undefined, {
                      embedded: item.embeddedChunkCount,
                      total: item.chunkCount,
                    })}</span
                  >`
                : nothing}
              ${(item.attempts ?? 0) > 0
                ? html`<span part="item-attempts"
                    >${this.localize('ingestionAttemptCount', undefined, { count: item.attempts! })}</span
                  >`
                : nothing}
            </div>`
          : nothing}
        ${item.stage === 'failed' && item.error
          ? html`<p part="item-error" role="alert">${item.error}</p>`
          : nothing}
        ${canRetry || canCancel
          ? html`<div part="item-actions">
              ${canRetry
                ? html`<button
                    part="retry-button"
                    type="button"
                    aria-label=${this.localize('ingestionRetryWithContext', undefined, {
                      label: item.document.name,
                    })}
                    @click=${() => this.onRetryClick(item)}
                  >
                    ${retryIcon()}<span>${this.localize('retry')}</span>
                  </button>`
                : nothing}
              ${canCancel
                ? html`<button
                    part="cancel-button"
                    type="button"
                    aria-label=${this.localize('ingestionCancelWithContext', undefined, {
                      label: item.document.name,
                    })}
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

  render(): TemplateResult {
    const computedLabel = this.label || this.localize('ingestionQueueLabel');
    const ariaLabel = this.getAttribute('aria-label') || computedLabel;

    if (this.items.length === 0) {
      return html`<lr-empty
        part="empty"
        heading=${this.localize('ingestionQueueEmpty')}
      ></lr-empty>`;
    }

    const virtualized = this.isVirtualized;
    return html`
      <div part="base" role="region" aria-label=${ariaLabel}>
        ${virtualized
          ? html`<lr-virtual-list
              .items=${this.items}
              .renderItem=${(item: unknown) => this.itemTemplate(item as IngestionQueueItem, false)}
              .keyFunction=${(item: unknown) => (item as IngestionQueueItem).id}
              aria-label=${ariaLabel}
            ></lr-virtual-list>`
          : html`<div part="list" role="list" aria-label=${ariaLabel}>
              ${repeat(
                this.items,
                (item) => item.id,
                (item) => this.itemTemplate(item, true),
              )}
            </div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-ingestion-queue': LyraIngestionQueue;
  }
}
