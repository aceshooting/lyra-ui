# Developer tools

Three additions make a generated dashboard easy to build, observe and start without a backend or a model.

## Mock data

```ts
import { createMockQueryProvider, mockLiveData, mockQueryResult } from '@aceshooting/lyra-gen/mock-data.js';

view.catalog = catalog;
view.liveData = mockLiveData(document, catalog, { seed: 1 });
view.queryProvider = createMockQueryProvider(catalog, { seed: 1, latencyMs: 200 });
```

- `mockQueryResult(catalog, name, params, { seed })` returns sample JSON for a declared query. It satisfies the query's `result` schema: string lengths, numeric ranges, integer rounding, `minItems`/`maxItems`, enums, `anyOf` and bounded maps. A query without a `result` schema takes its shape from the nodes that display it when you pass `{ view }`, otherwise it is `{}`. An undeclared name returns `undefined`.
- `mockLiveData(view, catalog, { seed })` builds the object for `lr-gen-view.liveData` from every `liveReads` pointer of nodes without a `dataQuery`, shaped by the target property schemas, and from live `repeat` lists (items carry unique keys and the template's `itemReads`).
- `createMockQueryProvider(catalog, options)` returns a function usable as `queryProvider`. It rejects undeclared queries, honours `signal` and can simulate `latencyMs`.
- Output depends only on the seed, the catalog and the inputs; `itemCount` (default 4) sets array sizes within their declared bounds. Mock data is for development: it respects schemas, not business meaning.

## Telemetry

```ts
import { createGenTelemetry, observeGenView } from '@aceshooting/lyra-gen/telemetry.js';

const telemetry = createGenTelemetry({
  onSpan: span => tracer.startSpan(span.name, { startTime: span.startTime, attributes: span.attributes }).end(span.endTime),
  onMetric: metric => counter(metric.name).add(metric.value, metric.attributes),
  onUsage: usage => billing.add(usage),
});
const parsed = telemetry.time('parse', () => parseGeneratedSource(text, 'json', catalog));
const observation = observeGenView(element, telemetry); // lr-gen-ready, -error, -state-change, -action
observation.markRequest(); // start of the next revision's latency
telemetry.recordUsage({ inputTokens, outputTokens, model }); // provider-reported values pass through
```

Spans are OpenTelemetry-shaped (`name`, `startTime`, `endTime` in epoch milliseconds, `durationMs`, `status`, `attributes`) so a host forwards them to any tracer; lyra-gen depends on none. Phases are `parse`, `validate`, `preview`, `repair` and `render`. `observeGenView()` reports a `lyra.gen.revision` span (with added, changed and removed counts) on ready, a `lyra.gen.error` span with diagnostic codes and counts, and `lyra.gen.state_change` and `lyra.gen.action` counters.

Attributes never carry state values, prompts or user text: only numbers, booleans and short identifier-like strings (ids, codes, sizes) are kept and everything else is dropped. A throwing callback never breaks rendering.

## `lyra-gen init`

```bash
npx lyra-gen init my-dashboard
cd my-dashboard && npx serve .   # any static server
```

Writes `index.html` (import map and `<lr-gen-view>`), `main.js` (the live-dashboard catalog, a fake provider that streams a canned view one revision at a time, mock live data and `createMockQueryProvider`), `dashboard-view.json` and `queries.json`. The import map loads packages from a CDN; point it at `node_modules` or use a bundler for production. The command refuses to overwrite any existing file and writes nothing in that case.
