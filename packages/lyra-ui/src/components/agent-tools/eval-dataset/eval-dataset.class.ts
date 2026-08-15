import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getCollator } from '../../../internal/intl-cache.js';
import { trueDefaultSpellcheckConverter as spellcheckConverter } from '../../../internal/converters.js';
import type { LyraTableEventMap, TableColumn } from '../../data/table/table.class.js';
import type { ChipSelectDetail } from '../../overlays/chip/chip.class.js';
import type { LyraFileInputEventMap } from '../../media/file-input/file-input.class.js';
import type { LyraExportFormatOption, LyraExportButtonEventMap } from '../../utility/export-button/export-button.class.js';
import { styles } from './eval-dataset.styles.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_evalDatasetAddExample, LYRA_DEFAULT_evalDatasetColumnExpectedOutput, LYRA_DEFAULT_evalDatasetColumnInput, LYRA_DEFAULT_evalDatasetColumnTags, LYRA_DEFAULT_evalDatasetEmpty, LYRA_DEFAULT_evalDatasetImportLabel, LYRA_DEFAULT_evalDatasetLabel, LYRA_DEFAULT_evalDatasetNoMatches, LYRA_DEFAULT_evalDatasetRemoveExample, LYRA_DEFAULT_evalDatasetSearchLabel, LYRA_DEFAULT_evalDatasetTagFilterLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MAX_RENDERED_EXAMPLES = 100;

/**
 * One row of an evaluation dataset -- a single labeled test case an eval run scores a
 * model/prompt against. Deliberately its own small shape rather than reusing anything from
 * `src/ai/types.ts`: none of that module's existing interfaces (`RetrievalQuery`, `ChatMessage`,
 * etc.) model "one row of a labeled eval dataset", so a divergent-looking type squeezed in there
 * would be worse than a self-contained one defined next to the component that actually consumes
 * it. `input`/`expectedOutput` are plain strings (not `unknown`/structured payloads) since every
 * column's `cell()` here renders them as plain text.
 */
export interface EvalExample {
  id: string;
  input: string;
  expectedOutput?: string;
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
}

export interface LyraEvalDatasetEventMap {
  'lr-example-select': CustomEvent<{ exampleId: string | null }>;
  'lr-example-add-request': CustomEvent<null>;
  'lr-example-remove-request': CustomEvent<{ exampleId: string }>;
  'lr-import-request': CustomEvent<LyraEventDetailSnapshot<{ files: File[] }>>;
  'lr-export-request': CustomEvent<{ format: string }>;
  /** Deliberate pass-through from the controlled comparison table. */
  'lr-sort': LyraTableEventMap<EvalExample>['lr-sort'];
  focus: CustomEvent<null>;
  blur: CustomEvent<null>;
}

/**
 * `<lr-eval-dataset>` — dataset management for an evaluation suite: a filterable/taggable list of
 * `EvalExample` rows, plus add/remove/import/export affordances.
 *
 * Fully controlled, matching this library's established convention for every other
 * orchestration-level component in this family (e.g. `<lr-thread-list>`'s
 * `lr-thread-pin`/`-archive`/`-delete`): `examples` is the host's own data, and this component
 * never mutates it or performs any I/O itself. Every action a user takes -- adding a row,
 * removing the selected row, importing files, exporting to a format -- fires a `*-request` event
 * carrying just enough information to act on. Duplicate example ids normalize before filtering,
 * selection, row keys, exports, and actions; the first occurrence wins. The host decides how (a local mutation, a network
 * round-trip, opening its own creation dialog, parsing an imported file's actual contents, writing
 * an exported file to disk or a server) and passes an updated `examples` array back in.
 *
 * Composes `<lr-table>` for the row list (columns for `input`/`expectedOutput`/joined
 * `tags`), `<lr-chip>`/`<lr-chip-group>` as a tag-based browse filter (one toggleable chip per
 * distinct tag currently present across `examples`; multiple active tags OR together, matching
 * the common "browse by any of these tags" idiom rather than requiring every tag to match),
 * `<lr-file-input>` for the import affordance, and `<lr-export-button>` for the export affordance
 * -- its own built-in client-side CSV/JSON download is deliberately suppressed
 * (`event.preventDefault()` on its `lr-export`) since `<lr-export-button>`'s flat `rows`/`columns`
 * CSV/JSON builder can't preserve an `EvalExample`'s own `tags`/`metadata` shape faithfully, and
 * producing the actual exported file/API-call either way is the host's job per this component's
 * own controlled contract; this keeps `lr-export-request` the single source of truth for every
 * configured format rather than one format silently downloading locally while every other format
 * does nothing.
 *
 * Row sorting is *not* re-implemented here: `<lr-table>`'s own `lr-sort` bubbles through
 * (composed events cross a shadow boundary automatically) for a host that wants to reorder
 * `examples` and hand back a resorted array -- the same "the host owns the actual data" contract
 * as every other mutation this component surfaces.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-eval-dataset
 * @event lr-example-select - A row was activated. `detail: { exampleId }` -- `exampleId` is `null` once the
 *   previously-selected row no longer exists in `examples` or falls outside the active filters
 *   (see `examples`' own doc).
 * @event lr-example-add-request - The "Add example" control was activated. No detail payload --
 *   this component has no opinion on what a new example's fields should be; the host implements
 *   its own creation flow (a dialog, a generated draft, etc.) and appends the result to `examples`.
 * @event lr-example-remove-request - The "Remove" control was activated for the selected row.
 *   `detail: { exampleId }`.
 * @event lr-import-request - Files were selected/dropped on the internal `<lr-file-input>` and at
 *   least one was accepted by its own type/size rules. `detail: { files }` — raw `File[]`; parsing
 *   (CSV/JSON/etc. into `EvalExample` rows) is left to the host, mirroring `<lr-file-input>`'s own
 *   "parsing is a host concern" scope.
 * @event lr-export-request - An export format was chosen. `detail: { format }`.
 * @event lr-sort - Deliberate pass-through from the internal table. `detail: { key }`.
 * @event focus - Re-dispatched when the internal search field (only rendered while `searchable`)
 *   receives focus, since native focus neither bubbles nor crosses the shadow boundary.
 * @event blur - Re-dispatched when the internal search field loses focus.
 * @csspart base - The root.
 * @csspart toolbar - The row of add/remove/import/export controls.
 * @csspart add-button - The "Add example" button.
 * @csspart remove-button - The "Remove" button, disabled while nothing is selected.
 * @csspart import - The internal `<lr-file-input>`.
 * @csspart export - The internal `<lr-export-button>`.
 * @csspart search - The search field's wrapper. Only rendered while `searchable`.
 * @csspart search-input - The `<input type="search">`. Only rendered while `searchable`.
 * @csspart tag-filter - The tag-filter chip group's wrapper. Only rendered while `examples`
 *   carries at least one tag.
 * @csspart grid - The internal `<lr-table>`.
 * @status stable
 * @since 4.1.0
 */
export class LyraEvalDataset extends LyraElement<LyraEvalDatasetEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['examples', 'exportFormats']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    evalDatasetAddExample: LYRA_DEFAULT_evalDatasetAddExample,
    evalDatasetColumnExpectedOutput: LYRA_DEFAULT_evalDatasetColumnExpectedOutput,
    evalDatasetColumnInput: LYRA_DEFAULT_evalDatasetColumnInput,
    evalDatasetColumnTags: LYRA_DEFAULT_evalDatasetColumnTags,
    evalDatasetEmpty: LYRA_DEFAULT_evalDatasetEmpty,
    evalDatasetImportLabel: LYRA_DEFAULT_evalDatasetImportLabel,
    evalDatasetLabel: LYRA_DEFAULT_evalDatasetLabel,
    evalDatasetNoMatches: LYRA_DEFAULT_evalDatasetNoMatches,
    evalDatasetRemoveExample: LYRA_DEFAULT_evalDatasetRemoveExample,
    evalDatasetSearchLabel: LYRA_DEFAULT_evalDatasetSearchLabel,
    evalDatasetTagFilterLabel: LYRA_DEFAULT_evalDatasetTagFilterLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-import-request',
  ]);

  /** Controlled dataset: every example currently known to the host. This component never
   *  mutates its own copy of it -- add/remove/import/export are all *requests*; the host performs
   *  the actual mutation (and any persistence/API call) and passes the updated array back in.
   *  Shrinking this out from under an in-progress selection or active tag filter is handled
   *  gracefully: a `selectedId` that no longer matches any row or falls outside the filtered
   *  result set resets to `null` (so Remove cannot act on a hidden row), and an active tag filter
   *  that no longer matches any row's `tags` is dropped rather than silently matching zero rows
   *  forever. Empty/blank ids are omitted and duplicates normalize first-wins before filtering,
   *  selection, the nested grid, and mutation events. */
  @property({ attribute: false }) examples: readonly EvalExample[] = [];

  /** Shows the built-in free-text search field, filtering by a case-insensitive substring match
   *  against `input`, `expectedOutput`, and `tags`. */
  @property({ type: Boolean, reflect: true }) searchable = false;

  /** Native autocomplete hint forwarded to the built-in search input while `searchable`. An empty
   *  string (the default) leaves the browser default in effect. */
  @property() autocomplete = '';

  /** Whether the browser spellchecks the built-in search input. Defaults to `true`; the literal
   *  `spellcheck="false"` attribute is deliberately parsed as false instead of as a presence-based
   *  boolean. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;

  /** Native capitalization hint forwarded to the built-in search input while `searchable`. */
  @property() override autocapitalize = '';

  /** Native autocorrection hint forwarded to the built-in search input while `searchable`.
   *  `autoCorrect` maps to the standard lowercase `autocorrect` attribute without colliding with
   *  the incompatible inherited `HTMLElement.autocorrect` type. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';

  /** Native virtual-keyboard input-mode hint forwarded to the built-in search input while
   *  `searchable`. */
  @property({ attribute: 'inputmode' }) override inputMode = '';

  /** Native virtual-keyboard enter-key hint forwarded to the built-in search input while
   *  `searchable`. */
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';

  /** Forwarded to the internal `<lr-file-input>`'s own `accept` (native-file-input-style pattern,
   *  e.g. `'.json,.csv'`). Empty (the default) accepts any file type. */
  @property() accept = '';

  /** Forwarded to the internal `<lr-export-button>`'s own `formats`. */
  @property({ attribute: false }) exportFormats: readonly LyraExportFormatOption[] = ['csv', 'json'];

  /** Disables every add/remove/import/export affordance -- e.g. while a host-side mutation from a
   *  previous request is still in flight. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Accessible name for the nested example grid. This wins over the localized
   *  `evalDatasetLabel` default; a host `aria-label` names the host itself and is not cloned onto
   *  the independently interactive grid. */
  @property() label = '';

  @state() private searchText = '';
  @state() private activeTags = new Set<string>();
  @state() private selectedId: string | null = null;

  private get normalizedExamples(): EvalExample[] {
    return firstByIdentity(Array.isArray(this.examples) ? this.examples : [], (example) => example.id);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('searchable') && !this.searchable) {
      this.searchText = '';
    }
    if (changed.has('examples')) {
      // A host fulfilling `lr-example-remove-request` (or an import that replaces the whole array)
      // can hand back an `examples` array that no longer contains the previously-selected id, or no
      // longer carries every previously-active tag. Re-clamp both here rather than leaving stale
      // state pointing at nothing: an unclamped `selectedId` would leave the Remove button enabled
      // for an id that can't be removed again, and an unclamped tag filter would keep matching zero
      // rows forever with no visible way back to "no filter".
      if (this.selectedId !== null && !this.normalizedExamples.some((example) => example.id === this.selectedId)) {
        this.clearSelection();
      }
      const available = this.allTags();
      if ([...this.activeTags].some((tag) => !available.includes(tag))) {
        this.activeTags = new Set([...this.activeTags].filter((tag) => available.includes(tag)));
      }
    }

    // A row can still exist in the controlled dataset but no longer be visible once a search or
    // tag filter narrows the grid. Clear its selection at that same boundary: leaving it active
    // would make Remove act on an invisible row with no way for the user to verify the target.
    const filtersChanged =
      changed.has('examples') || changed.has('searchText') || changed.has('activeTags') || changed.has('searchable');
    if (
      filtersChanged &&
      this.selectedId !== null &&
      !this.visibleExamples.some((example) => example.id === this.selectedId)
    ) {
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.selectedId = null;
    this.emit('lr-example-select', { exampleId: null });
  }

  private allTags(): string[] {
    const tags = new Set<string>();
    for (const example of this.normalizedExamples) {
      for (const tag of example.tags ?? []) tags.add(tag);
    }
    return [...tags].sort(getCollator(this.effectiveLocale).compare);
  }

  /** `examples` narrowed by the active tag filter (OR across `activeTags`) and the search text
   *  (AND with the tag filter -- both narrow the same list further). */
  private get visibleExamples(): EvalExample[] {
    const query = this.searchText.trim().toLocaleLowerCase(this.effectiveLocale);
    return this.normalizedExamples.filter((example) => {
      if (this.activeTags.size > 0 && !(example.tags ?? []).some((tag) => this.activeTags.has(tag))) return false;
      if (query === '') return true;
      const haystack = [example.input, example.expectedOutput ?? '', ...(example.tags ?? [])]
        .join(' ')
        .toLocaleLowerCase(this.effectiveLocale);
      return haystack.includes(query);
    });
  }

  private buildColumns(): TableColumn<EvalExample>[] {
    return [
      { key: 'input', label: this.localize('evalDatasetColumnInput'), cell: (row) => row.input },
      {
        key: 'expectedOutput',
        label: this.localize('evalDatasetColumnExpectedOutput'),
        cell: (row) => row.expectedOutput ?? '',
      },
      { key: 'tags', label: this.localize('evalDatasetColumnTags'), cell: (row) => (row.tags ?? []).join(', ') },
    ];
  }

  private onAddClick = (): void => {
    if (this.disabled) return;
    this.emit('lr-example-add-request');
  };

  private onRemoveClick = (): void => {
    if (this.disabled || this.selectedId === null) return;
    this.emit('lr-example-remove-request', { exampleId: this.selectedId });
  };

  private onGridRowClick = (e: CustomEvent<{ row: EvalExample }>): void => {
    e.stopPropagation();
    if (this.disabled) return;
    const id = e.detail.row.id;
    this.selectedId = id;
    this.emit('lr-example-select', { exampleId: id });
  };

  private onFiles = (e: LyraFileInputEventMap['lr-files']): void => {
    e.stopPropagation();
    if (this.disabled || e.detail.files.length === 0) return;
    this.emit('lr-import-request', { files: [...e.detail.files] });
  };

  private onExportButtonExport = (e: LyraExportButtonEventMap['lr-export']): void => {
    // Suppress the internal <lr-export-button>'s own built-in client-side blob download -- see
    // the class doc for why every configured format is redirected through lr-export-request
    // instead, rather than letting csv/json download locally while other formats silently do
    // nothing.
    e.preventDefault();
    e.stopPropagation();
    if (this.disabled) return;
    this.emit('lr-export-request', { format: e.detail.format });
  };

  private onTagChipSelect(tag: string, e: CustomEvent<ChipSelectDetail>): void {
    e.stopPropagation();
    if (this.disabled) return;
    const next = new Set(this.activeTags);
    if (e.detail.selected) next.add(tag);
    else next.delete(tag);
    this.activeTags = next;
  }

  private onSearchInput = (e: Event): void => {
    e.stopPropagation();
    if (this.disabled) return;
    this.searchText = (e.target as HTMLInputElement).value;
  };

  // Native focus/blur neither bubble nor cross the shadow boundary, so a host listening for
  // focus/blur directly on <lr-eval-dataset> (e.g. to commit a pending search on blur) would
  // never hear about the internal search field without this bridge.
  private onSearchFocus = (event: Event): void => {
    event.stopPropagation();
    this.emit('focus');
  };

  private onSearchBlur = (event: Event): void => {
    event.stopPropagation();
    this.emit('blur');
  };

  private stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  private renderToolbar(): TemplateResult {
    return html`
      <div part="toolbar">
        <button part="add-button" type="button" ?disabled=${this.disabled} @click=${this.onAddClick}>
          ${this.localize('evalDatasetAddExample')}
        </button>
        <button
          part="remove-button"
          type="button"
          ?disabled=${this.disabled || this.selectedId === null}
          @click=${this.onRemoveClick}
        >
          ${this.localize('evalDatasetRemoveExample')}
        </button>
        <lr-file-input
          part="import"
          accept=${this.accept}
          label=${this.localize('evalDatasetImportLabel')}
          ?disabled=${this.disabled}
          @input=${this.stopOwnedEvent}
          @change=${this.stopOwnedEvent}
          @focus=${this.stopOwnedEvent}
          @blur=${this.stopOwnedEvent}
          @lr-invalid=${this.stopOwnedEvent}
          @lr-files=${this.onFiles}
        ></lr-file-input>
        <lr-export-button
          part="export"
          .formats=${this.exportFormats}
          ?disabled=${this.disabled}
          @lr-export-complete=${this.stopOwnedEvent}
          @lr-export-error=${this.stopOwnedEvent}
          @lr-show=${this.stopOwnedEvent}
          @lr-hide=${this.stopOwnedEvent}
          @lr-export=${this.onExportButtonExport}
        ></lr-export-button>
      </div>
    `;
  }

  private renderSearch(): TemplateResult {
    const label = this.localize('evalDatasetSearchLabel');
    return html`
      <div part="search">
        <input
          part="search-input"
          type="search"
          .value=${this.searchText}
          aria-label=${label}
          placeholder=${label}
          autocomplete=${this.autocomplete || nothing}
          .spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.autoCorrect || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          ?disabled=${this.disabled}
          @input=${this.onSearchInput}
          @focus=${this.onSearchFocus}
          @blur=${this.onSearchBlur}
        />
      </div>
    `;
  }

  private renderTagFilter(tags: string[]): TemplateResult {
    return html`
      <div part="tag-filter" role="group" aria-label=${this.localize('evalDatasetTagFilterLabel')}>
        <lr-chip-group>
          ${tags.map(
            (tag) => html`<lr-chip
              toggleable
              .value=${tag}
              .selected=${this.activeTags.has(tag)}
              .disabled=${this.disabled}
              @lr-chip-select=${(e: CustomEvent<ChipSelectDetail>) => this.onTagChipSelect(tag, e)}
              >${tag}</lr-chip
            >`,
          )}
        </lr-chip-group>
      </div>
    `;
  }

  override render(): TemplateResult {
    const label = this.label || this.localize('evalDatasetLabel');
    const tags = this.allTags();
    const visible = this.visibleExamples;
    const examples = this.normalizedExamples;
    const filtered = visible.length !== examples.length;
    const emptyText =
      examples.length === 0
        ? this.localize('evalDatasetEmpty')
        : filtered && visible.length === 0
          ? this.localize('evalDatasetNoMatches')
          : '';

    return html`
      <div part="base">
        ${this.renderToolbar()}
        ${this.searchable ? this.renderSearch() : nothing}
        ${tags.length > 0 ? this.renderTagFilter(tags) : nothing}
        <lr-table
          part="grid"
          aria-label=${label}
          .selectionMode=${this.disabled ? 'none' : 'single'}
          .columns=${this.buildColumns()}
          .rows=${visible}
          .pageSize=${MAX_RENDERED_EXAMPLES}
          .rowKey=${(row: EvalExample) => row.id}
          .selectedKeys=${this.selectedId === null ? new Set() : new Set([this.selectedId])}
          .emptyHeading=${emptyText}
          @input=${this.stopOwnedEvent}
          @change=${this.stopOwnedEvent}
          @focus=${this.stopOwnedEvent}
          @blur=${this.stopOwnedEvent}
          @lr-priority-columns-visibility-change=${this.stopOwnedEvent}
          @lr-row-expand-toggle=${this.stopOwnedEvent}
          @lr-load-more=${this.stopOwnedEvent}
          @lr-selection-change=${this.stopOwnedEvent}
          @lr-filter-change=${this.stopOwnedEvent}
          @lr-page-change=${this.stopOwnedEvent}
          @lr-cell-edit=${this.stopOwnedEvent}
          @lr-column-resize=${this.stopOwnedEvent}
          @lr-row-click=${this.onGridRowClick}
        ></lr-table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-eval-dataset': LyraEvalDataset;
  }
}
