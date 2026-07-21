import { html, nothing, type TemplateResult, type ComplexAttributeConverter } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import type { RetrievalChunk } from '../../../ai/types.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.class.js';
import type { VirtualListGroup } from '../../layout/virtual-list/virtual-list.class.js';
import '../../layout/virtual-list/virtual-list.js';
import '../chunk-inspector/chunk-inspector.js';
import '../../forms/checkbox/checkbox.js';
import '../../overlays/spinner/spinner.js';
import '../../overlays/empty/empty.js';
import { styles } from './retrieval-results.styles.js';

/** `lr-select`'s detail: the complete updated selection, both as bare ids and as the (deduplicated)
 *  `RetrievalChunk` records they refer to -- a host wanting "what got selected" rarely wants to
 *  re-look up `ids` against its own copy of `chunks` on every toggle. */
export interface RetrievalResultsSelectDetail {
  ids: string[];
  chunks: RetrievalChunk[];
}

export interface LyraRetrievalResultsEventMap {
  'lr-select': CustomEvent<RetrievalResultsSelectDetail>;
  'lr-load-more': CustomEvent<undefined>;
  'lr-chunk-open': CustomEvent<{ id: string; sourceId: string }>;
}

export type RetrievalResultsGrouping = 'source' | 'none';
export type RetrievalResultsPresentation = 'compact' | 'expanded';

/** `RetrievalChunk` -> `lr-chunk-inspector`'s own `LyraChunk` display-row shape, per the mapping
 *  `RetrievalChunk`'s own doc comment (`src/ai/types.ts`) already specifies: `source.id -> sourceId`,
 *  `source.name -> title`. No `page`/`anchor` -- `RetrievalChunk`/`DocumentRef` carry neither, so
 *  those fields are simply left unset rather than guessed at from `metadata`. */
function toLyraChunk(chunk: RetrievalChunk): LyraChunk {
  return {
    id: chunk.id,
    text: chunk.text,
    score: chunk.score,
    sourceId: chunk.source.id,
    title: chunk.source.name,
  };
}

/** `true`-defaulting boolean attribute converter, identical shape to `<lr-task-list>`'s
 *  `trueDefaultBooleanConverter` -- duplicated locally per this library's convention of not
 *  sharing these tiny converters across independently-consumable component files. Lit's default
 *  presence-based `type: Boolean` can never be set back to `false` from a plain-HTML attribute
 *  once the property's own default is `true` (removing an attribute that was never present fires
 *  no `attributeChangedCallback`), so `fromAttribute` checks the literal string instead. Shared by
 *  `selectable` and `dedupe`, which have the identical `true`-default parsing need. `toAttribute`
 *  reflects the `true` state as a present (empty-string) attribute rather than omitting it,
 *  matching every other `reflect: true` boolean property in this library. */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? '' : null;
  },
};

function formatMetadataValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function safeScore(score: number): number {
  return finiteRange(score, 0, 0, 1);
}

/**
 * `<lr-retrieval-results>` — the orchestration-level ranked-chunk-list surface: takes raw
 * `RetrievalChunk[]` (the shared retrieval-and-grounding type from `src/ai/types.ts`) and adds
 * everything a single retrieval call's result set needs beyond what one chunk's own rendering
 * provides -- deduplication, optional grouping by source, multi-selection, pagination/infinite
 * loading, and a compact/expanded presentation switch -- while composing existing primitives for
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
 * **Controlled component.** `chunks`/`selectedIds`/`loading`/`error`/`hasMore` are all host-owned;
 * this component never fetches, retries, or mutates its own copy of `chunks`. Selecting a row
 * updates `selectedIds` locally *then* emits `lr-select` (the same "update own copy, then emit;
 * reassign to control" convention `<lr-source-picker>` already uses) so a host can either accept
 * the update as-is or override it before the next render.
 *
 * **Deduplication** keeps, per duplicate `id`, whichever chunk has the higher `score` -- set
 * `dedupe="false"` to see every raw entry `chunks` contains, duplicates included. **Grouping**
 * (`grouping="source"`) buckets the deduplicated, score-sorted list by `source.id`, each bucket
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
 * @customElement lr-retrieval-results
 * @event lr-select - The selected-chunk set changed. `detail: { ids, chunks }` — `ids` is the
 * complete updated selection (not just the toggled id), `chunks` the matching deduplicated
 * `RetrievalChunk` records.
 * @event lr-load-more - More results were requested — via the internal `<lr-virtual-list>`'s own
 * scroll-near-bottom detection while virtualized, or the built-in `[part="load-more"]` button
 * otherwise. Only ever fires while `has-more` is true and `loading` is false.
 * @event lr-chunk-open - A row's title/open button was activated, forwarded verbatim from the
 * per-row `<lr-chunk-inspector>`'s own `lr-chunk-open`. `detail: { id, sourceId }` — the event a
 * host routes into `<lr-document-viewer>`.
 * @csspart base - The outer container.
 * @csspart error - The error message region (`role="alert"`), shown while `error` is non-empty.
 * @csspart spinner - The initial-load `<lr-spinner>`, shown while `loading` is true and `chunks`
 * is still empty.
 * @csspart empty - The `<lr-empty>` wrapper, shown when `chunks` is empty and neither `error` nor
 * `loading` is set.
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
 */
export class LyraRetrievalResults extends LyraElement<LyraRetrievalResultsEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The raw (not deduplicated/sorted/grouped) result set. Host-owned. */
  @property({ attribute: false }) chunks: RetrievalChunk[] = [];

  /** Controlled selection, by chunk `id`. The component updates its own copy on toggle *then*
   *  emits `lr-select`; reassign to control. An id with no matching chunk is harmless -- it simply
   *  never renders a checked row. */
  @property({ attribute: false }) selectedIds: string[] = [];

  /** Shows a per-row `<lr-checkbox>`. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) selectable = true;

  /** Drops duplicate `id`s before rendering, keeping whichever duplicate has the higher `score`. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) dedupe = true;

  /** `'score'` (default) sorts the deduplicated list descending by `score`; `'none'` preserves
   *  `chunks`' own given order. */
  @property() sort: 'score' | 'none' = 'score';

  /** `'source'` buckets rows under a header per `source.id` (always rendered through the internal
   *  `<lr-virtual-list>`, regardless of `virtualize-at`); `'none'` (default) is a flat ranked list. */
  @property() grouping: RetrievalResultsGrouping = 'none';

  /** `'expanded'` (default) shows each chunk's full `<lr-chunk-inspector>` row (score bar, text
   *  preview with its own expand toggle) plus any `metadata`; `'compact'` shows title + score bar
   *  only, on both. */
  @property() presentation: RetrievalResultsPresentation = 'expanded';

  /** Forwarded verbatim to every per-row `<lr-chunk-inspector>`'s own `thresholds`. */
  @property({ attribute: false }) thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 };

  /** Above this many rows (after dedup, before grouping), rendering switches from a plain list to
   *  the internal `<lr-virtual-list>`. Grouped mode always virtualizes regardless of this value. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 50;

  /** Marks the chunk currently open in a viewer -- forwarded to each per-row `<lr-chunk-inspector>`
   *  and to the internal `<lr-virtual-list>` (which scrolls the matching row into view). */
  @property({ attribute: 'active-id' }) activeId = '';

  @property({ type: Boolean, reflect: true }) loading = false;

  /** While virtualized, forwarded to the internal `<lr-virtual-list>` so scrolling near the bottom
   *  fires `lr-load-more`; otherwise shows the built-in `[part="load-more"]` footer. */
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) hasMore = false;

  /** Non-empty replaces the entire result view with a `role="alert"` error message -- caller-
   *  supplied text, not routed through `localize()` (the same stance `<lr-document-preview>`'s own
   *  `error-message` takes for the same reason: this is app/network data, not library copy). */
  @property() error = '';

  /** Accessible name for the results region. Defaults to the localized `chunkInspectorLabel`
   *  ("Retrieved chunks") -- reused rather than a new key, since it already says exactly what this
   *  region is. */
  @property() label = '';

  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 50);
  }

  private get dedupedChunks(): RetrievalChunk[] {
    if (!this.dedupe) return this.chunks;
    const byId = new Map<string, RetrievalChunk>();
    for (const chunk of this.chunks) {
      const existing = byId.get(chunk.id);
      if (!existing || safeScore(chunk.score) > safeScore(existing.score)) byId.set(chunk.id, chunk);
    }
    return [...byId.values()];
  }

  private get processedChunks(): { chunks: RetrievalChunk[]; groups: VirtualListGroup[] } {
    const deduped = this.dedupedChunks;
    const sorted = this.sort === 'score' ? [...deduped].sort((a, b) => safeScore(b.score) - safeScore(a.score)) : deduped;
    if (this.grouping !== 'source') return { chunks: sorted, groups: [] };

    const bySource = new Map<string, RetrievalChunk[]>();
    const order: string[] = [];
    for (const chunk of sorted) {
      const key = chunk.source.id;
      if (!bySource.has(key)) {
        bySource.set(key, []);
        order.push(key);
      }
      bySource.get(key)!.push(chunk);
    }
    const rows: RetrievalChunk[] = [];
    const groups: VirtualListGroup[] = [];
    for (const key of order) {
      const groupChunks = bySource.get(key)!;
      groups.push({ key, label: groupChunks[0]!.source.name || this.localize('untitledSource'), startIndex: rows.length });
      rows.push(...groupChunks);
    }
    return { chunks: rows, groups };
  }

  private toggleSelect(chunk: RetrievalChunk): void {
    const next = new Set(this.selectedIds);
    if (next.has(chunk.id)) next.delete(chunk.id);
    else next.add(chunk.id);
    const ids = [...next];
    this.selectedIds = ids;
    const selectedChunks = this.dedupedChunks.filter((c) => next.has(c.id));
    this.emit<RetrievalResultsSelectDetail>('lr-select', { ids, chunks: selectedChunks });
  }

  private renderMetadata(metadata?: Record<string, unknown>): TemplateResult | typeof nothing {
    const entries = metadata ? Object.entries(metadata) : [];
    if (entries.length === 0) return nothing;
    return html`
      <dl part="metadata">
        ${entries.map(
          ([key, value]) =>
            html`<div part="metadata-entry">
              <dt part="metadata-term">${key}</dt>
              <dd part="metadata-value">${formatMetadataValue(value)}</dd>
            </div>`,
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
    const selected = this.selectedIds.includes(chunk.id);
    const rowLabel = chunk.source.name || this.localize('untitledSource');
    return html`
      ${this.selectable
        ? html`<lr-checkbox
            part="select"
            .checked=${selected}
            aria-label="${this.localize('select')} ${rowLabel}"
            @lr-change=${() => this.toggleSelect(chunk)}
          ></lr-checkbox>`
        : nothing}
      <div part=${selected ? 'row-body row-body-selected' : 'row-body'} ?data-selected=${selected}>
        <lr-chunk-inspector
          exportparts="chunk:chunk, chunk-current:chunk-current, score:chunk-score, score-current:chunk-score-current, score-bar:chunk-score-bar, score-fill:chunk-score-fill, score-fill-success:chunk-score-fill-success, score-fill-warning:chunk-score-fill-warning, score-fill-danger:chunk-score-fill-danger, open-button:chunk-open-button, title:chunk-title, text:chunk-text, text-clamped:chunk-text-clamped, toggle:chunk-toggle"
          .chunks=${[toLyraChunk(chunk)]}
          .thresholds=${this.thresholds}
          ?compact=${this.presentation === 'compact'}
          active-id=${this.activeId}
          label=${rowLabel}
          @lr-chunk-open=${(e: CustomEvent<{ id: string; sourceId: string }>) => {
            // lr-chunk-inspector's own lr-chunk-open bubbles+composes (LyraElement.emit()'s
            // defaults) -- without stopping it here it would keep bubbling straight through this
            // component under the same name, right behind the correctly-shaped re-emit below.
            e.stopPropagation();
            this.emit('lr-chunk-open', e.detail);
          }}
        ></lr-chunk-inspector>
        ${this.presentation === 'expanded' ? this.renderMetadata(chunk.metadata) : nothing}
      </div>
    `;
  };

  private renderLoadMoreFooter(): TemplateResult | typeof nothing {
    if (!this.hasMore) return nothing;
    return html`
      <div part="load-more-row">
        ${this.loading
          ? html`<lr-spinner part="spinner"></lr-spinner>`
          : html`<button type="button" part="load-more" @click=${() => this.emit('lr-load-more')}>
              ${this.localize('loadMore')}
            </button>`}
      </div>
    `;
  }

  override render(): TemplateResult {
    const label = this.label || this.localize('chunkInspectorLabel');

    if (this.error) {
      return html`<div part="base"><div part="error" role="alert">${this.error}</div></div>`;
    }

    const processed = this.processedChunks;
    if (processed.chunks.length === 0) {
      if (this.loading) {
        return html`<div part="base"><lr-spinner part="spinner"></lr-spinner></div>`;
      }
      // `heading` is passed as slotted light-DOM content (rather than the `heading` attribute) so
      // `[part="empty"]`'s `.textContent` -- a plain DOM accessor, which never pierces
      // `<lr-empty>`'s own shadow root -- actually includes the message; the same reason
      // `<lr-chunk-inspector>`'s own empty state takes this shape.
      return html`<div part="base"><lr-empty part="empty"><span slot="heading">${this.localize('chunkInspectorEmpty')}</span></lr-empty></div>`;
    }

    const useVirtualList = this.grouping === 'source' || processed.chunks.length > this.effectiveVirtualizeAt;
    return html`
      <div part="base" role="group" aria-label=${label}>
        ${useVirtualList
          ? html`<lr-virtual-list
              exportparts="row:row, group:group-header, select:select, row-body:row-body, row-body-selected:row-body-selected, metadata:metadata, metadata-entry:metadata-entry, metadata-term:metadata-term, metadata-value:metadata-value, chunk:chunk, chunk-current:chunk-current, chunk-score:chunk-score, chunk-score-current:chunk-score-current, chunk-score-bar:chunk-score-bar, chunk-score-fill:chunk-score-fill, chunk-score-fill-success:chunk-score-fill-success, chunk-score-fill-warning:chunk-score-fill-warning, chunk-score-fill-danger:chunk-score-fill-danger, chunk-open-button:chunk-open-button, chunk-title:chunk-title, chunk-text:chunk-text, chunk-text-clamped:chunk-text-clamped, chunk-toggle:chunk-toggle"
              .items=${processed.chunks}
              .renderItem=${this.renderRow}
              .keyFunction=${(item: unknown) => (item as RetrievalChunk).id}
              .groups=${processed.groups}
              .activeId=${this.activeId || ''}
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
                ${processed.chunks.map((c) => html`<div part="row" role="listitem">${this.renderRow(c)}</div>`)}
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
