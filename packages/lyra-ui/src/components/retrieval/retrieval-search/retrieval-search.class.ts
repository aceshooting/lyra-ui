import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSegmentedItem } from '../../layout/segmented/segmented.class.js';
import '../../forms/input/input.class.js';
import '../../layout/segmented/segmented.class.js';
import '../../overlays/chip/chip.class.js';
import '../../overlays/chip/chip-group.class.js';
import '../../overlays/spinner/spinner.class.js';
import '../../overlays/empty/empty.class.js';
import type { RetrievalQuery, CancelEventDetail } from '../../../ai/types.js';
import { styles } from './retrieval-search.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
import { formatBoundedRetrievalValue } from '../retrieval-value-format.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { canonicalIdentityList, isRecord } from '../retrieval-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_retrievalFilterChipLabel, LYRA_DEFAULT_retrievalFiltersLabel, LYRA_DEFAULT_retrievalModeHybrid, LYRA_DEFAULT_retrievalModeKeyword, LYRA_DEFAULT_retrievalModeLabel, LYRA_DEFAULT_retrievalModeVector, LYRA_DEFAULT_retrievalSearchEmptyDescription, LYRA_DEFAULT_retrievalSearchLabel, LYRA_DEFAULT_search, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** The three retrieval modes `RetrievalQuery.mode` supports, reused verbatim rather than
 *  redefining the union -- see `src/ai/types.ts`'s own header for why. */
export type LyraRetrievalMode = RetrievalQuery['mode'];

const RETRIEVAL_MODE = literalSetConverter<LyraRetrievalMode>(
  ['vector', 'keyword', 'hybrid'],
  'hybrid'
);

/** `detail` for `lr-filters-change` -- the complete, already-updated `filters`/`scope` state
 *  after a chip removal, mirroring `<lr-source-picker>`'s `lr-sources-change` "full next state"
 *  convention rather than a single-item delta. */
export interface RetrievalFiltersChangeDetail {
  filters: Record<string, unknown>;
  scope: string[];
}

export interface LyraRetrievalSearchEventMap {
  'lr-search': CustomEvent<LyraEventDetailSnapshot<RetrievalQuery>>;
  'lr-cancel': CustomEvent<CancelEventDetail>;
  'lr-filters-change': CustomEvent<
    LyraEventDetailSnapshot<RetrievalFiltersChangeDetail>
  >;
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
 * selector (the same small-closed-set-choice-in-a-toolbar role it already fills, left at the shared
 * default size so it resolves the same `--lr-form-control-height` as the query field and the submit
 * button and the row reads as one flush line), `<lr-chip>`/`<lr-chip-group>` for removable active-filter/scope
 * chips, `<lr-spinner>` for the loading state, and `<lr-empty>` (compact) for the empty state.
 * `filters`/`scope` chip removal updates this component's own copy first, then emits
 * `lr-filters-change` with the complete next state -- the same "update, then emit; reassign to
 * control" round-trip `<lr-source-picker>`'s `selectedSourceIds` already establishes. `empty` is a
 * host-driven flag (the last completed search returned zero results); this component holds no
 * results data of its own -- see `<lr-retrieval-results>` for rendering the actual chunk list.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-retrieval-search
 * @event lr-search - The query was submitted (Enter in the query field, or the submit button
 *   while not `loading`). `detail`: the full `RetrievalQuery` (`{ text, mode, filters, scope }`).
 * @event lr-cancel - The in-flight request should be cancelled: either the user clicked the
 *   button while `loading` (`detail: {}`), or a new submission superseded the in-flight one before
 *   it resolved (`detail: { reason: 'superseded' }`, fired immediately before the new `lr-search`).
 * @event lr-filters-change - A `filters`/`scope` chip's remove button was activated. `detail`: the
 *   complete updated `{ filters, scope }` state.
 * @csspart base - The root search shell. It owns `role="search"` and the fallback name unless a
 *   non-empty host `aria-label` makes the host the sole overall owner.
 * @csspart row - The row holding the query field, mode selector, and submit/cancel button.
 * @csspart query - The query `<lr-input type="search">`.
 * @csspart mode - The vector/keyword/hybrid `<lr-segmented>`.
 * @csspart submit - The submit/cancel `<button>`. Reads "Search" while idle, "Cancel" while
 *   `loading`.
 * @csspart filters - The active-filter/scope `<lr-chip-group>`. Omitted entirely when both
 *   `filters` and `scope` are empty.
 * @csspart spinner - The busy `<lr-spinner>`, shown only while `loading`.
 * @csspart error - The neutral, visible error message, shown only when `errorText` is non-empty and
 *   not `loading`. New non-empty errors are announced through a shared assertive light-DOM region;
 *   initial and reconnect content is not replayed.
 * @csspart empty - The compact `<lr-empty>`, shown only when `empty` is `true` and neither
 *   `loading` nor `errorText` is set.
 * @status stable
 * @since 4.1.0
 */
export class LyraRetrievalSearch extends LyraElement<LyraRetrievalSearchEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    cancel: LYRA_DEFAULT_cancel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    noMatches: LYRA_DEFAULT_noMatches,
    retrievalFilterChipLabel: LYRA_DEFAULT_retrievalFilterChipLabel,
    retrievalFiltersLabel: LYRA_DEFAULT_retrievalFiltersLabel,
    retrievalModeHybrid: LYRA_DEFAULT_retrievalModeHybrid,
    retrievalModeKeyword: LYRA_DEFAULT_retrievalModeKeyword,
    retrievalModeLabel: LYRA_DEFAULT_retrievalModeLabel,
    retrievalModeVector: LYRA_DEFAULT_retrievalModeVector,
    retrievalSearchEmptyDescription: LYRA_DEFAULT_retrievalSearchEmptyDescription,
    retrievalSearchLabel: LYRA_DEFAULT_retrievalSearchLabel,
    search: LYRA_DEFAULT_search,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'filters',
    'scope',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-search',
    'lr-filters-change',
  ]);

  /** The current query text. Controlled -- the internal `lr-input` updates this optimistically as
   *  the user types (mirroring every other Lyra input's controlled-value convention), and a host
   *  reassignment always wins. */
  @property() query = '';

  private _mode: LyraRetrievalMode = 'hybrid';

  /** Retrieval mode. Defaults to `'hybrid'`, the common default for a search bar combining both
   *  vector and keyword retrieval. */
  @property({ converter: RETRIEVAL_MODE })
  get mode(): LyraRetrievalMode {
    return this._mode;
  }
  set mode(next: LyraRetrievalMode) {
    const normalized = RETRIEVAL_MODE.normalize(next);
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
  }

  /** Arbitrary metadata filters, rendered as removable `"{key}: {value}"` chips. Controlled --
   *  reassign to change what's shown; see the class doc's "update, then emit" round-trip. */
  @property({ attribute: false }) filters: Readonly<Record<string, unknown>> =
    {};

  /** Source-scope ids/labels this query is restricted to, rendered as removable chips alongside
   *  `filters`. Same controlled round-trip as `filters`. */
  @property({ attribute: false }) scope: readonly string[] = [];

  /** Host-driven busy flag. This component never performs retrieval itself and has no way to know
   *  when a request resolves, so the host toggles this explicitly around its own fetch -- see the
   *  class doc for the resulting submit/cancel/supersede behavior. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Host-supplied error message from the last failed search, shown verbatim (caller-owned text,
   *  not localized) in a neutral visible region. New non-empty values are announced through a
   *  shared assertive light-DOM region; initial and reconnect content is not replayed. Empty
   *  string (the default) shows nothing. */
  @property({ attribute: 'error-text' }) errorText = '';

  /** Host-driven flag: the last completed search returned zero results. Renders a compact
   *  `<lr-empty>` beneath the search row and politely announces later transitions into that
   *  settled state. Never inferred by this component itself -- see the class doc; it holds no
   *  results data of its own. */
  @property({ type: Boolean, reflect: true }) empty = false;

  /** Placeholder for the query field. Empty string (the default) falls back to the localized
   *  generic "Search" placeholder, which also becomes that field's accessible name (mirroring
   *  `<lr-input>`'s own placeholder-as-label fallback). */
  @property() placeholder = '';

  /** Accessible name for the inner search landmark when the host has no `aria-label`. Omitting it
   *  falls back to the localized default; an explicit empty string clears it. */
  @property() label?: string;

  /** JS-only accessible-name override for the inner search landmark. A non-empty markup
   *  `aria-label` names the host as the sole overall owner instead. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private isMounting = true;
  private errorAnnouncementSink?: AnnouncementSink;
  private emptyAnnouncementSink?: AnnouncementSink;
  private wasEmptyPresented = false;
  private chipFocusGeneration = 0;

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
    const emptyPresented = this.empty && !this.loading && this.errorText === '';
    if (
      !wasMounting &&
      !this.wasEmptyPresented &&
      emptyPresented &&
      this.isConnected
    ) {
      this.emptyAnnouncementSink?.announce(this.localize('noMatches'));
    }
    this.wasEmptyPresented = emptyPresented;
  }

  private modeItems(): LyraSegmentedItem[] {
    return [
      { value: 'vector', label: this.localize('retrievalModeVector') },
      { value: 'keyword', label: this.localize('retrievalModeKeyword') },
      { value: 'hybrid', label: this.localize('retrievalModeHybrid') },
    ];
  }

  private formatFilterValue(value: unknown): string {
    const sentinel = this.localize('valueInvalid');
    return formatBoundedRetrievalValue(value, {
      locale: this.effectiveLocale,
      invalid: sentinel,
      truncated: sentinel,
    });
  }

  private get normalizedFilters(): Readonly<Record<string, unknown>> {
    return isRecord(this.filters) ? this.filters : {};
  }

  private get normalizedScope(): readonly string[] {
    return canonicalIdentityList(this.scope);
  }

  private buildQuery(): RetrievalQuery {
    return {
      text: this.query,
      mode: this.mode,
      filters: { ...this.normalizedFilters },
      scope: [...this.normalizedScope],
    };
  }

  private submit(): void {
    if (this.loading) this.emit('lr-cancel', { reason: 'superseded' });
    this.emit('lr-search', this.buildQuery());
  }

  private cancel(): void {
    this.emit('lr-cancel', {});
  }

  private emitFiltersChange(): void {
    this.emit('lr-filters-change', {
      filters: { ...this.normalizedFilters },
      scope: [...this.normalizedScope],
    });
  }

  private repairFocusAfterChipRemoval(
    index: number,
    shouldRepair: boolean
  ): void {
    const generation = ++this.chipFocusGeneration;
    if (!shouldRepair) return;
    void this.updateComplete.then(() => {
      if (!this.isConnected || generation !== this.chipFocusGeneration) return;
      const chips = this.renderRoot.querySelectorAll<HTMLElement>(
        '[part="filters"] lr-chip'
      );
      const target = chips[Math.min(index, chips.length - 1)];
      if (target) {
        target.focus();
        return;
      }
      this.renderRoot.querySelector<HTMLElement>('[part="query"]')?.focus();
    });
  }

  private removeScope(value: string, shouldRepairFocus = false): void {
    const scope = this.normalizedScope;
    const index = scope.indexOf(value);
    this.scope = scope.filter((s) => s !== value);
    this.emitFiltersChange();
    this.repairFocusAfterChipRemoval(Math.max(0, index), shouldRepairFocus);
  }

  private removeFilter(key: string, shouldRepairFocus = false): void {
    const filters = this.normalizedFilters;
    const index =
      this.normalizedScope.length + Object.keys(filters).indexOf(key);
    const next = { ...filters };
    delete next[key];
    this.filters = next;
    this.emitFiltersChange();
    this.repairFocusAfterChipRemoval(Math.max(0, index), shouldRepairFocus);
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
    const label = retrievalSemanticLabel(
      this,
      this.accessibleLabel ??
        (this.label == null
          ? this.localize('retrievalSearchLabel')
          : this.label)
    );
    const searchRole = retrievalSemanticRole(this, 'search');
    const filters = this.normalizedFilters;
    const scope = this.normalizedScope;
    const hasFilters = Object.keys(filters).length > 0 || scope.length > 0;

    return html`
      <div
        part="base"
        role=${searchRole ?? nothing}
        aria-label=${label ?? nothing}
      >
        <div part="row">
          <lr-input
            part="query"
            type="search"
            placeholder=${this.placeholder || this.localize('search')}
            .value=${this.query}
            @lr-input=${this.onQueryInput}
            @keydown=${this.onQueryKeyDown}
          ></lr-input>
          <!-- No size override: the mode selector, the query input and the submit button all
               resolve their height from the shared --lr-form-control-height ladder, so leaving
               this at the same default size is what actually makes the row flush. -->
          <lr-segmented
            part="mode"
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
              ${scope.map(
                (s) => html`<lr-chip
                  variant="brand"
                  removable
                  value=${s}
                  @lr-remove=${(event: Event) => {
                    event.stopPropagation();
                    const chip = event.currentTarget as HTMLElement;
                    this.removeScope(
                      s,
                      chip.shadowRoot?.activeElement !== null
                    );
                  }}
                  >${s}</lr-chip
                >`
              )}
              ${Object.entries(filters).map(
                ([k, v]) => html`<lr-chip
                  removable
                  value=${k}
                  @lr-remove=${(event: Event) => {
                    event.stopPropagation();
                    const chip = event.currentTarget as HTMLElement;
                    this.removeFilter(
                      k,
                      chip.shadowRoot?.activeElement !== null
                    );
                  }}
                  >${this.localize('retrievalFilterChipLabel', undefined, {
                    key: k,
                    value: this.formatFilterValue(v),
                  })}</lr-chip
                >`
              )}
            </lr-chip-group>`
          : nothing}
        ${this.loading
          ? html`<lr-spinner part="spinner"></lr-spinner>`
          : this.errorText
          ? html`<div part="error">${this.errorText}</div>`
          : this.empty
          ? html`<lr-empty
              part="empty"
              compact
              heading=${this.localize('noMatches')}
              description=${this.localize(
                'retrievalSearchEmptyDescription',
                undefined
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
