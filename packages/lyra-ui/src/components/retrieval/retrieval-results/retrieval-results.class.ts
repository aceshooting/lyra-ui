import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity, canonicalIdentityList } from '../retrieval-identity.js';
import {
  finiteCount,
  finiteNumber,
  finiteRange,
} from '../../../internal/numbers.js';
import type { DocumentLocator, RetrievalChunk } from '../../../ai/types.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { LyraVirtualListGroup } from '../../layout/virtual-list/virtual-list.class.js';
import { styles } from './retrieval-results.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import type { LyraScoreThresholds } from '../graph/graph.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chunkInspectorEmpty, LYRA_DEFAULT_chunkInspectorLabel, LYRA_DEFAULT_loadMore, LYRA_DEFAULT_retrievalResultsSelectRow, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** `lr-select`'s detail: the complete updated selection, both as bare ids and as one deterministic
 *  canonical `RetrievalChunk` record per id. This event contract is independent of the visible
 *  `dedupe` projection: duplicate rows never duplicate derived selection records. */
export interface RetrievalResultsSelectDetail {
  chunkIds: string[];
  chunks: RetrievalChunk[];
}

export interface LyraRetrievalResultsEventMap {
  'lr-select': CustomEvent<LyraEventDetailSnapshot<RetrievalResultsSelectDetail>>;
  'lr-load-more': CustomEvent<null>;
  'lr-chunk-open': CustomEvent<LyraEventDetailSnapshot<{
    chunkId: string;
    sourceId: string;
    anchor?: DocumentLocator;
  }>>;
}

export type RetrievalResultsGrouping = 'source' | 'custom' | 'none';
export type RetrievalResultsPresentation = 'compact' | 'expanded';

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
 * coloring, title+page rendering, expandable text, and `compact` mode verbatim -- this component
 * never hand-rolls chunk-card markup. `metadata` (arbitrary `Record<string, unknown>`, which no
 * existing primitive renders) is the one genuinely new bit of presentation here, shown as a plain
 * key/value list in `expanded` presentation only. Large result sets are windowed through an
 * internal `<lr-virtual-list>`, exactly like `<lr-thread-list>`'s own data-mode rendering -- each
 * row's rendered content therefore lives inside `<lr-virtual-list>`'s own shadow root, not this
 * component's, whenever virtualization is active (see that component's own doc for why).
 *
 * **Controlled component.** `chunks`/`selectedChunkIds`/`loading`/`errorText`/`hasMore` are all
 * host-owned;
 * this component never fetches, retries, or mutates its own copy of `chunks`. Selecting a row
 * updates `selectedChunkIds` locally *then* emits `lr-select` (the same "update own copy, then
 * emit; reassign to control" convention `<lr-source-picker>` already uses) so a host can either
 * accept the update as-is or override it before the next render.
 *
 * **Identity.** Blank chunk ids and later duplicates are always omitted first-wins before sorting,
 * grouping, selection, rendering, or events. The `dedupe` switch is retained for compatibility but
 * cannot reintroduce ambiguous duplicate identities. **Grouping** (`grouping="source"`) buckets the
 * canonical, score-sorted list by `source.id`, each bucket
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
 * @customElement lr-retrieval-results
 * @event lr-select - The selected-chunk set changed. `detail: { chunkIds, chunks }` — `chunkIds`
 * is the complete updated selection (not just the toggled id), `chunks` the matching canonical
 * `RetrievalChunk` records.
 * @event lr-load-more - More results were requested — via the internal `<lr-virtual-list>`'s own
 * scroll-near-bottom detection while virtualized, or the built-in `[part="load-more"]` button
 * otherwise. Only ever fires while `has-more` is true and `loading` is false.
 * @event lr-chunk-open - A row's title/open button was activated, forwarded verbatim from the
 * per-row `<lr-chunk-inspector>`'s own `lr-chunk-open`. `detail: { chunkId, sourceId, anchor? }` — the
 * event a host routes into `<lr-document-viewer>`.
 * @csspart base - The outer container and programmatic focus fallback when a controlled
 * collection/state transition removes every focused result action.
 * @csspart error - The neutral, visible error message shown while `errorText` is non-empty. New
 *   non-empty errors are announced through a shared assertive light-DOM region; initial and
 *   reconnect content is not replayed.
 * @csspart spinner - The initial-load `<lr-spinner>`, shown while `loading` is true and `chunks`
 * is still empty.
 * @csspart empty - The `<lr-empty>` wrapper, shown when `chunks` is empty and neither `errorText` nor
 * `loading` is set. A later transition into this settled state is announced through a shared
 * polite light-DOM region; initial and reconnect content is not replayed.
 * @csspart row - One result row's wrapper. Below the virtualization threshold this is a plain,
 * directly-styleable element in this component's own shadow root; while virtualized it is exported
 * from the internal `<lr-virtual-list>`'s own `row` part instead (`::part(row)` still reaches it
 * either way).
 * @csspart group-header - Exported from the internal `<lr-virtual-list>`'s `group` part —
 * grouped/virtualized mode only.
 * @csspart select - The per-row `<lr-checkbox>`, omitted entirely when `selectable` is false.
 * @csspart row-body - The wrapper around a row's `<lr-chunk-inspector>` plus its optional
 * metadata list; carries `data-selected` while that row is selected.
 * @csspart row-body-selected - Additional part on a selected `row-body`. State is exposed as a
 * second part name because Shadow Parts forbids an attribute selector after `::part()` —
 * `::part(row-body)[data-selected]` is invalid CSS, and while virtualized `::part()` is the only
 * way in. A state part is a second token in the same `part` attribute, so a `[part~="…"]` (not
 * `[part="…"]`) selector is the one that matches inside a tree.
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
    retrievalResultsSelectRow: LYRA_DEFAULT_retrievalResultsSelectRow,
    untitledSource: LYRA_DEFAULT_untitledSource,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['chunks', 'selectedChunkIds', 'groupOrder']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-select',
    'lr-chunk-open',
  ]);

  /** The raw (not deduplicated/sorted/grouped) result set. Host-owned. */
  @property({ attribute: false }) chunks: readonly RetrievalChunk[] = [];

  /** Controlled selection, by chunk `id`. The component updates its own copy on toggle *then*
   *  emits `lr-select`; reassign to control. An id with no matching chunk is harmless -- it simply
   *  never renders a checked row. */
  @property({ attribute: false }) selectedChunkIds: readonly string[] = [];

  /** Shows a per-row `<lr-checkbox>`. */
  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  selectable = true;

  /** Retained for compatibility. Identity is always nonblank and first-wins even when false. */
  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  dedupe = true;

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
   *  reconnect content is not replayed. */
  @property({ attribute: 'error-text' }) errorText = '';

  /** Fallback name for the results region. Omitting it falls back to the localized
   *  `chunkInspectorLabel` ("Retrieved chunks") -- reused rather than a new key, since it already
   *  says exactly what this region is. An explicit empty string clears the fallback. A non-empty
   *  host `aria-label` makes the host the sole overall owner; an explicitly empty host label stays
   *  empty on the region. */
  @property() label?: string;
  private pendingFocusTarget: string | 'base' | undefined;
  private previousProcessedChunkIds: string[] = [];
  private focusRestoreGeneration = 0;
  private isMounting = true;
  private errorAnnouncementSink?: AnnouncementSink;
  private emptyAnnouncementSink?: AnnouncementSink;
  private wasEmptyPresented = false;
  // Memoizes `computeProcessedChunks()` (identity + sort + group) for the current render cycle.
  // `willUpdate()` refreshes it exactly once whenever an input it actually depends on (`chunks`,
  // `dedupe`, `sort`, `grouping`) changed, so `updated()` and `render()` each read the same
  // already-computed result instead of independently repeating the full identity/sort/group work.
  private processedChunksCache?: {
    chunks: readonly RetrievalChunk[];
    groups: LyraVirtualListGroup[];
  };

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
  }

  override disconnectedCallback(): void {
    this.isMounting = true;
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
    this.emptyAnnouncementSink?.release();
    this.emptyAnnouncementSink = undefined;
    this.wasEmptyPresented = false;
    super.disconnectedCallback();
  }

  private deepActiveElement(): Element | null {
    return deepActiveElementIn(this.shadowRoot);
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
    const virtualList = this.renderRoot.querySelector('lr-virtual-list');
    if (virtualList?.shadowRoot) roots.push(virtualList.shadowRoot);
    return roots.flatMap((root) =>
      [...root.querySelectorAll('lr-chunk-inspector[data-chunk-id]')]
        .map((element) => element.getAttribute('data-chunk-id'))
        .filter((id): id is string => id !== null)
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // Only the identity/sort/group inputs actually affect the processed chunk pipeline --
    // an unrelated update (e.g. `selectedChunkIds`, `presentation`) leaves the cache as-is.
    if (
      this.processedChunksCache === undefined ||
      changed.has('chunks') ||
      changed.has('dedupe') ||
      changed.has('sort') ||
      changed.has('grouping') ||
      changed.has('groupBy') ||
      changed.has('groupLabel') ||
      changed.has('groupOrder')
    ) {
      this.processedChunksCache = this.computeProcessedChunks();
    }
    if (changed.has('chunks') || changed.has('selectedChunkIds')) {
      const normalized = this.normalizedSelectedChunkIds();
      if (
        normalized.length !== this.selectedChunkIds.length ||
        normalized.some((id, index) => id !== this.selectedChunkIds[index])
      ) {
        this.selectedChunkIds = normalized;
      }
    }
    if (
      !changed.has('chunks') &&
      !changed.has('dedupe') &&
      !changed.has('sort') &&
      !changed.has('grouping') &&
      !changed.has('groupBy') &&
      !changed.has('groupLabel') &&
      !changed.has('groupOrder') &&
      !changed.has('presentation') &&
      !changed.has('selectable') &&
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

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (
      !wasMounting &&
      changed.has('errorText') &&
      this.errorText !== '' &&
      this.isConnected
    ) {
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
    >('lr-virtual-list');
    await virtualList?.updateComplete;
    if (generation !== this.focusRestoreGeneration || !this.isConnected) return;
    const roots: ParentNode[] = [this.renderRoot];
    if (virtualList?.shadowRoot) roots.push(virtualList.shadowRoot);
    const candidates = roots.flatMap((root) => [
      ...root.querySelectorAll<HTMLElement>('[data-chunk-id]'),
    ]);
    const checkbox = candidates.find(
      (element) =>
        element.localName === 'lr-checkbox' &&
        element.getAttribute('data-chunk-id') === target
    );
    if (checkbox) {
      checkbox.focus();
      return;
    }
    const inspector = candidates.find(
      (element) =>
        element.localName === 'lr-chunk-inspector' &&
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
    return firstByRetrievalIdentity(this.chunks, (chunk) => chunk.id);
  }

  private normalizedSelectedChunkIds(): string[] {
    const validIds = new Set(this.canonicalChunks().map((chunk) => chunk.id));
    return canonicalIdentityList(this.selectedChunkIds).filter((id) =>
      validIds.has(id)
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
    return (this.processedChunksCache ??= this.computeProcessedChunks());
  }

  private computeProcessedChunks(): {
    chunks: readonly RetrievalChunk[];
    groups: LyraVirtualListGroup[];
  } {
    const canonical = this.canonicalChunks();
    const sorted =
      this.sort === 'score'
        ? canonical.sort((a, b) => safeScore(b.score) - safeScore(a.score))
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

  private toggleSelect(chunk: RetrievalChunk): void {
    const next = new Set(this.normalizedSelectedChunkIds());
    if (next.has(chunk.id)) next.delete(chunk.id);
    else next.add(chunk.id);
    const chunkIds = [...next];
    this.selectedChunkIds = chunkIds;
    const selectedChunks = this.canonicalChunks().filter((c) => next.has(c.id));
    this.emit('lr-select', { chunkIds, chunks: selectedChunks });
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

  private renderMetadata(
    metadata?: Record<string, unknown>
  ): TemplateResult | typeof nothing {
    const entries = metadata ? Object.entries(metadata) : [];
    if (entries.length === 0) return nothing;
    return html`
      <dl part="metadata">
        ${entries.map(
          ([key, value]) =>
            html`<div part="metadata-entry">
              <dt part="metadata-term">${key}</dt>
              <dd part="metadata-value">${this.formatMetadataValue(value)}</dd>
            </div>`
        )}
      </dl>
    `;
  }

  // Shared by both rendering paths (flat list and `<lr-virtual-list>`'s `renderItem`), exactly like
  // `<lr-chunk-inspector>`'s own `renderChunk` and `<lr-thread-list>`'s own `renderRow`. Returns
  // only the row's *content* (checkbox + body) -- the surrounding `role="listitem"`/`part="row"`
  // wrapper is supplied by whichever caller renders it, since `<lr-virtual-list>` already supplies
  // its own per-row wrapper when virtualized and a second, nested one would double up `part="row"`
  // within the same shadow tree and duplicate `role="listitem"` semantics.
  private renderRow = (item: unknown): TemplateResult => {
    const chunk = item as RetrievalChunk;
    const selected = this.selectedChunkIds.includes(chunk.id);
    const rowLabel = chunk.source.name || this.localize('untitledSource');
    return html`
      ${this.selectable
        ? html`<lr-checkbox
            part="select"
            data-chunk-id=${chunk.id}
            .checked=${selected}
            aria-label=${this.localize('retrievalResultsSelectRow', undefined, {
              label: rowLabel,
            })}
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
          .chunks=${[toLyraChunk(chunk)]}
          .thresholds=${this.thresholds}
          ?compact=${this.presentation === 'compact'}
          .activeChunkId=${this.activeChunkId}
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
            this.emit('lr-chunk-open', e.detail);
          }}
        ></lr-chunk-inspector>
        ${this.presentation === 'expanded'
          ? this.renderMetadata(chunk.metadata)
          : nothing}
      </div>
    `;
  };

  private renderLoadMoreFooter(): TemplateResult | typeof nothing {
    if (!this.hasMore) return nothing;
    return html`
      <div part="load-more-row">
        ${this.loading
          ? html`<lr-spinner part="spinner"></lr-spinner>`
          : html`<button
              type="button"
              part="load-more"
              @click=${() => this.emit('lr-load-more')}
            >
              ${this.localize('loadMore')}
            </button>`}
      </div>
    `;
  }

  override render(): TemplateResult {
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('chunkInspectorLabel') : this.label
    );
    const groupRole = retrievalSemanticRole(this, 'group');

    if (this.errorText) {
      return html`<div part="base" tabindex="-1">
        <div part="error">${this.errorText}</div>
      </div>`;
    }

    const processed = this.processedChunks;
    if (processed.chunks.length === 0) {
      if (this.loading) {
        return html`<div part="base" tabindex="-1">
          <lr-spinner part="spinner"></lr-spinner>
        </div>`;
      }
      // `heading` is passed as slotted light-DOM content (rather than the `heading` attribute) so
      // `[part="empty"]`'s `.textContent` -- a plain DOM accessor, which never pierces
      // `<lr-empty>`'s own shadow root -- actually includes the message; the same reason
      // `<lr-chunk-inspector>`'s own empty state takes this shape.
      return html`<div part="base" tabindex="-1">
        <lr-empty part="empty"
          ><span slot="heading"
            >${this.localize('chunkInspectorEmpty')}</span
          ></lr-empty
        >
      </div>`;
    }

    // Any grouped render goes through the virtual list regardless of `virtualize-at` -- it owns the
    // sticky group headers -- so this reads the computed groups rather than re-testing `grouping`,
    // which would have to be extended again for every new grouping mode.
    const useVirtualList =
      processed.groups.length > 0 ||
      processed.chunks.length > this.effectiveVirtualizeAt;
    return html`
      <div
        part="base"
        role=${groupRole ?? nothing}
        tabindex="-1"
        aria-label=${label ?? nothing}
      >
        ${useVirtualList
          ? html`<lr-virtual-list
              exportparts="row:row, group:group-header, select:select, row-body:row-body, row-body-selected:row-body-selected, metadata:metadata, metadata-entry:metadata-entry, metadata-term:metadata-term, metadata-value:metadata-value, chunk:chunk, chunk-current:chunk-current, chunk-score:chunk-score, chunk-score-current:chunk-score-current, chunk-score-bar:chunk-score-bar, chunk-score-fill:chunk-score-fill, chunk-score-fill-success:chunk-score-fill-success, chunk-score-fill-warning:chunk-score-fill-warning, chunk-score-fill-danger:chunk-score-fill-danger, chunk-open-button:chunk-open-button, chunk-title:chunk-title, chunk-text:chunk-text, chunk-text-clamped:chunk-text-clamped, chunk-toggle:chunk-toggle"
              .items=${processed.chunks}
              .renderItem=${this.renderRow}
              .keyFunction=${(item: unknown) => (item as RetrievalChunk).id}
              .groups=${processed.groups}
              .activeItemId=${this.activeChunkId || ''}
              ?loading=${this.loading}
              ?has-more=${this.hasMore}
              @lr-load-more=${(e: Event) => {
                // lr-virtual-list's own lr-load-more bubbles+composes (LyraElement.emit()'s
                // defaults) -- without stopping it here it would keep bubbling straight through
                // this component under the same name, right behind the re-emit below.
                e.stopPropagation();
                this.emit('lr-load-more');
              }}
            ></lr-virtual-list>`
          : html`<div role="list">
                ${processed.chunks.map(
                  (c) =>
                    html`<div part="row" role="listitem">
                      ${this.renderRow(c)}
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
