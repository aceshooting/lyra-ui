# Events and TypeScript

## Events

Lyra-specific events are `lr-`-prefixed `CustomEvent`s (`lr-change`, `lr-input`, `lr-select`, …),
dispatched through `LyraElement`'s `protected emit<T>(name, detail?, options?)`: **bubbling,
composed, and non-cancelable by default**, with the payload on `event.detail`. A component that
offers a genuine veto point opts into `{ cancelable: true }` and checks `defaultPrevented` before
acting (as `lr-export-request` on `<lr-export-button>` does) — that is called out per component.
Value-changing form controls expose native `input`/`change` plus typed `lr-input`/`lr-change`
with `{ value, ... }` details. Input reports live edits; change reports commits; a discrete
selection reports both. Programmatic writes and form reset/restore are silent. Composite forms
publish their complete value and contain child notifications. Native input is an `Event` or
`InputEvent`, preserving editing metadata when applicable; native change is an `Event`. Read
structured values from the prefixed events. Known-date retains its documented native-event detail
for compatibility, and documented primitive exceptions keep their own event contract.

Non-form widgets may publish only `lr-change`; do not assume every interactive component supports
native form events. Submit/reset buttons have no value-edit quartet. Focus/blur bridges use native
`FocusEvent`. Each component section documents its exact event details and phases.
`preventDefault()` on a non-cancelable event does nothing.

The veto rule applies to Lyra-only request actions. Shared overlay `show`, `hide`, `after-show` and
`after-hide` lifecycle events, and native or upstream-pinned events, retain their own contracts.
Table resize notifications are always non-cancelable. `lr-tour-end` is a permanent,
non-cancelable after-close notification carrying `{ reason }`; `lr-tour-request` is the veto point.
Neither notification has a deprecation notice while the contract survives.

Every one of those names is also typed — per component through its own event map, and globally
through `@aceshooting/lyra-ui/events` for listeners on an ancestor, `document` or `window`. See
"TypeScript" below.

For event-detail compatibility fields removed in the v23-to-v24 upgrade,
use step 7 of the [migration checklist](v23-to-v24-migration.md#migrate-a-project-in-reviewable-steps).
Those nested detail fields are separate from deprecated event names and are not automatic renames.

## TypeScript

- **Per-component event maps.** Every component with events exports a `Lyra<Name>EventMap` type, and
  `LyraElement<Events>` declares a typed `addEventListener` overload — so `event.detail` is inferred
  with no cast:
  ```ts
  import { LyraTable } from "@aceshooting/lyra-ui/components/data/table/table.class.js";
  const table = document.querySelector("lr-table") as LyraTable;
  table.addEventListener("lr-sort", (event) => event.detail.sortKey); // typed
  ```
- **`HTMLElementTagNameMap`** is augmented in the `.class.d.ts` files. `document.querySelector('lr-table')`
  is only typed as `LyraTable` when that class module is in the type graph — importing just the
  registration entry (`table.js`) also pulls it in, since the entry re-exports the class module.
- **Generics.** Row/item-carrying components are generic over their data type
  (`LyraTable<T>`, `LyraTableEventMap<T>`, …); annotate the element to keep `detail` payloads typed.
- **Setting object properties from templates** requires a property binding, never an attribute —
  see "Framework integration".
- **Framework template declarations are opt-in.** Import exactly the declaration entry your
  compiler uses once in its type graph:
  ```ts
  import type {} from "@aceshooting/lyra-ui/custom-elements-jsx"; // React 19 / JSX
  import type {} from "@aceshooting/lyra-ui/vue";
  import type {} from "@aceshooting/lyra-ui/svelte";
  ```
  All three are generated from the Custom Elements Manifest and type the documented properties,
  attribute aliases, events, element refs, and CSS custom properties. Their emitted JavaScript is
  empty: they are declaration merging, not runtime wrappers, and they do not register any tag.
- **Delegated, `document` and `window` listeners: `@aceshooting/lyra-ui/events`.** Component events
  bubble and are composed, so they reach ancestors, `document`, and `window` — but a listener
  attached _there_ has no element type to key off and would otherwise receive a bare `Event`. This
  subpath declares `LyraGlobalEventMap` (all generated Lyra event names) and mixes it into
  `GlobalEventHandlersEventMap`, which types `element`, `document` and `window`
  `addEventListener` calls alike:

  ```ts
  import "@aceshooting/lyra-ui/events";

  document.addEventListener("lr-sort", (event) => event.detail); // typed on document
  ```

  It is **opt-in**: the augmentation only applies once that import is somewhere in the project's
  type graph, so add it once (a root `main.ts`, or a `.d.ts` in the project's `include`). A direct
  element reference never needs it — `LyraElement` overrides `addEventListener`, so
  `table.addEventListener('lr-sort', …)` resolves through `LyraTableEventMap` first either way.
  `LyraGlobalEventMap` is exported as well, for writing your own typed helper over it.

- **The surface is per-event type aliases, not runtime event classes.** `LyraSortEvent` and its
  generated siblings are `type` aliases over component event-map entries. `LyraSortEvent` unions
  the `lr-sort` entries for document-library, eval-dataset and table. These aliases have no runtime
  constructor and cannot be used with `new` or `instanceof`. The module compiles to `export {};`:
  shipping runtime event subclasses to type a listener would cost every consumer runtime bytes for
  a compile-time concern, so it deliberately costs zero.
- **A shared event name narrows to the union of its dispatchers.** One name can come from several
  components with different details, such as `lr-select` and `lr-selection-change`, so
  its global entry is the _union_ of their entries, and `event.detail` there exposes only what all
  of them share. Index the owning component's own map when you need one component's exact detail:

  ```ts
  import type { LyraCommandPaletteEventMap } from "@aceshooting/lyra-ui/components/layout/command-palette/command-palette.class.js";

  type PaletteSelect = LyraCommandPaletteEventMap["lr-select"]; // the precise detail
  ```

  Native-named events some form controls re-emit (`blur`, `change`, `focus`, `input`) are
  deliberately **absent** from the global map — they already exist in the DOM's own event maps with
  their standard types, and redeclaring them globally would widen a built-in. Those stay typed
  through the component's own event map.

**Boolean attributes.** False-default `with-*` and `without-*` names describe feature options.
Native passthrough and observable state keep their own vocabulary: `spellcheck` follows browser
semantics; `follow` on activity-feed, agent-workspace, chat-viewport, terminal, thinking-panel and
transcript-feed is the current scroll-follow state; `map.legendOpen` is disclosure state;
`poll-status.active` is runtime activity; `callout.open` is its current visibility; and
`pagination.hasNext` and `table.hasNext` report availability when a server total is unknown.
`accordion-item.isTabbable` is a property-only internal state, with no public attribute.
`number-input.withoutSpinButtons` intentionally hides duplicate browser spin chrome beside the
component's own steppers; its presence-based `true` default accepts the literal HTML value
`"false"`. These true-default properties remain intentional and accept that literal value.

### Large collection sources

Use `@aceshooting/lyra-ui/data-sources.js` for the type-only collection protocols, and
`@aceshooting/lyra-ui/utilities/data-preparation.js` for staged numeric preparation. Import the
specific component's registration separately and check its documented source property before
binding a provider. A protocol declaration does not imply that every component accepts it.
Legacy arrays, rolling windows, file previews and display caps retain their documented limits;
a capped prefix does not provide access to a million-record source.

The host owns each source and its indexes, storage and query work. Keep its revision, counts,
records and returned projections immutable for a request snapshot. Revisions are nonempty strings
or finite numbers; counts, offsets and record orders are nonnegative safe integers. Nonempty keys
identify logical records, and `order` is canonical source order independent of query sorting.
A provider can generate or fetch a requested window without allocating an array for the entire collection.
Arbitrary work inside a host callback remains the host's responsibility.

For components that document these protocols, replace the source, reassign the same source, or
call keyless `requestUpdate()` to refresh. A changed revision becomes observable at that explicit
update; it is not polled. Source replacement, rebind, refresh, disconnect and document adoption
invalidate pending work and source-derived caches. Providers should settle promptly on
`context.signal` cancellation. Cancellation is advisory: a late reply must still belong to the
current source identity, revision and request before it can update the view. Page/query changes
invalidate their dependent work; unrelated presentation updates do not imply a full-source read.

Choose the access shape that matches the host's data:

- `LyraRangeSource<T>` reads exactly the requested in-bounds range. `LyraIndexedView<T>` also
  accepts the existing `LyraVirtualListIndexedSource<T>` for direct indexed access. Key lookup is
  optional for a generic range; `LyraHierarchyView<T>` requires direct key lookup so navigation
  does not scan the collection.
- `LyraPageSource<T, Q, Summary>` supplies globally queried pages, stable-key lookup and absolute
  query positions. `page` is zero-based; `locate` returns a zero-based index or `null`.
  `total` describes every query match, not loaded rows; group ranges describe the globally
  ordered query and facets describe the full source catalogue. A declared `Summary` is required
  in each result, while the default `undefined` summary can be omitted.
- `LyraTabularSource` has separate column metadata and zero-based body rows, using either
  `cellAt` or bounded rectangular `readCells`. `LyraWorkbookSource` names sheets separately.
  Search results use a bounded hit list, `total: null` when the global total is unknown, and
  `exhaustive: true` only when every matching hit is included. A header hit has `row: -1`.
- `LyraHierarchySource<T, Q, Summary>` returns an immutable visible-preorder projection with
  an opaque `state` token. `rows.count` is the visible logical count; `total` also includes
  collapsed nodes. Row `level`/`position` are one-based and `setSize` is the exact sibling
  count. Optional search and copy capabilities address the full requested source/scope, rather
  than only mounted rows.
- `LyraGraphSource<N, E>` separates full record paging from bounded scenes and optional overview
  bins. Global node/edge totals, scene coverage and displayed counts have distinct meanings;
  a neighborhood or aggregate scene is not a complete graph layout.

Numeric helpers inspect all source positions in bounded chunks. Preparation has total O(n)
source-read work per pass, plus reducer work, even though each chunk and the retained result are
bounded. The default `batchSize` is 2,048 and its maximum is 8,192; it must be a positive safe
integer, with larger safe integers clamped. Helpers yield between chunks and check aborts around
asynchronous work and before publication. Each read must return an actual array of exactly the
requested size. Sparse holes are invalid positions; explicit own `undefined` may be classified by
a generic category selector. Observed count/revision changes, malformed replies, callback errors
and finite-sum overflow reject preparation. Payload immutability and replayability remain host
obligations. Results and nested result containers are frozen; source storage is not copied
wholesale or frozen. Scratch storage is bounded by a chunk and the output budgets. Series handles
retain their readers for exact lookup; other helper results contain no reader handles. Output
budget options require positive safe integers (series points require at least four), with larger
safe integers clamped to their documented maxima.

`counts.sourceCount` always counts original positions, `validCount` accepted observations, and
`invalidCount` the remainder. Displayed samples, categories, bins, words and waveform buckets
are separate summary sizes. An empty/all-invalid numeric domain is `null`. Preparation limits
do not change a component's own accepted input budget; check the component's documented route
before passing a prepared result.

- `prepareLyraSeriesData` scans each series once. Finite x/y pairs contribute full domains and
  counts; null/nonfinite/missing coordinates are invalid and remain gaps. The overview retains
  first/last valid points and index-partition y extrema in source order, preserving original x
  and `sourceIndex`. `breakBefore` is true on the first sample and whenever invalid positions
  occur between retained samples, including omitted segments. This overview can omit valid
  segments and is not an exact reconstruction. `maxPointsPerSeries` defaults to 500, requires
  at least 4 and clamps to 1,000. Requested capacity across all series must fit 9,000 samples;
  excess series/capacity rejects. Inputs must share a revision and have unique IDs; the series
  list must be nonempty, although a reader may have zero positions. IDs are nonblank and at
  most 256 UTF-16 code units, labels at most 1,024, with 65,536 combined metadata units.
  The result intentionally retains readers and their backing storage: `getPoint` reads exactly
  one original position, returning a valid pair or `null`, and rejects unknown/out-of-range
  references. The helper does not implement optional `queryRange`; hosts may provide indexed
  refinement for `[startIndex, endIndex)` separately.
- `prepareLyraCategoryData` scans once into at most 1,000 declared unique categories and one
  result series, using the same ID/label/metadata limits as series preparation. `count` ignores
  `valueOf` entirely; `sum` and `mean` require an own synchronous numeric `valueOf` callback.
  Null/non-string/empty/over-256-unit category IDs and nonfinite amounts are invalid.
  Unknown remaining IDs map to `otherCategoryId` only when that ID names a declared category;
  otherwise they are invalid.
  Other is a real aggregate with its own `categoryCounts`, not a sampled remainder. Means divide
  each category's accepted sum by its accepted count; empty categories have value zero. Selectors
  return scalar values and their computation cost is host-owned. The helper does not build an
  unbounded category-frequency map or accept `host-defined` as a reducer option.
- `prepareLyraHistogram` uses one pass for explicit finite strictly increasing edges, or two
  replayable passes for automatic `binCount` edges. There are at most 1,000 bins. Bins are
  half-open except the inclusive final upper edge, and `sum(binCounts) + belowCount + aboveCount`
  equals `validCount`. Every finite observation contributes, including explicit-edge outliers;
  the observed `domain` includes those outliers. Constant data gets a finite nonzero display
  interval while its observed domain stays unchanged. Empty/all-invalid automatic results have
  no edges or bins; explicit edges remain with zero bin counts. Unrepresentable distinct edges
  reject.
- `prepareLyraWordCloud` selects exact global top-K from an already aggregated weighted catalog,
  with `maxWords` default/maximum 150. Ties favor earlier source positions. IDs must be globally
  unique by host contract; bounded duplicate detection covers only retained candidates. Blank
  or over-256-unit IDs/text and negative/nonfinite weights are invalid. `totalWeight` includes
  every valid observation; `retainedWeight` covers only selected words. Chosen text exceeding
  16,384 UTF-16 units rejects; lower `maxWords` to reduce the result. The bounded heap adds
  O(n log K) reducer work; this helper does not tokenize or compute arbitrary word frequencies.
- `prepareLyraWaveform` scans once into positional interval maxima, with `maxBuckets`
  default/maximum 65,536. Finite amplitudes clamp to [0, 1]; invalid positions keep their time
  slots and contribute no peak. Each `[startIndex, endIndex)` interval covers original positions.
  `sampleCount` equals `sourceCount`. `firstAmplitude`/`lastAmplitude` refer to original
  endpoints, with `null` for invalid/absent endpoints. `duration` must be finite, nonnegative
  and describe the summarized media interval.

For example, a replayable reader can generate a million logical values while allocating only
the requested chunk. The resulting histogram is a full-source distribution with 100 displayed
bins; it is not a million-element array.

```ts
import { prepareLyraHistogram } from '@aceshooting/lyra-ui/utilities/data-preparation.js';
import type { LyraIndexedInput } from '@aceshooting/lyra-ui/utilities/data-preparation.js';

const input: LyraIndexedInput<number> = {
  revision: 'measurements-1',
  count: 1_000_000,
  read(start, count, { signal }) {
    signal.throwIfAborted();
    return Array.from({ length: count }, (_, offset) => (start + offset) % 100);
  },
};
const abort = new AbortController();
const distribution = await prepareLyraHistogram(input, {
  binCount: 100,
  signal: abort.signal,
});
console.log(distribution.counts.sourceCount, distribution.binCounts.length);
```

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`data-sources-contracts`** — Public collection contracts from `data-sources.js`. These are type-only protocols; each component documents which source inputs it accepts. Inherited fields are repeated to show the complete effective request/row shape.

  `LyraSourceRevision = string | number`
  `LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
}`
  `LyraSourceRecord<T> {
  readonly key: string;
  readonly value: T;
  readonly order: number;
}`
  `LyraSourceSearchRequest extends LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
  readonly query: string;
  readonly limit: number;
}`
  `LyraSourceSearchResult<Hit> {
  readonly hits: readonly Hit[];
  readonly total: number | null;
  readonly exhaustive: boolean;
}`
  `LyraSourceRangeRequest extends LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
  readonly offset: number;
  readonly limit: number;
}`
  `LyraRangeSource<T> {
  readonly count: number;
  read(request: LyraSourceRangeRequest): Promise<readonly T[]>;
  indexOfKey?(key: string, context: LyraSourceContext): Promise<number | null>;
}`
  `LyraIndexedView<T> = LyraVirtualListIndexedSource<T> | LyraRangeSource<T>`
  `LyraHierarchyView<T> =
  | (LyraVirtualListIndexedSource<T> & {
      keyAt(index: number): string;
      indexOfKey(key: string | number): number;
    })
  | (LyraRangeSource<T> & {
      indexOfKey(key: string, context: LyraSourceContext): Promise<number | null>;
    })`
  `LyraSourceSummary<S> = [S] extends [undefined]
  ? { readonly summary?: undefined }
  : { readonly summary: S }`
  `LyraSourceCell = string | number | boolean | null | undefined`
  `LyraTabularColumn { readonly key: string; readonly label: string; }`
  `LyraTabularHit {
  readonly row: number;
  readonly column: number;
}`
  `LyraTabularReadRequest extends LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
  readonly row: number;
  readonly rowCount: number;
  readonly column: number;
  readonly columnCount: number;
}`
  `LyraTabularSourceBase {
  readonly revision: LyraSourceRevision;
  readonly rowCount: number;
  readonly columnCount: number;
  columnAt(index: number): LyraTabularColumn;
  rowKeyAt?(index: number): string;
  indexOfRowKey?(key: string): number;
  search?(request: LyraSourceSearchRequest): Promise<LyraSourceSearchResult<LyraTabularHit>>;
}`
  `LyraTabularSource = LyraTabularSourceBase & (
  | { cellAt(row: number, column: number): LyraSourceCell; readCells?: never }
  | { cellAt?: never; readCells(request: LyraTabularReadRequest): Promise<readonly (readonly LyraSourceCell[])[]> }
)`
  `LyraWorkbookHit extends LyraTabularHit {
  readonly row: number;
  readonly column: number;
  readonly sheetKey: string;
}`
  `LyraWorkbookSource {
  readonly revision: LyraSourceRevision;
  readonly sheets: readonly {
    readonly key: string;
    readonly name: string;
    readonly data: LyraTabularSource;
  }[];
  search?(request: LyraSourceSearchRequest): Promise<LyraSourceSearchResult<LyraWorkbookHit>>;
}`
  `LyraSourceFacet {
  readonly values: readonly { readonly key: string; readonly label: string; readonly count?: number }[];
  readonly total: number;
  readonly unavailableSelected: readonly string[];
}`
  `LyraSourceGroup {
  readonly key: string;
  readonly label: string;
  readonly startIndex: number;
  readonly itemCount: number;
}`
  `LyraPageRequest<Q> extends LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
  readonly page: number;
  readonly pageSize: number;
  readonly query: Q;
}`
  `LyraPageResult<T, Summary = undefined> = {
  readonly rows: readonly LyraSourceRecord<T>[];
  readonly total: number;
  readonly groups?: readonly LyraSourceGroup[];
  readonly tags?: LyraSourceFacet;
} & LyraSourceSummary<Summary>`
  `LyraPageSource<T, Q, Summary = undefined> {
  readonly revision: LyraSourceRevision;
  query(request: LyraPageRequest<Q>): Promise<LyraPageResult<T, Summary>>;
  lookup(keys: readonly string[], context: LyraSourceContext): Promise<readonly LyraSourceRecord<T>[]>;
  locate(key: string, query: Q, context: LyraSourceContext): Promise<number | null>;
}`
  `LyraHierarchyRow<T> {
  readonly key: string;
  readonly value: T;
  readonly parentKey: string | null;
  readonly level: number;
  readonly position: number;
  readonly setSize: number;
  readonly childCount: number;
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly selectionState?: 'none' | 'partial' | 'all';
}`
  `LyraHierarchyAction =
  | { readonly type: 'reset' }
  | { readonly type: 'toggle'; readonly key: string; readonly expanded: boolean }
  | { readonly type: 'reveal'; readonly key: string }
  | { readonly type: 'select'; readonly key: string; readonly selected: boolean; readonly scope: 'item' | 'subtree' }`
  `LyraHierarchyRequest<Q> extends LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
  readonly query: Q;
  readonly state: string | null;
  readonly action: LyraHierarchyAction;
}`
  `LyraHierarchyProjection<T, Summary = undefined> = {
  readonly state: string;
  readonly total: number;
  readonly rows: LyraHierarchyView<LyraHierarchyRow<T>>;
  readonly focusIndex?: number;
} & LyraSourceSummary<Summary>`
  `LyraHierarchySource<T, Q, Summary = undefined> {
  readonly revision: LyraSourceRevision;
  project(request: LyraHierarchyRequest<Q>): Promise<LyraHierarchyProjection<T, Summary>>;
  search?(request: LyraSourceSearchRequest): Promise<LyraSourceSearchResult<{ readonly key: string }>>;
  copy?(request: LyraSourceContext & {
    readonly key: string | null;
    readonly scope: 'node' | 'subtree' | 'document';
    readonly maxBytes: number;
  }): Promise<string>;
}`
  `LyraInspectionNode {
  readonly name: string;
  readonly kind: 'object' | 'array' | 'scalar' | 'element' | 'attribute' | 'text' | 'comment' | 'processing-instruction';
  readonly value?: string;
  readonly path: string;
}`
  `LyraHierarchyQuery {
  readonly search: string;
  readonly hiddenKinds: readonly string[];
}`
  `LyraTraceSourceSummary { readonly startMs: number; readonly endMs: number; }`
  `LyraTaskSourceSummary { readonly total: number; readonly completed: number; }`
  `LyraSourceBounds { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }`
  `LyraGraphSourceQuery {
  readonly kind: 'nodes' | 'edges';
  readonly search: string;
  readonly centerKey: string | null;
  readonly direction: 'in' | 'out' | 'both';
  readonly nodeTypes: readonly string[];
}`
  `LyraGraphRecord<N, E> =
  | { readonly kind: 'node'; readonly value: N }
  | { readonly kind: 'edge'; readonly value: E }`
  `LyraGraphSourceSummary { readonly nodes: number; readonly edges: number; }`
  `LyraGraphSceneRequest extends LyraSourceContext {
  readonly revision: LyraSourceRevision;
  readonly locale: string;
  readonly signal: AbortSignal;
  readonly mode: 'neighborhood' | 'viewport';
  readonly centerKey: string | null;
  readonly bounds: LyraSourceBounds | null;
  readonly nodeLimit: number;
  readonly edgeLimit: number;
  readonly includeKeys: readonly string[];
}`
  `LyraGraphScene<N, E> {
  readonly nodes: readonly { readonly key: string; readonly value: N; readonly position?: { readonly x: number; readonly y: number; readonly z?: number } }[];
  readonly edges: readonly { readonly key: string; readonly value: E; readonly source: string; readonly target: string }[];
  readonly total: LyraGraphSourceSummary;
  readonly coverage: 'complete' | 'neighborhood' | 'aggregate';
  readonly worldBounds: LyraSourceBounds | null;
}`
  `LyraGraphOverview {
  readonly bounds: LyraSourceBounds;
  readonly bins: readonly { readonly bounds: LyraSourceBounds; readonly count: number }[];
}`
  `LyraGraphSource<N, E> {
  readonly revision: LyraSourceRevision;
  readonly records: LyraPageSource<LyraGraphRecord<N, E>, LyraGraphSourceQuery, LyraGraphSourceSummary>;
  scene(request: LyraGraphSceneRequest): Promise<LyraGraphScene<N, E>>;
  overview?(request: LyraSourceContext & { readonly limit: number }): Promise<LyraGraphOverview>;
}`

- **`utilities-data-preparation-contracts`** — Public staged numeric helpers and result contracts from `utilities/data-preparation.js`. Preparation reads the full immutable source in bounded chunks; retained summaries are distinct from source counts. Inherited fields are repeated for reference. Defaulted options may be omitted.

  `LyraSourceValue<T> = T | PromiseLike<T>`
  `LyraSourceRequest { readonly signal: AbortSignal; }`
  `LyraIndexedInput<T> {
  readonly revision: LyraSourceRevision;
  readonly count: number;
  read(start: number, count: number, request: LyraSourceRequest): LyraSourceValue<readonly T[]>;
}`
  `LyraPreparationOptions {
  readonly signal?: AbortSignal;
  readonly batchSize?: number;
}`
  `LyraObservationCounts {
  readonly sourceCount: number;
  readonly validCount: number;
  readonly invalidCount: number;
}`
  `LyraNumericDomain { readonly min: number; readonly max: number; }`
  `LyraSeriesObservation { readonly x: number; readonly y: number | null; }`
  `LyraSeriesSample extends LyraSeriesObservation {
  readonly x: number;
  readonly y: number | null;
  readonly sourceIndex: number;
  readonly breakBefore: boolean;
}`
  `LyraPreparedSeries {
  readonly id: string;
  readonly label: string;
  readonly counts: LyraObservationCounts;
  readonly xDomain: LyraNumericDomain | null;
  readonly yDomain: LyraNumericDomain | null;
  readonly samples: readonly LyraSeriesSample[];
}`
  `LyraSeriesRangeRequest extends LyraSourceRequest {
  readonly signal: AbortSignal;
  readonly seriesId: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly maxPoints: number;
}`
  `LyraSeriesPointRef { readonly seriesId: string; readonly sourceIndex: number; }`
  `LyraPreparedSeriesData {
  readonly kind: 'series';
  readonly revision: LyraSourceRevision;
  readonly series: readonly LyraPreparedSeries[];
  getPoint(ref: LyraSeriesPointRef, request: LyraSourceRequest): LyraSourceValue<LyraSeriesObservation | null>;
  queryRange?(request: LyraSeriesRangeRequest): LyraSourceValue<readonly LyraSeriesSample[]>;
}`
  `LyraPreparedCategoryData {
  readonly kind: 'categories';
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly categories: readonly { readonly id: string; readonly label: string }[];
  readonly categoryCounts: readonly number[];
  readonly series: readonly { readonly id: string; readonly label: string; readonly values: readonly number[] }[];
  readonly aggregation: 'count' | 'sum' | 'mean' | 'host-defined';
}`
  `LyraHistogramDistribution {
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly domain: LyraNumericDomain | null;
  readonly edges: readonly number[];
  readonly binCounts: readonly number[];
  readonly belowCount: number;
  readonly aboveCount: number;
}`
  `LyraWeightedWord { readonly id: string; readonly text: string; readonly weight: number; }`
  `LyraPreparedWordCloud {
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly totalWeight: number;
  readonly retainedWeight: number;
  readonly words: readonly LyraWeightedWord[];
}`
  `LyraPreparedWaveform {
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly sampleCount: number;
  readonly duration: number;
  readonly buckets: readonly { readonly startIndex: number; readonly endIndex: number; readonly maxAmplitude: number }[];
  readonly firstAmplitude: number | null;
  readonly lastAmplitude: number | null;
}`
  `prepareLyraSeriesData(
  series: readonly { readonly id: string; readonly label: string; readonly input: LyraIndexedInput<LyraSeriesObservation> }[],
  options: LyraPreparationOptions & { readonly maxPointsPerSeries?: number } = {},
): Promise<LyraPreparedSeriesData>`
  `prepareLyraCategoryData<T>(
  input: LyraIndexedInput<T>,
  options: LyraPreparationOptions & {
    readonly categories: readonly { readonly id: string; readonly label: string }[];
    readonly seriesId: string;
    readonly seriesLabel: string;
    readonly categoryOf: (value: T, sourceIndex: number) => string | null;
    readonly otherCategoryId?: string;
  } & (
    | { readonly aggregation: 'count'; readonly valueOf?: (value: T, sourceIndex: number) => unknown }
    | { readonly aggregation: 'sum' | 'mean'; readonly valueOf: (value: T, sourceIndex: number) => number | null }
  ),
): Promise<LyraPreparedCategoryData>`
  `prepareLyraHistogram(
  input: LyraIndexedInput<number>,
  options: LyraPreparationOptions & ({ readonly edges: readonly number[] } | { readonly binCount: number }),
): Promise<LyraHistogramDistribution>`
  `prepareLyraWordCloud(
  input: LyraIndexedInput<LyraWeightedWord>,
  options: LyraPreparationOptions & { readonly maxWords?: number } = {},
): Promise<LyraPreparedWordCloud>`
  `prepareLyraWaveform(
  input: LyraIndexedInput<number>,
  options: LyraPreparationOptions & { readonly duration: number; readonly maxBuckets?: number },
): Promise<LyraPreparedWaveform>`

- **`ai-adapters-a2ui-contracts`** — AI adapter and runtime contracts.
  `A2UiAdapterLimits {
  maxComponents: number;
  maxDepth: number;
  maxOutputNodes: number;
  maxChildrenPerComponent: number;
  maxNodes: number;
  maxBytes: number;
  maxStringCharacters: number;
}`
  `A2UiLikeAction {
  id: string;
  payload?: unknown;
}`
  `A2UiLikeComponent {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  text?: string;
  children?: string[];
  action?: A2UiLikeAction;
}`
  `A2UiLikeSurface {
  surfaceId?: string;
  rootId: string;
  components: A2UiLikeComponent[];
  data?: unknown;
}`
  `adaptA2UiSurface(surface: unknown, typeMap: unknown, limits: Partial<A2UiAdapterLimits> = {}): LyraWidgetDocument | null`

- **`ai-adapters-ag-ui-contracts`** — AI adapter and runtime contracts.
  `AgUiAdapterLimits {
  maxBufferedTools: number;
  maxToolArgumentBytes: number;
  maxTextDeltaCharacters: number;
  maxDepth: number;
  maxNodes: number;
  maxBytes: number;
  maxStringCharacters: number;
}`
  `AgUiLikeEvent {
  type: string;
  eventId?: string;
  runId?: string;
  messageId?: string;
  role?: string;
  delta?: unknown;
  toolCallId?: string;
  toolCallName?: string;
  result?: unknown;
  message?: string;
  code?: string;
  snapshot?: unknown;
  messages?: unknown[];
}`

- **`ai-adapters-ai-sdk-contracts`** — AI adapter and runtime contracts.
  `adaptAiSdkMessage(message: unknown, limits?: Partial<AiSdkAdapterLimits>): ChatMessage | null`
  `AiSdkAdapterLimits {
  maxParts: number;
  maxDepth: number;
  maxNodes: number;
  maxBytes: number;
  maxStringCharacters: number;
}`
  `AiSdkLikeMessage {
  id: string;
  role: string;
  parts?: unknown[];
  metadata?: Record<string, unknown>;
}`

- **`ai-runtime-contracts`** — AI adapter and runtime contracts.
  `AgentStreamLimits {
  maxMessages: number;
  maxPartsPerMessage: number;
  maxTools: number;
  maxDeltaCharacters: number;
  maxTextCharactersPerPart: number;
  maxIdentifierCharacters: number;
  maxStatusMessageCharacters: number;
  maxPatchOperations: number;
  maxSnapshotDepth: number;
  maxSnapshotNodes: number;
  maxSnapshotBytes: number;
  maxRetainedBytes: number;
}`
  `AgentStreamState {
  generation: number;
  cursor: number;
  limits: Readonly<AgentStreamLimits>;
  runId?: string;
  interruption?: MessagePartInterruption;
  status: AgentStatus;
  messages: ChatMessage[];
  tools: ToolInvocation[];
  sharedState: unknown;
  error?: { message: string; code?: string };
}`
  `applySharedStatePatch(value: unknown, patch: readonly JsonPatchOperation[]): unknown`
  `createAgentStreamState(limits?: Partial<AgentStreamLimits>): AgentStreamState`
  `parseJsonPatch(value: unknown, limits: Partial<AgentStreamLimits> = {}): JsonPatchOperation[] | null`
  `reduceAgentStreamEvents(state: AgentStreamState, events: readonly AgentStreamEvent[]): AgentStreamState`
  `reduceAgentStream(state: AgentStreamState, event: AgentStreamEvent): AgentStreamState`

- **`ai-snapshot-contracts`** — AI adapter and runtime contracts.
  `createProviderSnapshotBudget(limits: Partial<ProviderSnapshotLimits> | Readonly<ProviderSnapshotLimits> = {}): ProviderSnapshotBudget`
  `ProviderSnapshotBudget {
  readonly limits: Readonly<ProviderSnapshotLimits>;
  bytes: number;
  nodes: number;
}`
  `ProviderSnapshotLimits {
  maxDepth: number;
  maxNodes: number;
  maxBytes: number;
  maxStringCharacters: number;
}`
  `resolveProviderSnapshotLimits(limits: Partial<ProviderSnapshotLimits> = {}): Readonly<ProviderSnapshotLimits>`
  `snapshotProviderValue<T = unknown>(value: unknown, budget: ProviderSnapshotBudget = createProviderSnapshotBudget()): ProviderSnapshotResult<T>`

- **`ai-types-contracts`** — AI adapter and runtime contracts.
  `AgentRun {
  id: string;
  status: AgentStatus;
  startedAt?: number;
  endedAt?: number;
  model?: string;
  costEstimate?: number;
  steps: readonly AgentStep[];
}`
  `AgentStatus {
  kind: AgentStatusKind;
  message?: string;
}`
  `AgentStep {
  id: string;
  kind: string;
  label: string;
  status: AgentStatus;
  startedAt?: number;
  endedAt?: number;
}`
  `AttachmentMessagePart {
  type: 'attachment';
  document: DocumentRef;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `AudioMessagePart {
  type: 'audio';
  src?: string;
  transcript?: string;
  mimeType?: string;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `CancelEventDetail {
  reason?: string;
}`
  `ChatMessage {
  id: string;
  role: ChatMessageRole;
  status?: ChatMessageStatus;
  timestamp?: Date | string;
  text?: string;
  attachments?: readonly DocumentRef[];
  parts?: readonly MessagePart[];
  metadata?: Record<string, unknown>;
}`
  `Citation {
  id: string;
  chunkId?: string;
  sourceId?: string;
  span?: { start: number; end: number };
  label?: string;
  locator?: DocumentLocator;
  answerRange?: { start: number; end: number };
  quote?: string;
  metadata?: Record<string, unknown>;
}`
  `CitationMessagePart {
  type: 'citation';
  citation: Citation;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `CitationSelectEventDetail {
  citation: Citation;
}`
  `DataMessagePart {
  type: 'data';
  name?: string;
  data: unknown;
  widget?: never;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `DocumentRef {
  id: string;
  name: string;
  mimeType?: string;
  uri?: string;
  version?: string;
}`
  `ErrorMessagePart {
  type: 'error';
  message: string;
  code?: string;
  retryable?: boolean;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `ExportEventDetail {
  format: string;
}`
  `GroundedClaim {
  id: string;
  text: string;
  status: GroundedClaimStatus;
  citationIds: readonly string[];
  answerRange?: { start: number; end: number };
  confidence?: number;
  explanation?: string;
}`
  `GroundingAssessment {
  supportedClaims: number;
  unsupportedClaims: number;
  coverage: number;
  confidence?: number;
  warnings?: readonly string[];
  claims?: readonly GroundedClaim[];
}`
  `MessagePartBase {
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `ReasoningMessagePart {
  type: 'reasoning';
  text: string;
  collapsed?: boolean;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `RetrievalChunk {
  id: string;
  text: string;
  score: number;
  source: DocumentRef;
  metadata?: Record<string, unknown>;
  rank?: number;
  locator?: DocumentLocator;
  queryId?: string;
  stage?: string;
  traceId?: string;
  scores?: RetrievalScoreBreakdown;
}`
  `RetrievalProgressEventDetail {
  queryId: string;
  stage: string;
  progress?: number;
}`
  `RetrievalQuery {
  text: string;
  filters?: Record<string, unknown>;
  mode: 'vector' | 'keyword' | 'hybrid';
  scope?: string[];
}`
  `RetrievalScoreBreakdown {
  dense?: number;
  sparse?: number;
  rerank?: number;
  final: number;
}`
  `RetryEventDetail {
  attempt: number;
  messageId?: string;
}`
  `RunLifecycleEventDetail {
  runId: string;
  status: AgentStatus;
}`
  `TextMessagePart {
  type: 'text';
  text: string;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `ToolApprovalEventDetail {
  invocationId: string;
  approved: boolean;
}`
  `ToolCallMessagePart {
  type: 'tool-call';
  invocation: ToolInvocation;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `ToolInvocation {
  id: string;
  name: string;
  displayName?: string;
  args: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  error?: string;
  startedAt?: number;
  endedAt?: number;
  redactedFields?: readonly string[];
}`
  `ToolResultErrorMessagePart {
  error: string;
  result?: unknown;
  type: 'tool-result';
  invocationId: string;
  name?: string;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `ToolResultSuccessMessagePart {
  result: unknown;
  error?: never;
  type: 'tool-result';
  invocationId: string;
  name?: string;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `WidgetMessagePart {
  type: 'data';
  name?: string;
  data?: never;
  widget: unknown;
  id: string;
  state?: MessagePartState;
  interruption?: MessagePartInterruption;
  metadata?: Record<string, unknown>;
}`
  `MessagePartInterruption {
  resumable: boolean;
  reason?: string;
}`

- **`autoloader-contracts`** — Shared utility contracts.
  `AutoloaderErrorEventDetail {
  readonly error: unknown;
  readonly tag: AutoloadableTagName;
  readonly optionalPeers: readonly string[];
}`
  `AutoloaderEventDetail {
  readonly tag: AutoloadableTagName;
  readonly optionalPeers: readonly string[];
}`
  `AutoloaderOptions {
  readonly optionalPeers?: AutoloaderOptionalPeers;
  readonly events?: boolean;
  readonly maxConcurrency?: number;
  readonly maxElements?: number;
  readonly maxRoots?: number;
  readonly maxDepth?: number;
  readonly maxWork?: number;
}`
  `AutoloaderTraversalErrorEventDetail {
  readonly limit: RenderedTreeTraversalLimit;
  readonly maximum: number;
  readonly error: Error;
}`
  `discover(root?: LyraDefinitionRoot | undefined, options?: AutoloaderOptions): Promise<readonly AutoloadableTagName[]>`
  `start(root?: LyraDefinitionRoot | undefined, options?: AutoloaderOptions): Promise<readonly AutoloadableTagName[]>`
  `stop(): void`

- **`custom-elements-jsx-contracts`** — Framework integration type contracts, including the multi-split
  `for` launcher id and `trigger` element reference.
  `LyraReactIntrinsicElements {
  'lr-accordion': LyraAccordionReactProps;
  'lr-accordion-item': LyraAccordionItemReactProps;
  'lr-activity-feed': LyraActivityFeedReactProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardReactProps;
  'lr-agent-question': LyraAgentQuestionReactProps;
  'lr-agent-run': LyraAgentRunReactProps;
  'lr-agent-trace': LyraAgentTraceReactProps;
  'lr-agent-workspace': LyraAgentWorkspaceReactProps;
  'lr-alert': LyraAlertReactProps;
  'lr-animated-image': LyraAnimatedImageReactProps;
  'lr-animation': LyraAnimationReactProps;
  'lr-app-rail': LyraAppRailReactProps;
  'lr-app-rail-group': LyraAppRailGroupReactProps;
  'lr-app-rail-item': LyraAppRailItemReactProps;
  'lr-approval-queue': LyraApprovalQueueReactProps;
  'lr-archive-viewer': LyraArchiveViewerReactProps;
  'lr-artifact-panel': LyraArtifactPanelReactProps;
  'lr-attachment-chip': LyraAttachmentChipReactProps;
  'lr-attachment-trigger': LyraAttachmentTriggerReactProps;
  'lr-audio-visualizer': LyraAudioVisualizerReactProps;
  'lr-av-player': LyraAvPlayerReactProps;
  'lr-avatar': LyraAvatarReactProps;
  'lr-avatar-group': LyraAvatarGroupReactProps;
  'lr-background-runs': LyraBackgroundRunsReactProps;
  'lr-badge': LyraBadgeReactProps;
  'lr-bar-chart': LyraBarChartReactProps;
  'lr-box-plot': LyraBoxPlotReactProps;
  'lr-branch-picker': LyraBranchPickerReactProps;
  'lr-breadcrumb': LyraBreadcrumbReactProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemReactProps;
  'lr-browser-frame': LyraBrowserFrameReactProps;
  'lr-bubble-chart': LyraBubbleChartReactProps;
  'lr-budget-meter': LyraBudgetMeterReactProps;
  'lr-button': LyraButtonReactProps;
  'lr-button-group': LyraButtonGroupReactProps;
  'lr-calendar': LyraCalendarReactProps;
  'lr-calendar-viewer': LyraCalendarViewerReactProps;
  'lr-callout': LyraCalloutReactProps;
  'lr-card': LyraCardReactProps;
  'lr-carousel': LyraCarouselReactProps;
  'lr-carousel-item': LyraCarouselItemReactProps;
  'lr-change-review': LyraChangeReviewReactProps;
  'lr-chart': LyraChartReactProps;
  'lr-chart-3d': LyraChart3dReactProps;
  'lr-chat-composer': LyraChatComposerReactProps;
  'lr-chat-message': LyraChatMessageReactProps;
  'lr-chat-viewport': LyraChatViewportReactProps;
  'lr-checkbox': LyraCheckboxReactProps;
  'lr-checkbox-group': LyraCheckboxGroupReactProps;
  'lr-checkpoint': LyraCheckpointReactProps;
  'lr-chip': LyraChipReactProps;
  'lr-chip-group': LyraChipGroupReactProps;
  'lr-chunk-inspector': LyraChunkInspectorReactProps;
  'lr-citation-badge': LyraCitationBadgeReactProps;
  'lr-claim-evidence': LyraClaimEvidenceReactProps;
  'lr-code-block': LyraCodeBlockReactProps;
  'lr-code-block-core': LyraCodeBlockCoreReactProps;
  'lr-code-editor': LyraCodeEditorReactProps;
  'lr-color-picker': LyraColorPickerReactProps;
  'lr-combobox': LyraComboboxReactProps;
  'lr-command-palette': LyraCommandPaletteReactProps;
  'lr-commit-card': LyraCommitCardReactProps;
  'lr-community-card': LyraCommunityCardReactProps;
  'lr-compare-panel': LyraComparePanelReactProps;
  'lr-condition-builder': LyraConditionBuilderReactProps;
  'lr-confirm-bar': LyraConfirmBarReactProps;
  'lr-connector-manager': LyraConnectorManagerReactProps;
  'lr-contact-viewer': LyraContactViewerReactProps;
  'lr-context-inspector': LyraContextInspectorReactProps;
  'lr-context-menu': LyraContextMenuReactProps;
  'lr-context-meter': LyraContextMeterReactProps;
  'lr-control-group': LyraControlGroupReactProps;
  'lr-conversation-item': LyraConversationItemReactProps;
  'lr-copy-button': LyraCopyButtonReactProps;
  'lr-country-picker': LyraCountryPickerReactProps;
  'lr-csv-viewer': LyraCsvViewerReactProps;
  'lr-currency-picker': LyraCurrencyPickerReactProps;
  'lr-dashboard-grid': LyraDashboardGridReactProps;
  'lr-data-grid': LyraDataGridReactProps;
  'lr-dataset-viewer': LyraDatasetViewerReactProps;
  'lr-date-input': LyraDateInputReactProps;
  'lr-date-picker': LyraDatePickerReactProps;
  'lr-details': LyraDetailsReactProps;
  'lr-dialog': LyraDialogReactProps;
  'lr-diff-view': LyraDiffViewReactProps;
  'lr-divider': LyraDividerReactProps;
  'lr-dock-panel': LyraDockPanelReactProps;
  'lr-document-compare': LyraDocumentCompareReactProps;
  'lr-document-library': LyraDocumentLibraryReactProps;
  'lr-document-preview': LyraDocumentPreviewReactProps;
  'lr-document-viewer': LyraDocumentViewerReactProps;
  'lr-docx-viewer': LyraDocxViewerReactProps;
  'lr-doughnut-chart': LyraDoughnutChartReactProps;
  'lr-drawer': LyraDrawerReactProps;
  'lr-drilldown-panel': LyraDrilldownPanelReactProps;
  'lr-drop-zone': LyraDropZoneReactProps;
  'lr-dropdown': LyraDropdownReactProps;
  'lr-dropdown-item': LyraDropdownItemReactProps;
  'lr-ebook-viewer': LyraEbookViewerReactProps;
  'lr-email-viewer': LyraEmailViewerReactProps;
  'lr-embedding-explorer': LyraEmbeddingExplorerReactProps;
  'lr-emoji-picker': LyraEmojiPickerReactProps;
  'lr-empty': LyraEmptyReactProps;
  'lr-entity-card': LyraEntityCardReactProps;
  'lr-entity-chip': LyraEntityChipReactProps;
  'lr-entity-dossier': LyraEntityDossierReactProps;
  'lr-env-list': LyraEnvListReactProps;
  'lr-eval-dataset': LyraEvalDatasetReactProps;
  'lr-eval-result': LyraEvalResultReactProps;
  'lr-eval-run': LyraEvalRunReactProps;
  'lr-export-button': LyraExportButtonReactProps;
  'lr-file-icon': LyraFileIconReactProps;
  'lr-file-input': LyraFileInputReactProps;
  'lr-file-tree': LyraFileTreeReactProps;
  'lr-filter-bar': LyraFilterBarReactProps;
  'lr-flag': LyraFlagReactProps;
  'lr-flow-canvas': LyraFlowCanvasReactProps;
  'lr-flow-controls': LyraFlowControlsReactProps;
  'lr-flow-minimap': LyraFlowMinimapReactProps;
  'lr-flow-node': LyraFlowNodeReactProps;
  'lr-flow-run-status': LyraFlowRunStatusReactProps;
  'lr-format-bytes': LyraFormatBytesReactProps;
  'lr-format-date': LyraFormatDateReactProps;
  'lr-format-number': LyraFormatNumberReactProps;
  'lr-funnel': LyraFunnelReactProps;
  'lr-gauge': LyraGaugeReactProps;
  'lr-generation-metrics': LyraGenerationMetricsReactProps;
  'lr-geojson-viewer': LyraGeoJsonViewerReactProps;
  'lr-graph': LyraGraphReactProps;
  'lr-graph-legend': LyraGraphLegendReactProps;
  'lr-graph-query-builder': LyraGraphQueryBuilderReactProps;
  'lr-grounding-summary': LyraGroundingSummaryReactProps;
  'lr-handoff-divider': LyraHandoffDividerReactProps;
  'lr-heatmap': LyraHeatmapReactProps;
  'lr-highlight-layer': LyraHighlightLayerReactProps;
  'lr-histogram': LyraHistogramReactProps;
  'lr-html-viewer': LyraHtmlViewerReactProps;
  'lr-icon': LyraIconReactProps;
  'lr-icon-button': LyraIconButtonReactProps;
  'lr-image-comparer': LyraImageComparerReactProps;
  'lr-image-viewer': LyraImageViewerReactProps;
  'lr-include': LyraIncludeReactProps;
  'lr-ingestion-queue': LyraIngestionQueueReactProps;
  'lr-input': LyraInputReactProps;
  'lr-intersection-observer': LyraIntersectionObserverReactProps;
  'lr-json-schema-viewer': LyraJsonSchemaViewerReactProps;
  'lr-json-viewer': LyraJsonViewerReactProps;
  'lr-kbd': LyraKbdReactProps;
  'lr-knowledge-base': LyraKnowledgeBaseReactProps;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdminReactProps;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorerReactProps;
  'lr-known-date': LyraKnownDateReactProps;
  'lr-lightbox': LyraLightboxReactProps;
  'lr-line-chart': LyraLineChartReactProps;
  'lr-lite-chart': LyraLiteChartReactProps;
  'lr-live-region': LyraLiveRegionReactProps;
  'lr-locale-picker': LyraLocalePickerReactProps;
  'lr-map': LyraMapReactProps;
  'lr-markdown': LyraMarkdownReactProps;
  'lr-markdown-core': LyraMarkdownCoreReactProps;
  'lr-mcp-app': LyraMcpAppReactProps;
  'lr-media-card': LyraMediaCardReactProps;
  'lr-memory-panel': LyraMemoryPanelReactProps;
  'lr-mention-popover': LyraMentionPopoverReactProps;
  'lr-menu': LyraMenuReactProps;
  'lr-menu-item': LyraMenuItemReactProps;
  'lr-menu-label': LyraMenuLabelReactProps;
  'lr-menubar': LyraMenubarReactProps;
  'lr-menubar-item': LyraMenubarItemReactProps;
  'lr-message-actions': LyraMessageActionsReactProps;
  'lr-message-feedback': LyraMessageFeedbackReactProps;
  'lr-message-parts': LyraMessagePartsReactProps;
  'lr-mind-map': LyraMindMapReactProps;
  'lr-model-select': LyraModelSelectReactProps;
  'lr-model-settings-panel': LyraModelSettingsPanelReactProps;
  'lr-model-viewer': LyraModelViewerReactProps;
  'lr-multi-split': LyraMultiSplitReactProps;
  'lr-mutation-observer': LyraMutationObserverReactProps;
  'lr-native-time-input': LyraNativeTimeInputReactProps;
  'lr-navigation-menu': LyraNavigationMenuReactProps;
  'lr-navigation-menu-item': LyraNavigationMenuItemReactProps;
  'lr-neighbor-list': LyraNeighborListReactProps;
  'lr-node-palette': LyraNodePaletteReactProps;
  'lr-notebook-viewer': LyraNotebookViewerReactProps;
  'lr-number-input': LyraNumberInputReactProps;
  'lr-option': LyraOptionReactProps;
  'lr-otp-input': LyraOtpInputReactProps;
  'lr-page': LyraPageReactProps;
  'lr-page-rail': LyraPageRailReactProps;
  'lr-pagination': LyraPaginationReactProps;
  'lr-pan-zoom': LyraPanZoomReactProps;
  'lr-path-strip': LyraPathStripReactProps;
  'lr-pdf-viewer': LyraPdfViewerReactProps;
  'lr-permission-grant': LyraPermissionGrantReactProps;
  'lr-permission-rules': LyraPermissionRulesReactProps;
  'lr-phone-input': LyraPhoneInputReactProps;
  'lr-pie-chart': LyraPieChartReactProps;
  'lr-polar-area-chart': LyraPolarAreaChartReactProps;
  'lr-policy-summary': LyraPolicySummaryReactProps;
  'lr-poll-status': LyraPollStatusReactProps;
  'lr-popover': LyraPopoverReactProps;
  'lr-popup': LyraPopupReactProps;
  'lr-pptx-viewer': LyraPptxViewerReactProps;
  'lr-progress-bar': LyraProgressBarReactProps;
  'lr-progress-ring': LyraProgressRingReactProps;
  'lr-prompt-input': LyraPromptInputReactProps;
  'lr-prompt-queue': LyraPromptQueueReactProps;
  'lr-prompt-studio': LyraPromptStudioReactProps;
  'lr-provenance-panel': LyraProvenancePanelReactProps;
  'lr-push-to-talk': LyraPushToTalkReactProps;
  'lr-qr-code': LyraQrCodeReactProps;
  'lr-radar-chart': LyraRadarChartReactProps;
  'lr-radio': LyraRadioReactProps;
  'lr-radio-button': LyraRadioButtonReactProps;
  'lr-radio-group': LyraRadioGroupReactProps;
  'lr-rag-answer': LyraRagAnswerReactProps;
  'lr-rag-eval-dashboard': LyraRagEvalDashboardReactProps;
  'lr-random-content': LyraRandomContentReactProps;
  'lr-rating': LyraRatingReactProps;
  'lr-realtime-session': LyraRealtimeSessionReactProps;
  'lr-relative-time': LyraRelativeTimeReactProps;
  'lr-reorder-item': LyraReorderItemReactProps;
  'lr-reorder-list': LyraReorderListReactProps;
  'lr-research-progress': LyraResearchProgressReactProps;
  'lr-resize-observer': LyraResizeObserverReactProps;
  'lr-responsive-panel': LyraResponsivePanelReactProps;
  'lr-result-card': LyraResultCardReactProps;
  'lr-result-field': LyraResultFieldReactProps;
  'lr-retrieval-compare': LyraRetrievalCompareReactProps;
  'lr-retrieval-results': LyraRetrievalResultsReactProps;
  'lr-retrieval-search': LyraRetrievalSearchReactProps;
  'lr-retrieval-trace': LyraRetrievalTraceReactProps;
  'lr-rubric-form': LyraRubricFormReactProps;
  'lr-scatter-chart': LyraScatterChartReactProps;
  'lr-scroller': LyraScrollerReactProps;
  'lr-segmented': LyraSegmentedReactProps;
  'lr-select': LyraSelectReactProps;
  'lr-selection-toolbar': LyraSelectionToolbarReactProps;
  'lr-sequence-playback': LyraSequencePlaybackReactProps;
  'lr-sequence-strip': LyraSequenceStripReactProps;
  'lr-signature-pad': LyraSignaturePadReactProps;
  'lr-skeleton': LyraSkeletonReactProps;
  'lr-slider': LyraSliderReactProps;
  'lr-source-card': LyraSourceCardReactProps;
  'lr-source-list': LyraSourceListReactProps;
  'lr-source-picker': LyraSourcePickerReactProps;
  'lr-span-waterfall': LyraSpanWaterfallReactProps;
  'lr-sparkline': LyraSparklineReactProps;
  'lr-spinner': LyraSpinnerReactProps;
  'lr-split-panel': LyraSplitPanelReactProps;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerReactProps;
  'lr-stack-trace': LyraStackTraceReactProps;
  'lr-stat': LyraStatReactProps;
  'lr-stepper': LyraStepperReactProps;
  'lr-stream-status': LyraStreamStatusReactProps;
  'lr-streaming-text': LyraStreamingTextReactProps;
  'lr-streaming-text-core': LyraStreamingTextCoreReactProps;
  'lr-subagent-panel': LyraSubagentPanelReactProps;
  'lr-suggestion-chips': LyraSuggestionChipsReactProps;
  'lr-svg-viewer': LyraSvgViewerReactProps;
  'lr-swatch-picker': LyraSwatchPickerReactProps;
  'lr-switch': LyraSwitchReactProps;
  'lr-tab': LyraTabReactProps;
  'lr-tab-group': LyraTabGroupReactProps;
  'lr-tab-panel': LyraTabPanelReactProps;
  'lr-table': LyraTableReactProps;
  'lr-tag': LyraTagReactProps;
  'lr-task-list': LyraTaskListReactProps;
  'lr-terminal': LyraTerminalReactProps;
  'lr-test-results': LyraTestResultsReactProps;
  'lr-textarea': LyraTextareaReactProps;
  'lr-thinking-panel': LyraThinkingPanelReactProps;
  'lr-thread-list': LyraThreadListReactProps;
  'lr-time-input': LyraTimeInputReactProps;
  'lr-time-range': LyraTimeRangeReactProps;
  'lr-time-zone-picker': LyraTimeZonePickerReactProps;
  'lr-timeline': LyraTimelineReactProps;
  'lr-timeline-item': LyraTimelineItemReactProps;
  'lr-toast': LyraToastReactProps;
  'lr-toast-item': LyraToastItemReactProps;
  'lr-toggle': LyraToggleReactProps;
  'lr-toggle-group': LyraToggleGroupReactProps;
  'lr-token-input': LyraTokenInputReactProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogReactProps;
  'lr-tool-call-block': LyraToolCallBlockReactProps;
  'lr-tool-call-chip': LyraToolCallChipReactProps;
  'lr-tool-param-form': LyraToolParamFormReactProps;
  'lr-tool-result-dialog': LyraToolResultDialogReactProps;
  'lr-tool-result-view': LyraToolResultViewReactProps;
  'lr-tool-select-dialog': LyraToolSelectDialogReactProps;
  'lr-tool-timeline': LyraToolTimelineReactProps;
  'lr-tooltip': LyraTooltipReactProps;
  'lr-tour': LyraTourReactProps;
  'lr-trace-tree': LyraTraceTreeReactProps;
  'lr-transcript-feed': LyraTranscriptFeedReactProps;
  'lr-tree': LyraTreeReactProps;
  'lr-tree-item': LyraTreeItemReactProps;
  'lr-typing-indicator': LyraTypingIndicatorReactProps;
  'lr-unit-picker': LyraUnitPickerReactProps;
  'lr-usage-badge': LyraUsageBadgeReactProps;
  'lr-video': LyraVideoReactProps;
  'lr-video-playlist': LyraVideoPlaylistReactProps;
  'lr-virtual-list': LyraVirtualListReactProps;
  'lr-visually-hidden': LyraVisuallyHiddenReactProps;
  'lr-voice-picker': LyraVoicePickerReactProps;
  'lr-widget': LyraWidgetReactProps;
  'lr-widget-renderer': LyraWidgetRendererReactProps;
  'lr-word-cloud': LyraWordCloudReactProps;
  'lr-xml-viewer': LyraXmlViewerReactProps;
  'lr-zoomable-frame': LyraZoomableFrameReactProps;
}`

- **`internal-ansi-contracts`** — Shared utility contracts.
  `AnsiStyles {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  fg?: string;
  bg?: string;
}`

- **`internal-canvas-color-contracts`** — Shared utility contracts.
  `resolveCanvasColor(scope: Element, color: string, fallback: string): string`
  `resolveCanvasColors(scope: Element, colors: Iterable<string>, fallback: string): string[]`

- **`internal-document-tokens-contracts`** — Shared utility contracts.
  `adoptLyraTokens(root: Document | ShadowRoot): void`
  Adopts the document token layer into a document or shadow root. Idempotent; see "Application
  shadow roots" in the styles and tokens guide for when a root needs it.

- **`internal-theme-scopes-contracts`** — Shared utility contracts.
  `findUnscopedThemeInputs(root?: Document | DocumentFragment | Element): Element[]`
  Lists elements that set an inline `--lr-theme-*` input the layer consumes without being a theme
  scope. Reads inline styles only and logs nothing.

- **`internal-localization-runtime-contracts`** — Shared utility contracts.
  `getLyraLocaleDirection(locale: string): LyraLocaleDirection`
  `getLyraLocale(): string`
  `getRegisteredLyraLocaleKeys(locale: string): readonly string[]`
  `getRegisteredLyraLocales(): readonly string[]`
  `registerLyraLocale(locale: string, strings: LyraLocaleStrings, meta?: LyraLocaleMeta): void`
  `resolveLyraDirection(host: Element): 'ltr' | 'rtl'`
  `resolveLyraLocale(host: Element): string`
  `setLyraLocale(locale: string): void`
  `subscribeLyraLocaleRegistry(listener: () => void): () => void`
  `registerLyraLocaleDelta(locale: string, parent: string, strings: LyraLocaleStrings, meta?: LyraLocaleMeta): void`

- **`internal-localization-types-contracts`** — Shared utility contracts.
  `LyraLocaleMeta {
  dir?: LyraLocaleDirection;
  name?: string;
}`

- **`internal-localization-contracts`** — Shared utility contracts.
  `resolveLyraString(host: Element, key: string, overrides?: LyraLocaleStrings, fallback?: string, values?: Record<string, string | number>): string`

- **`internal-node-type-style-contracts`** — Shared utility contracts.
  `LyraNodeTypeStyle {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
  readonly shape?: 'circle' | 'square' | 'diamond';
}`

- **`internal-registered-animation-contracts`** — Shared utility contracts.
  `RegisteredAnimationSpec {
  keyframes: Keyframe[];
  rtlKeyframes?: Keyframe[];
  durationProperties: readonly string[];
  easingProperties?: readonly string[];
  fallbackDuration?: number;
  fallbackEasing?: string;
  options?: KeyframeAnimationOptions;
}`

- **`internal-text-viewer-target-contracts`** — Shared utility contracts.
  `LyraSearchChangeDetail {
  query: string;
  matchCount: number;
  matchCountExact: boolean;
  activeIndex: number;
}`
  `LyraTextViewerTarget {
  search(query: string): Promise<number>;
  searchNext(): Promise<boolean>;
  searchPrevious(): Promise<boolean>;
  clearSearch(): void;
  highlights: readonly LyraHighlight[];
  activeHighlightId: string | null;
  anchor: LyraAnchor | string | null;
  readonly anchorKinds: readonly LyraAnchorKind[];
  scrollToAnchor(target: LyraAnchor | string): Promise<boolean>;
}`

- **`ssr-contracts`** — Shared utility contracts.
  `buildLyraSsrStaticSafety(tags: readonly string[], tagCapabilities: Readonly<Record<string, LyraSsrTagCapabilities>>, auditedStaticSafeTags: readonly string[]): LyraSsrStaticSafetyResult`
  Fail-closed classifier behind `LYRA_SSR_STATIC_SAFETY`/`getLyraSsrStaticSafety`: a tag present in
  neither a non-empty `tagCapabilities` entry nor `auditedStaticSafeTags` is reported in the result's
  `unaudited` list instead of silently defaulting to `'static-safe'`. Pure and fixture-friendly --
  `scripts/check-ssr.mjs` calls it with the real inventory, tests call it with small fixture lists.
  `deriveLyraSsrStaticSafety(capabilities: LyraSsrTagCapabilities): LyraSsrStaticSafety`
  Derives static safety from one tag's capability record: any `'after-hydration'`/`'client-only'`
  entry makes it `'hydration-required'`; an empty record defaults to `'static-safe'`. That empty-
  record default is only valid for a record already known to reflect a completed review (as
  `LYRA_SSR_TAG_CAPABILITIES` entries do) -- `buildLyraSsrStaticSafety()` does not rely on it for a
  tag missing from that record entirely, which it instead routes through `auditedStaticSafeTags`.
  `diagnoseLyraHydration(root?: ParentNode): Promise<readonly LyraHydrationDiagnostic[]>`
  `getLyraSsrMode(tagName: string): LyraSsrMode | undefined`
  `getLyraSsrStaticSafety(tagName: string): LyraSsrStaticSafety | undefined`
  Returns the static-safety classification for a `render-and-hydrate` Lyra tag, or `undefined` for a
  tag outside that tier. See "SSR and declarative shadow DOM" above for the full write-up.
  `LyraHydrationDiagnostic {
  element: Element;
  tag: string;
  mode: LyraSsrMode;
  status: LyraHydrationStatus;
  error?: unknown;
}`
  `LyraLitElementRendererConstructor {
  new (tagName: string): object;
  readonly prototype: object;
  matchesClass(constructor: CustomElementConstructor, tagName: string, attributes: Map<string, string>): boolean;
}`
  `LyraSsrClientRenderReason {
  code: LyraSsrClientRenderReasonCode;
  detail: string;
}`
  `LyraSsrStaticSafetyResult {
  classification: Readonly<Record<string, LyraSsrStaticSafety>>;
  unaudited: readonly string[];
}`
  Return shape of `buildLyraSsrStaticSafety()`: `classification` holds one entry per classified tag
  (a tag absent from it was neither capability-bearing nor audited), and a non-empty `unaudited`
  means the check must fail closed.
  `lyraSsrElementRenderers<T extends LyraLitElementRendererConstructor>(litElementRenderer: T): readonly [typeof LyraSsrFallbackRenderer, T]`

- **`svelte-contracts`** — Framework integration type contracts, including the multi-split
  `for` launcher id and `trigger` element reference.
  `LyraElementTagNameMap {
  'lr-accordion': LyraComponentTypeMap['lr-accordion']['element'];
  'lr-accordion-item': LyraComponentTypeMap['lr-accordion-item']['element'];
  'lr-activity-feed': LyraComponentTypeMap['lr-activity-feed']['element'];
  'lr-agent-eval-dashboard': LyraComponentTypeMap['lr-agent-eval-dashboard']['element'];
  'lr-agent-question': LyraComponentTypeMap['lr-agent-question']['element'];
  'lr-agent-run': LyraComponentTypeMap['lr-agent-run']['element'];
  'lr-agent-trace': LyraComponentTypeMap['lr-agent-trace']['element'];
  'lr-agent-workspace': LyraComponentTypeMap['lr-agent-workspace']['element'];
  'lr-alert': LyraComponentTypeMap['lr-alert']['element'];
  'lr-animated-image': LyraComponentTypeMap['lr-animated-image']['element'];
  'lr-animation': LyraComponentTypeMap['lr-animation']['element'];
  'lr-app-rail': LyraComponentTypeMap['lr-app-rail']['element'];
  'lr-app-rail-group': LyraComponentTypeMap['lr-app-rail-group']['element'];
  'lr-app-rail-item': LyraComponentTypeMap['lr-app-rail-item']['element'];
  'lr-approval-queue': LyraComponentTypeMap['lr-approval-queue']['element'];
  'lr-archive-viewer': LyraComponentTypeMap['lr-archive-viewer']['element'];
  'lr-artifact-panel': LyraComponentTypeMap['lr-artifact-panel']['element'];
  'lr-attachment-chip': LyraComponentTypeMap['lr-attachment-chip']['element'];
  'lr-attachment-trigger': LyraComponentTypeMap['lr-attachment-trigger']['element'];
  'lr-audio-visualizer': LyraComponentTypeMap['lr-audio-visualizer']['element'];
  'lr-av-player': LyraComponentTypeMap['lr-av-player']['element'];
  'lr-avatar': LyraComponentTypeMap['lr-avatar']['element'];
  'lr-avatar-group': LyraComponentTypeMap['lr-avatar-group']['element'];
  'lr-background-runs': LyraComponentTypeMap['lr-background-runs']['element'];
  'lr-badge': LyraComponentTypeMap['lr-badge']['element'];
  'lr-bar-chart': LyraComponentTypeMap['lr-bar-chart']['element'];
  'lr-box-plot': LyraComponentTypeMap['lr-box-plot']['element'];
  'lr-branch-picker': LyraComponentTypeMap['lr-branch-picker']['element'];
  'lr-breadcrumb': LyraComponentTypeMap['lr-breadcrumb']['element'];
  'lr-breadcrumb-item': LyraComponentTypeMap['lr-breadcrumb-item']['element'];
  'lr-browser-frame': LyraComponentTypeMap['lr-browser-frame']['element'];
  'lr-bubble-chart': LyraComponentTypeMap['lr-bubble-chart']['element'];
  'lr-budget-meter': LyraComponentTypeMap['lr-budget-meter']['element'];
  'lr-button': LyraComponentTypeMap['lr-button']['element'];
  'lr-button-group': LyraComponentTypeMap['lr-button-group']['element'];
  'lr-calendar': LyraComponentTypeMap['lr-calendar']['element'];
  'lr-calendar-viewer': LyraComponentTypeMap['lr-calendar-viewer']['element'];
  'lr-callout': LyraComponentTypeMap['lr-callout']['element'];
  'lr-card': LyraComponentTypeMap['lr-card']['element'];
  'lr-carousel': LyraComponentTypeMap['lr-carousel']['element'];
  'lr-carousel-item': LyraComponentTypeMap['lr-carousel-item']['element'];
  'lr-change-review': LyraComponentTypeMap['lr-change-review']['element'];
  'lr-chart': LyraComponentTypeMap['lr-chart']['element'];
  'lr-chart-3d': LyraComponentTypeMap['lr-chart-3d']['element'];
  'lr-chat-composer': LyraComponentTypeMap['lr-chat-composer']['element'];
  'lr-chat-message': LyraComponentTypeMap['lr-chat-message']['element'];
  'lr-chat-viewport': LyraComponentTypeMap['lr-chat-viewport']['element'];
  'lr-checkbox': LyraComponentTypeMap['lr-checkbox']['element'];
  'lr-checkbox-group': LyraComponentTypeMap['lr-checkbox-group']['element'];
  'lr-checkpoint': LyraComponentTypeMap['lr-checkpoint']['element'];
  'lr-chip': LyraComponentTypeMap['lr-chip']['element'];
  'lr-chip-group': LyraComponentTypeMap['lr-chip-group']['element'];
  'lr-chunk-inspector': LyraComponentTypeMap['lr-chunk-inspector']['element'];
  'lr-citation-badge': LyraComponentTypeMap['lr-citation-badge']['element'];
  'lr-claim-evidence': LyraComponentTypeMap['lr-claim-evidence']['element'];
  'lr-code-block': LyraComponentTypeMap['lr-code-block']['element'];
  'lr-code-block-core': LyraComponentTypeMap['lr-code-block-core']['element'];
  'lr-code-editor': LyraComponentTypeMap['lr-code-editor']['element'];
  'lr-color-picker': LyraComponentTypeMap['lr-color-picker']['element'];
  'lr-combobox': LyraComponentTypeMap['lr-combobox']['element'];
  'lr-command-palette': LyraComponentTypeMap['lr-command-palette']['element'];
  'lr-commit-card': LyraComponentTypeMap['lr-commit-card']['element'];
  'lr-community-card': LyraComponentTypeMap['lr-community-card']['element'];
  'lr-compare-panel': LyraComponentTypeMap['lr-compare-panel']['element'];
  'lr-condition-builder': LyraComponentTypeMap['lr-condition-builder']['element'];
  'lr-confirm-bar': LyraComponentTypeMap['lr-confirm-bar']['element'];
  'lr-connector-manager': LyraComponentTypeMap['lr-connector-manager']['element'];
  'lr-contact-viewer': LyraComponentTypeMap['lr-contact-viewer']['element'];
  'lr-context-inspector': LyraComponentTypeMap['lr-context-inspector']['element'];
  'lr-context-menu': LyraComponentTypeMap['lr-context-menu']['element'];
  'lr-context-meter': LyraComponentTypeMap['lr-context-meter']['element'];
  'lr-control-group': LyraComponentTypeMap['lr-control-group']['element'];
  'lr-conversation-item': LyraComponentTypeMap['lr-conversation-item']['element'];
  'lr-copy-button': LyraComponentTypeMap['lr-copy-button']['element'];
  'lr-country-picker': LyraComponentTypeMap['lr-country-picker']['element'];
  'lr-csv-viewer': LyraComponentTypeMap['lr-csv-viewer']['element'];
  'lr-currency-picker': LyraComponentTypeMap['lr-currency-picker']['element'];
  'lr-dashboard-grid': LyraComponentTypeMap['lr-dashboard-grid']['element'];
  'lr-data-grid': LyraComponentTypeMap['lr-data-grid']['element'];
  'lr-dataset-viewer': LyraComponentTypeMap['lr-dataset-viewer']['element'];
  'lr-date-input': LyraComponentTypeMap['lr-date-input']['element'];
  'lr-date-picker': LyraComponentTypeMap['lr-date-picker']['element'];
  'lr-details': LyraComponentTypeMap['lr-details']['element'];
  'lr-dialog': LyraComponentTypeMap['lr-dialog']['element'];
  'lr-diff-view': LyraComponentTypeMap['lr-diff-view']['element'];
  'lr-divider': LyraComponentTypeMap['lr-divider']['element'];
  'lr-dock-panel': LyraComponentTypeMap['lr-dock-panel']['element'];
  'lr-document-compare': LyraComponentTypeMap['lr-document-compare']['element'];
  'lr-document-library': LyraComponentTypeMap['lr-document-library']['element'];
  'lr-document-preview': LyraComponentTypeMap['lr-document-preview']['element'];
  'lr-document-viewer': LyraComponentTypeMap['lr-document-viewer']['element'];
  'lr-docx-viewer': LyraComponentTypeMap['lr-docx-viewer']['element'];
  'lr-doughnut-chart': LyraComponentTypeMap['lr-doughnut-chart']['element'];
  'lr-drawer': LyraComponentTypeMap['lr-drawer']['element'];
  'lr-drilldown-panel': LyraComponentTypeMap['lr-drilldown-panel']['element'];
  'lr-drop-zone': LyraComponentTypeMap['lr-drop-zone']['element'];
  'lr-dropdown': LyraComponentTypeMap['lr-dropdown']['element'];
  'lr-dropdown-item': LyraComponentTypeMap['lr-dropdown-item']['element'];
  'lr-ebook-viewer': LyraComponentTypeMap['lr-ebook-viewer']['element'];
  'lr-email-viewer': LyraComponentTypeMap['lr-email-viewer']['element'];
  'lr-embedding-explorer': LyraComponentTypeMap['lr-embedding-explorer']['element'];
  'lr-emoji-picker': LyraComponentTypeMap['lr-emoji-picker']['element'];
  'lr-empty': LyraComponentTypeMap['lr-empty']['element'];
  'lr-entity-card': LyraComponentTypeMap['lr-entity-card']['element'];
  'lr-entity-chip': LyraComponentTypeMap['lr-entity-chip']['element'];
  'lr-entity-dossier': LyraComponentTypeMap['lr-entity-dossier']['element'];
  'lr-env-list': LyraComponentTypeMap['lr-env-list']['element'];
  'lr-eval-dataset': LyraComponentTypeMap['lr-eval-dataset']['element'];
  'lr-eval-result': LyraComponentTypeMap['lr-eval-result']['element'];
  'lr-eval-run': LyraComponentTypeMap['lr-eval-run']['element'];
  'lr-export-button': LyraComponentTypeMap['lr-export-button']['element'];
  'lr-file-icon': LyraComponentTypeMap['lr-file-icon']['element'];
  'lr-file-input': LyraComponentTypeMap['lr-file-input']['element'];
  'lr-file-tree': LyraComponentTypeMap['lr-file-tree']['element'];
  'lr-filter-bar': LyraComponentTypeMap['lr-filter-bar']['element'];
  'lr-flag': LyraComponentTypeMap['lr-flag']['element'];
  'lr-flow-canvas': LyraComponentTypeMap['lr-flow-canvas']['element'];
  'lr-flow-controls': LyraComponentTypeMap['lr-flow-controls']['element'];
  'lr-flow-minimap': LyraComponentTypeMap['lr-flow-minimap']['element'];
  'lr-flow-node': LyraComponentTypeMap['lr-flow-node']['element'];
  'lr-flow-run-status': LyraComponentTypeMap['lr-flow-run-status']['element'];
  'lr-format-bytes': LyraComponentTypeMap['lr-format-bytes']['element'];
  'lr-format-date': LyraComponentTypeMap['lr-format-date']['element'];
  'lr-format-number': LyraComponentTypeMap['lr-format-number']['element'];
  'lr-funnel': LyraComponentTypeMap['lr-funnel']['element'];
  'lr-gauge': LyraComponentTypeMap['lr-gauge']['element'];
  'lr-generation-metrics': LyraComponentTypeMap['lr-generation-metrics']['element'];
  'lr-geojson-viewer': LyraComponentTypeMap['lr-geojson-viewer']['element'];
  'lr-graph': LyraComponentTypeMap['lr-graph']['element'];
  'lr-graph-legend': LyraComponentTypeMap['lr-graph-legend']['element'];
  'lr-graph-query-builder': LyraComponentTypeMap['lr-graph-query-builder']['element'];
  'lr-grounding-summary': LyraComponentTypeMap['lr-grounding-summary']['element'];
  'lr-handoff-divider': LyraComponentTypeMap['lr-handoff-divider']['element'];
  'lr-heatmap': LyraComponentTypeMap['lr-heatmap']['element'];
  'lr-highlight-layer': LyraComponentTypeMap['lr-highlight-layer']['element'];
  'lr-histogram': LyraComponentTypeMap['lr-histogram']['element'];
  'lr-html-viewer': LyraComponentTypeMap['lr-html-viewer']['element'];
  'lr-icon': LyraComponentTypeMap['lr-icon']['element'];
  'lr-icon-button': LyraComponentTypeMap['lr-icon-button']['element'];
  'lr-image-comparer': LyraComponentTypeMap['lr-image-comparer']['element'];
  'lr-image-viewer': LyraComponentTypeMap['lr-image-viewer']['element'];
  'lr-include': LyraComponentTypeMap['lr-include']['element'];
  'lr-ingestion-queue': LyraComponentTypeMap['lr-ingestion-queue']['element'];
  'lr-input': LyraComponentTypeMap['lr-input']['element'];
  'lr-intersection-observer': LyraComponentTypeMap['lr-intersection-observer']['element'];
  'lr-json-schema-viewer': LyraComponentTypeMap['lr-json-schema-viewer']['element'];
  'lr-json-viewer': LyraComponentTypeMap['lr-json-viewer']['element'];
  'lr-kbd': LyraComponentTypeMap['lr-kbd']['element'];
  'lr-knowledge-base': LyraComponentTypeMap['lr-knowledge-base']['element'];
  'lr-knowledge-base-admin': LyraComponentTypeMap['lr-knowledge-base-admin']['element'];
  'lr-knowledge-graph-explorer': LyraComponentTypeMap['lr-knowledge-graph-explorer']['element'];
  'lr-known-date': LyraComponentTypeMap['lr-known-date']['element'];
  'lr-lightbox': LyraComponentTypeMap['lr-lightbox']['element'];
  'lr-line-chart': LyraComponentTypeMap['lr-line-chart']['element'];
  'lr-lite-chart': LyraComponentTypeMap['lr-lite-chart']['element'];
  'lr-live-region': LyraComponentTypeMap['lr-live-region']['element'];
  'lr-locale-picker': LyraComponentTypeMap['lr-locale-picker']['element'];
  'lr-map': LyraComponentTypeMap['lr-map']['element'];
  'lr-markdown': LyraComponentTypeMap['lr-markdown']['element'];
  'lr-markdown-core': LyraComponentTypeMap['lr-markdown-core']['element'];
  'lr-mcp-app': LyraComponentTypeMap['lr-mcp-app']['element'];
  'lr-media-card': LyraComponentTypeMap['lr-media-card']['element'];
  'lr-memory-panel': LyraComponentTypeMap['lr-memory-panel']['element'];
  'lr-mention-popover': LyraComponentTypeMap['lr-mention-popover']['element'];
  'lr-menu': LyraComponentTypeMap['lr-menu']['element'];
  'lr-menu-item': LyraComponentTypeMap['lr-menu-item']['element'];
  'lr-menu-label': LyraComponentTypeMap['lr-menu-label']['element'];
  'lr-menubar': LyraComponentTypeMap['lr-menubar']['element'];
  'lr-menubar-item': LyraComponentTypeMap['lr-menubar-item']['element'];
  'lr-message-actions': LyraComponentTypeMap['lr-message-actions']['element'];
  'lr-message-feedback': LyraComponentTypeMap['lr-message-feedback']['element'];
  'lr-message-parts': LyraComponentTypeMap['lr-message-parts']['element'];
  'lr-mind-map': LyraComponentTypeMap['lr-mind-map']['element'];
  'lr-model-select': LyraComponentTypeMap['lr-model-select']['element'];
  'lr-model-settings-panel': LyraComponentTypeMap['lr-model-settings-panel']['element'];
  'lr-model-viewer': LyraComponentTypeMap['lr-model-viewer']['element'];
  'lr-multi-split': LyraComponentTypeMap['lr-multi-split']['element'];
  'lr-mutation-observer': LyraComponentTypeMap['lr-mutation-observer']['element'];
  'lr-native-time-input': LyraComponentTypeMap['lr-native-time-input']['element'];
  'lr-navigation-menu': LyraComponentTypeMap['lr-navigation-menu']['element'];
  'lr-navigation-menu-item': LyraComponentTypeMap['lr-navigation-menu-item']['element'];
  'lr-neighbor-list': LyraComponentTypeMap['lr-neighbor-list']['element'];
  'lr-node-palette': LyraComponentTypeMap['lr-node-palette']['element'];
  'lr-notebook-viewer': LyraComponentTypeMap['lr-notebook-viewer']['element'];
  'lr-number-input': LyraComponentTypeMap['lr-number-input']['element'];
  'lr-option': LyraComponentTypeMap['lr-option']['element'];
  'lr-otp-input': LyraComponentTypeMap['lr-otp-input']['element'];
  'lr-page': LyraComponentTypeMap['lr-page']['element'];
  'lr-page-rail': LyraComponentTypeMap['lr-page-rail']['element'];
  'lr-pagination': LyraComponentTypeMap['lr-pagination']['element'];
  'lr-pan-zoom': LyraComponentTypeMap['lr-pan-zoom']['element'];
  'lr-path-strip': LyraComponentTypeMap['lr-path-strip']['element'];
  'lr-pdf-viewer': LyraComponentTypeMap['lr-pdf-viewer']['element'];
  'lr-permission-grant': LyraComponentTypeMap['lr-permission-grant']['element'];
  'lr-permission-rules': LyraComponentTypeMap['lr-permission-rules']['element'];
  'lr-phone-input': LyraComponentTypeMap['lr-phone-input']['element'];
  'lr-pie-chart': LyraComponentTypeMap['lr-pie-chart']['element'];
  'lr-polar-area-chart': LyraComponentTypeMap['lr-polar-area-chart']['element'];
  'lr-policy-summary': LyraComponentTypeMap['lr-policy-summary']['element'];
  'lr-poll-status': LyraComponentTypeMap['lr-poll-status']['element'];
  'lr-popover': LyraComponentTypeMap['lr-popover']['element'];
  'lr-popup': LyraComponentTypeMap['lr-popup']['element'];
  'lr-pptx-viewer': LyraComponentTypeMap['lr-pptx-viewer']['element'];
  'lr-progress-bar': LyraComponentTypeMap['lr-progress-bar']['element'];
  'lr-progress-ring': LyraComponentTypeMap['lr-progress-ring']['element'];
  'lr-prompt-input': LyraComponentTypeMap['lr-prompt-input']['element'];
  'lr-prompt-queue': LyraComponentTypeMap['lr-prompt-queue']['element'];
  'lr-prompt-studio': LyraComponentTypeMap['lr-prompt-studio']['element'];
  'lr-provenance-panel': LyraComponentTypeMap['lr-provenance-panel']['element'];
  'lr-push-to-talk': LyraComponentTypeMap['lr-push-to-talk']['element'];
  'lr-qr-code': LyraComponentTypeMap['lr-qr-code']['element'];
  'lr-radar-chart': LyraComponentTypeMap['lr-radar-chart']['element'];
  'lr-radio': LyraComponentTypeMap['lr-radio']['element'];
  'lr-radio-button': LyraComponentTypeMap['lr-radio-button']['element'];
  'lr-radio-group': LyraComponentTypeMap['lr-radio-group']['element'];
  'lr-rag-answer': LyraComponentTypeMap['lr-rag-answer']['element'];
  'lr-rag-eval-dashboard': LyraComponentTypeMap['lr-rag-eval-dashboard']['element'];
  'lr-random-content': LyraComponentTypeMap['lr-random-content']['element'];
  'lr-rating': LyraComponentTypeMap['lr-rating']['element'];
  'lr-realtime-session': LyraComponentTypeMap['lr-realtime-session']['element'];
  'lr-relative-time': LyraComponentTypeMap['lr-relative-time']['element'];
  'lr-reorder-item': LyraComponentTypeMap['lr-reorder-item']['element'];
  'lr-reorder-list': LyraComponentTypeMap['lr-reorder-list']['element'];
  'lr-research-progress': LyraComponentTypeMap['lr-research-progress']['element'];
  'lr-resize-observer': LyraComponentTypeMap['lr-resize-observer']['element'];
  'lr-responsive-panel': LyraComponentTypeMap['lr-responsive-panel']['element'];
  'lr-result-card': LyraComponentTypeMap['lr-result-card']['element'];
  'lr-result-field': LyraComponentTypeMap['lr-result-field']['element'];
  'lr-retrieval-compare': LyraComponentTypeMap['lr-retrieval-compare']['element'];
  'lr-retrieval-results': LyraComponentTypeMap['lr-retrieval-results']['element'];
  'lr-retrieval-search': LyraComponentTypeMap['lr-retrieval-search']['element'];
  'lr-retrieval-trace': LyraComponentTypeMap['lr-retrieval-trace']['element'];
  'lr-rubric-form': LyraComponentTypeMap['lr-rubric-form']['element'];
  'lr-scatter-chart': LyraComponentTypeMap['lr-scatter-chart']['element'];
  'lr-scroller': LyraComponentTypeMap['lr-scroller']['element'];
  'lr-segmented': LyraComponentTypeMap['lr-segmented']['element'];
  'lr-select': LyraComponentTypeMap['lr-select']['element'];
  'lr-selection-toolbar': LyraComponentTypeMap['lr-selection-toolbar']['element'];
  'lr-sequence-playback': LyraComponentTypeMap['lr-sequence-playback']['element'];
  'lr-sequence-strip': LyraComponentTypeMap['lr-sequence-strip']['element'];
  'lr-signature-pad': LyraComponentTypeMap['lr-signature-pad']['element'];
  'lr-skeleton': LyraComponentTypeMap['lr-skeleton']['element'];
  'lr-slider': LyraComponentTypeMap['lr-slider']['element'];
  'lr-source-card': LyraComponentTypeMap['lr-source-card']['element'];
  'lr-source-list': LyraComponentTypeMap['lr-source-list']['element'];
  'lr-source-picker': LyraComponentTypeMap['lr-source-picker']['element'];
  'lr-span-waterfall': LyraComponentTypeMap['lr-span-waterfall']['element'];
  'lr-sparkline': LyraComponentTypeMap['lr-sparkline']['element'];
  'lr-spinner': LyraComponentTypeMap['lr-spinner']['element'];
  'lr-split-panel': LyraComponentTypeMap['lr-split-panel']['element'];
  'lr-spreadsheet-viewer': LyraComponentTypeMap['lr-spreadsheet-viewer']['element'];
  'lr-stack-trace': LyraComponentTypeMap['lr-stack-trace']['element'];
  'lr-stat': LyraComponentTypeMap['lr-stat']['element'];
  'lr-stepper': LyraComponentTypeMap['lr-stepper']['element'];
  'lr-stream-status': LyraComponentTypeMap['lr-stream-status']['element'];
  'lr-streaming-text': LyraComponentTypeMap['lr-streaming-text']['element'];
  'lr-streaming-text-core': LyraComponentTypeMap['lr-streaming-text-core']['element'];
  'lr-subagent-panel': LyraComponentTypeMap['lr-subagent-panel']['element'];
  'lr-suggestion-chips': LyraComponentTypeMap['lr-suggestion-chips']['element'];
  'lr-svg-viewer': LyraComponentTypeMap['lr-svg-viewer']['element'];
  'lr-swatch-picker': LyraComponentTypeMap['lr-swatch-picker']['element'];
  'lr-switch': LyraComponentTypeMap['lr-switch']['element'];
  'lr-tab': LyraComponentTypeMap['lr-tab']['element'];
  'lr-tab-group': LyraComponentTypeMap['lr-tab-group']['element'];
  'lr-tab-panel': LyraComponentTypeMap['lr-tab-panel']['element'];
  'lr-table': LyraComponentTypeMap['lr-table']['element'];
  'lr-tag': LyraComponentTypeMap['lr-tag']['element'];
  'lr-task-list': LyraComponentTypeMap['lr-task-list']['element'];
  'lr-terminal': LyraComponentTypeMap['lr-terminal']['element'];
  'lr-test-results': LyraComponentTypeMap['lr-test-results']['element'];
  'lr-textarea': LyraComponentTypeMap['lr-textarea']['element'];
  'lr-thinking-panel': LyraComponentTypeMap['lr-thinking-panel']['element'];
  'lr-thread-list': LyraComponentTypeMap['lr-thread-list']['element'];
  'lr-time-input': LyraComponentTypeMap['lr-time-input']['element'];
  'lr-time-range': LyraComponentTypeMap['lr-time-range']['element'];
  'lr-time-zone-picker': LyraComponentTypeMap['lr-time-zone-picker']['element'];
  'lr-timeline': LyraComponentTypeMap['lr-timeline']['element'];
  'lr-timeline-item': LyraComponentTypeMap['lr-timeline-item']['element'];
  'lr-toast': LyraComponentTypeMap['lr-toast']['element'];
  'lr-toast-item': LyraComponentTypeMap['lr-toast-item']['element'];
  'lr-toggle': LyraComponentTypeMap['lr-toggle']['element'];
  'lr-toggle-group': LyraComponentTypeMap['lr-toggle-group']['element'];
  'lr-token-input': LyraComponentTypeMap['lr-token-input']['element'];
  'lr-tool-approval-dialog': LyraComponentTypeMap['lr-tool-approval-dialog']['element'];
  'lr-tool-call-block': LyraComponentTypeMap['lr-tool-call-block']['element'];
  'lr-tool-call-chip': LyraComponentTypeMap['lr-tool-call-chip']['element'];
  'lr-tool-param-form': LyraComponentTypeMap['lr-tool-param-form']['element'];
  'lr-tool-result-dialog': LyraComponentTypeMap['lr-tool-result-dialog']['element'];
  'lr-tool-result-view': LyraComponentTypeMap['lr-tool-result-view']['element'];
  'lr-tool-select-dialog': LyraComponentTypeMap['lr-tool-select-dialog']['element'];
  'lr-tool-timeline': LyraComponentTypeMap['lr-tool-timeline']['element'];
  'lr-tooltip': LyraComponentTypeMap['lr-tooltip']['element'];
  'lr-tour': LyraComponentTypeMap['lr-tour']['element'];
  'lr-trace-tree': LyraComponentTypeMap['lr-trace-tree']['element'];
  'lr-transcript-feed': LyraComponentTypeMap['lr-transcript-feed']['element'];
  'lr-tree': LyraComponentTypeMap['lr-tree']['element'];
  'lr-tree-item': LyraComponentTypeMap['lr-tree-item']['element'];
  'lr-typing-indicator': LyraComponentTypeMap['lr-typing-indicator']['element'];
  'lr-unit-picker': LyraComponentTypeMap['lr-unit-picker']['element'];
  'lr-usage-badge': LyraComponentTypeMap['lr-usage-badge']['element'];
  'lr-video': LyraComponentTypeMap['lr-video']['element'];
  'lr-video-playlist': LyraComponentTypeMap['lr-video-playlist']['element'];
  'lr-virtual-list': LyraComponentTypeMap['lr-virtual-list']['element'];
  'lr-visually-hidden': LyraComponentTypeMap['lr-visually-hidden']['element'];
  'lr-voice-picker': LyraComponentTypeMap['lr-voice-picker']['element'];
  'lr-widget': LyraComponentTypeMap['lr-widget']['element'];
  'lr-widget-renderer': LyraComponentTypeMap['lr-widget-renderer']['element'];
  'lr-word-cloud': LyraComponentTypeMap['lr-word-cloud']['element'];
  'lr-xml-viewer': LyraComponentTypeMap['lr-xml-viewer']['element'];
  'lr-zoomable-frame': LyraComponentTypeMap['lr-zoomable-frame']['element'];
}`
  `LyraSvelteElements {
  'lr-accordion': LyraAccordionSvelteProps;
  'lr-accordion-item': LyraAccordionItemSvelteProps;
  'lr-activity-feed': LyraActivityFeedSvelteProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardSvelteProps;
  'lr-agent-question': LyraAgentQuestionSvelteProps;
  'lr-agent-run': LyraAgentRunSvelteProps;
  'lr-agent-trace': LyraAgentTraceSvelteProps;
  'lr-agent-workspace': LyraAgentWorkspaceSvelteProps;
  'lr-alert': LyraAlertSvelteProps;
  'lr-animated-image': LyraAnimatedImageSvelteProps;
  'lr-animation': LyraAnimationSvelteProps;
  'lr-app-rail': LyraAppRailSvelteProps;
  'lr-app-rail-group': LyraAppRailGroupSvelteProps;
  'lr-app-rail-item': LyraAppRailItemSvelteProps;
  'lr-approval-queue': LyraApprovalQueueSvelteProps;
  'lr-archive-viewer': LyraArchiveViewerSvelteProps;
  'lr-artifact-panel': LyraArtifactPanelSvelteProps;
  'lr-attachment-chip': LyraAttachmentChipSvelteProps;
  'lr-attachment-trigger': LyraAttachmentTriggerSvelteProps;
  'lr-audio-visualizer': LyraAudioVisualizerSvelteProps;
  'lr-av-player': LyraAvPlayerSvelteProps;
  'lr-avatar': LyraAvatarSvelteProps;
  'lr-avatar-group': LyraAvatarGroupSvelteProps;
  'lr-background-runs': LyraBackgroundRunsSvelteProps;
  'lr-badge': LyraBadgeSvelteProps;
  'lr-bar-chart': LyraBarChartSvelteProps;
  'lr-box-plot': LyraBoxPlotSvelteProps;
  'lr-branch-picker': LyraBranchPickerSvelteProps;
  'lr-breadcrumb': LyraBreadcrumbSvelteProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemSvelteProps;
  'lr-browser-frame': LyraBrowserFrameSvelteProps;
  'lr-bubble-chart': LyraBubbleChartSvelteProps;
  'lr-budget-meter': LyraBudgetMeterSvelteProps;
  'lr-button': LyraButtonSvelteProps;
  'lr-button-group': LyraButtonGroupSvelteProps;
  'lr-calendar': LyraCalendarSvelteProps;
  'lr-calendar-viewer': LyraCalendarViewerSvelteProps;
  'lr-callout': LyraCalloutSvelteProps;
  'lr-card': LyraCardSvelteProps;
  'lr-carousel': LyraCarouselSvelteProps;
  'lr-carousel-item': LyraCarouselItemSvelteProps;
  'lr-change-review': LyraChangeReviewSvelteProps;
  'lr-chart': LyraChartSvelteProps;
  'lr-chart-3d': LyraChart3dSvelteProps;
  'lr-chat-composer': LyraChatComposerSvelteProps;
  'lr-chat-message': LyraChatMessageSvelteProps;
  'lr-chat-viewport': LyraChatViewportSvelteProps;
  'lr-checkbox': LyraCheckboxSvelteProps;
  'lr-checkbox-group': LyraCheckboxGroupSvelteProps;
  'lr-checkpoint': LyraCheckpointSvelteProps;
  'lr-chip': LyraChipSvelteProps;
  'lr-chip-group': LyraChipGroupSvelteProps;
  'lr-chunk-inspector': LyraChunkInspectorSvelteProps;
  'lr-citation-badge': LyraCitationBadgeSvelteProps;
  'lr-claim-evidence': LyraClaimEvidenceSvelteProps;
  'lr-code-block': LyraCodeBlockSvelteProps;
  'lr-code-block-core': LyraCodeBlockCoreSvelteProps;
  'lr-code-editor': LyraCodeEditorSvelteProps;
  'lr-color-picker': LyraColorPickerSvelteProps;
  'lr-combobox': LyraComboboxSvelteProps;
  'lr-command-palette': LyraCommandPaletteSvelteProps;
  'lr-commit-card': LyraCommitCardSvelteProps;
  'lr-community-card': LyraCommunityCardSvelteProps;
  'lr-compare-panel': LyraComparePanelSvelteProps;
  'lr-condition-builder': LyraConditionBuilderSvelteProps;
  'lr-confirm-bar': LyraConfirmBarSvelteProps;
  'lr-connector-manager': LyraConnectorManagerSvelteProps;
  'lr-contact-viewer': LyraContactViewerSvelteProps;
  'lr-context-inspector': LyraContextInspectorSvelteProps;
  'lr-context-menu': LyraContextMenuSvelteProps;
  'lr-context-meter': LyraContextMeterSvelteProps;
  'lr-control-group': LyraControlGroupSvelteProps;
  'lr-conversation-item': LyraConversationItemSvelteProps;
  'lr-copy-button': LyraCopyButtonSvelteProps;
  'lr-country-picker': LyraCountryPickerSvelteProps;
  'lr-csv-viewer': LyraCsvViewerSvelteProps;
  'lr-currency-picker': LyraCurrencyPickerSvelteProps;
  'lr-dashboard-grid': LyraDashboardGridSvelteProps;
  'lr-data-grid': LyraDataGridSvelteProps;
  'lr-dataset-viewer': LyraDatasetViewerSvelteProps;
  'lr-date-input': LyraDateInputSvelteProps;
  'lr-date-picker': LyraDatePickerSvelteProps;
  'lr-details': LyraDetailsSvelteProps;
  'lr-dialog': LyraDialogSvelteProps;
  'lr-diff-view': LyraDiffViewSvelteProps;
  'lr-divider': LyraDividerSvelteProps;
  'lr-dock-panel': LyraDockPanelSvelteProps;
  'lr-document-compare': LyraDocumentCompareSvelteProps;
  'lr-document-library': LyraDocumentLibrarySvelteProps;
  'lr-document-preview': LyraDocumentPreviewSvelteProps;
  'lr-document-viewer': LyraDocumentViewerSvelteProps;
  'lr-docx-viewer': LyraDocxViewerSvelteProps;
  'lr-doughnut-chart': LyraDoughnutChartSvelteProps;
  'lr-drawer': LyraDrawerSvelteProps;
  'lr-drilldown-panel': LyraDrilldownPanelSvelteProps;
  'lr-drop-zone': LyraDropZoneSvelteProps;
  'lr-dropdown': LyraDropdownSvelteProps;
  'lr-dropdown-item': LyraDropdownItemSvelteProps;
  'lr-ebook-viewer': LyraEbookViewerSvelteProps;
  'lr-email-viewer': LyraEmailViewerSvelteProps;
  'lr-embedding-explorer': LyraEmbeddingExplorerSvelteProps;
  'lr-emoji-picker': LyraEmojiPickerSvelteProps;
  'lr-empty': LyraEmptySvelteProps;
  'lr-entity-card': LyraEntityCardSvelteProps;
  'lr-entity-chip': LyraEntityChipSvelteProps;
  'lr-entity-dossier': LyraEntityDossierSvelteProps;
  'lr-env-list': LyraEnvListSvelteProps;
  'lr-eval-dataset': LyraEvalDatasetSvelteProps;
  'lr-eval-result': LyraEvalResultSvelteProps;
  'lr-eval-run': LyraEvalRunSvelteProps;
  'lr-export-button': LyraExportButtonSvelteProps;
  'lr-file-icon': LyraFileIconSvelteProps;
  'lr-file-input': LyraFileInputSvelteProps;
  'lr-file-tree': LyraFileTreeSvelteProps;
  'lr-filter-bar': LyraFilterBarSvelteProps;
  'lr-flag': LyraFlagSvelteProps;
  'lr-flow-canvas': LyraFlowCanvasSvelteProps;
  'lr-flow-controls': LyraFlowControlsSvelteProps;
  'lr-flow-minimap': LyraFlowMinimapSvelteProps;
  'lr-flow-node': LyraFlowNodeSvelteProps;
  'lr-flow-run-status': LyraFlowRunStatusSvelteProps;
  'lr-format-bytes': LyraFormatBytesSvelteProps;
  'lr-format-date': LyraFormatDateSvelteProps;
  'lr-format-number': LyraFormatNumberSvelteProps;
  'lr-funnel': LyraFunnelSvelteProps;
  'lr-gauge': LyraGaugeSvelteProps;
  'lr-generation-metrics': LyraGenerationMetricsSvelteProps;
  'lr-geojson-viewer': LyraGeoJsonViewerSvelteProps;
  'lr-graph': LyraGraphSvelteProps;
  'lr-graph-legend': LyraGraphLegendSvelteProps;
  'lr-graph-query-builder': LyraGraphQueryBuilderSvelteProps;
  'lr-grounding-summary': LyraGroundingSummarySvelteProps;
  'lr-handoff-divider': LyraHandoffDividerSvelteProps;
  'lr-heatmap': LyraHeatmapSvelteProps;
  'lr-highlight-layer': LyraHighlightLayerSvelteProps;
  'lr-histogram': LyraHistogramSvelteProps;
  'lr-html-viewer': LyraHtmlViewerSvelteProps;
  'lr-icon': LyraIconSvelteProps;
  'lr-icon-button': LyraIconButtonSvelteProps;
  'lr-image-comparer': LyraImageComparerSvelteProps;
  'lr-image-viewer': LyraImageViewerSvelteProps;
  'lr-include': LyraIncludeSvelteProps;
  'lr-ingestion-queue': LyraIngestionQueueSvelteProps;
  'lr-input': LyraInputSvelteProps;
  'lr-intersection-observer': LyraIntersectionObserverSvelteProps;
  'lr-json-schema-viewer': LyraJsonSchemaViewerSvelteProps;
  'lr-json-viewer': LyraJsonViewerSvelteProps;
  'lr-kbd': LyraKbdSvelteProps;
  'lr-knowledge-base': LyraKnowledgeBaseSvelteProps;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdminSvelteProps;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorerSvelteProps;
  'lr-known-date': LyraKnownDateSvelteProps;
  'lr-lightbox': LyraLightboxSvelteProps;
  'lr-line-chart': LyraLineChartSvelteProps;
  'lr-lite-chart': LyraLiteChartSvelteProps;
  'lr-live-region': LyraLiveRegionSvelteProps;
  'lr-locale-picker': LyraLocalePickerSvelteProps;
  'lr-map': LyraMapSvelteProps;
  'lr-markdown': LyraMarkdownSvelteProps;
  'lr-markdown-core': LyraMarkdownCoreSvelteProps;
  'lr-mcp-app': LyraMcpAppSvelteProps;
  'lr-media-card': LyraMediaCardSvelteProps;
  'lr-memory-panel': LyraMemoryPanelSvelteProps;
  'lr-mention-popover': LyraMentionPopoverSvelteProps;
  'lr-menu': LyraMenuSvelteProps;
  'lr-menu-item': LyraMenuItemSvelteProps;
  'lr-menu-label': LyraMenuLabelSvelteProps;
  'lr-menubar': LyraMenubarSvelteProps;
  'lr-menubar-item': LyraMenubarItemSvelteProps;
  'lr-message-actions': LyraMessageActionsSvelteProps;
  'lr-message-feedback': LyraMessageFeedbackSvelteProps;
  'lr-message-parts': LyraMessagePartsSvelteProps;
  'lr-mind-map': LyraMindMapSvelteProps;
  'lr-model-select': LyraModelSelectSvelteProps;
  'lr-model-settings-panel': LyraModelSettingsPanelSvelteProps;
  'lr-model-viewer': LyraModelViewerSvelteProps;
  'lr-multi-split': LyraMultiSplitSvelteProps;
  'lr-mutation-observer': LyraMutationObserverSvelteProps;
  'lr-native-time-input': LyraNativeTimeInputSvelteProps;
  'lr-navigation-menu': LyraNavigationMenuSvelteProps;
  'lr-navigation-menu-item': LyraNavigationMenuItemSvelteProps;
  'lr-neighbor-list': LyraNeighborListSvelteProps;
  'lr-node-palette': LyraNodePaletteSvelteProps;
  'lr-notebook-viewer': LyraNotebookViewerSvelteProps;
  'lr-number-input': LyraNumberInputSvelteProps;
  'lr-option': LyraOptionSvelteProps;
  'lr-otp-input': LyraOtpInputSvelteProps;
  'lr-page': LyraPageSvelteProps;
  'lr-page-rail': LyraPageRailSvelteProps;
  'lr-pagination': LyraPaginationSvelteProps;
  'lr-pan-zoom': LyraPanZoomSvelteProps;
  'lr-path-strip': LyraPathStripSvelteProps;
  'lr-pdf-viewer': LyraPdfViewerSvelteProps;
  'lr-permission-grant': LyraPermissionGrantSvelteProps;
  'lr-permission-rules': LyraPermissionRulesSvelteProps;
  'lr-phone-input': LyraPhoneInputSvelteProps;
  'lr-pie-chart': LyraPieChartSvelteProps;
  'lr-polar-area-chart': LyraPolarAreaChartSvelteProps;
  'lr-policy-summary': LyraPolicySummarySvelteProps;
  'lr-poll-status': LyraPollStatusSvelteProps;
  'lr-popover': LyraPopoverSvelteProps;
  'lr-popup': LyraPopupSvelteProps;
  'lr-pptx-viewer': LyraPptxViewerSvelteProps;
  'lr-progress-bar': LyraProgressBarSvelteProps;
  'lr-progress-ring': LyraProgressRingSvelteProps;
  'lr-prompt-input': LyraPromptInputSvelteProps;
  'lr-prompt-queue': LyraPromptQueueSvelteProps;
  'lr-prompt-studio': LyraPromptStudioSvelteProps;
  'lr-provenance-panel': LyraProvenancePanelSvelteProps;
  'lr-push-to-talk': LyraPushToTalkSvelteProps;
  'lr-qr-code': LyraQrCodeSvelteProps;
  'lr-radar-chart': LyraRadarChartSvelteProps;
  'lr-radio': LyraRadioSvelteProps;
  'lr-radio-button': LyraRadioButtonSvelteProps;
  'lr-radio-group': LyraRadioGroupSvelteProps;
  'lr-rag-answer': LyraRagAnswerSvelteProps;
  'lr-rag-eval-dashboard': LyraRagEvalDashboardSvelteProps;
  'lr-random-content': LyraRandomContentSvelteProps;
  'lr-rating': LyraRatingSvelteProps;
  'lr-realtime-session': LyraRealtimeSessionSvelteProps;
  'lr-relative-time': LyraRelativeTimeSvelteProps;
  'lr-reorder-item': LyraReorderItemSvelteProps;
  'lr-reorder-list': LyraReorderListSvelteProps;
  'lr-research-progress': LyraResearchProgressSvelteProps;
  'lr-resize-observer': LyraResizeObserverSvelteProps;
  'lr-responsive-panel': LyraResponsivePanelSvelteProps;
  'lr-result-card': LyraResultCardSvelteProps;
  'lr-result-field': LyraResultFieldSvelteProps;
  'lr-retrieval-compare': LyraRetrievalCompareSvelteProps;
  'lr-retrieval-results': LyraRetrievalResultsSvelteProps;
  'lr-retrieval-search': LyraRetrievalSearchSvelteProps;
  'lr-retrieval-trace': LyraRetrievalTraceSvelteProps;
  'lr-rubric-form': LyraRubricFormSvelteProps;
  'lr-scatter-chart': LyraScatterChartSvelteProps;
  'lr-scroller': LyraScrollerSvelteProps;
  'lr-segmented': LyraSegmentedSvelteProps;
  'lr-select': LyraSelectSvelteProps;
  'lr-selection-toolbar': LyraSelectionToolbarSvelteProps;
  'lr-sequence-playback': LyraSequencePlaybackSvelteProps;
  'lr-sequence-strip': LyraSequenceStripSvelteProps;
  'lr-signature-pad': LyraSignaturePadSvelteProps;
  'lr-skeleton': LyraSkeletonSvelteProps;
  'lr-slider': LyraSliderSvelteProps;
  'lr-source-card': LyraSourceCardSvelteProps;
  'lr-source-list': LyraSourceListSvelteProps;
  'lr-source-picker': LyraSourcePickerSvelteProps;
  'lr-span-waterfall': LyraSpanWaterfallSvelteProps;
  'lr-sparkline': LyraSparklineSvelteProps;
  'lr-spinner': LyraSpinnerSvelteProps;
  'lr-split-panel': LyraSplitPanelSvelteProps;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerSvelteProps;
  'lr-stack-trace': LyraStackTraceSvelteProps;
  'lr-stat': LyraStatSvelteProps;
  'lr-stepper': LyraStepperSvelteProps;
  'lr-stream-status': LyraStreamStatusSvelteProps;
  'lr-streaming-text': LyraStreamingTextSvelteProps;
  'lr-streaming-text-core': LyraStreamingTextCoreSvelteProps;
  'lr-subagent-panel': LyraSubagentPanelSvelteProps;
  'lr-suggestion-chips': LyraSuggestionChipsSvelteProps;
  'lr-svg-viewer': LyraSvgViewerSvelteProps;
  'lr-swatch-picker': LyraSwatchPickerSvelteProps;
  'lr-switch': LyraSwitchSvelteProps;
  'lr-tab': LyraTabSvelteProps;
  'lr-tab-group': LyraTabGroupSvelteProps;
  'lr-tab-panel': LyraTabPanelSvelteProps;
  'lr-table': LyraTableSvelteProps;
  'lr-tag': LyraTagSvelteProps;
  'lr-task-list': LyraTaskListSvelteProps;
  'lr-terminal': LyraTerminalSvelteProps;
  'lr-test-results': LyraTestResultsSvelteProps;
  'lr-textarea': LyraTextareaSvelteProps;
  'lr-thinking-panel': LyraThinkingPanelSvelteProps;
  'lr-thread-list': LyraThreadListSvelteProps;
  'lr-time-input': LyraTimeInputSvelteProps;
  'lr-time-range': LyraTimeRangeSvelteProps;
  'lr-time-zone-picker': LyraTimeZonePickerSvelteProps;
  'lr-timeline': LyraTimelineSvelteProps;
  'lr-timeline-item': LyraTimelineItemSvelteProps;
  'lr-toast': LyraToastSvelteProps;
  'lr-toast-item': LyraToastItemSvelteProps;
  'lr-toggle': LyraToggleSvelteProps;
  'lr-toggle-group': LyraToggleGroupSvelteProps;
  'lr-token-input': LyraTokenInputSvelteProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogSvelteProps;
  'lr-tool-call-block': LyraToolCallBlockSvelteProps;
  'lr-tool-call-chip': LyraToolCallChipSvelteProps;
  'lr-tool-param-form': LyraToolParamFormSvelteProps;
  'lr-tool-result-dialog': LyraToolResultDialogSvelteProps;
  'lr-tool-result-view': LyraToolResultViewSvelteProps;
  'lr-tool-select-dialog': LyraToolSelectDialogSvelteProps;
  'lr-tool-timeline': LyraToolTimelineSvelteProps;
  'lr-tooltip': LyraTooltipSvelteProps;
  'lr-tour': LyraTourSvelteProps;
  'lr-trace-tree': LyraTraceTreeSvelteProps;
  'lr-transcript-feed': LyraTranscriptFeedSvelteProps;
  'lr-tree': LyraTreeSvelteProps;
  'lr-tree-item': LyraTreeItemSvelteProps;
  'lr-typing-indicator': LyraTypingIndicatorSvelteProps;
  'lr-unit-picker': LyraUnitPickerSvelteProps;
  'lr-usage-badge': LyraUsageBadgeSvelteProps;
  'lr-video': LyraVideoSvelteProps;
  'lr-video-playlist': LyraVideoPlaylistSvelteProps;
  'lr-virtual-list': LyraVirtualListSvelteProps;
  'lr-visually-hidden': LyraVisuallyHiddenSvelteProps;
  'lr-voice-picker': LyraVoicePickerSvelteProps;
  'lr-widget': LyraWidgetSvelteProps;
  'lr-widget-renderer': LyraWidgetRendererSvelteProps;
  'lr-word-cloud': LyraWordCloudSvelteProps;
  'lr-xml-viewer': LyraXmlViewerSvelteProps;
  'lr-zoomable-frame': LyraZoomableFrameSvelteProps;
}`

- **`testing-event-factory-contracts`** — Shared utility contracts.
  `createLyraEvent<Tag extends keyof LyraTagEventTypes, Name extends LyraFactoryEventName<Tag>>(tag: Tag, name: Name, detail?: LyraFactoryDetail<LyraTagEventTypes[Tag][Name]>): LyraTagEventTypes[Tag][Name]`
  See "Constructing a validated test event: `createLyraEvent()`" above for the full contract.

- **`testing-happy-dom-shims-contracts`** — Shared utility contracts.
  `installHappyDomFormAssociatedShims(): void`
  `installHappyDomShadowFocusShim(): () => void`
  `flattenCascadeLayers(css: string): string`
  `installHappyDomAriaControlsShim(proto: object | undefined = globalThis.Element?.prototype): void`
  `installHappyDomCascadeLayerShim(proto: SheetTextMethods | undefined = globalThis.CSSStyleSheet?.prototype, misbehaves: () => boolean = cascadeLayerRulesDropped): () => void`
  `installHappyDomShims(): void`
  `installStubInternalsForTest(host: Element): StubElementInternals`

- **`testing-jsdom-shims-contracts`** — Shared utility contracts.
  `JsdomAdoptedStyleSheetsTargets {
  documentPrototype?: object;
  shadowRootPrototype?: object;
  styleSheetPrototype?: object;
  isJsdom?: () => boolean;
}`
  `installJsdomAdoptedStyleSheetsShim(targets?: JsdomAdoptedStyleSheetsTargets): () => void`
  `JsdomFormAssociatedTargets {
  internalsPrototype?: object;
  elementPrototype?: object;
  isJsdom?: () => boolean;
}`
  `installJsdomFormAssociatedShim(targets?: JsdomFormAssociatedTargets): () => void`
  `installJsdomShims(): () => void`
  See "jsdom: `installJsdomShims()`" above for the full contract.

- **`testing-interaction-drivers-contracts`** — Shared utility contracts.
  `chooseOption(owner: LyraOptionListElement, value: string): Promise<void>`
  `submitConfirmDecision(owner: LyraConfirmBar | LyraToolApprovalDialog, decision: ApprovalDecision): Promise<void>`
  `toggleSwitch(switchEl: LyraSwitch): Promise<void>`
  `activateStep(stepper: LyraStepper, target: number | string): Promise<void>`
  `chooseSwatch(picker: LyraSwatchPicker, value: string): Promise<void>`
  `chooseCurrency(picker: LyraCurrencyPicker, code: string): Promise<void>`
  `PopoverDriverOptions {
  timeoutMs?: number;
}`
  `ClosePopoverOptions {
  via?: 'escape' | 'trigger';
  timeoutMs?: number;
}`
  `openPopover(popover: LyraPopover, options: PopoverDriverOptions = {}): Promise<void>`
  `closePopover(popover: LyraPopover, options: ClosePopoverOptions = {}): Promise<void>`
  See "Driving a component's real activation path: interaction drivers" above for the full contract.

- **`testing-wait-for-mount-contracts`** — Shared utility contracts.
  `waitForLyraElement<T extends Element = HTMLElement>(selector: string, options: WaitForLyraElementOptions<T> = {}): Promise<T>`
  `WaitForLyraElementOptions {
  root?: Node & ParentNode;
  match?: (element: T) => boolean;
  timeoutMs?: number;
}`
  `waitForToast(match?: ToastMatch, options: Omit<WaitForLyraElementOptions<LyraToastItem>, 'match'> = {}): Promise<LyraToastItem>`
  See "Awaiting a lazily registered mount: `waitForLyraElement()` and `waitForToast()`" above for the
  full contract.

- **`theme-gemstones-data-contracts`** — Shared utility contracts.
  `GemstoneAccent {
  key: GemstoneKey;
  fill: string;
  deep: string;
}`

- **`theme-gemstones-contracts`** — Shared utility contracts.
  `gemstoneGlyph(color = 'currentColor'): TemplateResult`
  `gemstoneSelectedGlyphStyles: CSSResult` — the shared "selected" halo/shine presentation for a
  rendered `gemstoneGlyph()`, applied via the `data-lr-gemstone-selected` boolean attribute on the
  element wrapping the glyph. `lr-swatch-picker mode="gemstone"` includes this exact stylesheet in
  its own `static styles` for its checked swatch's automatic glyph rather than keeping a private
  copy, so a glyph rendered anywhere else on the page can match it exactly by consuming the same
  export and attribute.

- **`theme-theme-contracts`** — Shared utility contracts.
  `createLyraThemeBootstrap(options?: LyraThemeBootstrapOptions): string`
  `LyraThemeBootstrapOptions {
  storageKey?: string;
  restore?: 'all' | 'mode';
}`
  `LyraThemeSemanticRole = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'`
  `LyraThemeAccentValue = string | null | { light?: string | null; dark?: string | null }`
  `LyraThemeAccent = string | null | Partial<Record<LyraThemeSemanticRole, LyraThemeAccentValue>>`
  ``LyraThemeTokenName = `--lr-theme-${string}```
  `LyraThemeTokenValue = string | { light?: string | null; dark?: string | null }`
  `LyraThemeTokens = Readonly<Record<LyraThemeTokenName, LyraThemeTokenValue>>`
  `LyraStyleAxis = 'look' | 'surface' | 'density' | 'mode' | 'accent'`
  `LyraStyleField = LyraStyleAxis | 'accentBackground' | 'overrides'`
  `LyraLookId = 'lyra' | 'shadcn' | 'material' | (string & {})`
  `LyraSurface = 'solid' | 'glass'`
  `LyraDensity = 'compact' | 'comfortable' | 'touch'`
  `LyraMode = 'light' | 'dark' | 'system' | 'unset'`
  `LyraAccentName = 'emerald' | 'peridot' | 'topaz' | 'ruby' | 'tourmaline' | 'amethyst' | 'aquamarine' | 'sapphire' | 'hematite'`
  `LyraAccent = LyraAccentName | LyraThemeAccent`
  `LyraAccentBackground = string | { light?: string | null; dark?: string | null } | null`
  `applyLyraStyleScope(element: Element, choices: LyraStyleScopeChoices | null): void`
  `defineLyraLook<const Look extends LyraLook>(look: Look): Readonly<Look>`
  `getLyraStyle(): Readonly<LyraStyle>`
  `lyraThemeBootstrap: string`
  `LyraLook {
  readonly id: LyraLookId;
  readonly tokens: LyraThemeTokens;
}`
  `lyraStyleAttributes(style: Partial<LyraStyle>): Readonly<Record<string, string>>`
  `LyraStyleChangeDetail {
  readonly style: Readonly<LyraStyle>;
  readonly changed: readonly (LyraStyleField | 'resolvedMode')[];
}`
  `LyraStyleChoices {
  look?: LyraLookId | LyraLook | null;
  surface?: LyraSurface | null;
  density?: LyraDensity | null;
  mode?: LyraMode | null;
  accent?: LyraAccent;
  accentBackground?: LyraAccentBackground;
  overrides?: LyraThemeTokens | null;
}`
  `LyraStyle {
  readonly look: LyraLookId;
  readonly lookForm: 'stylesheet' | 'runtime';
  readonly surface: LyraSurface;
  readonly density: LyraDensity;
  readonly mode: LyraMode;
  readonly accent: LyraAccent;
  readonly accentName: LyraAccentName | null;
  readonly accentBackground: LyraAccentBackground;
  readonly overrides?: LyraThemeTokens;
  readonly resolvedMode: 'light' | 'dark' | null;
}`
  `LyraStyleScopeChoices {
  look?: LyraLookId | LyraLook;
  surface?: LyraSurface;
  density?: LyraDensity;
  mode?: 'light' | 'dark' | 'system';
  accent?: LyraAccent;
  accentBackground?: LyraAccentBackground;
  overrides?: LyraThemeTokens;
}`
  `parseLyraStyleRecord(value: unknown): Readonly<LyraStyle>`
  `resetLyraStyle(fields?: readonly LyraStyleField[]): Readonly<LyraStyle>`
  `setLyraStyle(choices: LyraStyleChoices): Readonly<LyraStyle>`
  `startLyraStyle(): Readonly<LyraStyle>`

- **`vue-contracts`** — Framework integration type contracts, including the multi-split
  `for` launcher id and `trigger` element reference.
  `LyraVueGlobalComponents {
  'lr-accordion': LyraAccordionVueProps;
  'lr-accordion-item': LyraAccordionItemVueProps;
  'lr-activity-feed': LyraActivityFeedVueProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardVueProps;
  'lr-agent-question': LyraAgentQuestionVueProps;
  'lr-agent-run': LyraAgentRunVueProps;
  'lr-agent-trace': LyraAgentTraceVueProps;
  'lr-agent-workspace': LyraAgentWorkspaceVueProps;
  'lr-alert': LyraAlertVueProps;
  'lr-animated-image': LyraAnimatedImageVueProps;
  'lr-animation': LyraAnimationVueProps;
  'lr-app-rail': LyraAppRailVueProps;
  'lr-app-rail-group': LyraAppRailGroupVueProps;
  'lr-app-rail-item': LyraAppRailItemVueProps;
  'lr-approval-queue': LyraApprovalQueueVueProps;
  'lr-archive-viewer': LyraArchiveViewerVueProps;
  'lr-artifact-panel': LyraArtifactPanelVueProps;
  'lr-attachment-chip': LyraAttachmentChipVueProps;
  'lr-attachment-trigger': LyraAttachmentTriggerVueProps;
  'lr-audio-visualizer': LyraAudioVisualizerVueProps;
  'lr-av-player': LyraAvPlayerVueProps;
  'lr-avatar': LyraAvatarVueProps;
  'lr-avatar-group': LyraAvatarGroupVueProps;
  'lr-background-runs': LyraBackgroundRunsVueProps;
  'lr-badge': LyraBadgeVueProps;
  'lr-bar-chart': LyraBarChartVueProps;
  'lr-box-plot': LyraBoxPlotVueProps;
  'lr-branch-picker': LyraBranchPickerVueProps;
  'lr-breadcrumb': LyraBreadcrumbVueProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemVueProps;
  'lr-browser-frame': LyraBrowserFrameVueProps;
  'lr-bubble-chart': LyraBubbleChartVueProps;
  'lr-budget-meter': LyraBudgetMeterVueProps;
  'lr-button': LyraButtonVueProps;
  'lr-button-group': LyraButtonGroupVueProps;
  'lr-calendar': LyraCalendarVueProps;
  'lr-calendar-viewer': LyraCalendarViewerVueProps;
  'lr-callout': LyraCalloutVueProps;
  'lr-card': LyraCardVueProps;
  'lr-carousel': LyraCarouselVueProps;
  'lr-carousel-item': LyraCarouselItemVueProps;
  'lr-change-review': LyraChangeReviewVueProps;
  'lr-chart': LyraChartVueProps;
  'lr-chart-3d': LyraChart3dVueProps;
  'lr-chat-composer': LyraChatComposerVueProps;
  'lr-chat-message': LyraChatMessageVueProps;
  'lr-chat-viewport': LyraChatViewportVueProps;
  'lr-checkbox': LyraCheckboxVueProps;
  'lr-checkbox-group': LyraCheckboxGroupVueProps;
  'lr-checkpoint': LyraCheckpointVueProps;
  'lr-chip': LyraChipVueProps;
  'lr-chip-group': LyraChipGroupVueProps;
  'lr-chunk-inspector': LyraChunkInspectorVueProps;
  'lr-citation-badge': LyraCitationBadgeVueProps;
  'lr-claim-evidence': LyraClaimEvidenceVueProps;
  'lr-code-block': LyraCodeBlockVueProps;
  'lr-code-block-core': LyraCodeBlockCoreVueProps;
  'lr-code-editor': LyraCodeEditorVueProps;
  'lr-color-picker': LyraColorPickerVueProps;
  'lr-combobox': LyraComboboxVueProps;
  'lr-command-palette': LyraCommandPaletteVueProps;
  'lr-commit-card': LyraCommitCardVueProps;
  'lr-community-card': LyraCommunityCardVueProps;
  'lr-compare-panel': LyraComparePanelVueProps;
  'lr-condition-builder': LyraConditionBuilderVueProps;
  'lr-confirm-bar': LyraConfirmBarVueProps;
  'lr-connector-manager': LyraConnectorManagerVueProps;
  'lr-contact-viewer': LyraContactViewerVueProps;
  'lr-context-inspector': LyraContextInspectorVueProps;
  'lr-context-menu': LyraContextMenuVueProps;
  'lr-context-meter': LyraContextMeterVueProps;
  'lr-control-group': LyraControlGroupVueProps;
  'lr-conversation-item': LyraConversationItemVueProps;
  'lr-copy-button': LyraCopyButtonVueProps;
  'lr-country-picker': LyraCountryPickerVueProps;
  'lr-csv-viewer': LyraCsvViewerVueProps;
  'lr-currency-picker': LyraCurrencyPickerVueProps;
  'lr-dashboard-grid': LyraDashboardGridVueProps;
  'lr-data-grid': LyraDataGridVueProps;
  'lr-dataset-viewer': LyraDatasetViewerVueProps;
  'lr-date-input': LyraDateInputVueProps;
  'lr-date-picker': LyraDatePickerVueProps;
  'lr-details': LyraDetailsVueProps;
  'lr-dialog': LyraDialogVueProps;
  'lr-diff-view': LyraDiffViewVueProps;
  'lr-divider': LyraDividerVueProps;
  'lr-dock-panel': LyraDockPanelVueProps;
  'lr-document-compare': LyraDocumentCompareVueProps;
  'lr-document-library': LyraDocumentLibraryVueProps;
  'lr-document-preview': LyraDocumentPreviewVueProps;
  'lr-document-viewer': LyraDocumentViewerVueProps;
  'lr-docx-viewer': LyraDocxViewerVueProps;
  'lr-doughnut-chart': LyraDoughnutChartVueProps;
  'lr-drawer': LyraDrawerVueProps;
  'lr-drilldown-panel': LyraDrilldownPanelVueProps;
  'lr-drop-zone': LyraDropZoneVueProps;
  'lr-dropdown': LyraDropdownVueProps;
  'lr-dropdown-item': LyraDropdownItemVueProps;
  'lr-ebook-viewer': LyraEbookViewerVueProps;
  'lr-email-viewer': LyraEmailViewerVueProps;
  'lr-embedding-explorer': LyraEmbeddingExplorerVueProps;
  'lr-emoji-picker': LyraEmojiPickerVueProps;
  'lr-empty': LyraEmptyVueProps;
  'lr-entity-card': LyraEntityCardVueProps;
  'lr-entity-chip': LyraEntityChipVueProps;
  'lr-entity-dossier': LyraEntityDossierVueProps;
  'lr-env-list': LyraEnvListVueProps;
  'lr-eval-dataset': LyraEvalDatasetVueProps;
  'lr-eval-result': LyraEvalResultVueProps;
  'lr-eval-run': LyraEvalRunVueProps;
  'lr-export-button': LyraExportButtonVueProps;
  'lr-file-icon': LyraFileIconVueProps;
  'lr-file-input': LyraFileInputVueProps;
  'lr-file-tree': LyraFileTreeVueProps;
  'lr-filter-bar': LyraFilterBarVueProps;
  'lr-flag': LyraFlagVueProps;
  'lr-flow-canvas': LyraFlowCanvasVueProps;
  'lr-flow-controls': LyraFlowControlsVueProps;
  'lr-flow-minimap': LyraFlowMinimapVueProps;
  'lr-flow-node': LyraFlowNodeVueProps;
  'lr-flow-run-status': LyraFlowRunStatusVueProps;
  'lr-format-bytes': LyraFormatBytesVueProps;
  'lr-format-date': LyraFormatDateVueProps;
  'lr-format-number': LyraFormatNumberVueProps;
  'lr-funnel': LyraFunnelVueProps;
  'lr-gauge': LyraGaugeVueProps;
  'lr-generation-metrics': LyraGenerationMetricsVueProps;
  'lr-geojson-viewer': LyraGeoJsonViewerVueProps;
  'lr-graph': LyraGraphVueProps;
  'lr-graph-legend': LyraGraphLegendVueProps;
  'lr-graph-query-builder': LyraGraphQueryBuilderVueProps;
  'lr-grounding-summary': LyraGroundingSummaryVueProps;
  'lr-handoff-divider': LyraHandoffDividerVueProps;
  'lr-heatmap': LyraHeatmapVueProps;
  'lr-highlight-layer': LyraHighlightLayerVueProps;
  'lr-histogram': LyraHistogramVueProps;
  'lr-html-viewer': LyraHtmlViewerVueProps;
  'lr-icon': LyraIconVueProps;
  'lr-icon-button': LyraIconButtonVueProps;
  'lr-image-comparer': LyraImageComparerVueProps;
  'lr-image-viewer': LyraImageViewerVueProps;
  'lr-include': LyraIncludeVueProps;
  'lr-ingestion-queue': LyraIngestionQueueVueProps;
  'lr-input': LyraInputVueProps;
  'lr-intersection-observer': LyraIntersectionObserverVueProps;
  'lr-json-schema-viewer': LyraJsonSchemaViewerVueProps;
  'lr-json-viewer': LyraJsonViewerVueProps;
  'lr-kbd': LyraKbdVueProps;
  'lr-knowledge-base': LyraKnowledgeBaseVueProps;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdminVueProps;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorerVueProps;
  'lr-known-date': LyraKnownDateVueProps;
  'lr-lightbox': LyraLightboxVueProps;
  'lr-line-chart': LyraLineChartVueProps;
  'lr-lite-chart': LyraLiteChartVueProps;
  'lr-live-region': LyraLiveRegionVueProps;
  'lr-locale-picker': LyraLocalePickerVueProps;
  'lr-map': LyraMapVueProps;
  'lr-markdown': LyraMarkdownVueProps;
  'lr-markdown-core': LyraMarkdownCoreVueProps;
  'lr-mcp-app': LyraMcpAppVueProps;
  'lr-media-card': LyraMediaCardVueProps;
  'lr-memory-panel': LyraMemoryPanelVueProps;
  'lr-mention-popover': LyraMentionPopoverVueProps;
  'lr-menu': LyraMenuVueProps;
  'lr-menu-item': LyraMenuItemVueProps;
  'lr-menu-label': LyraMenuLabelVueProps;
  'lr-menubar': LyraMenubarVueProps;
  'lr-menubar-item': LyraMenubarItemVueProps;
  'lr-message-actions': LyraMessageActionsVueProps;
  'lr-message-feedback': LyraMessageFeedbackVueProps;
  'lr-message-parts': LyraMessagePartsVueProps;
  'lr-mind-map': LyraMindMapVueProps;
  'lr-model-select': LyraModelSelectVueProps;
  'lr-model-settings-panel': LyraModelSettingsPanelVueProps;
  'lr-model-viewer': LyraModelViewerVueProps;
  'lr-multi-split': LyraMultiSplitVueProps;
  'lr-mutation-observer': LyraMutationObserverVueProps;
  'lr-native-time-input': LyraNativeTimeInputVueProps;
  'lr-navigation-menu': LyraNavigationMenuVueProps;
  'lr-navigation-menu-item': LyraNavigationMenuItemVueProps;
  'lr-neighbor-list': LyraNeighborListVueProps;
  'lr-node-palette': LyraNodePaletteVueProps;
  'lr-notebook-viewer': LyraNotebookViewerVueProps;
  'lr-number-input': LyraNumberInputVueProps;
  'lr-option': LyraOptionVueProps;
  'lr-otp-input': LyraOtpInputVueProps;
  'lr-page': LyraPageVueProps;
  'lr-page-rail': LyraPageRailVueProps;
  'lr-pagination': LyraPaginationVueProps;
  'lr-pan-zoom': LyraPanZoomVueProps;
  'lr-path-strip': LyraPathStripVueProps;
  'lr-pdf-viewer': LyraPdfViewerVueProps;
  'lr-permission-grant': LyraPermissionGrantVueProps;
  'lr-permission-rules': LyraPermissionRulesVueProps;
  'lr-phone-input': LyraPhoneInputVueProps;
  'lr-pie-chart': LyraPieChartVueProps;
  'lr-polar-area-chart': LyraPolarAreaChartVueProps;
  'lr-policy-summary': LyraPolicySummaryVueProps;
  'lr-poll-status': LyraPollStatusVueProps;
  'lr-popover': LyraPopoverVueProps;
  'lr-popup': LyraPopupVueProps;
  'lr-pptx-viewer': LyraPptxViewerVueProps;
  'lr-progress-bar': LyraProgressBarVueProps;
  'lr-progress-ring': LyraProgressRingVueProps;
  'lr-prompt-input': LyraPromptInputVueProps;
  'lr-prompt-queue': LyraPromptQueueVueProps;
  'lr-prompt-studio': LyraPromptStudioVueProps;
  'lr-provenance-panel': LyraProvenancePanelVueProps;
  'lr-push-to-talk': LyraPushToTalkVueProps;
  'lr-qr-code': LyraQrCodeVueProps;
  'lr-radar-chart': LyraRadarChartVueProps;
  'lr-radio': LyraRadioVueProps;
  'lr-radio-button': LyraRadioButtonVueProps;
  'lr-radio-group': LyraRadioGroupVueProps;
  'lr-rag-answer': LyraRagAnswerVueProps;
  'lr-rag-eval-dashboard': LyraRagEvalDashboardVueProps;
  'lr-random-content': LyraRandomContentVueProps;
  'lr-rating': LyraRatingVueProps;
  'lr-realtime-session': LyraRealtimeSessionVueProps;
  'lr-relative-time': LyraRelativeTimeVueProps;
  'lr-reorder-item': LyraReorderItemVueProps;
  'lr-reorder-list': LyraReorderListVueProps;
  'lr-research-progress': LyraResearchProgressVueProps;
  'lr-resize-observer': LyraResizeObserverVueProps;
  'lr-responsive-panel': LyraResponsivePanelVueProps;
  'lr-result-card': LyraResultCardVueProps;
  'lr-result-field': LyraResultFieldVueProps;
  'lr-retrieval-compare': LyraRetrievalCompareVueProps;
  'lr-retrieval-results': LyraRetrievalResultsVueProps;
  'lr-retrieval-search': LyraRetrievalSearchVueProps;
  'lr-retrieval-trace': LyraRetrievalTraceVueProps;
  'lr-rubric-form': LyraRubricFormVueProps;
  'lr-scatter-chart': LyraScatterChartVueProps;
  'lr-scroller': LyraScrollerVueProps;
  'lr-segmented': LyraSegmentedVueProps;
  'lr-select': LyraSelectVueProps;
  'lr-selection-toolbar': LyraSelectionToolbarVueProps;
  'lr-sequence-playback': LyraSequencePlaybackVueProps;
  'lr-sequence-strip': LyraSequenceStripVueProps;
  'lr-signature-pad': LyraSignaturePadVueProps;
  'lr-skeleton': LyraSkeletonVueProps;
  'lr-slider': LyraSliderVueProps;
  'lr-source-card': LyraSourceCardVueProps;
  'lr-source-list': LyraSourceListVueProps;
  'lr-source-picker': LyraSourcePickerVueProps;
  'lr-span-waterfall': LyraSpanWaterfallVueProps;
  'lr-sparkline': LyraSparklineVueProps;
  'lr-spinner': LyraSpinnerVueProps;
  'lr-split-panel': LyraSplitPanelVueProps;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerVueProps;
  'lr-stack-trace': LyraStackTraceVueProps;
  'lr-stat': LyraStatVueProps;
  'lr-stepper': LyraStepperVueProps;
  'lr-stream-status': LyraStreamStatusVueProps;
  'lr-streaming-text': LyraStreamingTextVueProps;
  'lr-streaming-text-core': LyraStreamingTextCoreVueProps;
  'lr-subagent-panel': LyraSubagentPanelVueProps;
  'lr-suggestion-chips': LyraSuggestionChipsVueProps;
  'lr-svg-viewer': LyraSvgViewerVueProps;
  'lr-swatch-picker': LyraSwatchPickerVueProps;
  'lr-switch': LyraSwitchVueProps;
  'lr-tab': LyraTabVueProps;
  'lr-tab-group': LyraTabGroupVueProps;
  'lr-tab-panel': LyraTabPanelVueProps;
  'lr-table': LyraTableVueProps;
  'lr-tag': LyraTagVueProps;
  'lr-task-list': LyraTaskListVueProps;
  'lr-terminal': LyraTerminalVueProps;
  'lr-test-results': LyraTestResultsVueProps;
  'lr-textarea': LyraTextareaVueProps;
  'lr-thinking-panel': LyraThinkingPanelVueProps;
  'lr-thread-list': LyraThreadListVueProps;
  'lr-time-input': LyraTimeInputVueProps;
  'lr-time-range': LyraTimeRangeVueProps;
  'lr-time-zone-picker': LyraTimeZonePickerVueProps;
  'lr-timeline': LyraTimelineVueProps;
  'lr-timeline-item': LyraTimelineItemVueProps;
  'lr-toast': LyraToastVueProps;
  'lr-toast-item': LyraToastItemVueProps;
  'lr-toggle': LyraToggleVueProps;
  'lr-toggle-group': LyraToggleGroupVueProps;
  'lr-token-input': LyraTokenInputVueProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogVueProps;
  'lr-tool-call-block': LyraToolCallBlockVueProps;
  'lr-tool-call-chip': LyraToolCallChipVueProps;
  'lr-tool-param-form': LyraToolParamFormVueProps;
  'lr-tool-result-dialog': LyraToolResultDialogVueProps;
  'lr-tool-result-view': LyraToolResultViewVueProps;
  'lr-tool-select-dialog': LyraToolSelectDialogVueProps;
  'lr-tool-timeline': LyraToolTimelineVueProps;
  'lr-tooltip': LyraTooltipVueProps;
  'lr-tour': LyraTourVueProps;
  'lr-trace-tree': LyraTraceTreeVueProps;
  'lr-transcript-feed': LyraTranscriptFeedVueProps;
  'lr-tree': LyraTreeVueProps;
  'lr-tree-item': LyraTreeItemVueProps;
  'lr-typing-indicator': LyraTypingIndicatorVueProps;
  'lr-unit-picker': LyraUnitPickerVueProps;
  'lr-usage-badge': LyraUsageBadgeVueProps;
  'lr-video': LyraVideoVueProps;
  'lr-video-playlist': LyraVideoPlaylistVueProps;
  'lr-virtual-list': LyraVirtualListVueProps;
  'lr-visually-hidden': LyraVisuallyHiddenVueProps;
  'lr-voice-picker': LyraVoicePickerVueProps;
  'lr-widget': LyraWidgetVueProps;
  'lr-widget-renderer': LyraWidgetRendererVueProps;
  'lr-word-cloud': LyraWordCloudVueProps;
  'lr-xml-viewer': LyraXmlViewerVueProps;
  'lr-zoomable-frame': LyraZoomableFrameVueProps;
}`

- **`components-agent-tools-background-runs-background-runs-contracts`** — Public contracts from `components/agent-tools/background-runs/background-runs.class.js`.
  `BackgroundRun {
  id: string;
  label: string;
  description?: string;
  status: BackgroundRunStatus;
}`

- **`components-agent-tools-change-review-change-review-contracts`** — Public contracts from `components/agent-tools/change-review/change-review.class.js`.
  `ChangeReviewFile {
  id: string;
  path: string;
  previousPath?: string;
  hunks: readonly ChangeReviewHunk[];
}`
  `ChangeReviewHunk {
  id: string;
  label?: string;
  before: string;
  after: string;
  decision?: ChangeReviewDecision;
}`

- **`components-agent-tools-connector-manager-connector-manager-contracts`** — Public contracts from `components/agent-tools/connector-manager/connector-manager.class.js`.
  `AgentConnector {
  id: string;
  name: string;
  description?: string;
  kind: AgentConnectorKind;
  status: AgentConnectorStatus;
  error?: string;
}`

- **`components-agent-tools-permission-rules-permission-rules-contracts`** — Public contracts from `components/agent-tools/permission-rules/permission-rules.class.js`.
  `PermissionRule {
  id: string;
  label: string;
  description?: string;
  scope: string;
  decision: PermissionRuleDecision;
}`

- **`components-agent-tools-tool-approval-dialog-tool-approval-dialog-contracts`** — Public contracts from `components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js`.
  `LyraToolApprovalDialogCloseDetail {
  reason: ToolApprovalDialogCloseReason;
}`

- **`components-agent-tools-tool-param-form-tool-param-types-contracts`** — Public contracts from `components/agent-tools/tool-param-form/tool-param-types.js`.
  String choices use either an `enum` of stored strings or titled `anyOf` entries in array items. Titles are already-localized caller data; `const` is the stored value. See the tool parameter form guide for the flat schema limits and validation behavior.

  `ToolParamEnumItems {
  readonly type?: 'string';
  readonly enum?: readonly string[];
  readonly anyOf?: readonly ToolParamEnumOption[];
}`
  `ToolParamEnumOption {
  readonly const: string;
  readonly title: string;
}`

- **`components-agent-tools-tool-result-dialog-tool-result-dialog-contracts`** — Public contracts from `components/agent-tools/tool-result-dialog/tool-result-dialog.class.js`.
  `LyraToolResultDialogCloseDetail {
  reason: ToolResultDialogCloseReason;
}`

- **`components-agent-tools-tool-select-dialog-tool-select-dialog-contracts`** — Public contracts from `components/agent-tools/tool-select-dialog/tool-select-dialog.class.js`.
  `LyraToolSelectDialogCloseDetail {
  reason: ToolSelectDialogCloseReason;
}`

- **`components-layout-command-palette-command-palette-contracts`** — Public contracts from `components/layout/command-palette/command-palette.class.js`.
  `LyraCommandPaletteCloseDetail {
  reason: LyraCommandPaletteCloseReason;
}`

- **`components-layout-responsive-panel-responsive-panel-contracts`** — Public contracts from `components/layout/responsive-panel/responsive-panel.class.js`.
  `LyraResponsivePanelCloseDetail {
  reason: LyraResponsivePanelCloseReason;
}`

- **`components-media-lightbox-lightbox-contracts`** — Public contracts from `components/media/lightbox/lightbox.class.js`.
  `LyraLightboxCloseDetail {
  reason: LyraLightboxCloseReason;
}`

- **`components-overlays-callout-callout-contracts`** — Public contracts from `components/overlays/callout/callout.class.js`.
  `LyraCalloutCloseDetail {
  reason: 'close-button';
}`

- **`components-overlays-dialog-dialog-contracts`** — Public contracts from `components/overlays/dialog/dialog.class.js`.
  `LyraDialogCloseDetail {
  reason: DialogCloseReason;
}`

- **`components-retrieval-research-progress-research-progress-contracts`** — Public contracts from `components/retrieval/research-progress/research-progress.class.js`.
  `ResearchStep {
  id: string;
  label: string;
  description?: string;
  status: ResearchStepStatus;
  sources?: number;
}`

- **`components-viewers-document-viewer-document-viewer-contracts`** — Public contracts from `components/viewers/document-viewer/document-viewer.class.js`.
  `LyraDocumentViewerCloseDetail {
  reason: DocumentViewerCloseReason;
}`

- **`theme-chart-palette-contracts`** — Public contracts from `theme/chart-palette.js`.
  The explicit mode chooses the fallback palette (default `lyra`). A scope resolves live chart tokens for SVG/canvas; `null` uses DOM-free palette data. Scale positions clamp to 0–1, non-finite values use zero, and 0.5 returns the middle stop. Sampling uses sRGB interpolation; DOM-free non-hex colors fall back to the nearest stop. Domain normalization remains caller-owned.

  `LyraChartPaletteOptions {
  readonly mode: LyraChartPaletteMode;
  readonly palette?: LyraChartPaletteName;
}`
  `resolveLyraChartPalette(scope: Element | null, options: LyraChartPaletteOptions): LyraChartPalette`
  `sampleLyraChartScale(scope: Element | null, scale: LyraChartScale, position: number): string`

- **`theme-look-css-contracts`** — Public contracts from `theme/look-css.js`.
  Serialize a validated look without DOM access or global registration. Install the returned CSS alongside `theme.css` in each relevant tree. Optional `modeAliases` enables `.light`/`.dark` below that look; explicit Lyra mode attributes take precedence.

  `lyraLookCss(input: LyraLook, options?: LyraLookCssOptions): string`
  `LyraLookCssOptions {
  readonly modeAliases?: boolean;
}`

- **`theme-options-charts-contracts`** — Public contracts from `theme/options/charts.js`.
  Choose `lyra`, `shadcn`, or `material` palettes in light/dark mode. Categorical colors identify series; three-stop sequential/diverging scales encode magnitude in labeled or bounded fills and are not foreground/text contrast guarantees. Token maps provide both modes. Series cues cycle through eight marker/dash combinations; finite indices are floored and clamped to zero, non-finite indices use zero. Pair cues with visible labels and accessible data.

  `getLyraChartPaletteTokens(name: LyraChartPaletteName): LyraThemeTokens`
  `getLyraChartSeriesCue(index: number): LyraChartSeriesCue`
  `LyraChartPalette {
  readonly categorical: readonly string[];
  readonly sequential: LyraChartScale;
  readonly diverging: LyraChartScale;
}`
  `LyraChartSeriesCue {
  readonly marker: LyraChartMarker;
  readonly dash: readonly number[];
}`

- **`theme-preferences-contracts`** — Public contracts from `theme/preferences.js`.
  Contrast accepts `system` or `more`; motion accepts `system` or `reduce`. Omitted fields inherit. Attribute serialization validates input and works during SSR. Applying preferences replaces the helper-owned scope values; omitted fields or `null` restore prior values while preserving intervening application writes. Reads return requested and effective values; SSR defaults are system requests with false effective flags. Persistence is application-owned.

  `applyLyraPreferences(scope: Element, preferences: LyraPreferences | null): void`
  `getLyraPreferences(scope?: Element): ResolvedLyraPreferences`
  `lyraPreferenceAttributes(preferences: LyraPreferences): Partial<Record<'data-lr-contrast' | 'data-lr-motion', string>>`
  `LyraPreferences {
  contrast?: LyraContrastPreference;
  motion?: LyraMotionPreference;
}`
  `ResolvedLyraPreferences {
  contrast: LyraContrastPreference;
  motion: LyraMotionPreference;
  increasedContrast: boolean;
  reducedMotion: boolean;
}`

- **`theme-style-ownership-contracts`** — Public contracts from `theme/style-ownership.js`.
  This theme handoff structure records the prior attribute/property value (`before`), CSS priority, last helper-written value (`written`), and optional original token request (`requested`). The reader returns a bounded data-only snapshot or `undefined` for malformed input; it does not apply styles. Theme/style helpers manage these records automatically. Use those helpers to change styles.

  `OwnedStyleValue {
  before: string | null;
  priority: string;
  written: string | null;
  requested?: string;
}`
  `readStyleOwnership(raw: unknown): StyleOwnership | undefined`
  `StyleOwnership {
  attributes: Map<string, OwnedStyleValue>;
  properties: Map<string, OwnedStyleValue>;
}`

- **`utilities-scoped-registry-loader-contracts`** — Public contracts from `utilities/scoped-registry-loader.js`.
  Optional catalog-driven loading of requested full tags and their registration dependencies into one native scope. Unknown tags or unsupported environments reject the promise. This does not register global tags or install peer integration bridges; supply optional peers separately. The explicit registry helper does not import this catalog.

  `loadScopedRegistry(tags: readonly string[], options?: {
    document?: Document;
}): Promise<LyraScopedRegistry>`

- **`utilities-scoped-registry-contracts`** — Public contracts from `utilities/scoped-registry.js`.
  Native, document-bound isolation with class-only definitions. Unsupported/SSR environments report false from feature detection and throw on creation; no polyfill or global fallback is installed. Same-constructor definitions are idempotent; conflicts, unknown template tags, and cross-document usage fail. See [native scoped registry composition](imports-and-registration.md#optional-native-scoped-registries) for parser, Lit creation-scope, and shadow-root usage.

  `createScopedRegistry<Definitions extends LyraScopedDefinitions>(definitions: Definitions, options?: {
    document?: Document;
}): LyraScopedRegistry<Definitions>`
  `LyraScopedCreationScope {
  importNode<T extends Node>(node: T, deep?: boolean): T;
}`
  `LyraScopedRegistry<Definitions extends LyraScopedDefinitions = LyraScopedDefinitions> {
  readonly registry: CustomElementRegistry;
  readonly creationScope: LyraScopedCreationScope;
  createElement<Name extends keyof Definitions & string>(name: Name): InstanceType<Definitions[Name]>;
  createElement(name: string): LyraElement<any>;
  attachShadow(host: HTMLElement, options?: ShadowRootInit): ShadowRoot;
  define(name: string, constructor: LyraScopedElementConstructor): void;
}`
  `supportsScopedRegistries(): boolean`

- **`framework-types-contracts`** — The opt-in, type-only component metadata map from
  `@aceshooting/lyra-ui/framework-types`. Its keys are the complete supported tag space, including
  registration aliases. The generated per-component references document individual members;
  indexed types retain the exact component-specific unions without copying them into application
  declarations. Importing these types does not register components or load framework wrappers.

  `LyraComponentTypeMap = import('@aceshooting/lyra-ui/framework-types').LyraComponentTypeMap`

  `LyraComponentTypeMapEntry<Tag extends keyof LyraComponentTypeMap> = LyraComponentTypeMap[Tag]`

  Each entry exposes these exact indexed contracts:

  - `LyraComponentTypeMap[Tag]['element']` — the component's concrete element class.
  - `LyraComponentTypeMap[Tag]['properties']` — optional property bindings, with manifest overrides
    for properties whose framework input differs from the class member type.
  - `LyraComponentTypeMap[Tag]['events']` — the component event map; components without events use
    an empty object.
  - `LyraComponentTypeMap[Tag]['eventNames']` — documented event-name literals, or `never`.
  - `LyraComponentTypeMap[Tag]['cssNames']` — supported CSS custom-property names, or `never`.
  - `LyraComponentTypeMap[Tag]['attributeAliases']` — optional native/dashed attribute bindings,
    each with its corresponding component property's value type.

  ```ts
  import type { LyraComponentTypeMap } from "@aceshooting/lyra-ui/framework-types";

  type Tag = keyof LyraComponentTypeMap;
  type ElementFor<T extends Tag> = LyraComponentTypeMap[T]["element"];
  type BindingsFor<T extends Tag> = LyraComponentTypeMap[T]["properties"];
  type ButtonBindings = BindingsFor<"lr-button">;
  type ButtonElement = ElementFor<"lr-button">;
  ```

Native `focus` and `blur` bridges use `FocusEvent`, preserving `relatedTarget` and bubbling across
component boundaries exactly once. This includes command-palette, conversation-item, thread-list,
message-feedback, known-date, table, eval-dataset, prompt-studio, tool-approval-dialog,
tool-param-form, and tool-select-dialog. These events have no custom `detail`; use native focus
properties. Value controls similarly reserve native `input`/`change` for Event/InputEvent and use
`lr-input`/`lr-change` for typed `{ value }` details. Known-date keeps its native-event detail
compatibility fields as well as the typed pair.
