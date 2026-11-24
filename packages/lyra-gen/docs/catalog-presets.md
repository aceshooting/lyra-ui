# Request-specific catalog presets

Five named presets select existing reviewed roles for one request. Each contains its declared child dependencies and a common layout/status vocabulary. A node cannot use an omitted role, and unrestricted children remain limited to the active preset. Presets add no runtime imports beyond their existing lazy component loaders.

```ts
import { dataCatalog, selectCatalogPreset } from '@aceshooting/lyra-gen/catalog.js';
import { buildCatalogPrompt } from '@aceshooting/lyra-gen/prompts.js';

const prompt = buildCatalogPrompt(dataCatalog);
const selected = selectCatalogPreset('forms');
if (!selected.ok) throw new Error('The requested preset is unavailable.');
const formCatalog = selected.value;
```

The direct exports are `chatCatalog`, `formsCatalog`, `dataCatalog`, `retrievalCatalog`, and `agentOpsCatalog`. `catalogPresets[name]` exposes the same frozen values, `catalogPresetNames` lists the five supported names, and `catalogPresetRoles[name]` lists each preset's closed role inventory.

| Name | Added roles beyond common layout/status roles | Intended use |
| --- | --- | --- |
| `chat` | `chat-viewport`, `chat-message`, `chat-composer`, `citation`, `source-card`, `source-list` | Conversations with plain content and host-resolved source references. |
| `forms` | `form`, `input`, `textarea`, `select`, `option`, `checkbox`, `switch`, `slider` | Host-approved fields with native validation and explicit submission. |
| `data` | `stat`, `table`, `chart` | Metrics and structured numeric/tabular answers. |
| `retrieval` | `citation`, `source-card`, `source-list`, `search` | Search and host-resolved sources. |
| `agent-ops` | `stat`, `table`, `chart`, `chat-message` | Generic operation status, metrics and messages. It does not introduce tool-call, workflow or terminal components. |

Common roles are `stack`, `row`, `text`, `heading`, `card`, `badge`, `alert`, `empty`, `skeleton`, and `button`. The role lists are explicit; no unreviewed roles are substituted when a host source catalog lacks one of them.

### Companion roles for `subsetCatalog()`

`subsetCatalog()` refuses a role whose required child role is not selected (`catalog.dependency`). A parent can declare some child roles optional with `optionalChildren`; leaving one out is accepted and the role is removed from that parent's allowed children, so a generated `button` under `alert` in a read-only subset is rejected by `validateView()` (`children.type`, or `children.forbidden` when no child remains) instead of being accepted as an unknown role.

| Parent role | Required companions | Optional companions |
| --- | --- | --- |
| `alert` | none | `text`, `button` |
| `empty` | none | `button` |
| `source-card` | none | `text` |
| `source-list` | `source-card` | none |
| `select` | `option` | none |
| `chat-viewport` | `chat-message` | none |

A host catalog declares `optionalChildren` as a subset of `children`; `createCatalog()` rejects an optional entry that is not also a listed child.

Each preset identity is `${source.id}/${name}` and retains `source.version`. The built-in data preset is therefore `lyra-reviewed/data` version `1`. Use that selected catalog reference in the generated view and retain it with stored answers. A preset is not interchangeable with the full catalog or another preset. Selecting a preset does not qualify a new A2UI catalog identity.

`selectExamples()` from `examples.js` accepts the five exact built-in preset references and validates every candidate against the active preset's actual roles and schemas. Missing roles are skipped. Compatibility does not rely on an ID prefix or automatically extend to future versions. A custom host catalog identity requires host-authored examples; the built-in example selector refuses it.

Actions are closed by default, including when the source catalog defines actions. Hosts must explicitly name the source actions permitted for the request:

```ts
import { createCatalog, initialCatalog, selectCatalogPreset } from '@aceshooting/lyra-gen/catalog.js';

const hostCatalog = createCatalog({
  ...initialCatalog,
  id: 'app-reviewed',
  actions: { refresh: { payload: { type: 'null' } } },
});
const selected = selectCatalogPreset('agent-ops', hostCatalog, ['refresh']);
if (!selected.ok) throw new Error('The requested roles or actions are unavailable.');
// selected.value.actions contains only refresh.
```

An unknown preset, absent role/dependency, or undeclared action yields diagnostics. Component event declarations alone grant no action authority. Presets also grant no permission to collect fields, resolve sources, access data, or execute tools; those remain host policies. Keep the renderer's authorization and confirmation controls in place.

## CLI and request context

The CLI defaults to the full catalog. Use the same preset for generation, schema, validation,
recording and replay so catalog identities match:

```sh
pnpm exec lyra-gen prompt --preset data
pnpm exec lyra-gen schema --preset data
pnpm exec lyra-gen validate answer.json --preset data
```

`record` and `replay` also accept `--preset`; the benchmark retains its full-catalog fixtures.
Unknown presets reject. `buildCatalogPrompt()` already embeds `exportCatalogArtifact()`; do not
append that identical artifact again. Task-specific composed examples can still provide useful
context; select only examples supported by the active catalog.

The repository-only measurement script records the emitted prompt and schema content:

```sh
node packages/lyra-gen/scripts/report-catalog-presets.mjs --check
node packages/lyra-gen/scripts/report-catalog-presets.mjs --write
```

Build the package first. The [checked report](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-gen/scripts/fixtures/catalog-preset-prompts.json) includes prompt UTF-16/code-point counts, UTF-8 bytes and SHA-256; compact serialized-schema bytes and SHA-256; and their combined content bytes. Trailing newlines, provider wrappers and request metadata are excluded. Provider tokens and model error rates remain unmeasured; smaller content does not establish token, quality, latency, caching or cost improvements.

## Composite answer blocks (opt-in overlay)

`answerBlocksCatalog(base = initialCatalog)` returns a new catalog with id `${base.id}+blocks` (built-in: `lyra-reviewed+blocks`) and the base version. It adds three compact roles that let a model express common answer patterns in one node. Nothing changes for existing catalogs or stored views, and the overlay is a different catalog identity: retain its reference with the answer. It throws a `TypeError` when the base lacks `row`, `stat` or `table`, or already defines one of the added roles.

| Role | Props | Expands to |
| --- | --- | --- |
| `kpi-row` | `items`: 1-6 of `label`, `value` (string or number), optional `caption`, `deltaPercent`, `goodDirection` (`up`/`down`) | `row` of `stat`, children `<id>--<index>` |
| `comparison` | `caption`, optional `rowLabel` (first column header, default `Item`), `columns`: 2-6 labels, `rows`: 1-50 of `label` and `values` (one scalar per column) | `table`; column keys `c0` (row label), `c1`... |
| `steps` | `label`, `items`: 1-12 of `label`, optional `description`; optional zero-based `current` | read-only `stepper` (`lr-stepper`); earlier steps completed, later pending |

The overlay also adds the `stepper` primitive role. The reviewed `stat` role already accepts optional `frame` (`card`/`plain`), `deltaPercent` and `goodDirection` (`up`/`down`); the overlay guarantees the two trend props on a custom base that omits them. A `comparison` row whose `values` length differs from `columns` is rejected at that row. Expansion happens during validation, so renderers and stored output only ever contain primitive nodes; an expanded id that collides with an existing id is a duplicate-identity failure.

```ts
import { answerBlocksCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { buildCatalogPrompt } from '@aceshooting/lyra-gen/prompts.js';

const catalog = answerBlocksCatalog();
const prompt = buildCatalogPrompt(catalog);
```

## Live dashboard roles (opt-in overlay)

`dashboardCatalog(base = initialCatalog)` returns a new catalog with id `${base.id}+dashboard`
(built-in: `lyra-reviewed+dashboard`) and the base version, adding reviewed roles for live
dashboards. Every role renders from plain bounded JSON; formatters, callbacks, colors, server modes
and row hooks stay host-owned and unreachable from generated content. It throws a `TypeError` when the
base already defines one of the added roles.

| Group | Roles |
| --- | --- |
| Metrics and status | `gauge` (up to 8 `thresholds`), `sparkline` (1-500 `values`), `progress-bar`, `progress-ring`, `budget-meter`, `number-ticker`, `funnel` (1-12 `stages`, optional `comparison`), `poll-status` |
| Structure | `tabs` with `tab` (slot `nav`, `panel`) and `tab-panel` (`name`), `details`, `timeline` with `timeline-item` (ISO `timestamp`) |
| Charts | `series-chart` (`lr-chart`: up to 8 series over 200 categories, stacked, area, horizontal, pie, radar or a second axis), `treemap` (three levels), `sankey` (50 nodes, 200 links), `word-cloud` (200 words) |
| Data and controls | `heatmap` (matrix up to 50 by 50), `data-grid` (16 columns `c0`-`c15`, 500 rows, client-side only), `time-range` (binds `start`/`end`), `filter-bar` (up to 12 select filters, binds `value`) |
| Values and status | `format-number`, `format-date`, `relative-time`, `format-bytes` (raw values, reader-locale formatting), `callout`, `tag`, `chip`, read-only `rating`, `kbd`, `divider`, `avatar`, `avatar-group` (initials only; images are never generated) |
| More charts | `donut-chart`, `radial-chart`, `radar-chart`, `horizontal-bar`, `bar-list` (orientation fixed by the trusted adapter), `bubble-chart`, `category-bar`, `tracker` (theme colour tokens only), `chord` |
| Rich answers and controls | `markdown` (raw HTML shown as text, links and images as plain text), `context-meter`, `stream-status`, `generation-metrics`, bounded `graph` (200 nodes, 400 edges) and `mind-map`, and state-bound controls `segmented`, `toggle-group`, `checkbox-group`, `radio-group`, `number-input`, `date-input` |
| Technical answers | `code-block`, `json-viewer` (bounded JSON), `diff-view`, `test-results`, `trace-tree`, `span-waterfall` (500 spans) |
| Structure and statistics | `accordion` with `accordion-item`, read-only `tree` (three levels), `box-plot`, `histogram` (2000 values), `scatter-chart` (1000 points per series) |

`liveDashboardCatalog` (id `lyra-reviewed+dashboard/live`) narrows the overlay to
`liveDashboardRoles`: the common layout roles, `stat`, `table`, `chart`, the `slider`, `switch` and
`select` controls and the dashboard metrics, structure, chart and control roles plus number and
relative-time formatting, callouts and tags, with no actions. The full overlay is larger than one
prompt budget; select a preset or `subsetCatalog()` it per request. Controls drive other panels without a
new revision through `reads`, and host data streams reach them through `liveReads` and `.liveData`.

`mapCatalog(base, { mapStyle })` adds a `map` role (`lr-map`) with id `${base.id}+map`. The host
supplies the basemap style; the adapter assigns it as `mapStyle`, and it never appears in the prompt
or the generated schema. Generated content supplies only `label`, `center` (`[longitude, latitude]`),
`zoom` (0-22) and at most 500 labelled `markers`; marker HTML, colors, tiles and engines are refused.
With `regions: { geojson, idProperty, palette? }` (1-1000 features, each with a unique string id),
the role also accepts `choropleth: { values, interpolation? }` keyed by region id and
`choroplethLegend`; the trusted adapter builds the fill layer from the host's geometry and ascending
palette (default: the brand fill ramp tokens), and a value for an undeclared region fails closed.

```ts
import { dashboardCatalog, liveDashboardCatalog, mapCatalog } from '@aceshooting/lyra-gen/catalog.js';

const dashboard = dashboardCatalog();
const live = liveDashboardCatalog;
const geo = mapCatalog(dashboard, { mapStyle: 'https://tiles.example.com/style.json' });
```

To review a further role, `node scripts/draft-role.mjs lr-<tag>` (from the package directory of a
repository checkout) drafts an overlay from the published Lyra UI manifest: scalar members get
bounded schemas, closed unions become enums, and object data, callbacks, element references and
URL-like members are listed for review instead of being exposed. The draft is never registered;
`check:catalog` proves every overlay role against the component's declared types, and the browser
conformance suite renders each one in both directions, under reduced motion and with axe.
