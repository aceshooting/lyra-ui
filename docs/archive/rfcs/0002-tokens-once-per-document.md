# Archived: RFC 0002: Declare design tokens once per document

Moved from [0002-tokens-once-per-document.md](../../rfcs/0002-tokens-once-per-document.md); history before 30.0.0, not current guidance.

## Appendix A: evidence summary

**Method.** [`0002-evidence/README.md`](../../rfcs/0002-evidence/README.md) defines the variants and the
harness; [`results.md`](../../rfcs/0002-evidence/results.md) has every table. In short: `theme.css` is loaded;
N elements cycle through `lr-button` (brand), `lr-input` (label, placeholder), `lr-card`, `lr-badge`
(success), `lr-icon` and `lr-switch` (checked), six to a flex row; the "no card" mix drops
`lr-card`. A batched insert sets `innerHTML` once (`setHTMLUnsafe()` for application shadow roots,
written as declarative shadow DOM on plain hosts); streamed rows append one row at a time and force
style and layout after each. Metrics: insert to first full style and layout (through every
`updateComplete` to a forced `offsetHeight`); the deferred flush (the final forced style and layout
alone); Chromium's `RecalcStyleDuration`; a re-theme (one change on `<html>` and a forced flush,
median of 7 toggles: `data-lr-theme` light/dark, an inline accent input, an inline spacing input);
and growth in proportional set size over the browser's process tree (Chromium collects garbage
first). Each measurement uses a fresh browser; variant order alternates between runs; tables give
medians with interquartile ranges.

**Machine.** Intel Core i7-7820X (8 cores, 16 threads, 3.6 GHz), 61 GiB RAM, Linux 7.0, Node
22.23.2, Playwright 1.63.0 with Chromium 153.0.8010.12 (headless shell), Firefox 155.0 and WebKit
26.6. The machine was shared with other work in every run; treat single-digit differences as noise
unless the interquartile ranges separate. Memory growth is not sensitive to load.

| Run | Scenario | Variants | N | Load average |
|---|---|---|---|---|
| 1 | Six-type mix, batched insert (7 runs per cell) | A, B | 200, 1,000, 3,000 | 3–5 |
| 2 | No `lr-card`, rows streamed | A, B | 1,000, 3,000 | 12–21 |
| 3 | No `lr-card`, batched insert | A, B | 1,000, 3,000 | 9–16 |
| 4 | No `lr-card`, rows streamed | A, B, D | 3,000 | 7–9 |
| 5 | Six-type mix | A, C | 1,000, 3,000 | 10–45 |
| 6 | 50 nested scopes (ten chains of five) | A, D | 1,000, 3,000 | 9–20 |
| 6b | The same, Chromium only | A, D | 1,000 | about 23 |
| 7 | Six-type mix | A, E | 1,000, 3,000 | 8–14 |
| 8 | 50 nested scopes | A, E | 1,000, 3,000 | 8–32 |
| 9 | A scope on every row | A, E | 1,000, 3,000 | 32–39 |
| 10 | Every row in an application shadow root, adoption into every root | A, E | 1,000, 3,000 | 14–39 |
| 11 | As 10, each application host also a scope | A, E | 1,000, 3,000 | 6–14 |
| 12 | As 10, adoption only where a scope needs it (the proposal) | A, E | 1,000, 3,000 | 5–13 |

Runs have 5 runs per cell unless noted. Runs 7–11 and the first-adoption measurement used the E
build before the `.light` and `.dark` scopes and on-demand adoption were added; none of their pages
contains a `.light` or `.dark` element, and Run 10 is the adopt-everywhere behaviour that the final
build reproduces with `--foreign-always`. Run 12, the parity matrix and the structure counts used
the final build. Results files from Run 7 on record their bundle hashes, page parameters and load
averages; every run used one source commit.

**Structure** (custom properties a host declares rather than inherits; identical in the three
engines, except that Firefox counts 560 on E's root):

| Variant | On `:root` | `lr-button` | `lr-input` | `lr-card` | `lr-badge` | `lr-icon` | `lr-switch` |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 273 | 339 | 310 | 290 | 316 | 289 | 304 |
| D | 559 | 53 | 24 | 4 | 30 | 3 | 18 |
| E | 561 | 53 | 24 | 4 | 30 | 3 | 18 |

**Input consumption** (`analyze-inputs.mjs`: 1,459 built modules, 296 distinct CSS texts parsed with
postcss). The shared sheets declare 293 names and read 216 inputs (215 in the layer, one
host-local); the specialist sheet reads 48; component sheets read 11 directly; no component sheet
declares a shared name.

**Other.** In Chromium, the first render of 600 instances of one type forces one style recalculation
for `lr-button`, `lr-input`, `lr-badge` and `lr-icon`, two for `lr-switch`, and 1,800 (with 601
layouts) for `lr-card`, which derives its accessible text from computed style during its first
update, in A and in the prototypes alike.
