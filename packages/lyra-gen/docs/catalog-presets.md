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

Build the package first. The [checked report](../scripts/fixtures/catalog-preset-prompts.json) includes prompt UTF-16/code-point counts, UTF-8 bytes and SHA-256; compact serialized-schema bytes and SHA-256; and their combined content bytes. Trailing newlines, provider wrappers and request metadata are excluded. Provider tokens and model error rates remain unmeasured; smaller content does not establish token, quality, latency, caching or cost improvements.
