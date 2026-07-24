import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
import type { SegmentedItem } from '../../layout/segmented/segmented.class.js';
import '../../forms/input/input.class.js';
import '../../layout/segmented/segmented.class.js';
import '../../overlays/chip/chip.class.js';
import '../../overlays/chip/chip-group.class.js';
import '../../overlays/spinner/spinner.class.js';
import '../../overlays/empty/empty.class.js';
import type { RetrievalQuery, CancelEventDetail } from '../../../ai/types.js';
import { styles } from './retrieval-search.styles.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';

/** The three retrieval modes `RetrievalQuery.mode` supports, reused verbatim rather than
 *  redefining the union -- see `src/ai/types.ts`'s own header for why. */
export type LyraRetrievalMode = RetrievalQuery['mode'];

/** `detail` for `lr-filters-change` -- the complete, already-updated `filters`/`scope` state
 *  after a chip removal, mirroring `<lr-source-picker>`'s `lr-sources-change` "full next state"
 *  convention rather than a single-item delta. */
export interface RetrievalFiltersChangeDetail {
  filters: Record<string, unknown>;
  scope: string[];
}

export interface LyraRetrievalSearchEventMap {
  'lr-search': CustomEvent<RetrievalQuery>;
  'lr-cancel': CustomEvent<CancelEventDetail>;
  'lr-filters-change': CustomEvent<RetrievalFiltersChangeDetail>;
}

/**
 * `<lr-retrieval-search>` -- the query bar for a retrieval/RAG surface: query text, an active-
 * filter/scope chip row, a vector/keyword/hybrid mode selector, and loading/error/empty status
 * feedback. Consumes `RetrievalQuery` (`src/ai/types.ts`) as the shape emitted on submit.
 *
 * Fully controlled, like every other Lyra input: `query`/`mode`/`filters`/`scope` are host-owned
 * properties. This component never performs retrieval itself -- it only emits `lr-search`; the
 * host owns the actual fetch and toggles `loading` around it. Because this component has no way
 * to know when a request resolves (only `loading`, set from outside), submitting again (Enter, or
 * clicking the button) while `loading` is already `true` is treated as **superseding** the
 * in-flight request: `lr-cancel` fires immediately before the new `lr-search`. The submit button
 * itself doubles as an explicit Cancel affordance while `loading` -- clicking it only emits
 * `lr-cancel`, without resubmitting, the same "just stop" action `<lr-chat-composer>`'s Stop
 * button offers for its own `stoppable` busy state.
 *
 * Composes `<lr-input type="search">` for the query field, `<lr-segmented>` for the mode
 * selector (the same small-closed-set-choice-in-a-toolbar role it already fills, sized to sit
 * flush beside `<lr-input>`), `<lr-chip>`/`<lr-chip-group>` for removable active-filter/scope
 * chips, `<lr-spinner>` for the loading state, and `<lr-empty>` (compact) for the empty state.
 * `filters`/`scope` chip removal updates this component's own copy first, then emits
 * `lr-filters-change` with the complete next state -- the same "update, then emit; reassign to
 * control" round-trip `<lr-source-picker>`'s `selectedIds` already establishes. `empty` is a
 * host-driven flag (the last completed search returned zero results); this component holds no
 * results data of its own -- see `<lr-retrieval-results>` for rendering the actual chunk list.
 *
 * @customElement lr-retrieval-search
 * @event lr-search - The query was submitted (Enter in the query field, or the submit button
 *   while not `loading`). `detail`: the full `RetrievalQuery` (`{ text, mode, filters, scope }`).
 * @event lr-cancel - The in-flight request should be cancelled: either the user clicked the
 *   button while `loading` (`detail: {}`), or a new submission superseded the in-flight one before
 *   it resolved (`detail: { reason: 'superseded' }`, fired immediately before the new `lr-search`).
 * @event lr-filters-change - A `filters`/`scope` chip's remove button was activated. `detail`: the
 *   complete updated `{ filters, scope }` state.
 * @csspart base - The `role="search"` root landmark.
 * @csspart row - The row holding the query field, mode selector, and submit/cancel button.
 * @csspart query - The query `<lr-input type="search">`.
 * @csspart mode - The vector/keyword/hybrid `<lr-segmented>`.
 * @csspart submit - The submit/cancel `<button>`. Reads "Search" while idle, "Cancel" while
 *   `loading`.
 * @csspart filters - The active-filter/scope `<lr-chip-group>`. Omitted entirely when both
 *   `filters` and `scope` are empty.
 * @csspart spinner - The busy `<lr-spinner>`, shown only while `loading`.
 * @csspart error - The `role="alert"` error message, shown only when `errorText` is non-empty and
 *   not `loading`.
 * @csspart empty - The compact `<lr-empty>`, shown only when `empty` is `true` and neither
 *   `loading` nor `errorText` is set.
 */
export class LyraRetrievalSearch extends LyraElement<LyraRetrievalSearchEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The current query text. Controlled -- the internal `lr-input` updates this optimistically as
   *  the user types (mirroring every other Lyra input's controlled-value convention), and a host
   *  reassignment always wins. */
  @property() query = '';

  /** Retrieval mode. Defaults to `'hybrid'`, the common default for a search bar combining both
   *  vector and keyword retrieval. */
  @property() mode: LyraRetrievalMode = 'hybrid';

  /** Arbitrary metadata filters, rendered as removable `"{key}: {value}"` chips. Controlled --
   *  reassign to change what's shown; see the class doc's "update, then emit" round-trip. */
  @property({ attribute: false }) filters: Record<string, unknown> = {};

  /** Source-scope ids/labels this query is restricted to, rendered as removable chips alongside
   *  `filters`. Same controlled round-trip as `filters`. */
  @property({ attribute: false }) scope: string[] = [];

  /** Host-driven busy flag. This component never performs retrieval itself and has no way to know
   *  when a request resolves, so the host toggles this explicitly around its own fetch -- see the
   *  class doc for the resulting submit/cancel/supersede behavior. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Host-supplied error message from the last failed search, shown verbatim (caller-owned text,
   *  not localized) in a `role="alert"` region. Empty string (the default) shows nothing. */
  @property({ attribute: 'error-text' }) errorText = '';

  /** Host-driven flag: the last completed search returned zero results. Renders a compact
   *  `<lr-empty>` beneath the search row. Never inferred by this component itself -- see the
   *  class doc; it holds no results data of its own. */
  @property({ type: Boolean, reflect: true }) empty = false;

  /** Placeholder for the query field. Empty string (the default) falls back to the localized
   *  generic "Search" placeholder, which also becomes that field's accessible name (mirroring
   *  `<lr-input>`'s own placeholder-as-label fallback). */
  @property() placeholder = '';

  /** Accessible name for the `role="search"` landmark. Falls back to the localized default; a
   *  host `aria-label` (via `accessibleLabel`) wins over both. */
  @property() label = '';

  /** Overrides the computed accessible name for the `role="search"` landmark. Wins over `label`
   *  and the localized default. Attribute-reflects from a host-level `aria-label`. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private modeItems(): SegmentedItem[] {
    return [
      { value: 'vector', label: this.localize('retrievalModeVector') },
      { value: 'keyword', label: this.localize('retrievalModeKeyword') },
      { value: 'hybrid', label: this.localize('retrievalModeHybrid') },
    ];
  }

  private formatFilterValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') {
      return getNumberFormat(this.effectiveLocale).format(finiteNumber(value, 0));
    }
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return getListFormat(this.effectiveLocale, { type: 'conjunction' }).format(
        value.map((item) => this.formatFilterValue(item)),
      );
    }
    if (value == null) return '';
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private buildQuery(): RetrievalQuery {
    return { text: this.query, mode: this.mode, filters: { ...this.filters }, scope: [...this.scope] };
  }

  private submit(): void {
    if (this.loading) this.emit<CancelEventDetail>('lr-cancel', { reason: 'superseded' });
    this.emit<RetrievalQuery>('lr-search', this.buildQuery());
  }

  private cancel(): void {
    this.emit<CancelEventDetail>('lr-cancel', {});
  }

  private emitFiltersChange(): void {
    this.emit<RetrievalFiltersChangeDetail>('lr-filters-change', {
      filters: { ...this.filters },
      scope: [...this.scope],
    });
  }

  private removeScope(value: string): void {
    this.scope = this.scope.filter((s) => s !== value);
    this.emitFiltersChange();
  }

  private removeFilter(key: string): void {
    const next = { ...this.filters };
    delete next[key];
    this.filters = next;
    this.emitFiltersChange();
  }

  private onQueryInput = (e: CustomEvent<{ value: string }>): void => {
    e.stopPropagation();
    this.query = e.detail.value;
  };

  private onQueryKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter') return;
    // An IME composition step (e.g. confirming a Japanese/Chinese/Korean candidate) must never be
    // treated as "the user pressed Enter to search" -- keyCode 229 is a defense-in-depth fallback
    // for browsers that report isComposing inconsistently on the compositionend-adjacent keydown.
    // Mirrors <lr-chat-composer>'s identical guard.
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    this.submit();
  };

  private onModeChange = (e: CustomEvent<{ value: string }>): void => {
    e.stopPropagation();
    this.mode = e.detail.value as LyraRetrievalMode;
  };

  private onSubmitClick = (): void => {
    if (this.loading) {
      this.cancel();
      return;
    }
    this.submit();
  };

  override render(): TemplateResult {
    const label =
      this.accessibleLabel || this.label || this.localize('retrievalSearchLabel');
    const hasFilters = Object.keys(this.filters).length > 0 || this.scope.length > 0;

    return html`
      <div part="base" role="search" aria-label=${label}>
        <div part="row">
          <lr-input
            part="query"
            type="search"
            placeholder=${this.placeholder || this.localize('search')}
            .value=${this.query}
            @lr-input=${this.onQueryInput}
            @keydown=${this.onQueryKeyDown}
          ></lr-input>
          <lr-segmented
            part="mode"
            size="s"
            .items=${this.modeItems()}
            .value=${this.mode}
            label=${this.localize('retrievalModeLabel')}
            @lr-change=${this.onModeChange}
          ></lr-segmented>
          <button part="submit" type="button" @click=${this.onSubmitClick}>
            ${this.loading ? this.localize('cancel') : this.localize('search')}
          </button>
        </div>
        ${hasFilters
          ? html`<lr-chip-group
              part="filters"
              role="group"
              aria-label=${this.localize('retrievalFiltersLabel')}
            >
              ${this.scope.map(
                (s) => html`<lr-chip tone="brand" removable value=${s} @lr-remove=${(event: Event) => {
                  event.stopPropagation();
                  this.removeScope(s);
                }}
                  >${s}</lr-chip
                >`,
              )}
              ${Object.entries(this.filters).map(
                ([k, v]) => html`<lr-chip removable value=${k} @lr-remove=${(event: Event) => {
                  event.stopPropagation();
                  this.removeFilter(k);
                }}
                  >${this.localize('retrievalFilterChipLabel', undefined, {
                    key: k,
                    value: this.formatFilterValue(v),
                  })}</lr-chip
                >`,
              )}
            </lr-chip-group>`
          : nothing}
        ${this.loading
          ? html`<lr-spinner part="spinner" aria-label=${label}></lr-spinner>`
          : this.errorText
            ? html`<div part="error" role="alert">${this.errorText}</div>`
            : this.empty
              ? html`<lr-empty
                  part="empty"
                  compact
                  heading=${this.localize('noMatches')}
                  description=${this.localize('retrievalSearchEmptyDescription', undefined,
                  )}
                ></lr-empty>`
              : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-retrieval-search': LyraRetrievalSearch;
  }
}
