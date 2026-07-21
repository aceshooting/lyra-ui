import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { TableColumn } from '../../data/table/table.class.js';
import '../../data/table/table.js';
import type { ChipSelectDetail } from '../../overlays/chip/chip.class.js';
import '../../overlays/chip/chip.js';
import '../../overlays/chip/chip-group.js';
import type { LyraFileInputEventMap } from '../../media/file-input/file-input.class.js';
import '../../media/file-input/file-input.js';
import type { ExportFormatOption, LyraExportButtonEventMap } from '../../utility/export-button/export-button.class.js';
import '../../utility/export-button/export-button.js';
import { styles } from './eval-dataset.styles.js';

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
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface LyraEvalDatasetEventMap {
  'lr-example-select': CustomEvent<{ id: string | null }>;
  'lr-example-add-request': CustomEvent<undefined>;
  'lr-example-remove-request': CustomEvent<{ id: string }>;
  'lr-import-request': CustomEvent<{ files: File[] }>;
  'lr-export-request': CustomEvent<{ format: string }>;
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
 * carrying just enough information to act on; the host decides how (a local mutation, a network
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
 * @customElement lr-eval-dataset
 * @event lr-example-select - A row was activated. `detail: { id }` -- `id` is `null` once the
 *   previously-selected row no longer exists in `examples` (see `examples`' own doc).
 * @event lr-example-add-request - The "Add example" control was activated. No detail payload --
 *   this component has no opinion on what a new example's fields should be; the host implements
 *   its own creation flow (a dialog, a generated draft, etc.) and appends the result to `examples`.
 * @event lr-example-remove-request - The "Remove" control was activated for the selected row.
 *   `detail: { id }`.
 * @event lr-import-request - Files were selected/dropped on the internal `<lr-file-input>` and at
 *   least one was accepted by its own type/size rules. `detail: { files }` — raw `File[]`; parsing
 *   (CSV/JSON/etc. into `EvalExample` rows) is left to the host, mirroring `<lr-file-input>`'s own
 *   "parsing is a host concern" scope.
 * @event lr-export-request - An export format was chosen. `detail: { format }`.
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
 */
export class LyraEvalDataset extends LyraElement<LyraEvalDatasetEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Controlled dataset: every example currently known to the host. This component never
   *  mutates its own copy of it -- add/remove/import/export are all *requests*; the host performs
   *  the actual mutation (and any persistence/API call) and passes the updated array back in.
   *  Shrinking this out from under an in-progress selection or active tag filter is handled
   *  gracefully: a `selectedId` that no longer matches any row resets to `null` (re-enabling the
   *  "Add" button's inert Remove sibling), and an active tag filter that no longer matches any
   *  row's `tags` is dropped rather than silently matching zero rows forever. */
  @property({ attribute: false }) examples: EvalExample[] = [];

  /** Shows the built-in free-text search field, filtering by a case-insensitive substring match
   *  against `input`, `expectedOutput`, and `tags`. */
  @property({ type: Boolean, reflect: true }) searchable = false;

  /** Forwarded to the internal `<lr-file-input>`'s own `accept` (native-file-input-style pattern,
   *  e.g. `'.json,.csv'`). Empty (the default) accepts any file type. */
  @property() accept = '';

  /** Forwarded to the internal `<lr-export-button>`'s own `formats`. */
  @property({ attribute: false }) exportFormats: ExportFormatOption[] = ['csv', 'json'];

  /** Disables every add/remove/import/export affordance -- e.g. while a host-side mutation from a
   *  previous request is still in flight. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Accessible name for the example grid region. A host-level `aria-label` attribute wins over
   *  this, which in turn wins over the localized `evalDatasetLabel` default. */
  @property() label = '';

  @state() private searchText = '';
  @state() private activeTags = new Set<string>();
  @state() private selectedId: string | null = null;

  protected willUpdate(changed: PropertyValues): void {
    if (!changed.has('examples')) return;
    // A host fulfilling `lr-example-remove-request` (or an import that replaces the whole array)
    // can hand back an `examples` array that no longer contains the previously-selected id, or no
    // longer carries every previously-active tag. Re-clamp both here rather than leaving stale
    // state pointing at nothing: an unclamped `selectedId` would leave the Remove button enabled
    // for an id that can't be removed again, and an unclamped tag filter would keep matching zero
    // rows forever with no visible way back to "no filter".
    if (this.selectedId !== null && !this.examples.some((example) => example.id === this.selectedId)) {
      this.selectedId = null;
    }
    const available = this.allTags();
    if ([...this.activeTags].some((tag) => !available.includes(tag))) {
      this.activeTags = new Set([...this.activeTags].filter((tag) => available.includes(tag)));
    }
  }

  private allTags(): string[] {
    const tags = new Set<string>();
    for (const example of this.examples) {
      for (const tag of example.tags ?? []) tags.add(tag);
    }
    return [...tags].sort();
  }

  /** `examples` narrowed by the active tag filter (OR across `activeTags`) and the search text
   *  (AND with the tag filter -- both narrow the same list further). */
  private get visibleExamples(): EvalExample[] {
    const query = this.searchText.trim().toLowerCase();
    return this.examples.filter((example) => {
      if (this.activeTags.size > 0 && !(example.tags ?? []).some((tag) => this.activeTags.has(tag))) return false;
      if (query === '') return true;
      const haystack = [example.input, example.expectedOutput ?? '', ...(example.tags ?? [])]
        .join(' ')
        .toLowerCase();
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
    this.emit<undefined>('lr-example-add-request');
  };

  private onRemoveClick = (): void => {
    if (this.disabled || this.selectedId === null) return;
    this.emit('lr-example-remove-request', { id: this.selectedId });
  };

  private onGridRowClick = (e: CustomEvent<{ row: EvalExample }>): void => {
    const id = e.detail.row.id;
    this.selectedId = id;
    this.emit('lr-example-select', { id });
  };

  private onFiles = (e: LyraFileInputEventMap['lr-files']): void => {
    if (this.disabled || e.detail.files.length === 0) return;
    this.emit('lr-import-request', { files: e.detail.files });
  };

  private onExportButtonExport = (e: LyraExportButtonEventMap['lr-export']): void => {
    // Suppress the internal <lr-export-button>'s own built-in client-side blob download -- see
    // the class doc for why every configured format is redirected through lr-export-request
    // instead, rather than letting csv/json download locally while other formats silently do
    // nothing.
    e.preventDefault();
    this.emit('lr-export-request', { format: e.detail.format });
  };

  private onTagChipSelect(tag: string, e: CustomEvent<ChipSelectDetail>): void {
    const next = new Set(this.activeTags);
    if (e.detail.selected) next.add(tag);
    else next.delete(tag);
    this.activeTags = next;
  }

  private onSearchInput = (e: Event): void => {
    this.searchText = (e.target as HTMLInputElement).value;
  };

  // Native focus/blur neither bubble nor cross the shadow boundary, so a host listening for
  // focus/blur directly on <lr-eval-dataset> (e.g. to commit a pending search on blur) would
  // never hear about the internal search field without this bridge.
  private onSearchFocus = (): void => {
    this.emit('focus');
  };

  private onSearchBlur = (): void => {
    this.emit('blur');
  };

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
          @lr-files=${this.onFiles}
        ></lr-file-input>
        <lr-export-button
          part="export"
          .formats=${this.exportFormats}
          ?disabled=${this.disabled}
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
              @lr-chip-select=${(e: CustomEvent<ChipSelectDetail>) => this.onTagChipSelect(tag, e)}
              >${tag}</lr-chip
            >`,
          )}
        </lr-chip-group>
      </div>
    `;
  }

  render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('evalDatasetLabel');
    const tags = this.allTags();
    const visible = this.visibleExamples;
    const filtered = visible.length !== this.examples.length;
    const emptyText =
      this.examples.length === 0
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
          selection-mode="single"
          .columns=${this.buildColumns()}
          .rows=${visible}
          .rowKey=${(row: EvalExample) => row.id}
          .selectedKey=${this.selectedId}
          .emptyHeading=${emptyText}
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
