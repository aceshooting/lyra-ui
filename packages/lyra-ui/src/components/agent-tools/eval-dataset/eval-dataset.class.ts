import type { LyraPageSource, LyraPageResult, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { createHaystackMemo } from '../../../internal/search-haystack.js';
import { indexByKey } from '../../../internal/keyed-index.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import '../../forms/input/input.class.js';
import type { LyraInput } from '../../forms/input/input.class.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getCollator, getNumberFormat } from '../../../internal/intl-cache.js';
import { trueDefaultSpellcheckConverter as spellcheckConverter } from '../../../internal/converters.js';
import type { LyraTableEventMap, TableColumn } from '../../data/table/table.class.js';
import type { ChipSelectDetail } from '../../overlays/chip/chip.class.js';
import type { LyraFileInputEventMap } from '../../media/file-input/file-input.class.js';
import type { LyraExportFormatOption, LyraExportButtonEventMap } from '../../utility/export-button/export-button.class.js';
import { styles } from './eval-dataset.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import { firstByIdentity } from '../collection-identity.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_evalDatasetAddExample, LYRA_DEFAULT_evalDatasetColumnExpectedOutput, LYRA_DEFAULT_evalDatasetColumnInput, LYRA_DEFAULT_evalDatasetColumnTags, LYRA_DEFAULT_evalDatasetEmpty, LYRA_DEFAULT_evalDatasetImportLabel, LYRA_DEFAULT_evalDatasetLabel, LYRA_DEFAULT_evalDatasetLimit, LYRA_DEFAULT_evalDatasetNoMatches, LYRA_DEFAULT_evalDatasetRemoveExample, LYRA_DEFAULT_evalDatasetSearchLabel, LYRA_DEFAULT_evalDatasetTagFilterLabel } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_tagFacetLimit } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MAX_RENDERED_EXAMPLES = 100;
const MAX_TAG_FACETS = 500;

const rowKey = (row: EvalExample): string => row.id;

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

/** Full-source example query; tags use OR semantics, combined with text search. */
export interface EvalDatasetSourceQuery {
  readonly search: string;
  readonly tags: readonly string[];
  readonly sortKey: string | null;
  readonly sortDir: 'asc' | 'desc';
}
export type EvalDatasetSource = LyraPageSource<EvalExample, EvalDatasetSourceQuery>;

export interface LyraEvalDatasetEventMap {
  'lr-example-select': CustomEvent<{ exampleId: string | null }>;
  'lr-example-add-request': CustomEvent<null>;
  'lr-example-remove-request': CustomEvent<{ exampleId: string }>;
  'lr-import-request': CustomEvent<LyraEventDetailSnapshot<{ files: File[] }>>;
  'lr-export-request': CustomEvent<{ format: string }>;
  /** Deliberate pass-through from the controlled comparison table. */
  'lr-sort': LyraTableEventMap<EvalExample>['lr-sort'];
  focus: FocusEvent;
  blur: FocusEvent;
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
 * (`event.preventDefault()` on its `lr-export-request`) since `<lr-export-button>`'s flat `rows`/`columns`
 * CSV/JSON builder can't preserve an `EvalExample`'s own `tags`/`metadata` shape faithfully, and
 * producing the actual exported file/API-call either way is the host's job per this component's
 * own controlled contract; this keeps `lr-export-request` the single source of truth for every
 * configured format rather than one format silently downloading locally while every other format
 * does nothing.
 *
 * Row sorting is *not* re-implemented here: all three built-in text columns opt into
 * `<lr-table>` sorting, and its own `lr-sort` bubbles through (composed events cross a shadow
 * boundary automatically) for a host that wants to reorder `examples` and hand back a resorted
 * array -- the same "the host owns the actual data" contract as every other mutation this
 * component surfaces.
 *
 * Public collection arrays take bounded readonly snapshots. Example records retain identity so
 * opaque metadata stays intact; reassign `examples` after editing records. At most 10,000 examples
 * are admitted, with an existing limit notice when more are supplied. Other owned collections
 * retain the 10,000-entry and 50,000-node clone limits.
 *
 * Tag facets show at most 500 locale-sorted distinct tags, keeping selected tags visible and
 * filling the remaining places with the earliest tags. A localized note counts omitted tags.
 * Search and filtering continue to use the complete admitted dataset.
 *
 * With dataSource, the provider owns global text filtering, OR-tag filtering and server sorting.
 * Zero-based sourcePage and sourcePageSize (1..500) address the complete source; sourceTotal is
 * null until an authoritative page arrives. Provider rows have at most 500 tags and 65,536 total
 * display-text UTF-16 units; opaque metadata is not traversed or rendered. Catalogue facets are
 * required, independent of the loaded page, and reserve active tags inside the 500-facet budget.
 * Only unavailableSelected removes active filters. Page/query transitions clear the private
 * selected example once, keeping Remove restricted to a visible row. Import/export/add intents
 * keep their existing host-owned behavior; source mode does not export only the loaded page.
 * Reassign dataSource or call requestUpdate() to refresh; named paints keep source caches stable.
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
 * @event lr-sort - Deliberate pass-through from the internal table.
 *   `detail: { phase: 'commit', sortKey, sortDir }`.
 * @event {FocusEvent} focus - Re-dispatched when the internal search field (only rendered while `searchable`)
 *   receives focus, since native focus neither bubbles nor crosses the shadow boundary.
 * @event {FocusEvent} blur - Re-dispatched when the internal search field loses focus.
 * @csspart base - The root.
 * @csspart toolbar - The row of add/remove/import/export controls.
 * @csspart add-button - The "Add example" button.
 * @csspart remove-button - The "Remove" button, disabled while nothing is selected.
 * @csspart import - The internal tight-density `<lr-file-input>`; its dropzone text and accessible name
 *   are the localized `evalDatasetImportLabel`.
 * @csspart export - The internal `<lr-export-button>`.
 * @csspart search - The search field's wrapper. Only rendered while `searchable`.
 * @csspart search-input - The composed `<lr-input type="search">`. Only rendered while `searchable`.
 * @csspart search-input-field - The native `<input>` inside the search field (forwarded from `<lr-input>`).
 * @csspart search-clear - The search field's clear button (forwarded from `<lr-input>`). Only rendered
 *   while the field has text.
 * @csspart tag-filter - The tag-filter chip group's wrapper. Only rendered while `examples`
 *   carries at least one tag.
 * @csspart grid - The internal `<lr-table>`.
 * @csspart limit - Visible notice for omitted examples or tags beyond the 500-facet ceiling.
 * The search field is a composed `<lr-input>`, so it is themed through the shared `--lr-input-*` and
 * `--lr-form-control-*` tokens.
 *
 * @status stable
 * @since 4.1.0
 */
export class LyraEvalDataset extends LyraElement<LyraEvalDatasetEventMap> {
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
    evalDatasetLimit: LYRA_DEFAULT_evalDatasetLimit,
    evalDatasetNoMatches: LYRA_DEFAULT_evalDatasetNoMatches,
    evalDatasetRemoveExample: LYRA_DEFAULT_evalDatasetRemoveExample,
    evalDatasetSearchLabel: LYRA_DEFAULT_evalDatasetSearchLabel,
    evalDatasetTagFilterLabel: LYRA_DEFAULT_evalDatasetTagFilterLabel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    tagFacetLimit: LYRA_DEFAULT_tagFacetLimit,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['examples', 'exportFormats']);
  /** Rows carry opaque `metadata` that is never read, so they are kept by identity, not cloned. */
  protected static override readonly identityCollectionProperties = Object.freeze(['examples']);

  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];
  private readonly limitAnnouncements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private limitAnnouncementInitialized = false;
  private previouslyTruncated = false;
  private examplesTruncated = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.sourceMode && this.selectedId !== null) this.clearSelection();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.limitAnnouncements.adopted();
    this.sourcePages.adopted();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.limitAnnouncementInitialized && this.examplesTruncated && !this.previouslyTruncated) {
      const truncation = publicCollectionTruncation(this, 'examples');
      if (truncation) this.limitAnnouncements.announcePolite(this.localize('evalDatasetLimit', undefined, {
        count: getNumberFormat(this.effectiveLocale).format(truncation.retained),
      }));
    }
    this.limitAnnouncementInitialized = true;
    this.previouslyTruncated = this.examplesTruncated;
  }
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-import-request',
  ]);

  @state() private sourceStateVersion = 0;
  private _dataSource?: EvalDatasetSource;
  private sourceEpoch = 0;
  private sourceSyncing = false;
  private sourceInputs?: readonly unknown[];
  private sourceQueryInputs?: readonly unknown[];
  private sourceFailure: unknown;
  private sourceResult?: LyraPageResult<EvalExample>;
  private sourceRows: EvalExample[] = [];
  private sourceTags: string[] = [];
  private sourceFacetLabels = new Map<string, string>();
  private sourceSortKey: string | null = null;
  private sourceSortDir: 'asc' | 'desc' = 'asc';
  private readonly sourcePages = new SourcePageController<EvalExample, EvalDatasetSourceQuery>(this, {
    normalizeRecord: (record, isCurrent) => this.projectSourceExample(record, isCurrent),
    validateMetadata: (result, query) => {
      if (!result.tags || query.tags.length > MAX_TAG_FACETS || result.tags.unavailableSelected.some(key => !query.tags.includes(key))) throw new TypeError('Invalid example source facets');
      const available = new Set(result.tags.values.map(facet => facet.key));
      const missing = new Set(result.tags.unavailableSelected);
      if (query.tags.some(key => !available.has(key) && !missing.has(key))) throw new TypeError('Selected source facet is missing');
    },
    onChange: () => { this.sourceStateVersion++; },
  });

  /** Host-owned full-source pages; wins over examples even when invalid. Reassign the same
   * provider or call requestUpdate() to refresh. undefined restores the current examples input. */
  @property({ attribute: false })
  get dataSource(): EvalDatasetSource | undefined { return this._dataSource; }
  set dataSource(value: EvalDatasetSource | undefined) {
    const previous = this._dataSource; this._dataSource = value;
    this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    this.requestUpdate('dataSource', previous);
  }
  /** Zero-based provider page; legacy table paging is unchanged. */
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Provider rows per page, normalized to 1..500. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact current-query total, or null while pending, invalid or outside provider mode. */
  get sourceTotal(): number | null { return this.dataSource === undefined ? null : this.sourcePages.state.result?.total ?? null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }
  private get sourceBlocked(): boolean { return this.sourceMode && (this.sourcePages.state.pending || !!this.sourcePages.state.error || !!this.sourceFailure); }

  private projectSourceExample(record: LyraSourceRecord<unknown>, isCurrent: () => boolean): LyraSourceRecord<EvalExample> {
    const assertCurrent = (): void => { if (!isCurrent()) throw new TypeError('Obsolete source record'); };
    const descriptorOf = (target: object, key: PropertyKey) => {
      assertCurrent();
      const descriptor = getOwnDataDescriptor(target, key);
      assertCurrent();
      return descriptor;
    };
    assertCurrent();
    if (record.value === null || typeof record.value !== 'object') throw new TypeError('Invalid source example');
    const candidate = record.value;
    const read = (key: string, optional = false): unknown => {
      const descriptor = descriptorOf(candidate, key);
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || (!optional && descriptor === MISSING_OWN_DATA_DESCRIPTOR)) throw new TypeError('Invalid source example');
      return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
    };
    const id = read('id'); const input = read('input'); const expectedOutput = read('expectedOutput', true); const rawTags = read('tags', true);
    if (typeof id !== 'string' || !id.trim() || id !== record.key || typeof input !== 'string' || (expectedOutput !== undefined && typeof expectedOutput !== 'string')) throw new TypeError('Invalid source example');
    let units = id.length + input.length + (expectedOutput?.length ?? 0);
    const tags: string[] = [];
    if (rawTags !== undefined) {
      if (!Array.isArray(rawTags)) throw new TypeError('Invalid source tags');
      const length = descriptorOf(rawTags, 'length');
      if (length === MISSING_OWN_DATA_DESCRIPTOR || length === UNSAFE_OWN_DATA_DESCRIPTOR || typeof length.value !== 'number' || length.value > MAX_TAG_FACETS) throw new RangeError('Invalid source tags');
      for (let i = 0; i < length.value; i++) {
        const tag = descriptorOf(rawTags, String(i));
        if (tag === MISSING_OWN_DATA_DESCRIPTOR || tag === UNSAFE_OWN_DATA_DESCRIPTOR || typeof tag.value !== 'string') throw new TypeError('Invalid source tag');
        units += tag.value.length; tags.push(tag.value);
      }
    }
    if (units > 65_536) throw new RangeError('Source example too large');
    return { key: record.key, order: record.order, value: Object.freeze({ id, input, ...(expectedOutput === undefined ? {} : { expectedOutput }), tags: Object.freeze(tags) }) };
  }

  private syncSource(): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    try {
      if (!this.sourceMode) {
        if (this.sourceInputs) this.sourcePages.bind(undefined);
        this.sourceInputs = undefined; this.sourceQueryInputs = undefined;
        this.sourceResult = undefined; this.sourceRows = []; this.sourceTags = []; this.sourceFailure = undefined;
        return;
      }
      const source = this.dataSource!; const epoch = this.sourceEpoch + this.explicitRefresh;
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      let page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      const queryInputs = [this.searchText, this.activeTags, this.sourceSortKey, this.sourceSortDir, size];
      if (this.sourceQueryInputs && queryInputs.some((value, index) => value !== this.sourceQueryInputs![index])) { page = 0; this.sourcePage = 0; }
      this.sourceQueryInputs = queryInputs;
      const revision = source.revision;
      const inputs = [source, revision, epoch, this.effectiveLocale, ...queryInputs, page];
      if (this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index])) return;
      this.sourceInputs = inputs; this.sourceFailure = undefined; this.sourceRows = []; this.sourceTags = []; this.sourceResult = undefined;
      if (this.selectedId !== null) this.clearSelection();
      this.sourcePages.bind({ source, revision, epoch, locale: this.effectiveLocale });
      const query: EvalDatasetSourceQuery = Object.freeze({ search: this.searchText, tags: Object.freeze([...this.activeTags]), sortKey: this.sourceSortKey, sortDir: this.sourceSortDir });
      void this.sourcePages.request(query, page, size);
    } catch (error) {
      this.sourcePages.bind(undefined); this.sourceRows = []; this.sourceTags = []; this.sourceResult = undefined; this.sourceFailure = error;
    } finally { this.sourceSyncing = false; }
  }

  private acceptSourcePage(): void {
    const result = this.sourcePages.state.result;
    if (!result || result === this.sourceResult) return;
    this.sourceResult = result; this.sourceRows = result.rows.map(record => record.value);
    this.sourceTags = result.tags!.values.map(facet => facet.key);
    this.sourceFacetLabels = new Map(result.tags!.values.map(facet => [facet.key, facet.label]));
    const removed = new Set(result.tags!.unavailableSelected);
    if ([...this.activeTags].some(key => removed.has(key))) { this.activeTags = new Set([...this.activeTags].filter(key => !removed.has(key))); return; }
    if (this.sourcePage !== this.sourcePages.state.page) {
      this.sourceSyncing = true; this.sourcePage = this.sourcePages.state.page; this.sourceSyncing = false; this.sourceInputs = this.sourceInputs ? [...this.sourceInputs.slice(0, -1), this.sourcePages.state.page] : undefined;
    }
  }
  private onSourcePage = (event: CustomEvent<{ page: number }>): void => {
    event.stopPropagation(); if (this.sourceMode && !this.disabled) this.sourcePage = event.detail.page - 1;
  };
  private onSourceSort = (event: LyraTableEventMap<EvalExample>['lr-sort']): void => {
    if (!this.sourceMode || this.disabled) return;
    this.sourceSortKey = event.detail.sortKey; this.sourceSortDir = event.detail.sortDir;
    this.syncSource(); this.sourceStateVersion++;
  };
  private onSourceRetry = (event: Event): void => { event.stopPropagation(); if (this.sourceMode && !this.disabled) this.requestUpdate(); };

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
   *  `evalDatasetLabel` default, which also applies when it is empty since the grid needs a name; a
   *  host `aria-label` names the host itself and is not cloned onto the independently interactive grid. */
  @property() label = '';

  @state() private searchText = '';
  @state() private activeTags = new Set<string>();
  @state() private selectedId: string | null = null;

  private normalizedFor?: readonly EvalExample[];
  private normalizedCache: EvalExample[] = [];

  private get normalizedExamples(): EvalExample[] {
    if (this.normalizedFor !== this.examples) {
      this.normalizedFor = this.examples;
      const deduped = firstByIdentity(Array.isArray(this.examples) ? this.examples : [], (example) => example.id);
      // A malformed `tags` value (string, number, object) must not reach the consumers below, which iterate it.
      this.normalizedCache = deduped.map((example) => (Array.isArray(example.tags) ? example : { ...example, tags: undefined }));
    }
    return this.normalizedCache;
  }

  private explicitRefresh = 0;
  private normalizedRefresh = 0;
  private filterMemo?: { inputs: unknown[]; rows: EvalExample[] };
  private readonly searchCorpus = createHaystackMemo<EvalExample>((example, locale) =>
    [example.input, example.expectedOutput ?? '', ...(example.tags ?? [])].join(' ').toLocaleLowerCase(locale));

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) this.explicitRefresh = (this.explicitRefresh ?? 0) + 1;
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize', 'searchText', 'activeTags'].includes(String(args[0]))) this.syncSource();
    super.requestUpdate(...args);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('searchable') && !this.searchable) this.searchText = '';
    this.syncSource();
    if (this.sourceMode) { this.acceptSourcePage(); return; }
    const normalizedChanged = changed.has('dataSource') || this.normalizedFor !== this.examples || this.normalizedRefresh !== this.explicitRefresh;
    if (this.normalizedRefresh !== this.explicitRefresh) {
      this.normalizedRefresh = this.explicitRefresh;
      this.normalizedFor = undefined;
    }
    if (changed.has('searchable') && !this.searchable) {
      this.searchText = '';
    }
    if (normalizedChanged) {
      // A host fulfilling `lr-example-remove-request` (or an import that replaces the whole array)
      // can hand back an `examples` array that no longer contains the previously-selected id, or no
      // longer carries every previously-active tag. Re-clamp both here rather than leaving stale
      // state pointing at nothing: an unclamped `selectedId` would leave the Remove button enabled
      // for an id that can't be removed again, and an unclamped tag filter would keep matching zero
      // rows forever with no visible way back to "no filter".
      if (this.selectedId !== null && !indexByKey(this.normalizedExamples, rowKey).has(this.selectedId)) {
        this.clearSelection();
      }
      const available = new Set(this.allTags());
      if ([...this.activeTags].some((tag) => !available.has(tag))) {
        this.activeTags = new Set([...this.activeTags].filter((tag) => available.has(tag)));
      }
    }

    // A row can still exist in the controlled dataset but no longer be visible once a search or
    // tag filter narrows the grid. Clear its selection at that same boundary: leaving it active
    // would make Remove act on an invisible row with no way for the user to verify the target.
    const inputs = [this.normalizedExamples, this.searchText, this.activeTags, this.effectiveLocale];
    const filtersChanged = !this.filterMemo || inputs.some((input, index) => input !== this.filterMemo!.inputs[index]);
    if (filtersChanged) this.filterMemo = { inputs, rows: this.filterExamples() };
    this.visibleExamples = this.filterMemo!.rows;
    if (
      filtersChanged &&
      this.selectedId !== null &&
      !indexByKey(this.visibleExamples, rowKey).has(this.selectedId)
    ) {
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.selectedId = null;
    this.emit('lr-example-select', { exampleId: null });
  }

  private tagsMemo?: { examples: readonly EvalExample[]; locale: string; tags: string[] };
  private allTags(): string[] {
    const examples = this.normalizedExamples;
    const locale = this.effectiveLocale;
    if (this.tagsMemo?.examples === examples && this.tagsMemo.locale === locale) return this.tagsMemo.tags;
    const tags = new Set<string>();
    for (const example of this.normalizedExamples) {
      for (const tag of example.tags ?? []) tags.add(tag);
    }
    const sorted = [...tags].sort(getCollator(locale).compare);
    this.tagsMemo = { examples, locale, tags: sorted };
    return sorted;
  }

  /** `examples` narrowed by the active tag filter (OR across `activeTags`) and the search text
   *  (AND with the tag filter -- both narrow the same list further). */
  private visibleExamples: EvalExample[] = [];

  private filterExamples(): EvalExample[] {
    const query = this.searchText.trim().toLocaleLowerCase(this.effectiveLocale);
    const corpus = query ? this.searchCorpus(this.normalizedExamples, this.effectiveLocale) : undefined;
    return this.normalizedExamples.filter((example, index) => {
      if (this.activeTags.size > 0 && !(example.tags ?? []).some((tag) => this.activeTags.has(tag))) return false;
      if (query === '') return true;
      return corpus![index]!.includes(query);
    });
  }

  private columnsCache?: { key: string; columns: TableColumn<EvalExample>[] };
  private selectedKeysCache?: { id: string | null; keys: Set<string> };

  /** Rebuilt only when a localized header changes, so the table keeps a stable `columns` reference. */
  private buildColumns(): TableColumn<EvalExample>[] {
    const labels: readonly [string, string, string] = [
      this.localize('evalDatasetColumnInput'),
      this.localize('evalDatasetColumnExpectedOutput'),
      this.localize('evalDatasetColumnTags'),
    ];
    const key = labels.join('\u0000');
    if (this.columnsCache?.key !== key) this.columnsCache = { key, columns: this.createColumns(labels) };
    return this.columnsCache.columns;
  }

  private selectedKeys(): Set<string> {
    if (this.selectedKeysCache?.id !== this.selectedId) {
      this.selectedKeysCache = { id: this.selectedId, keys: this.selectedId === null ? new Set() : new Set([this.selectedId]) };
    }
    return this.selectedKeysCache.keys;
  }

  private createColumns([inputLabel, expectedLabel, tagsLabel]: readonly [string, string, string]): TableColumn<EvalExample>[] {
    return [
      {
        key: 'input',
        label: inputLabel,
        sortable: true,
        sortValue: (row) => row.input,
        cell: (row) => row.input,
      },
      {
        key: 'expectedOutput',
        label: expectedLabel,
        sortable: true,
        sortValue: (row) => row.expectedOutput ?? '',
        cell: (row) => row.expectedOutput ?? '',
      },
      {
        key: 'tags',
        label: tagsLabel,
        sortable: true,
        sortValue: (row) => (row.tags ?? []).join(', '),
        cell: (row) => (row.tags ?? []).join(', '),
      },
    ];
  }

  private onAddClick = (): void => {
    if (this.disabled) return;
    this.emit('lr-example-add-request');
  };

  private onRemoveClick = (): void => {
    if (this.disabled || this.sourceBlocked || this.selectedId === null) return;
    this.emit('lr-example-remove-request', { exampleId: this.selectedId });
  };

  private onGridRowActivate = (e: CustomEvent<{ row: EvalExample }>): void => {
    e.stopPropagation();
    if (this.disabled) return;
    if (this.sourceBlocked || (this.sourceMode && !this.sourceRows.includes(e.detail.row))) return;
    const id = e.detail.row.id;
    this.selectedId = id;
    this.emit('lr-example-select', { exampleId: id });
  };

  private onFiles = (e: LyraFileInputEventMap['lr-files']): void => {
    e.stopPropagation();
    if (this.disabled || e.detail.files.length === 0) return;
    this.emit('lr-import-request', { files: [...e.detail.files] });
  };

  private onExportButtonExport = (e: LyraExportButtonEventMap['lr-export-request']): void => {
    // Suppress the internal <lr-export-button>'s own built-in client-side blob download -- see
    // the class doc for why every configured format is redirected through lr-export-request
    // instead, rather than letting csv/json download locally while other formats silently do
    // nothing.
    e.preventDefault();
    e.stopPropagation();
    if (this.disabled) return;
    this.emit('lr-export-request', { format: e.detail.format });
  };

  private onTagChipToggle(tag: string, e: CustomEvent<ChipSelectDetail>): void {
    e.stopPropagation();
    if (this.disabled) return;
    const next = new Set(this.activeTags);
    if (e.detail.selected) next.add(tag);
    else next.delete(tag);
    this.activeTags = next;
  }

  private stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  private renderToolbar(): TemplateResult {
    return html`
      <div part="toolbar">
        <button part="add-button" data-agent-action="brand" type="button" ?disabled=${this.disabled} @click=${this.onAddClick}>
          ${this.localize('evalDatasetAddExample')}
        </button>
        <button
          part="remove-button"
          data-agent-action="neutral"
          type="button"
          ?disabled=${this.disabled || this.sourceBlocked || this.selectedId === null}
          @click=${this.onRemoveClick}
        >
          ${this.localize('evalDatasetRemoveExample')}
        </button>
        <lr-file-input
          part="import"
          accept=${this.accept}
          aria-label=${this.localize('evalDatasetImportLabel')}
          ?disabled=${this.disabled}
          @input=${this.stopOwnedEvent}
          @change=${this.stopOwnedEvent}
          @lr-input=${this.stopOwnedEvent}
          @lr-change=${this.stopOwnedEvent}
          @focus=${this.stopOwnedEvent}
          @blur=${this.stopOwnedEvent}
          @lr-invalid=${this.stopOwnedEvent}
          @lr-files=${this.onFiles}
        >
          <span slot="dropzone">${this.localize('evalDatasetImportLabel')}</span>
        </lr-file-input>
        <lr-export-button
          part="export"
          .formats=${this.exportFormats}
          ?disabled=${this.disabled}
          @lr-export-complete=${this.stopOwnedEvent}
          @lr-export-error=${this.stopOwnedEvent}
          @lr-show=${this.stopOwnedEvent}
          @lr-hide=${this.stopOwnedEvent}
          @lr-export-request=${this.onExportButtonExport}
          @lr-export=${this.stopOwnedEvent}
        ></lr-export-button>
      </div>
    `;
  }

  private renderSearch(): TemplateResult {
    const label = this.localize('evalDatasetSearchLabel');
    const relayFocus = (event: FocusEvent): void => {
      event.stopPropagation();
      relayNativeEvent(this, event);
    };
    const contain = (event: Event): void => event.stopPropagation();
    return html`
      <div part="search">
        <lr-input
          part="search-input"
          exportparts="input:search-input-field, clear-button:search-clear"
          type="search"
          clearable
          aria-label=${label}
          placeholder=${label}
          .value=${this.searchText}
          ?disabled=${this.disabled}
          autocomplete=${this.autocomplete || nothing}
          spellcheck=${String(this.spellcheck)}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.autoCorrect || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          @lr-input=${(event: Event) => {
            event.stopPropagation();
            if (!this.disabled) this.searchText = (event.currentTarget as LyraInput).value;
          }}
          @input=${contain}
          @change=${contain}
          @lr-change=${contain}
          @lr-clear=${contain}
          @click=${this.gateDisabledClear}
          @focus=${relayFocus}
          @blur=${relayFocus}
        ></lr-input>
      </div>
    `;
  }

  /** `disabled` can change in the same task as a click on the composed field's clear button, before
   *  the field itself re-renders disabled; the capture-phase gate keeps that click from clearing it. */
  private readonly gateDisabledClear = {
    handleEvent: (event: Event): void => {
      if (this.disabled) event.stopPropagation();
    },
    capture: true,
  };

  private facetMemo?: { tags: string[]; selected: ReadonlySet<string>; visible: string[] };
  private visibleTagFacets(tags: string[]): string[] {
    if (this.facetMemo?.tags === tags && this.facetMemo.selected === this.activeTags) return this.facetMemo.visible;
    const visible: string[] = [];
    // Active tags originate from this bounded facet list. Reserve them before admitting the
    // earliest unselected tags, so every active filter keeps its own deselection control.
    let unselectedBudget = MAX_TAG_FACETS - this.activeTags.size;
    for (const tag of tags) {
      if (this.activeTags.has(tag)) visible.push(tag);
      else if (unselectedBudget > 0) {
        visible.push(tag);
        unselectedBudget--;
      }
      if (visible.length === MAX_TAG_FACETS) break;
    }
    this.facetMemo = { tags, selected: this.activeTags, visible };
    return visible;
  }

  private tagTemplateMemo?: { inputs: unknown[]; template: TemplateResult };
  private renderTagFilter(tags: string[]): TemplateResult {
    const label = this.localize('evalDatasetTagFilterLabel');
    const omitted = this.sourceMode ? (this.sourceResult?.tags?.total ?? 0) - tags.length : tags.length - MAX_TAG_FACETS;
    const overflow = omitted > 0 ? this.localize('tagFacetLimit', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(omitted),
    }) : '';
    const inputs = [tags, this.activeTags, this.disabled, label, overflow, this.sourceFacetLabels];
    if (this.tagTemplateMemo && inputs.every((input, index) => input === this.tagTemplateMemo!.inputs[index])) return this.tagTemplateMemo.template;
    const template = html`
      <div part="tag-filter" role="group" aria-label=${label}>
        <lr-chip-group>
          ${(this.sourceMode ? tags : this.visibleTagFacets(tags)).map(
            (tag) => html`<lr-chip
              toggleable
              .value=${tag}
              .selected=${this.activeTags.has(tag)}
              .disabled=${this.disabled}
              @lr-chip-toggle-request=${(e: CustomEvent<ChipSelectDetail>) => this.onTagChipToggle(tag, e)}
              @lr-chip-select=${this.stopOwnedEvent}
              >${this.sourceMode ? this.sourceFacetLabels.get(tag) ?? tag : tag}</lr-chip
            >`,
          )}
        </lr-chip-group>
        ${overflow ? html`<p part="limit" role="note">${overflow}</p>` : nothing}
      </div>
    `;
    this.tagTemplateMemo = { inputs, template };
    return template;
  }

  override render(): TemplateResult {
    const label = this.label || this.localize('evalDatasetLabel');
    const tags = this.sourceMode ? this.sourceTags : this.allTags();
    const visible = this.sourceMode ? this.sourceRows : this.visibleExamples;
    const examples = this.sourceMode ? this.sourceRows : this.normalizedExamples;
    const truncation = this.sourceMode ? undefined : publicCollectionTruncation(this, 'examples');
    this.examplesTruncated = truncation !== undefined;
    const filtered = this.sourceMode ? !!this.searchText || this.activeTags.size > 0 : visible.length !== examples.length;
    const emptyText =
      examples.length === 0 && !filtered
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
          .strings=${this.strings}
          .paginationMode=${this.sourceMode ? 'server' : 'client'}
          .page=${this.sourceMode ? finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER) + 1 : 1}
          .totalItems=${this.sourceMode ? this.sourceTotal ?? 0 : -1}
          .unknownTotal=${this.sourceMode && this.sourceTotal === null}
          .hasNext=${!this.sourceMode || this.sourceTotal !== null}
          .loading=${this.sourceMode && this.sourcePages.state.pending}
          .error=${this.sourceMode && !!(this.sourceFailure || this.sourcePages.state.error)}
          .sortMode=${this.sourceMode ? 'server' : 'client'}
          .sortKey=${this.sourceMode ? this.sourceSortKey : null}
          .sortDir=${this.sourceMode ? this.sourceSortDir : 'asc'}
          .selectionMode=${this.disabled || this.sourceBlocked ? 'none' : 'single'}
          .columns=${this.buildColumns()}
          .rows=${visible}
          .pageSize=${this.sourceMode ? finiteInteger(this.sourcePageSize, 100, 1, 500) : MAX_RENDERED_EXAMPLES}
          .rowKey=${rowKey}
          .selectedRowKeys=${this.selectedKeys()}
          .emptyHeading=${emptyText}
          @input=${this.stopOwnedEvent}
          @change=${this.stopOwnedEvent}
          @lr-input=${this.stopOwnedEvent}
          @lr-change=${this.stopOwnedEvent}
          @focus=${this.stopOwnedEvent}
          @blur=${this.stopOwnedEvent}
          @lr-sort-request=${this.stopOwnedEvent}
          @lr-sort=${this.onSourceSort}
          @lr-retry-request=${this.onSourceRetry}
          @lr-priority-columns-visibility-change=${this.stopOwnedEvent}
          @lr-row-expand-toggle=${this.stopOwnedEvent}
          @lr-load-more=${this.stopOwnedEvent}
          @lr-selection-change=${this.stopOwnedEvent}
          @lr-filter-change=${this.stopOwnedEvent}
          @lr-page-change=${this.onSourcePage}
          @lr-cell-edit=${this.stopOwnedEvent}
          @lr-column-resize=${this.stopOwnedEvent}
          @lr-row-activate=${this.onGridRowActivate}
          @lr-row-click=${this.stopOwnedEvent}
        ></lr-table>
        ${truncation
          ? html`<p part="limit" role="note">${this.localize('evalDatasetLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(truncation.retained),
            })}</p>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-eval-dataset': LyraEvalDataset;
  }
}
