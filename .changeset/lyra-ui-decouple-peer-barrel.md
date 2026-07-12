---
"@aceshooting/lyra-ui": major
---

**Breaking:** the root `@aceshooting/lyra-ui` entry point no longer re-exports or
side-effect-registers the optional-peer-dependent component families — `<lyra-chart>`
and its typed subclasses, `<lyra-box-plot>`, `<lyra-histogram>`, `<lyra-map>`, and
`<lyra-graph>`. Import each of these directly from its own subpath instead (the README
already recommends granular subpath imports as the primary pattern):

```js
import '@aceshooting/lyra-ui/components/chart/chart.js';
import '@aceshooting/lyra-ui/components/map/map.js';
```

Why: the root barrel previously re-exported every component's public API from one
`lyra.ts` file, so TypeScript had to resolve `chart.js`/`maplibre-gl`/`d3-force`'s type
declarations even for a consumer who only imports an unrelated component (e.g.
`LyraEmpty`) from the package root — a hard compile error for anyone who hadn't
installed every optional peer. Splitting these families out of the root barrel means
importing `@aceshooting/lyra-ui` (or any of its remaining members) never requires an
optional peer's types to be resolvable.

Every other component (including `<lyra-lite-chart>`, which has zero peer
dependencies) is unaffected — the root barrel still re-exports/registers everything
else exactly as before.
