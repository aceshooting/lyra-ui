# @aceshooting/lyra-gen

Generated views, interactive chat and saved/live dashboard contracts for Lyra UI. It accepts a
reviewed component catalog and bounded declarative data; the host supplies model requests, authorized
data, action handling and storage. Check the installed package's version and compatibility profile.
The [program roadmap](https://github.com/aceshooting/lyra-ui/blob/main/docs/roadmap/generative-ui.md) separates implementation from remaining
qualification, planned features and conditional work.

The package provides catalog subsets, deterministic JSON generation prompts, a restricted Markup
parser, view validation, revision-checked patches, local binding state, a browser renderer and host
persistence contracts. The [compatibility profile](docs/compatibility.md) defines the 1.x contract,
separately experimental A2UI candidate entry and 1.0 qualification status. Each protocol and
host integration retains its documented limits; API availability does not establish full protocol
conformance or qualify an application's deployment.

## Choose an integration

Requires Node ≥22 for package tooling and a compatible `@aceshooting/lyra-ui` peer. The browser
recipes use granular module imports through the application's bundler. Run repository examples
from a built workspace or adapt their source into the application.

| Task | Guide |
| --- | --- |
| Explore scripted Markets, Weather and travel budgets | [Guided demo](docs/guided-demo.md) |
| Select roles and generate prompts | [Catalog presets](docs/catalog-presets.md) |
| Stream JSON or expand keyed rows | [Structured input and templates](docs/structured-input.md) |
| Mix prose and generated views | [Interactive chat](docs/interactive-chat.md) |
| Connect an existing transport | [AI SDK](docs/ai-sdk.md), [AG-UI adapter](https://github.com/aceshooting/lyra-ui/blob/main/docs/ag-ui-adapter.md), [A2UI processor](docs/a2ui.md) |
| Run a server/client example | [Server transport](docs/server-transport.md) |
| Render, schedule and restore | [Browser rendering](docs/rendering.md), [server snapshots](docs/ssr.md) |
| Confirm an action | [Approval composition](docs/approval.md) |
| Review an external destination | [Host navigation](docs/navigation.md) |
| Save or publish a dashboard | [Host persistence](docs/dashboards.md), [executable development host](examples/saved-dashboard/README.md) |
| Filter, navigate or cite values | [Live dashboard composition](docs/dashboard-composition.md) |
| Recover or upgrade stored answers | [Recovery and diagnostics](docs/recovery-and-diagnostics.md), [catalog migrations](docs/stored-answer-migrations.md) |
| Review trust and compatibility | [Security](docs/security.md), [threat fixtures](docs/threat-matrix.md), [compatibility](docs/compatibility.md) |

## Render a validated view

Use granular entry points. Importing the package root registers no elements; `gen-view.js`
registers `<lr-gen-view>`. The browser example below uses the built-in catalog's plain text roles.
The installed package's explicit `exports` map defines the import boundary; see
[supported paths and migration](docs/compatibility.md#supported-api-boundary). Files in `examples/`
are application source recipes, not exported runtime modules.

```ts
import '@aceshooting/lyra-ui/theme.css';
import { initialCatalog, subsetCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';

const selected = subsetCatalog(initialCatalog, ['stack', 'heading', 'text']);
if (!selected.ok) throw new Error('The requested catalog is unavailable.');
const catalog = selected.value;
const result = validateView({
  version: '1', catalog: { id: catalog.id, version: catalog.version },
  surfaceId: 'answer-1', revision: 0,
  root: { id: 'summary', type: 'stack', children: [
    { id: 'title', type: 'heading', text: 'Quarterly summary' },
    { id: 'detail', type: 'text', text: 'Revenue increased this quarter.' },
  ] },
}, catalog);
if (!result.ok) throw new Error('The generated view was rejected.');

const view = new LyraGenViewElement();
view.catalog = catalog;
view.document = result.value;
document.body.append(view);
```

Catalog roles such as `text`, `input` and `chart` map to trusted tags. Generated node `type` values
are catalog roles, not arbitrary element names. Each node needs a unique explicit `id`. Structured
properties use JSON values and are validated against the selected role's schema.

### Generated typography and component parts

Generated headings and paragraphs use the Lyra typography scale and have zero margins. Set
`--lr-gen-heading-font-size`, `--lr-gen-heading-font-weight`, `--lr-gen-heading-margin`,
`--lr-gen-text-font-size` or `--lr-gen-text-margin` on the view to override these defaults.

A host can adopt its own stylesheet into the view's open shadow root. Select the generated role
with `data-gen-type` and the underlying component's documented part with `::part()`. The same
rules apply after asynchronous loading or replacement of a generated component.

```js
await view.updateComplete;
const theme = new CSSStyleSheet();
theme.replaceSync(`
  [data-gen-type="chart"]::part(data-table-toggle) { justify-self: end; }
  [data-gen-type="card"]::part(base) { border-radius: var(--lr-radius); }
`);
view.shadowRoot.adoptedStyleSheets = [...view.shadowRoot.adoptedStyleSheets, theme];
```

## Generate with a selected catalog

```ts
import { initialCatalog, subsetCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { buildCatalogPrompt, exportCatalogJsonSchema } from '@aceshooting/lyra-gen/prompts.js';

const selected = subsetCatalog(initialCatalog, ['stack', 'heading', 'text', 'button']);
if (!selected.ok) throw new Error('The requested catalog is unavailable.');
const prompt = buildCatalogPrompt(selected.value, { maxCharacters: 16_384 });
const schema = exportCatalogJsonSchema(selected.value);
// Pass prompt/schema to your host-owned generation transport.
// Validate the returned value with validateView before using it.
```

The prompt requests JSON. The exported schema describes the structural envelope; runtime
validation additionally checks identity, catalog, slot, binding and action rules. Provider support
for this JSON Schema profile must be checked by the host. `exportCatalogArtifact()` exports plain
catalog metadata without executable module loaders.

Keep numeric data as finite JSON numbers and dates as unambiguous ISO 8601 strings where the
schema admits them. The host chooses display locale and requested prose language separately.
Do not replace a numeric source value with a localized display string. Properties whose actual
component schema requires a string still use that documented type.

Property schemas are a bounded JSON Schema subset. An object schema is closed by default
(`additionalProperties: false`). For map-like input, give `additionalProperties` a value schema
together with the required `maxProperties` and `propertyNames: { maxLength }` ceilings (optional
`minProperties` and `propertyNames.minLength`). Declared `properties` keep their own schemas,
`maxProperties` counts every key, prototype-related keys are always refused, and a map key named
like a URL or navigation sink is refused by the content policy. `exportCatalogJsonSchema()` emits
the same value schema and ceilings:

```ts
const counts = { type: 'object', properties: {}, additionalProperties: { type: 'integer', minimum: 0 },
  maxProperties: 24, propertyNames: { maxLength: 32 } } as const;
```

A role can declare `hostProperties` for element properties that only its trusted
`prepareProperties` adapter supplies, such as a formatter callback. The view assigns those adapter
outputs, while generated content can neither set nor bind them, and `buildCatalogPrompt()`,
`exportCatalogArtifact()` and `exportCatalogJsonSchema()` omit them. Names must not overlap
`properties` or bindings and must not be URL or navigation sinks:

```ts
const metric = { tag: 'lr-stat', properties: { label, value }, hostProperties: ['valueFormatter'],
  prepareProperties: (props) => ({ ...props, valueFormatter: formatHostValue }) };
```

`exportCatalogSchemaForProfile(catalog, 'closed-json-v1')` returns a diagnosed result for a narrow
closed, single-leaf profile. Unsupported unions, open maps, bindings and actions are rejected by that profile.
The `json-schema-2020-12` profile preserves the full structural artifact. These names describe
schema profiles; neither name is a provider acceptance or conformance claim.

For task-specific examples, select from the same active catalog:

```ts
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { selectExamples, createExampleAblation } from '@aceshooting/lyra-gen/examples.js';

const selected = selectExamples(initialCatalog, 'data', { maxExamples: 2, maxBytes: 8_192 });
if (!selected.ok) throw new Error('Example selection failed.');
const portableExamples = selected.value.source;
const ablation = createExampleAblation(initialCatalog, ['summary', 'data']);
// Supply portableExamples as host-selected context, alongside the same prompt/schema.
// ablation is paired offline configuration, not a model run or an improvement result.
```

Supported example tasks are `summary`, `form`, `data` and `retrieval`. Selection is deterministic
and bounded by the UTF-8 size of its complete artifact. An example requiring an unavailable role
or property is skipped; the selector never broadens the catalog or grants an action/data reference.
The versioned source reuses reviewed catalog examples. `createExampleAblation()` pairs an empty
example set with the selected set and marks its configuration `measured: false`; real validity,
token and latency effects remain unmeasured until the host runs an approved campaign.

### Normalize misplaced properties

Pass `{ normalize: true }` to `validateView(input, catalog, options)` or
`createJsonViewStream({ catalog, normalize: true })` to move misplaced catalog-declared node
members into `props`. On a role without text content, a string `text` moves into the first
available declared `caption` or `description` property, including an empty string destination.
Each move produces a `node.normalized` warning at the original JSON Pointer, subject to the
diagnostic limit. Existing conflicting properties, unknown members and invalid values still
fail ordinary validation. The input stays intact. Strict placement is the default.

## Parse restricted Lyra Markup

```ts
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { parseMarkup } from '@aceshooting/lyra-gen/parser.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';

const parsed = parseMarkup(
  '<stack id="root"><text id="greeting">Hello &amp; welcome</text></stack>',
  { catalog: initialCatalog, surfaceId: 'answer-2', revision: 0,
    allowedTags: Object.keys(initialCatalog.components) },
);
const validated = parsed.status === 'complete' && parsed.view
  ? validateView(parsed.view, initialCatalog)
  : undefined;
```

Parsing checks syntax; a complete parse still needs catalog/runtime validation. Strings are
quoted, booleans and numbers use JSON braces (`disabled={false}`), and objects use a JSON object
inside those braces (`action={{"name":"save","payload":{}}}`). No JavaScript is evaluated.
See [RFC 0006](https://github.com/aceshooting/lyra-ui/blob/main/docs/rfcs/0006-lyra-markup.md) for escaping, limits and exact grammar.

`createMarkupParser()` buffers a bounded document and exposes its view at `finish()`.
`createIslandParser()` from `islands.js` preserves prose and publishes complete fenced `lyra`
islands as closing fence lines arrive. An unfinished island stays inert. These APIs do not render
each partial opening tag or guess missing identities.

For complete JSON streams and explicit-key repeated rows, see
[structured input and templates](docs/structured-input.md). Neither route exposes partially
validated controls or grants data/action authority.

## Structured charts and tables

Converters in `converters.js` validate typed data instead of embedding a JSON string in a
component property. For example:

```ts
import { chartToView } from '@aceshooting/lyra-gen/converters.js';

const chart = chartToView({
  label: 'Monthly orders', type: 'bar', labels: ['January', 'February', 'March'],
  series: [{ label: 'Orders', values: [12, null, 18] }],
}, { surfaceId: 'orders', nodeId: 'monthly-orders', revision: 0 });
if (!chart.ok) throw new Error('Chart data was rejected.');
// Assign chart.value to a view using initialCatalog.
```

`chartToView()` / `viewToChart()` preserve numeric values and missing observations. A table uses
`tableToView({ caption, columns, rows })`, with each column declaring `key`, `label`, `type` and
optional `nullable`. Its result is an artifact containing `.view` plus preserved column metadata;
`viewToTable(artifact)` restores the typed source shape. Keep that metadata beside the view if a
round trip is needed. Limits include 16 table columns, 200 rows/categories and 8 chart series. For locale-aware numeric
and ISO-date column display, see [typed values](docs/dashboard-composition.md#typed-values-and-source-details);
formatting keeps raw source values intact.

## Browser contract

Set `.document` to a `LyraGenView` and `.catalog` to its trusted catalog. `.bindingState` supplies
JSON values for declared bindings. A node's `reads` maps a declared, non-URL property to a state
path that a binding in the same view owns, so a slider bound to `/limit` can drive a sibling
gauge or stat live without a new revision; a read value applies only while it satisfies the
property schema, otherwise the node's own `props` value stays. `.controlled` selects host-controlled state; listen for
`lr-gen-state-change` and supply the accepted state. `.enabledActions` can restrict available
catalog actions further. `.confirmAction(action, signal)` supplies host approval for catalog
actions marked `confirm`. The [approval example](docs/approval.md) connects that callback to a
real `lr-confirm-bar`. Set `.limits` to lower admission ceilings; overrides cannot exceed the
runtime hard limits.

The view emits `lr-gen-action` with `{ surfaceId, nodeId, revision, name, payload }`,
`lr-gen-state-change` with `{ surfaceId, revision, nodeId, values, dirty }`, and `lr-gen-error`
with `{ diagnostics }`. Rendering never performs the application's action. `reset()` resets the
rendered native form state. Preserve surface and node identities when replacing a view so retained
state belongs to the same logical controls.

Read-only `.status` is `empty`, `loading`, `ready`, `error` or `interrupted`; `.busy` is true during
loading and is reflected through host `aria-busy`. `lr-gen-ready` carries `{ surfaceId, revision, changes? }`
once after that accepted revision's encountered modules and generated child updates settle.
`changes` (absent for a surface's first ready revision) lists the node ids `added`, `changed` and
`removed` since the previous ready revision, as `diffViews(previous, next)` computes; the added
and changed components also carry the unstyled `changed` part until the next ready revision, so a
host can highlight a refinement with `lr-gen-view::part(changed)` (honor `prefers-reduced-motion`).
It does not certify remote resources fetched independently by a child.
`elementForNode(nodeId)` returns a node's rendered element in the current revision (or
`undefined` while it is unknown, loading, failed or isolated); every rendered element also carries
`data-gen-id` and `data-gen-type`, and keeps its identity across revisions and keyed reorders. Readiness does not move
focus or announce completion automatically; the chat host decides its completion announcement.

`createTypedCatalog()` from `typed-catalog.js` preserves action names and payload types from const
definitions, and optionally infers state from a supplied schema. `.action(name, payload)` and
`.parseState(input)` still perform runtime validation. Static inference cannot enforce numeric or
resource bounds and never replaces runtime admission or host authorization.

```ts
import { createTypedCatalog } from '@aceshooting/lyra-gen/typed-catalog.js';

const typed = createTypedCatalog({
  id: 'app-summary', version: '1',
  components: { text: { tag: 'p', properties: {}, text: true } },
  actions: { save: { payload: { type: 'object', properties: {
    query: { type: 'string', maxLength: 128 },
  }, required: ['query'], additionalProperties: false } } },
});
const action = typed.action('save', { query: 'Recent orders' });
// Unknown action names and wrong payload types are TypeScript errors; bounds are checked at runtime.
```

Diagnostics have a stable code, a JSON Pointer path, severity and a safe explanatory message;
source parsers can also provide original UTF-16 offsets. Keep diagnostics for developer review
and present localized application recovery text to users.

## CLI and replay

From a built repository checkout:

```sh
node packages/lyra-gen/bin/lyra-gen.mjs help
node packages/lyra-gen/bin/lyra-gen.mjs validate packages/lyra-gen/examples/fixtures/support-chat.json
node packages/lyra-gen/bin/lyra-gen.mjs benchmark --iterations 100 --format both
```

The CLI defaults to the full catalog; `--preset` selects a [reviewed request catalog](docs/catalog-presets.md)
for prompt, schema, validation, recording and replay. `prompt` emits generation instructions; `schema` exports
its structural schema; `validate` accepts a file or `-` for standard input. `record` and `replay`
operate on a validated-source `ReplayRecord`, not a timed chunk recording. Invalid input exits
nonzero. The offline benchmark measures parsing/validation, not provider or browser performance.

For timed browser playback, `replay.js` provides `parseReplayRecording()` and
`replayRecordedChunks(recording, onChunk, { signal })`. It validates bounded versioned
`ReplayRecording` data, then invokes the synchronous callback at its original offsets. Abort
stops pending playback; reset or disposal must abort before replacing the parser/controller.
The [recording](examples/recordings/chat-review.v1.json),
[browser composition](examples/recorded-replay.ts) and Storybook **Recorded Cadence** scene use
authored synthetic text and offsets, not provider output or latency. See the
[measurement guide](https://github.com/aceshooting/lyra-ui/blob/main/benchmarks/generative-ui/README.md) for workloads, visual checks and
measurement limits. The [OpenUI experiment](docs/openui-experiment.md) remains a separate no-go
runtime-importer result.

## Dependencies

Runtime dependencies are `lit` for rendering and `tslib` for emitted TypeScript helpers.
`@aceshooting/lyra-ui` is a required peer used by the browser view and the built-in catalog's
component loaders. Check this package's `package.json` for the supported peer range. The parser,
schema and runtime modules do not require a model-provider SDK or a protocol runtime dependency.

There is no telemetry collector or automatic model request. The host chooses provider transport,
logging, analytics and persistence. Trusted catalog loaders and application callbacks can load
modules or contact services; review them as application capabilities. See the repository's
dependency inventory and license tooling for the complete resolved development graph.

Lyra Gen is MIT licensed. It is an optional companion for applications using Lyra UI; Lyra UI
remains independently usable and never imports this companion.
