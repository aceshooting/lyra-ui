# Testing conventions — lyra-ui agent reference

> Detail behind the "Testing conventions" digest in [AGENTS.md](../../AGENTS.md).

- **Stack:** `@web/test-runner` (`wtr`) + `@web/test-runner-playwright` (Chromium launcher) +
  `@open-wc/testing` (`fixture`, `expect`, `oneEvent`, and axe accessibility assertions via
  `expect(el).to.be.accessible()`).
- **TDD, failing-test-first.** Every behavior change starts with a test that fails for the right
  reason. Commit after each green step.
- Test files are colocated siblings: `components/<name>/<name>.test.ts`. Run via `pnpm test` from
  repo root (fans out to every package) or `packages/lyra-ui/` for just this package;
  `pnpm test:watch` for iteration.
- Calling `oneEvent()` *after* a synchronous `dispatchEvent()` races and hangs — always set up
  the `oneEvent()` listener *before* triggering the dispatch (a pitfall that recurred across
  multiple plan docs' own sample code, always fixed the same way).
- Every component gets at least one `it('is accessible', ...)` axe check in addition to behavior
  tests, **run against an instance of its own tag** — not a sibling in the same family.
  `check-component-coverage.mjs`'s accessibility gate only requires the substring `accessible`
  somewhere in the family's combined test files, so a green `pnpm lint` does **not** prove a
  given tag was ever axe-checked: `lr-tag` is "covered" by an axe call against `lr-badge`, and
  `tree-node.test.ts` has no axe assertion of its own at all. Read the component's own
  `.test.ts`.
- **Run axe against populated/open states, not just the empty default render.** The DOM carrying
  most a11y risk — open dialog chrome, data rows, an expanded listbox, highlight/overlay layers,
  status footers — often doesn't exist in a freshly-constructed component. Two traps make an
  empty-state pass extra hollow: the chai assertion surfaces only axe *violations* and silently
  discards `incomplete` ("needs review") results (e.g. a prohibited `aria-label` on a role-less
  element is a hard violation only while that element has no text content), and a fixture that
  never actually reached the intended state passes vacuously. So: build the populated state,
  assert the state-specific part/element actually rendered, then
  `await expect(el).to.be.accessible()` — see the populated axe test in
  `src/components/data/table/table.test.ts` for the pattern.
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
  `0 passed, 0 failed` at the 180s `testsFinishTimeout` with no per-test detail — which reads
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
- `@sinonjs/fake-timers` is a `devDependency` but **does not currently work in this test
  environment** — it's CJS-only with no ESM build and no browser `exports` condition, so
  importing it throws `ReferenceError: require is not defined` under `wtr`'s esbuild-based
  pipeline (unlike `hammerjs`/`maplibre-gl`, no CJS-interop shim exists for it in
  `web-test-runner.config.js`). Timer/interval-driven components (stall detection, coalescing,
  elapsed-time ticks) use real timers with short, generously-margined thresholds instead — see
  `stream-status.test.ts` or `generation-status.test.ts` for the pattern. Fixing this properly
  (adding a shim, or swapping to an ESM-compatible fake-timer library) is open — do it if a
  future test genuinely can't be written reliably with real timers, but don't reach for
  `@sinonjs/fake-timers` assuming it already works.
- **A test that stubs a browser global saves and restores it** — `window.matchMedia`,
  `window.ResizeObserver`, `window.IntersectionObserver`, `window.MediaRecorder`,
  `window.AudioContext`, `navigator.mediaDevices.getUserMedia`. There is no sinon/fake-timers
  sandbox in this repo to auto-restore a monkey-patched global, so every author hand-rolls
  save/restore: assign inside a `try` block whose `finally` restores the saved original (or
  restore in `afterEach`). A leaked stub bleeds into later, unrelated tests and produces
  state-dependent failures — this bit `lr-push-to-talk`'s
  `MediaRecorder`/`getUserMedia`/`AudioContext` stubs during the voice-component work.
- **A newly-added opt-in property gets an explicit unset-regression test.** When an
  already-shipped component gains a new opt-in `@property`/attribute, add a test proving that,
  left unset, the component's rendered DOM/events/behavior are unchanged from before the property
  existed — don't just infer this from the property having a default value. Nothing automated
  catches the omission, and new-feature work naturally focuses on exercising the new behavior
  rather than proving the absence of a behavior change; `split.test.ts`'s
  `'defaults to "container", leaving committed behavior unchanged'` and `heatmap.test.ts`'s
  equivalent are the pattern to match.
