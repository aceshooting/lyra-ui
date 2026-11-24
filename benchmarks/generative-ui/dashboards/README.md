# Dashboard generation format benchmark (offline)

A reproducible harness that compares four encodings of the same authored dashboards. It is
**offline, synthetic, and has no model in the loop**: no provider is contacted, nothing is generated,
and no result says how well any model writes these formats.

Formats compared for each of 13 scenarios (KPI overview, ops latency, funnel, sales without geography,
incident timeline, what-if slider to gauge with `reads`, live `liveReads` metrics, filters and data
grid, heatmap, sankey, tabs with charts, quota meters, and a refinement that adds a panel):

| Id | Encoding | Streaming consumer |
|---|---|---|
| `json` | lyra-gen JSON view, compact | `createJsonViewStream` (commits at finish) |
| `markup` | Lyra Markup | `createMarkupParser` (commits at finish) |
| `json-patch` | RFC 6902 operations, one per line, over a flat `{ root, elements }` map | harness-local line consumer |
| `statements` | one `name = Component(args)` line per node, positional arguments, forward references | harness-local line consumer |

The last two encoders and their consumers are minimal originals written for this comparison; they share
no code with, and are not implementations of, any third-party grammar.

## Run

```sh
pnpm --filter @aceshooting/lyra-gen build        # the harness imports packages/lyra-gen/dist
node benchmarks/generative-ui/dashboards/run.mjs \
  --output=dashboards-report.json --markdown=dashboards-summary.md --samples=5 --chunk=24
node --test benchmarks/generative-ui/dashboards/run.test.mjs
```

Options: `--samples` (timing repetitions, default 5), `--chunk` (code units per streamed chunk, default 24),
`--scenarios=id,id` (subset). Output files must not already exist; with neither output option the
Markdown summary prints to stdout. Run on a quiet machine with the pinned Node version for timings;
bytes, token estimates and validity are deterministic.

## What is measured

- **Size**: UTF-8 bytes and an approximate token count. The tokenizer is `heuristic-v1` (see
  `tokens.mjs`): a byte-pair-style pre-split with per-class piece estimates, next to a `bytes / 4`
  baseline. Neither is a provider token count and neither was calibrated against a provider.
- **Streaming validity**: every format is fed chunk by chunk; the result is checked with `validateView`
  and compared by deep equality with the authored view (round trip).
- **Time to first valid partial render**: cumulative consumer time (parse, partial build and
  validation, no generation or network time) until the first tree that passes `validateView`, plus the
  chunk index and the fraction of the stream consumed. The lyra-gen JSON and Markup parsers admit
  nothing before finish, so for them this equals completion; the line formats admit a root early.
- **Parse and validation time**: total consumer time, standalone `validateView` time, and their sum
  (JSON streaming validates inside `finish`, which is flagged in the report).
- **Corrupted views**: six deliberate corruptions per scenario run through strict validation, isolate
  recovery, and `createRepairRequest` plus `LyraGenRepairSession` using an oracle replacement of the
  original node. This exercises repair scope and refusal rules, not the quality of any real repair.
- **Damaged streams**: each format truncated at 60 percent and with three stray characters at the
  midpoint. A truncated line-based stream can still be a valid, smaller dashboard; the report shows
  that validity alone does not prove completeness.
- **Refinement**: delta bytes and tokens for adding one panel versus regenerating the whole view, with
  each delta verified to reproduce the refined view.

The report (`lyra-gen-dashboard-benchmark`, version 1) contains the limits verbatim; the Markdown
summary repeats them above the tables.
