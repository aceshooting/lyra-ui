# Synthetic workloads

The fixture loads the configured built Lyra UI package through its stable component imports.
`catalog.mjs` defines scenario IDs, profiles, numeric parameters, checks, metric keys, and fixed
error codes. The runner controls repetition: one warmup and seven measured samples by default.
`window.__benchmark.run(id, { sampleIndex, warmup })` returns one JSON-compatible sample.

Setup creates the component, data, labels, and callback functions before the measured operation.
The same component is reused across samples of one scenario. Switching scenarios removes it and
prepares a fresh fixture. Two preallocated input identities alternate so an assignment exercises
the collection setter instead of a same-reference early return. No component methods are replaced.

## Timing phases

| Metric | Interval |
| --- | --- |
| `assignmentMs` | Synchronous public property writes or DOM activation, with input allocation already complete. |
| `updateMs` | Option-child updates where applicable, then the owner's Lit update and a microtask checkpoint. |
| `settleMs` | Two task turns, each followed by pending component updates. |
| `paintMs` | Two animation-frame callbacks after settling. This measures frame scheduling, not GPU time or a guaranteed presentation timestamp. |
| `totalMs` | The sum of these phases, from the first write to the second frame callback. |

The corresponding `noop*` metrics repeat the same waiting sequence without a property write.
The standalone `noop-control` uses an ordinary element. Synchronous elapsed time is wall-clock
time, not an isolated CPU measurement. Timer clamping, frame scheduling, garbage collection, and
the waiting machinery contribute to the readings; compare the raw distributions and controls
instead of blindly subtracting a baseline. Hidden pages fail with `PAGE_NOT_VISIBLE`.

Semantic checks run after the measured operation and before its matched no-op. Failure results use
fixed error codes and boolean checks; exception messages and stacks are not serialized.

## Scenarios

- **Table assignment:** 1,000 and 10,000 preallocated records, three columns, and the default
  100-row page. Checks inspect all rendered cells through the public `cellElement()` method and
  match their DOM order to the expected sequence with `rowElement()`.
- **Table sorting:** a fixed 10,000-record input with permuted numeric amounts alternates
  `sortDir` on the `amount` column. The full public `viewRows` sequence must match an independently
  precomputed numeric-position oracle in each direction, and all 100 rendered rows must match it.
- **Table filtering:** a fixed 10,000-record input alternates `filterText` between two group
  labels, each matching 1,000 records through the default text filter. The full public `viewRows`
  sequence and 100 rendered rows must match precomputed group-membership oracles. Source creation,
  oracle construction, and expected-page slicing are outside both operation timings.
- **Million-record boundary:** a one-million-record input tests the current 10,000-record snapshot
  limit and its public `rowsTruncated` signal. It does not claim that the whole input is rendered,
  filtered, or exported. The two arrays share records beyond the accepted prefix.
- **Million-record paging:** a complete caller-owned dataset provides precomputed 100-row pages
  from its beginning and end. Server pagination and sorting preserve the declared million-record
  total while only the selected page reaches the component. Dataset creation and page slicing are
  setup work, so this measures page application rather than backend or caller query performance.
- **Chart assignment:** one numeric bar series with 1,000 or 10,000 retained records. Checks use
  Chart.js's public `Chart.getChart()` lookup, confirm the current 1,000-record plot/table budget,
  and verify all sampled values plus the first and last category. Canvas backing/display dimensions
  and the peer's chart area must be positive; an untimed raster check rejects transparent or
  uniform canvases. Animation is disabled explicitly.
- **Chart label update:** unchanged 1,000-record chart data with an alternating accessible label.
  `formatterTableCalls` counts public formatter invocations for the table surface. The count is
  evidence to compare, not a minimum requirement: avoiding unnecessary calls is a valid improvement.
  The generated accessible table remains mounted throughout.
- **Option metadata:** closed select and combobox controls with 100, 1,000, or 5,000 existing
  options. Every option receives a preallocated explicit label. Checks verify every public label
  and the owner's displayed selection, chosen from the end of the catalog. Element creation,
  popup opening, and transition durations are outside this workload.

The quick profile includes the scheduling control, both ordinary table sizes, table sorting and
filtering, the 1,000-record
chart workloads, and both controls at 100 and 1,000 options. Stress includes these scenarios plus
the million-record boundaries, the 10,000-record chart, and both 5,000-option catalogs. There is
no million-option or million-row DOM workload.

- **Document-library filtering:** 10,000 compact records alternate the public `searchTerm`
  between two groups with 1,000 matches each. Independent precomputed pages verify all 100
  mounted rows, sorted by name, while checking full input retention and filtered table membership.
- **Eval-dataset selection:** 10,000 examples with one shared tag alternate actual clicks on the
  first two table rows. Checks require the public selection event, selected row state, full input
  retention, and the default 100-row page.
- **Retrieval selection:** 10,000 chunks share one immutable source record and omit optional
  metadata to minimize deep input work. Input count and admitted count are checked separately;
  a release with stricter admission may retain a smaller prefix. Click the first visible
  checkbox to alternate selection; check event chunk identity, public selected IDs, checked state,
  a virtual-list count matching the reported retained chunks (9,999–10,000), and at most 40
  mounted inspectors.
- **Ingestion progress:** two preallocated 5,000-item arrays differ only in the first record's
  progress (40/41); the other 4,999 record identities remain shared. Assignments check full
  retention, visible document/stage/progress, and at most 40 mounted rows.

All four list scenarios run in both profiles. Nested tables, virtual lists, and their rendered
controls finish their Lit updates before validation. These workloads serialize public semantic
counts; component-private mechanism counters belong to deterministic scale tests.
`window.__benchmark.check(id)` performs setup and both alternating actions with the same semantic
checks but without collecting timing metrics. Use it for compatibility smoke checks before a
comparable baseline/candidate measurement. Input construction and page oracles stay outside actions.

For a known retrieval admission boundary, semantic smoke accepts an explicit
`check(id, { expectedRetained })` expectation and returns it alongside actual counts. This changes
only smoke validation. Measured retrieval runs keep the same complete 10,000-row input and
accept the narrow documented 9,999–10,000 admitted range; samples report the actual retained count.
Before measuring, candidate semantic smoke must pass its default strict 10,000 expectation, while
a baseline known to retain 9,999 uses that explicit smoke expectation. Other workloads require exact
full retention. Retained counts remain visible in result samples and are never inferred from input size.
