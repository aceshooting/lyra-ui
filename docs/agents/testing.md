# Testing conventions — lyra-ui agent reference

> Detail behind the "Testing conventions" digest in [AGENTS.md](../../AGENTS.md).

Native mouse tests import `sendMouse`, `resetMouse`, `sendWheel` and `hoverUntilMatched` from
`packages/lyra-ui/test/wtr-mouse.ts` through their relative `.js` path. The shared helper orders
native actions and tracks held buttons. `resetMouse()` releases only those buttons, then moves the
pointer to the origin; it preserves keyboard focus and does not synthesize idle button releases.
An unpressed middle-button release can paste Linux primary-selection text into a focused input.
Do not mix the shared helper with `@web/test-runner-commands` mouse imports, which bypass its
button tracking. Keyboard commands such as `sendKeys` continue using that package.

- **Stack:** `@web/test-runner` (`wtr`) + `@web/test-runner-playwright` (Chromium launcher) +
  `@open-wc/testing` (`fixture`, `expect`, `oneEvent`, and axe accessibility assertions via
  `expect(el).to.be.accessible()`).
- **TDD, failing-test-first.** Every behavior change starts with a test that fails for the right
  reason. Commit after each green step.
- Test files are colocated siblings:
  `src/components/<family>/<name>/<name>.test.ts`. Run via `pnpm test` from repo root (fans out to
  every package) or `packages/lyra-ui/` for just this package;
  `pnpm test:watch` for iteration.
- **The complete test tree is a blocking strict-TypeScript surface.** Run `pnpm run
  check:test-types` from `packages/lyra-ui/`; it covers every colocated test, ambient declaration,
  and shared `test/**/*.ts` helper under `tsconfig.test.json`. Fix diagnostics with the real
  browser/test contract: complete platform fakes, explicit runtime guards, and precise private-seam
  interfaces. Do not make a red gate disappear with blanket casts, suppressions, relaxed compiler
  options, or narrower include/exclude patterns.
- **Scoping `wtr` to specific files needs the flag repeated, not comma-joined.** `pnpm test
  --files "a.test.ts,b.test.ts"` and `pnpm test -- --files "..."` both silently report "Could not
  find any test files." Working forms: repeat `--files` once per file (`pnpm test --files
  "a.test.ts" --files "b.test.ts"`), or bare positional args (`pnpm test -- a.test.ts
  b.test.ts`, matching `test:platform`'s own convention).
- Calling `oneEvent()` *after* a synchronous `dispatchEvent()` races and hangs — always set up
  the `oneEvent()` listener *before* triggering the dispatch (a pitfall that recurred across
  multiple plan docs' own sample code, always fixed the same way).
- Every component gets at least one axe check in addition to behavior tests, **run against the
  exact instance of its own tag mounted by that test** — not a sibling or a separate fixture.
  `check:qualification` enforces same-test, same-instance evidence, or a narrowly scoped recorded
  exception for a component with no distinct data-bearing/open state.
- **Run axe against a verified populated/open state, not just the empty default render.** The DOM
  carrying most a11y risk — open dialog chrome, data rows, an expanded listbox,
  highlight/overlay layers, status footers — often doesn't exist in a freshly-constructed
  component. Two traps make an
  empty-state pass extra hollow: the chai assertion surfaces only axe *violations* and silently
  discards `incomplete` ("needs review") results (e.g. a prohibited `aria-label` on a role-less
  element is a hard violation only while that element has no text content), and a fixture that
  never actually reached the intended state passes vacuously. So: build the populated state,
  assert the state-specific part/element actually rendered, then
  `await expect(el).to.be.accessible()` — see the populated axe test in
  `src/components/data/table/table.test.ts` for the pattern.
- **A test that probes a shared global must scope its evidence to the component under test.**
  Patching a prototype hook (the `LitElement.prototype.willUpdate`/`updated` trick used to prove a
  component chains to `super`) and recording a bare `called = true` boolean is vacuous: almost every
  component mounts other Lit elements in its own shadow root (`lr-button`, `lr-live-region`,
  `lr-icon`, …), and any one of them trips the flag. Observed for real on 2026-08-12 — a
  `lr-confirm-bar` super-chain test passed identically with and without the `super` calls, because
  its nested `lr-button` was doing the calling. Record *which* element called
  (`calledBy[hook].add(this.localName)`, then assert the tag you care about) or capture the instance
  and compare identity. The same reasoning applies to any spy on a shared global — `Intl`,
  `matchMedia`, `ResizeObserver`, `DOMParser`, `fetch`: attribute each call to a caller before
  asserting on the count.
- **Prove every regression test discriminates.** A test written against an already-fixed defect is
  worth nothing, and the failure mode is silent. Temporarily revert the source change, re-run, watch
  it go red *for the stated reason*, then restore — and prefer reverting via the real source rather
  than a stubbed shortcut, so the revert exercises the same path the fix does. For a pure refactor
  with no observable behavior change, no discriminating test is possible; say so explicitly and lean
  on the existing suite passing unchanged instead of inventing a hollow one.
- **Adversarial fixtures.** Happy-path fixtures hide recurring bug classes; each interaction
  shape gets its matching hostile fixture:
  - Keyboard activation (Enter/Space) is asserted to act on the element that actually has focus,
    not on a hover-synced active index — hover moving an internal index otherwise silently
    redirects keyboard activation to the wrong item.
  - Direction-sensitive arrow-key handling gets a `dir="rtl"` fixture assertion — an LTR-only
    test passes even when the RTL arrow swap is missing or inverted.
  - Order-dependent components get an UNSORTED-input fixture — a pre-sorted fixture cannot tell
    "sorts correctly" apart from "assumes sorted input".
  - Reference-following components (idrefs, item keys, anchor targets) get a dangling-reference
    fixture — a missing target must degrade gracefully, not throw or emit broken ARIA wiring.
  - Roving-tabindex components get a fixture where the data shrinks below the focused index —
    the roving index must clamp, or the tab stop lands on an item that no longer exists.
  - Pointer-gesture components get a pointercancel-path test — real devices interrupt drags
    (touch scrolling, palm rejection), and an interrupted gesture must not leave stuck state.
  - Global reconnect/leak coverage lives in `src/lifecycle-contracts.test.ts`, but a component
    with nontrivial post-reconnect behavior still needs its own assertion — the global suite
    proves reconnect doesn't leak or throw, not that component-specific state resumes correctly.
- **A red test is reproducible, not noise:** the runner retries each failed test once (mocha
  `retries` in `web-test-runner.config.js`), so a failure that reaches the report already failed
  twice in a row. Flaky tests get fixed, or explicitly quarantined with a tracked reason — never
  re-run until green and shrugged at.
- **Reproducing a CI-only timing flake:** `taskset -c 0,1 <command>` (or similar CPU-count
  pinning) approximates GitHub Actions' constrained runners on a full-core dev machine — useful
  when two subsystems only race under CPU pressure. Separately, if a fix's own CI run fails on a
  *different* error than the one it targeted, check whether the job simply progressed further and
  hit the next unrelated pre-existing bug (`gh run view <id> --log-failed`, and `gh run list`
  against commits predating the fix) before assuming the fix itself was wrong.
- **Firefox native pointer tests require one page per browser process.** Separate browser contexts
  still share native pointer capture: a sibling page's mouse release can end another page's drag,
  and a sibling capture can receive another page's press. The runner enforces a one-page Firefox
  ceiling even with `WTR_CONCURRENCY`; use independent process shards for parallelism. WebKit/Safari
  retain the smaller of four pages or half the available CPUs by default. Their pointer commands
  do not force foreground because stealing it can suspend a sibling page's animation frames.
- **`noUnusedLocals`/`noUnusedParameters` can't see a field only read by a test.**
  `tsconfig.json` excludes `src/**/*.test.ts` from the strict-flags program, so a class field that
  looks write-only to `tsc` may be a colocated test's only observability seam. Before deleting a
  flagged field, grep the sibling `*.test.ts` for the same identifier — assert on observable
  output (or a shared cache/loader) instead of deleting the field and silently breaking the
  test's only assertion.
- For a role/control inside shadow DOM, assert accessible-name/state attributes on the actual
  semantic descendant as well as running axe. Include the false state for stateful ARIA and prove
  that any public host naming path reaches that descendant.
- Native-wrapper tests cover relevant attribute forwarding, form/reset/validity behavior, public
  focus/editing methods, and the exact bubbling/composed event contract. A rendered private
  native element is not proof that the host API works.
- **A *failing* assertion whose `actual`/`expected` is a DOM node, `NodeList`, or any other
  non-structured-cloneable value hangs the whole test file** under `wtr`. Root cause (verified
  empirically, 2026-07-20): `@web/test-runner-mocha`'s `collectTestResults` copies
  `err.actual`/`err.expected` *verbatim* into the `wtr-session-finished` message;
  `@web/dev-server-core`'s browser `sendMessage` serializes it with `stable()`, whose very first
  statement is `structuredClone(obj)`; `structuredClone` throws `DataCloneError` on any DOM
  value, so the message is never sent, the session never finishes, and the file reports
  `0 passed, 0 failed` only when the per-file `testsFinishTimeout` expires, with no per-test detail — which reads
  exactly like an infinite loop or an environment/resource-contention issue and is easy to
  misdiagnose as one. It is neither: chai's own message formatting is fine (~2 ms), and deleting
  `actual`/`expected` off the caught `AssertionError` before rethrowing makes the identical
  failure report instantly. **Never assert on a DOM node/NodeList directly unless the assertion
  is guaranteed to pass** — compare an id, a tag name, `querySelectorAll(...).length`, or
  `labels.length` instead. Every matcher that leaves the asserted object as chai's `actual` has
  the same effect (`.to.equal()`, `expect(node).to.exist`, `.to.not.exist`, `.to.be.null`,
  `.to.be.undefined`, `.to.deep.equal(...)`); `.to.have.lengthOf(n)` and asserting `.length` are
  safe because chai passes a *number* as `actual`. The trap bites only during a TDD red phase —
  the assertion passes fine once the behaviour is right — so a hang immediately after writing a
  new test is almost always this, not the code under test (two separate agents hit it via
  `.to.not.exist` while writing tests for this very guidance). If a test file hangs with no
  informative output: bisect it (binary-split the `it()` blocks into scratch files until you
  isolate the one test), then either fix the underlying wrong expectation or restructure the
  assertion to compare something other than the DOM elements directly (e.g. an id/attribute). Two
  concrete traps that produce this: comparing `document.activeElement` against an element inside
  a shadow root (`document.activeElement` never drills into an *open* shadow root — compare
  against `theHost.shadowRoot.activeElement` instead, walking one `.shadowRoot` level per nesting
  depth); and asserting `outerShadowRoot.activeElement` equals an element nested *two* shadow
  roots deep (an outer component's own `shadowRoot.activeElement` only resolves as far as the
  *host* of a further-nested shadow tree, never the real focused descendant inside it — only
  `document.activeElement` walked all the way down, or a component's own shadow-piercing
  `getActiveElement()`-style helper, sees the true target).
- **WebKit silently drops a programmatic `window.getSelection().addRange(range)`** when the
  range's boundary nodes live inside a shadow tree — `rangeCount` stays `0`, no error. Chromium
  and Firefox both accept it, and `ShadowRoot.getSelection()` is Chromium-only, so there's no
  WebKit-side workaround; only real drag-selection works there. Grep `getComposedRanges\|addRange`
  under `src --include=*.test.ts` for files building a selection this way — guard each with `if
  (selection.rangeCount === 0) this.skip()` (see `archive-viewer.test.ts`) before adding any of
  them to `test:platform`'s file list, or the Firefox/WebKit CI job reddens immediately.
- **WebKit implements `enterkeyhint`/`inputmode` as HTML attributes but leaves the matching IDL
  properties (`el.enterKeyHint`, `el.inputMode`) undefined.** A test that reads the JS property to
  confirm forwarding passes on Chromium/Firefox and silently proves nothing on WebKit — assert the
  rendered *attribute*, not the IDL property, when testing native-attribute forwarding across
  engines.
- **A `?bool-attr=${false}` (or a literal `bool-attr="false"`) binding can never set a reactive
  boolean property back to `false` once that property's own default is `true`** — Lit's
  boolean-attribute binding only *toggles the attribute's presence*, and removing an attribute
  that was never present fires no `attributeChangedCallback`, so the property stays at its
  constructor default. The only way to assign `false` from a template is a **property** binding:
  `.boolProp=${false}`. This bit both a shipped component's own test suite and its Storybook
  stories in this family (search for `submitOnEnter`/`editable` in `git log` for the two real
  instances) — grep for `?` bindings against any property whose class-field default is `true`
  before trusting a `?attr=${false}` test setup at face value. The authoring-side fix is a custom
  converter — see the `true`-defaulting boolean rule in
  [coding-conventions.md](coding-conventions.md).
- `@sinonjs/fake-timers` is **not supported or installed** in this test environment. Its CJS-only
  package fails under `wtr`'s browser-native ESM pipeline. Timer-driven tests use real timers with
  short, generously-margined thresholds; see `stream-status.test.ts` for the pattern. Add an
  ESM-compatible timer harness only when a future test genuinely cannot be reliable with real
  timers.
- **A test that stubs a browser global saves and restores it** — `window.matchMedia`,
  `window.ResizeObserver`, `window.IntersectionObserver`, `window.MediaRecorder`,
  `window.AudioContext`, `navigator.mediaDevices.getUserMedia`. There is no sinon/fake-timers
  sandbox in this repo to auto-restore a monkey-patched global, so every author hand-rolls
  save/restore: assign inside a `try` block whose `finally` restores the saved original (or
  restore in `afterEach`). A leaked stub bleeds into later, unrelated tests and produces
  state-dependent failures — this bit `lr-push-to-talk`'s
  `MediaRecorder`/`getUserMedia`/`AudioContext` stubs during the voice-component work.
- **Only the merged coverage summary is the library-wide headline.** `pnpm test:coverage` runs four
  sequential shards, and Web Test Runner prints a `Code coverage: X %` line for each partial shard.
  Each such line is the arithmetic mean of that shard's statements/branches/functions/lines, not
  the complete suite. After the runner merges the shards, compute the release-wide mean from
  `coverage/coverage-summary.json#total`; `check:coverage-floors` separately enforces every merged
  per-metric floor. Because functions are a much smaller population than branches library-wide,
  one newly-covered function moves the merged mean roughly 5x more than one covered branch arm —
  sweep uncovered functions first when asked to raise "coverage." Some gaps are uncoverable by
  design (e.g. `ElementInternals` shim methods a component only attaches for the
  `<fieldset disabled>` cascade and never calls, or `toAttribute` converters on properties without
  `reflect: true`, which Lit never invokes) — don't chase those.
- **A test fixture with a missing required field can pass under `wtr` while failing `tsc`.**
  `wtr`'s esbuild pipeline strips TypeScript types at transform time, so an incomplete DTO fixture
  (e.g. missing a required `mimeType`) can run and pass the test while still failing `pnpm lint`'s
  `tsc --noEmit`. Type-check a batch of new test fixtures before committing, not just run them.
- **A failing coverage run points at `scripts/coverage-floors.json`.** `pnpm test:coverage`
  (`WTR_COVERAGE=1 wtr …`) runs the suite with istanbul instrumentation and hands `wtr`'s blocking
  `coverageConfig.threshold` the four per-metric floors read out of that file —
  `statements`/`branches`/`functions`/`lines`. A red "coverage threshold" line names the metric that
  dropped; the fix is to cover the code you just added, not to edit the number. The file also
  records the `measured` snapshot and `measuredAt` date the floors were derived from, so the diff
  says what the suite was actually at.
  - Floors are **generated, not hand-written**: `pnpm run coverage-floors` (i.e.
    `node scripts/write-coverage-floors.mjs --write-floors`, run from `packages/lyra-ui` after a
    coverage run has populated `coverage/`) re-derives each floor as `floor(measured − margin)`,
    with a default 1.5-point margin (`--margin N` overrides it). `pnpm run check:coverage-floors`
    is the read-only form the `build-and-coverage` CI job runs right after `test:coverage`; it fails
    both when a floor sits *above* the measurement (the suite can never pass) and when it has fallen
    more than 5 points *below* it (the floor stopped gating anything).
  - **Lowering a floor needs `--allow-lower` on top of `--write-floors`.** Without it the refresh
    keeps the higher floor, prints which metrics it blocked, and exits non-zero — so a coverage
    regression cannot be silently re-baselined by whoever last ran the command. The flag exists to
    make accepting one an explicit act that lands as a reviewable one-line drop in
    `coverage-floors.json`, next to the `measured` values that justify it. Hand-edited floors are
    exactly the failure this replaced: they were last left at 75/65/65/75 while the suite measured
    99/94/99/99, so about a quarter of the tree could have gone uncovered without the gate firing.
- **A newly-added opt-in property gets an explicit unset-regression test.** When an
  already-shipped component gains a new opt-in `@property`/attribute, add a test proving that,
  left unset, the component's rendered DOM/events/behavior are unchanged from before the property
  existed — don't just infer this from the property having a default value. Nothing automated
  catches the omission, and new-feature work naturally focuses on exercising the new behavior
  rather than proving the absence of a behavior change; `multi-split.test.ts`'s
  `'defaults to "container", leaving committed behavior unchanged'` and `heatmap.test.ts`'s
  equivalent are the pattern to match.
