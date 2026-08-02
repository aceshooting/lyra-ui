# Support policy

What "supported" means for `@aceshooting/lyra-ui`: which browsers, which Node versions, which
assistive technologies, and what evidence stands behind each answer.

Two categories run through this page and they are not the same thing:

- **Proven** — a CI job runs on it, on every commit, and a failure blocks the merge. The job is
  named.
- **Supported** — inside the compatibility window: a bug report against it is a bug we intend to
  fix. Not the same as tested.

Nothing on this page is proven by a human using the software. See
[`docs/accessibility.md`](accessibility.md) for the accessibility half of that admission.

---

## Browsers

| Engine | Supported from | Proven by CI |
|---|---|---|
| Chrome / Edge (Chromium) | **120** | Current stable — full test suite (CI `build-and-coverage`) |
| Firefox (Gecko) | **121** | Current stable — contract subset (CI `platform-contracts`) |
| Safari (WebKit) | **16.4** | Current stable — contract subset (CI `platform-contracts`) |
| Anything without native Custom Elements v1 + Shadow DOM (Internet Explorer, legacy Edge) | Not supported | — |

Mobile equivalents track their desktop engine: Chrome for Android ≥ 120, Safari on iOS ≥ 16.4.

**The floor is derived, not tested.** CI only ever runs the engines' *current stable* builds. The
version numbers above come from the platform features this library's source actually uses — Lyra
ships untranspiled ES2022 modules with no polyfills and no build-time downleveling, so a runtime
feature the source uses is a hard floor:

| Feature | Uses in `src/` | Raises the floor to |
|---|---|---|
| `color-mix()` | 422 | Chrome 111 · Safari 16.2 · Firefox 113 |
| `:dir()` | 109 rules across 47 stylesheets | **Chrome 120** · Safari 16.4 · Firefox 49 |
| `:has()` | 12 rules | Chrome 105 · Safari 15.4 · **Firefox 121** |
| `@container` / `container-type` | 79 / 56 | Chrome 105 · **Safari 16** · Firefox 110 |
| `ElementInternals` form association | 268 `attachInternals()` call sites | Chrome 77 · **Safari 16.4** · Firefox 98 |
| `inert` | widely, incl. the overlay manager | Chrome 102 · Safari 15.5 · Firefox 112 |
| `@layer` | the token cascade | Chrome 99 · Safari 15.4 · Firefox 97 |
| ES2022 output (`tsconfig` `target`) | the whole package | Chrome 94 · Safari 15.4 · Firefox 93 |

`:dir()` and `:has()` are what set the Chromium and Gecko numbers; `ElementInternals` and
`@container` set the WebKit one. If any of those three lines moves, the window moves with it and
this table has to move in the same pull request.

There is deliberately **no `browserslist` field** in either package. A browserslist implies a build
step that targets it; this package has none, so the field would describe nothing and drift silently.
This table is the support window.

### What the CI matrix actually runs

`.github/workflows/ci.yml` is authoritative. Today:

- **`build-and-coverage`** — the complete `@web/test-runner` suite on Chromium (Playwright's pinned
  build), plus coverage floors, SSR render matrix, and DSD hydration.
- **`platform-contracts`** — a matrix of `{firefox, webkit} × Node {20, 22}` running
  `pnpm test:platform`, a curated subset of the suite (form association, the overlay manager,
  overlay components, the form-control family, menu, split panel, tab group, tree, carousel, table,
  virtual list). The exact file list is the `test:platform` script entry in
  `packages/lyra-ui/package.json` — that entry, not this sentence, is the definition.

Firefox and WebKit therefore have **contract-level** coverage, not full coverage. One known,
deliberate gap: WebKit silently drops a programmatic `addRange()` into a shadow tree, so
cross-shadow text selection is unverified there. Every selection-dependent test file currently sits
outside `test:platform`, which is why the gap is latent rather than red. Adding one of those files
to the matrix requires a WebKit guard first.

---

## Node

| | |
|---|---|
| Supported | **≥ 20** (`engines.node` in both packages) |
| Proven by CI | Node 22 on every primary job; Node 20 **and** 22 on `platform-contracts` |
| Module format | ESM only. No CommonJS entry point, no `require()` path. |

Node matters for two things: building/testing this repository, and server-side rendering. The SSR
entry points (`@aceshooting/lyra-ui/ssr.js`, `ssr-loader.js`) are exercised on Node by
`test:ssr` and `test:hydration` in the `build-and-coverage` job. Browser-only capabilities begin
after hydration.

When a Node major reaches end-of-life upstream, dropping it here is a **semver-major** change for the
package, made together with an `engines.node` bump and an entry in this document.

---

## Assistive technology

| Assistive technology | Pairing | Verified |
|---|---|---|
| NVDA | Firefox / Chrome on Windows | **No** |
| JAWS | Chrome / Edge on Windows | **No** |
| VoiceOver | Safari on macOS / iOS | **No** |
| Narrator | Edge on Windows | **No** |
| Orca | Firefox on Linux | **No** |
| TalkBack | Chrome on Android | **No** |
| Dragon / voice control | any | **No** |
| Windows High Contrast (`forced-colors`) | Edge / Chrome / Firefox | **No** |

**No assistive technology has been verified against this library, in any pairing, and no such
verification is on record.** That is the complete state of it — not "pending", not "informal",
not "spot-checked". No screen reader runs in CI, and axe-core is a static rule engine that does not
approximate one.

What exists instead is documented in [`docs/accessibility.md`](accessibility.md): per-component
axe-core assertions, contrast and target-size gates, and a written role/name/state contract. Those
raise the floor; they do not substitute for a row in the table above.

**Changing a row to "Yes" requires a record**, not a recollection: the AT version, the browser
version, the OS, the date, the components exercised, and the findings — published here. Until a
release carries that record, the honest answer stays "No", and the project makes no screen-reader
support claim in its README, marketing, or release notes.

If you use one of these pairings, a bug report from you is the only mechanism that currently exists
for finding these defects. See "Reporting an accessibility bug" in
[`docs/accessibility.md`](accessibility.md#reporting-an-accessibility-bug).

---

## Engines outside the window

For a browser older than the floor above, or one with no native custom elements at all:

- **No fix is guaranteed.** An issue may be closed as out of window.
- **No polyfills ship.** The package will not add `@webcomponents/webcomponentsjs`, a `color-mix()`
  shim, or a transpiled legacy build. Applications that need one load it themselves, before Lyra's
  modules.
- **A pull request is welcome only if it is free** for in-window engines: no extra bytes in the
  default path, no extra runtime branch on a hot path, no second code path to maintain. A CSS
  `@supports` fallback usually qualifies. A JavaScript feature test usually does not.
- **Reporting still helps.** A report that names the exact failing feature is how the floor above
  gets corrected when it is wrong.

### When a `@supports` fallback may be dropped

A `@supports` guard exists to keep something usable on an engine that lacks the feature. It may be
removed when — and only when — **every engine in the support window above supports the guarded
feature unprefixed and unflagged**, i.e. the feature's support floor is at or below the Chrome 120 /
Firefox 121 / Safari 16.4 line.

Concretely:

1. Check the feature's per-engine availability (MDN's browser-compatibility table or the Baseline
   status; cite it in the pull request).
2. If any of the three window floors predates that availability, the guard **stays**. Raising the
   window to justify removing a guard is a legitimate move, but it is the window change that must be
   argued and versioned, not the guard removal.
3. If all three clear it, drop the guard and say so in the changeset. This is not a breaking change
   for in-window engines — by construction nothing rendered by them changes — so it belongs in a
   minor or patch release.
4. Never replace a `@supports` guard with a JavaScript feature test to sidestep this rule. The guard
   is cheaper and it fails in the right direction.

Do not add a `@supports` guard for a feature every in-window engine already has: it is dead weight
that reads as a live compatibility concern. The single guard in the library today
(`@supports (max-block-size: 1dvh)` in `lr-responsive-panel`) exists because the `dvh` unit fails at
computed-value time on engines that lack it, which resets `max-block-size` to `none` rather than
falling back gracefully — that is the shape of case the guard is for.

---

## Changing this window

Raising any floor in the browser table, or `engines.node`, is a **semver-major** change for the
affected package. It lands with:

- the version bump and a changeset entry saying which engines left the window and why;
- this document updated in the same pull request;
- the root README's "Browser & Node support" section updated to match.

Lowering a floor (widening support) is a minor change and needs whatever guard or fallback makes the
claim true, plus a test that proves it.

---

## Related

- [`docs/accessibility.md`](accessibility.md) — what is enforced mechanically, what is not, and how
  to report an accessibility bug.
- [`SECURITY.md`](../SECURITY.md) — which released versions receive security fixes, and how to
  report a vulnerability privately.
- [`packages/lyra-ui/llms/shared.md`](../packages/lyra-ui/llms/shared.md#component-status-versioning-and-deprecation)
  — component status, semver, and the deprecation window.
- [`docs/agents/component-qualification.md`](agents/component-qualification.md) — the internal
  evidence a component must show before claiming `stable`.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — the authoritative job list behind every
  "Proven by CI" cell above.
