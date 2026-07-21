# lyra-ui cross-component review checklist

Every entry below is a defect class that has **already been found and fixed at least once in this
library**. They are collected here because the fix almost always landed only on the component where
someone happened to notice it, while structurally identical siblings kept the bug — `:hover` parity
alone took four separate remediation commits and still has open violations.

That is what this checklist is for: not to re-review code against generic best practice, but to ask
of every component *"we found this once — is it still here, somewhere else?"*

## Provenance

Mined from 145 completed audit/bug/plan documents in the project's internal archive (~724k words,
20 parallel extraction agents → 440 raw patterns), then deduplicated per category and **re-verified
against the source tree at HEAD on 2026-07-20**. A candidate check was dropped unless an agent could
point at a component that still violates it, so this is not a list of already-solved problems.

## How to read an entry

- **Check** — the assertion, phrased so it can be true or false of a given component.
- **Why** — what actually broke, with the component it broke on. Never review from the rule alone;
  the failure story is what tells you whether a new instance is real or a lookalike.
- **How to verify** — a grep or a file to open. These were executed during synthesis, but greps go
  stale as the tree moves; if one returns nothing at all, suspect the pattern before concluding the
  library is clean.
- **Known live violation** — a real `file:line` that failed the check on 2026-07-20. Treat it as a
  starting point, not as current truth: some will have been fixed by the time you read this, and a
  concurrent session may have changed the file. Re-verify before reporting any of them as a finding.

## Severity

`blocker` — ships broken behaviour to consumers, or a security/a11y defect.
`high` — real user-visible breakage in a reachable state.
`medium` — inconsistency, missing affordance, or an API sharp edge.
`low` — polish, docs, or internal tidiness.

`auto-gated` on an entry means an existing check script already catches it — those are listed for
completeness, but `pnpm lint` is the authority and you should not spend review effort re-deriving
them by hand.

## What is NOT in here

Anything the automated gates already enforce reliably is deliberately excluded (design-token
literals, part reachability, side-effect registration, manifest coverage, event-barrel reachability,
form-associated hardening). Run the gates first — see `.claude/commands/review.md` step 1 — and spend
the review budget on what no script can see.

---

## API-SURFACE-AND-ESCAPE-HATCHES
### `api-surface-true-default-boolean-attribute` — high

**Check.** Every reactive boolean property whose own default is `true` uses a custom converter (e.g. `trueDefaultBooleanConverter`, or a bespoke converter like `spellcheckConverter`) rather than Lit's default presence-based `type: Boolean` converter, so a plain HTML attribute (`prop="false"`) actually clears it.

**Why.** Lit's built-in Boolean converter only toggles by attribute *presence* -- removing/never-setting an attribute and explicitly writing `prop="false"` are indistinguishable, so a `true`-defaulting property silently stays `true` for any consumer using plain markup instead of a JS property binding. AGENTS.md itself documents this having already 'bit' two shipped components' own test suites (`submitOnEnter`, `editable`) before the `trueDefaultBooleanConverter` fix pattern existed.

**How to verify.** Run: grep -rnE "@property\([^)]*\)\s+[a-zA-Z]+\s*=\s*true;" packages/lyra-ui/src/components --include=*.class.ts -- for each hit missing a `converter:` key (or whose converter isn't a true-aware one that special-cases the literal string 'false'), the property is broken for attribute-only consumers. Then check the component's own `.test.ts`: if it only proves the false case via `.prop=${false}` (property binding) and never a plain `prop="false"` attribute, the gap is untested too.

**Known live violation (as of 2026-07-20).** src/components/media/attachment-chip/attachment-chip.class.ts:213 (`@property({ type: Boolean, reflect: true }) removable = true;`, no converter); its own test at attachment-chip.test.ts:424 only exercises `.removable=${false}` as a property binding, never the attribute form. Dozens of siblings share the same gap, e.g. carousel.class.ts:48 (`showIndicators`), dock-panel.class.ts:140 (`resizable`), terminal.class.ts:136-138 (`follow`/`wrap`/`copyable`), voice-picker.class.ts:124 (`preview`) -- against only ~6 properties across the whole library (agent-run.class.ts's `showCancel`/`showRetry`, task-list.class.ts's `expanded`/`collapsible`, activity-feed.class.ts's `follow`, checkpoint.class.ts's `restorable`/`confirmRestore`) that actually use `trueDefaultBooleanConverter`.

### `api-surface-form-control-click-forwarding` — high

**Check.** Every custom element that renders its own clickable/toggleable control inside shadow DOM (form-associated or otherwise host-activatable) overrides host `click()` to forward to that internal control, the same way `lyra-button` does.

**Why.** `HTMLElement.prototype.click()` on a custom element with no native click semantics of its own is a no-op; any generic form-submit helper, test utility, or automation script that calls `.click()` on the host element (rather than clicking rendered pixels) silently does nothing unless the component defines its own forwarding `click()`. These same components already define `focus()`/`blur()` overrides, showing the forwarding pattern is known -- it just wasn't extended to `click()`.

**How to verify.** grep -rl 'formAssociated = true' packages/lyra-ui/src/components --include=*.class.ts, then for each hit grep for 'override click('. Also check its `.test.ts`: if every `.click()` call target is `el.shadowRoot!.querySelector('[part=...]')` and never the host element `el` itself, the missing host-level override is never exercised by any test.

**Known live violation (as of 2026-07-20).** src/components/forms/checkbox/checkbox.class.ts:105 (`static formAssociated = true`, role="checkbox" base at line 419, `override focus()`/`override blur()` at :357/:362, but no `click()` override anywhere in the file) -- identically src/components/forms/radio/radio.class.ts:40, src/components/forms/switch/switch.class.ts:59, src/components/forms/select/select.class.ts:99, src/components/forms/combobox/combobox.class.ts, and src/components/forms/token-input/token-input.class.ts. Their test files (checkbox.test.ts, select.test.ts, etc.) only ever call `.click()` on an internal `shadowRoot.querySelector('[part="base"]'/'[part="trigger"]')` element, never on the host. Only src/components/forms/button/button.class.ts:152-154 implements the override.

### `api-surface-target-blank-missing-noopener` — high

**Check.** Any component property that can set a real anchor's `target` (e.g. to `_blank`) automatically derives `rel="noopener noreferrer"` from that same `target` value, rather than leaving `rel` as an independent, freely-omittable property.

**Why.** A `target="_blank"` anchor without `rel="noopener"` leaves the newly-opened page holding a `window.opener` reference back into the host application -- a real reverse-tabnabbing vector triggered simply by a consumer setting `target` and forgetting to also set `rel`.

**How to verify.** grep -rnF 'target=${' packages/lyra-ui/src/components --include=*.class.ts to find every template binding a property to an anchor's `target`; for each, check whether the same template's `rel=` is computed FROM `target` (`rel=${this.target ? 'noopener noreferrer' : nothing}`) or is instead read from a separately-settable `rel` property with no such derivation.

**Known live violation (as of 2026-07-20).** src/components/data/stat/stat.class.ts:65 declares an independent `@property() rel?: string;`, rendered at line 252 as `rel=${this.rel || nothing}` alongside `target=${this.target || nothing}` -- a consumer setting only `target="_blank"` gets an anchor with no `rel` at all. Contrast with the correct pattern already used one file away in src/components/layout/app-rail/app-rail-item.class.ts:118-120, which derives `rel` from `target` automatically.

### `api-surface-numeric-property-finite-guard` — high

**Check.** Every `@property({ type: Number })` reactive property either routes its value through a shared finite-number guard (`finiteNumber`/`finiteRange`/`finiteInteger`/`finiteCount`/`finiteDuration` from `internal/numbers.ts`) before it reaches layout math, an `Intl.*` constructor, canvas sizing, or a timer duration, or carries an explicit `// numeric-guard-exempt: <reason>` comment.

**Why.** A plain HTML attribute or an untyped JS caller can hand any string/number through a numeric property regardless of its declared TypeScript type; an unguarded NaN/Infinity/negative value reaching layout math or a canvas/`Intl` call can throw, silently misrender, or trigger unbounded allocation -- documented as a bug class that has 'hit this package twice' already, which is why the guard helpers and this exact check script exist.

**How to verify.** Run `node packages/lyra-ui/scripts/check-numeric-guards.mjs` directly from `packages/lyra-ui` -- it is fully implemented but is NOT wired into `pnpm lint`, `package.json` scripts, or any CI workflow (verify by grepping `.github/workflows/ci.yml` and `package.json` for the filename), so it never runs automatically. It prints every flagged property with a file:line.

**Known live violation (as of 2026-07-20).** Running the script today reports 8 live findings: src/components/conversation/agent-workspace/agent-workspace.class.ts:132 (`contextTotal`), :138 (`unreadStartIndex`), :156-157 (`composerMinRows`/`composerMaxRows`); src/components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.class.ts:146-147 (`width`/`height`); src/components/utility/diff-view/diff-view.class.ts:71 (`contextLines`); src/components/agent-tools/context-inspector/context-inspector.class.ts:137 (`total`) -- none of these files import any `internal/numbers.js` guard helper.

### `api-surface-cancelable-event-no-defaultprevented-check` — medium

**Check.** Every custom event emitted with `{ cancelable: true }` has a corresponding `if (event.defaultPrevented) return;`-style guard, in the same component, gating the action the event announces -- a `cancelable` flag with nothing ever consulting it is dead, misleading API surface.

**Why.** AGENTS.md's own event convention reserves `cancelable: true` for 'a real veto point'; if no code branches on `.defaultPrevented`, a consumer calling `preventDefault()` gets no different behavior than not calling it, contradicting what the event's own construction advertises.

**How to verify.** grep -rn 'cancelable: *true' packages/lyra-ui/src/components --include=*.class.ts; for each hit, open the emitting method and confirm it (or its immediate caller) reads `.defaultPrevented` off the returned/emitted `CustomEvent` before proceeding with the action.

**Known live violation (as of 2026-07-20).** src/components/layout/stepper/stepper.class.ts:262 emits `lr-step-select` with `{ cancelable: true }` inside `selectStep()`, but never reads the returned event's `.defaultPrevented` anywhere in the file -- contrast with 8 other cancelable emissions in the same codebase that all check it correctly: dialog.class.ts:253-254, lightbox.class.ts:222-223, tour.class.ts:404-405 and :422-425, export-button.class.ts:246-247, voice-picker.class.ts:419-423, callout.class.ts:48-49.

### `api-surface-inline-style-precedence-conflict` — medium

**Check.** When a component exposes both a free-form inline-style callback prop (e.g. a per-row/per-cell `cellStyle`) and a separate declarative visual feature painted via the component's own shadow stylesheet (e.g. a computed heat-tint background), the two are documented and tested for precedence, since an inline `style=` attribute always wins the CSS cascade over any external stylesheet rule regardless of specificity.

**Why.** A consumer combining both features on the same element gets one of them silently and completely overridden with no warning, because the two are merged into a single `styleMap()` and rendered as one inline `style=` attribute while the CSS-rule-based feature can never out-rank it.

**How to verify.** In table.class.ts's row-render function, check whether `col.cellStyle(row)`'s returned object is spread into the same object as the heat-tint custom property before being passed to a single `styleMap()` call; then check table.styles.ts for whether the actual heat-tint `background` is painted by a stylesheet selector rule (not also applied inline). Search table.test.ts for a test that sets both a `cellStyle` returning `background`/`backgroundColor` AND `heatValue` on the same column and asserts which one wins.

**Known live violation (as of 2026-07-20).** src/components/data/table/table.class.ts:1769-1772 spreads `col.cellStyle(row)` first, then adds `'--lr-table-heat-t'`, into one object passed to `styleMap()` and applied as the `<td>`'s inline `style=` at line 1793; table.styles.ts:215-216 paints the actual tint via the shadow stylesheet rule `[part='cell'][data-heat] { background: color-mix(...); }`. A `cellStyle` callback that returns `background`/`backgroundColor` on a `heatValue`-enabled column silently defeats the tint with no test covering the combination, and neither `cellStyle`'s doc (table.class.ts:114-117) nor `heatValue`'s (table.class.ts:129-134) mentions the other.

## A11Y
### `a11y-nested-interactive-slot` — high

**Check.** A slot documented as accepting 'only non-focusable content' because it renders inside a role="button"/"option" ancestor has a colocated adversarial test that actually slots a focusable element into it and runs axe, not just benign <span>/<mark> fixtures.

**Why.** lr-conversation-item's `meta`/`excerpt` slots render inside `[part="option"]` (role="button" when not renaming) and are documented 'only non-focusable content should be slotted here' specifically to avoid axe's nested-interactive rule, but nothing tests that a consumer who ignores the prose actually trips it.

**How to verify.** Open packages/lyra-ui/src/components/conversation/conversation-item/conversation-item.class.ts: read the @slot JSDoc for `excerpt`/`meta` (lines 128-135) noting the 'non-focusable'/'nested-interactive' warning, then confirm render() (line 394 `role=${this.renaming ? nothing : 'button'}`) nests both slots inside that role="button" element. Then grep conversation-item.test.ts for `slot="meta"` / `slot="excerpt"` fixtures and check whether any of them slots a real <a>/<button> and runs `expect(el).to.be.accessible()` against it.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/conversation/conversation-item/conversation-item.class.ts:130-134 (doc warning) + :394-428 (role="button" wraps both slots); conversation-item.test.ts:93,115 only slot <span>/<mark> into meta/excerpt, never a focusable element

### `a11y-hit-target-min-size` — high

**Check.** Every icon-sized interactive control (a <button>, role="button", or tabindex="0" element carrying a `part`) has a min-inline-size/min-block-size rule in its styles file reaching the shared 40px floor (--lr-icon-button-size), not just cursor/color/opacity styling.

**Why.** packages/lyra-ui/scripts/check-hit-area.mjs is a fully-built 743-line checker for exactly this WCAG 2.5.5/2.5.8 target-size class of bug, but it is wired into no npm script and no CI job (confirmed absent from package.json and ci.yml), so violations ship silently.

**How to verify.** Run `node packages/lyra-ui/scripts/check-hit-area.mjs` from the packages/lyra-ui directory (it is NOT part of `pnpm lint` or CI) — it prints file:line + part name for every offending control. Or manually: for a <button>/role="button"/tabindex="0" element with a `part="x"` attribute, grep its sibling `*.styles.ts` for a `[part='x']` rule and confirm it sets min-inline-size/min-block-size (not only opacity/cursor/color).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/data/table/table.class.ts:769 ([part="resize-handle"], table.styles.ts has no size rule for it); packages/lyra-ui/src/components/forms/token-input/token-input.class.ts:346 ([part="token-label"], token-input.styles.ts:22-24 sets only border-radius/cursor/outline); also agent-tools/agent-trace/agent-trace.class.ts:194, conversation/thread-list/thread-list.class.ts:525/535/545, data/graph-query-builder/graph-query-builder.class.ts:576, layout/dashboard-grid/dashboard-grid.class.ts:571, viewers/dataset-viewer/dataset-viewer.class.ts:166 (script output verified directly, none carry a hit-area-exempt comment)

### `a11y-accessible-name-override` — high

**Check.** A component that computes its own internal accessible name (an aria-label bound onto a shadow-DOM control, or a role/aria-label set imperatively via setAttribute in willUpdate/updated) lets a host-level aria-label win over that computed default, via an accessibleLabel property or a `this.getAttribute('aria-label')` fallback checked first.

**Why.** AGENTS.md's 'ARIA-name forwarding' rule exists because this exact gap recurred independently across roughly a dozen mined findings (lr-select, lr-combobox, lr-textarea, lr-slider, lr-heatmap, lr-word-cloud, lr-audio-visualizer, lr-gauge, lr-context-meter, lr-tree-node); every one of those is now fixed (verified: heatmap/word-cloud/audio-visualizer guard role via an authorSuppliedRole flag, gauge/context-meter/tree-node track an explicitAriaLabel/appliedAriaLabel pair, select/combobox/textarea/slider all check getAttribute('aria-label') or an accessibleLabel property before falling back), but it is this codebase's single most frequently reintroduced a11y defect and nothing automated catches a regression.

**How to verify.** grep a component for `aria-label=\${this\.` and confirm the expression's precedence chain includes `this.getAttribute('aria-label')` or `this.accessibleLabel` before any internally-derived fallback. For components that set role/aria-label imperatively, grep `this.setAttribute('aria-label'` / `this.setAttribute('role'` inside willUpdate()/updated() and confirm it is gated by a stored 'was this externally set' flag (e.g. authorSuppliedRole, explicitAriaLabel/appliedAriaLabel comparison) rather than an unconditional overwrite on every render.

### `a11y-roving-focus-skip-disabled` — high

**Check.** Roving-tabindex / arrow-key grid navigation (calendar cells, menu items, tree nodes, canvas-overlay cells, etc.) steps forward/backward until it lands on an enabled target — never arithmetically committing to a disabled/excluded cell — and the 'which element currently owns tabindex="0"' computation has a well-defined fallback when nothing is selected or previously focused, rather than a condition that can evaluate false for every candidate and leave zero focusable stops in the whole widget.

**Why.** Originally found in lr-date-picker, whose arrow-key handlers computed the next target purely arithmetically with no isDisabled check (and whose tabbable-cell fallback could leave the entire grid with zero tabindex="0" elements when nothing was selected/focused yet); the fix (nearestEnabledDate/firstEnabledFrom, stepping past disabled cells up to a bounded cap) is now the established convention any new roving-tabindex component should match.

**How to verify.** In a component implementing Arrow-key/Tab roving focus over a computed set of positions, locate the step function and confirm it consults a disabled/excluded predicate before committing to the next position (not a raw arithmetic offset onto whatever cell is N steps away). Confirm the initial/no-selection tabindex="0" fallback degrades gracefully (no focusable cell, rather than silently landing on a disabled one) when every candidate could be disabled.

### `a11y-live-region-announce-on-mount` — medium

**Check.** A component that announces through a live region from inside `updated()`/`willUpdate()` guards the very first update (an isMounting/hasUpdated-style flag, or a state-transition comparison that is provably false pre-mount) so it never announces its own initial property values as though they were a live change.

**Why.** lr-chat-message and lr-branch-picker both had to add an explicit `isMounting` flag (their own comments cross-reference each other) specifically to stop this; lr-node-palette's `updated()` still fires an announcement on bare `changed.has('items')`, which Lit marks true on the component's very first update whenever `items` has a non-empty default/initial value, so it announces '<N> items' the instant it mounts with no user action.

**How to verify.** grep a component for `.announce(` reached from inside `updated()`/`willUpdate()`; check whether the guarding condition is a bare `changed.has('propName')` (bug — true on first update too) versus a flag/comparison that cannot be true pre-mount (e.g. `wasPreviouslyRunning && !isRunningNow` where the tracked field defaults false, or an explicit `isMounting` flag cleared after the first pass).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/retrieval/node-palette/node-palette.class.ts:97-100 (`updated(changed)` calls `this.announcer.announce(...)` whenever `changed.has('items')` or `changed.has('queryText')`, with no mount guard); node-palette.test.ts has no test at all covering announce/liveText/mount behavior

### `a11y-stateful-aria-explicit-false` — medium

**Check.** Once a component's role opts into a stateful ARIA attribute (aria-pressed/aria-selected/aria-expanded/aria-checked), the false case renders the literal string "false" rather than omitting the attribute — Lit's `?attr=${bool}` boolean-presence directive must never be bound directly to one of these.

**Why.** AGENTS.md states this as a binding rule after it recurred at least five times independently (lr-chip's toggle-mode aria-pressed, plus others called out across two separate audit plans); Lit's `?attr=` idiom is reached for out of habit even though the target is tri-state (true/false/not-applicable-at-all), not a real HTML boolean.

**How to verify.** grep -rn "aria-pressed=\|aria-selected=\|aria-expanded=\|aria-checked=" packages/lyra-ui/src/components/**/*.class.ts; for every ternary hit, confirm both branches render literal 'true'/'false' strings when the state is applicable (`nothing` is only legitimate for a separate 'this control isn't in stateful/toggle mode at all' condition, never for 'currently false'). Separately grep for `?aria-pressed=`/`?aria-selected=`/`?aria-expanded=`/`?aria-checked=` (the boolean-directive form) — any hit is an automatic violation since it always omits the false case.

### `a11y-reduced-motion-coverage` — medium

**Check.** Every CSS @keyframes/animation declaration is paired with a `prefers-reduced-motion: reduce` override in the same styles file, and every programmatic scrollIntoView()/scrollTo() call whose behavior could be 'smooth' derives that choice from prefersReducedMotion() rather than a hardcoded 'smooth' literal.

**Why.** AGENTS.md requires decorative/ambient animation to stop or simplify under reduced motion; this was violated across at least five components (dock-panel, time-range, word-cloud, tabs, task-list) before being fixed, and a later plan had to write the same requirement into its own Global Constraints specifically for scrollIntoView/scrollTo call sites after the identical gap recurred there in JS rather than CSS.

**How to verify.** grep -rl '@keyframes\|animation:' packages/lyra-ui/src/components/**/*.styles.ts and confirm each hit's file also contains an `@media (prefers-reduced-motion: reduce)` block disabling/simplifying it. grep -rn 'scrollIntoView(\|\.scrollTo(' packages/lyra-ui/src/components/**/*.class.ts and confirm any explicit `behavior:` option is computed via `prefersReducedMotion() ? 'auto' : 'smooth'` rather than a bare `'smooth'` string literal (an omitted `behavior` key defaults to non-smooth and is not itself a violation).

## TESTING-PITFALLS
### `testing-css-source-text-vs-computed-style` — high

**Check.** A component's test asserts a CSS rule's effect (custom-property resolution, RTL mirroring, layout) by matching raw stylesheet source text (styles.cssText / css.toString()) instead of getComputedStyle()/hit-testing on an actually-rendered fixture — except for genuinely-unsynthesizable pseudo-classes (:hover/:active/:focus-visible), where the established convention IS the cssText-regex pattern.

**Why.** AGENTS.md documents four real, shipped bugs that hid behind exactly this pattern (a :has() selector invalid inside :host(), :empty not matching lit's whitespace nodes, an auto sentinel beating a var() fallback, and a since-fixed lyra-heatmap regression test); the pattern still recurs today, e.g. widget.test.ts's scrim-color test only proves the token string exists in the sheet, never that it reaches a rendered fullscreen scrim.

**How to verify.** grep a component's *.test.ts for `styles.cssText` / `.cssText.replace(` followed by `.to.include(` or `.to.match(` — if the surrounding assertion is NOT about :hover/:active/:focus-visible, check whether a getComputedStyle-based fixture test exists anywhere else in the file for the same rule; its absence is the finding.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/widget/widget.test.ts:738-742 asserts `--lr-widget-overlay-color`/scrim background only via `styles.cssText.replace(...).to.include(...)`, never getComputedStyle on a rendered fullscreen-open scrim; packages/lyra-ui/src/components/layout/details/details.test.ts:67-70 asserts the RTL disclosure-marker rotation only via a cssText regex, never getComputedStyle under an actual dir="rtl" fixture.

### `testing-per-tag-a11y-contract-gap` — high

**Check.** Every public custom element (each `@customElement lr-x` in the manifest) has at least one accessibility (`to.be.accessible()`) assertion run against an instance of itself specifically — not merely a passing mention that satisfies a family-wide substring check.

**Why.** check-component-coverage.mjs's 'accessible' check is per-family (readFamilyFiles(family,'.test.ts').join) not per-tag, so lr-tag (badge family) is fully green with zero assertions of its own — its only appearance in the suite is a one-line `.to.exist` mount inside badge.test.ts, whose sole `to.be.accessible()` call targets lr-badge, never lr-tag; lr-tree-node's own 89-line test file has real behavior tests but zero 'accessible' assertions, relying on sibling tree.test.ts to satisfy the family gate.

**How to verify.** For the component under review, open its own *.test.ts and grep for `to.be.accessible()` run against an instance of ITS OWN tag (not a sibling in the family) — do not accept a passing `pnpm lint`/check-component-coverage.mjs run as proof, since it only requires the substring 'accessible' to appear ANYWHERE in the family's combined test files.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/overlays/badge/tag.class.ts (lr-tag) — no dedicated test file; only reference is packages/lyra-ui/src/components/overlays/badge/badge.test.ts:6 (`<lr-tag>Tag</lr-tag>`, asserted only `.to.exist`, axe run against lr-badge on line 9). packages/lyra-ui/src/components/data/tree/tree-node.test.ts — 0 occurrences of 'accessible' despite real dedicated ARIA-attribute tests (role=treeitem, aria-level/aria-setsize/aria-posinset).

### `testing-boolean-attribute-binding-cannot-unset-true-default` — high

**Check.** A Storybook story or test that intends to force a `true`-defaulting boolean `@property` back to `false` uses a property binding (`.propName=${false}`), never a boolean-attribute binding (`?prop-name=${false}` or a literal `prop-name="false"`).

**Why.** Lit's `?attr` binding only toggles the attribute's presence; removing an attribute that was never present fires no attributeChangedCallback, so the property silently stays at its `true` class-field default — this has bitten a shipped component's test suite and Storybook story before (submitOnEnter/editable, per git log), and is live again today in lr-source-picker's own story.

**How to verify.** grep a component's *.class.ts for `@property({ type: Boolean` (or `attribute:`) `... = true`, then grep its own *.test.ts and *.stories.ts for `?<attr-name>=${false}` or a literal `<attr-name>="false"` against that same property — either form silently fails to disable it; only `.propName=${false}` works.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/retrieval/source-picker/source-picker.stories.ts:35 — the `NoSelectAllNoSearch` story sets `?show-select-all=${false} ?searchable=${false}`, but `showSelectAll`/`searchable` both default to `true` (source-picker.class.ts:68-69), so neither binding actually turns them off; the story silently renders identically to `Default` instead of the no-select-all/no-search variant its name promises.

### `testing-axe-only-empty-default-render` — high

**Check.** A component's `it('is accessible', ...)` test runs axe against a populated/open/non-trivial state of the component (real content, slotted children, or an opened/active state), not only a bare `fixture(html`<lr-x></lr-x>`)` with no attributes and no content.

**Why.** Violations only surfacing once real content or interactive state is present are invisible to an axe check that only ever renders the empty default — this is called out as a hard requirement precisely because it's an easy corner to cut, and two components currently only test the bare-empty case.

**How to verify.** grep a component's *.test.ts for `it('is accessible'` and inspect the fixture literal it awaits — a bare `<lr-x></lr-x>` with no follow-up property assignment, slotted content, or open/active state set before `await expect(el).to.be.accessible()` is the finding; check whether ANY other axe call elsewhere in the same file covers a populated/open variant before flagging.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/viewers/html-viewer/html-viewer.test.ts:61 — the file's only axe check, against a bare `<lr-html-viewer></lr-html-viewer>` fixture with no HTML content ever loaded. packages/lyra-ui/src/components/viewers/contact-viewer/contact-viewer.test.ts:33 — same pattern, no vCard/contact data populated before the axe check.

### `testing-dom-node-equality-structuredclone-hang` — medium

**Check.** A test assertion never compares a live DOM Element/NodeList/ElementInternals-derived object directly via `.to.equal()`/`.to.deep.equal()`/`.to.exist`/`.to.not.exist` unless the match is genuinely guaranteed to pass — an id, tag name, or `.length` is used instead wherever a real risk of mismatch exists.

**Why.** @web/test-runner-mocha copies err.actual/err.expected verbatim into its session-finished message, which structuredClone throws DataCloneError on for any DOM node/NodeList, silently dropping the message so the session never finishes and only the 180s outer watchdog eventually kills it, misreporting as '0 passed, 0 failed' — this has hit lr-notebook-viewer and rubric-form's `.labels` test before.

**How to verify.** grep a test file for `.to.equal(`/`.to.deep.equal(` where the argument resolves to a DOM node/NodeList (e.g. `el.shadowRoot!.querySelector(...)`, `document.activeElement`) rather than a derived primitive; for each hit, judge whether the two sides could plausibly diverge on a future regression — if so, it's a landmine even though currently green.

**Known live violation (as of 2026-07-20).** The pattern is widespread by accepted convention (AGENTS.md rule 55's own 'unless guaranteed to pass' carve-out) — e.g. packages/lyra-ui/src/components/data/query-builder/query-builder.test.ts:269 and packages/lyra-ui/src/components/layout/app-rail/app-rail.test.ts:372 both compare `shadowRoot.activeElement` directly against a `querySelector(...)` result; none are confirmed-broken today, but each is a silent-hang risk the moment it starts failing.

### `testing-fake-timers-unusable` — medium

**Check.** No test file imports `@sinonjs/fake-timers` (or any other fake-timer library) — timer/interval-driven behavior (elapsed-time ticks, stall detection, auto-stop, coalescing) is tested with real `setInterval`/`setTimeout` and short, generously-margined thresholds instead.

**Why.** `@sinonjs/fake-timers` is CJS-only with no ESM build or browser `exports` condition, so importing it throws `ReferenceError: require is not defined` under wtr's esbuild pipeline — it's a devDependency purely because someone reached for it and then reverted; timer-driven components like lr-stream-status and lr-generation-status use real timers instead.

**How to verify.** grep packages/lyra-ui/src for `from '@sinonjs/fake-timers'` or `require('@sinonjs` in any *.test.ts; also check package.json still lists it only as a devDependency, never imported.

### `testing-oneevent-registered-after-trigger` — medium

**Check.** Every `oneEvent(el, 'event-name')` call is registered (synchronously, before the triggering action resolves) prior to the event actually firing — the trigger itself is deferred via `setTimeout(() => trigger())` rather than called inline immediately before `await oneEvent(...)`.

**Why.** Setting up a oneEvent listener after the synchronous action that fires the event races dispatch against listener registration, producing intermittent test hangs — this bit lr-push-to-talk's own test suite during the Family E voice work.

**How to verify.** grep a test file for `await oneEvent(` and check the immediately preceding trigger line: it must be wrapped in `setTimeout(() => ...)`, not a bare `.click()`/`.dispatchEvent(` called directly before the oneEvent await.

### `testing-stubbed-globals-not-restored` — medium

**Check.** Any test that monkey-patches a browser global (`window.matchMedia`, `window.ResizeObserver`, `window.IntersectionObserver`, `window.MediaRecorder`, `window.AudioContext`, `navigator.mediaDevices.getUserMedia`) saves the original and restores it in a `finally` block (or a paired `afterEach`), never leaving the stub in place past the test that installed it.

**Why.** There is no sinon/fake-timers sandbox in this repo to auto-restore globals, so every author hand-rolls save/restore; a stub left in place after a test leaks into later, unrelated tests and produces state-dependent failures — this was flagged during the Family E (voice) work for lr-push-to-talk's MediaRecorder/getUserMedia/AudioContext stubs.

**How to verify.** grep a test file for `window.<Global> =` or `navigator.mediaDevices.<x> =` and confirm the assignment sits inside a `try` block whose `finally` restores the saved original (or the restore happens in `afterEach`) — a bare assignment with no restore path anywhere in the file is the finding.

### `testing-new-property-missing-unset-regression-test` — medium

**Check.** A newly-added opt-in `@property`/attribute on an already-shipped component has an explicit test proving that, left unset, the component's rendered DOM/events/behavior are unchanged from before the property existed — not merely inferred from the property having a default value.

**Why.** New-feature tests naturally focus on exercising the new behavior; proving the *absence* of behavior change for consumers who don't opt in requires a deliberate, separate test that's easy to skip under time pressure — restated as a binding rule across multiple plans (orientationBreakpointBasis, legendStops/showLegend, lr-graph's additions) precisely because nothing automated catches its omission.

**How to verify.** For a component that just gained a new property, grep its *.test.ts for a test whose name/body specifically asserts the unset case reproduces prior output (patterns like /unchanged/i, /unaffected/i, /regression/i near the new property's describe block) — its absence for a recently-added, non-required property is the gap. Good examples already in the tree: split.test.ts:1899 ('defaults to "container", leaving committed behavior unchanged'), heatmap.test.ts:1122/1181.

## EVENTS-AND-DATA-FLOW
### `events-native-input-blur-focus-bridging` — high

**Check.** Every internal native <input>/<textarea> that has an @input/@change handler also bridges its native blur/focus by calling this.emit('blur')/this.emit('focus') from paired @blur=/@focus= handlers, since native blur/focus neither bubble nor cross the shadow boundary.

**Why.** lyra-textarea and lyra-chat-composer both previously shipped with only local state mutated on blur (no this.emit('blur')/'focus'), so a host-level @blur/@focus listener on the custom element never fired; both were fixed and AGENTS.md rule 30 now states the requirement explicitly, but four newer components still ship a bare text <input> with @input wired and no focus/blur bridge at all.

**How to verify.** for f in $(grep -rl '<input\|<textarea' packages/lyra-ui/src/components --include=*.class.ts); do echo "$f: focus=$(grep -c '@focus=' $f) blur=$(grep -c '@blur=' $f)"; done — any file with a real text-entry <input>/<textarea> and 0 for either count is a live gap (exclude non-text controls like <input type=range> and transient dialog/palette search boxes where the omission is a judgment call).

**Known live violation (as of 2026-07-20).** src/components/agent-tools/tool-param-form/tool-param-form.class.ts:600 and :614 (string/number <input> fields, @input wired via onTextInput/onNumberInput, no @focus/@blur at all); src/components/retrieval/node-palette/node-palette.class.ts:190-197 (search <input>, @input=onSearchInput, no bridge); src/components/forms/emoji-picker/emoji-picker.class.ts:513-523 (search <input>, same gap); src/components/conversation/thread-list/thread-list.class.ts:641-648 (search <input>, same gap).

### `events-async-src-fetch-generation-guard` — high

**Check.** An async method that (re-)fetches/parses a consumer-supplied `src`-like property guards every state write after an `await` with a monotonically-incrementing generation/token counter captured at call start (`if (generation !== this.generation) return;`), so a fast reassignment mid-fetch can't let an older, slower response clobber a newer one's already-applied result.

**Why.** This exact race was independently rediscovered across at least four separate historical audit passes (pdf-viewer's load(), document-viewer's resolve(), the phase1 SVG/HTML viewers, the phase3 spreadsheet/csv viewers) before becoming a hard convention now adopted in essentially every fetch-driven viewer — a new or modified async-fetching component that skips it silently reintroduces a race that an ordinary manual test won't reproduce (needs a fast double-trigger).

**How to verify.** grep -rn 'await fetch(' packages/lyra-ui/src/components --include=*.class.ts; for each hit's containing async method, confirm a `generation`-style field (or equivalent per-call token, e.g. lr-flag's `resolveToken`) is incremented before the fetch/parse begins and re-checked after every subsequent `await` before any component-state write.

### `events-src-fetch-scheme-validation` — high

**Check.** A component accepting a `src`/URL property and calling fetch() on it validates the URL's scheme via safeFetchUrl() (src/internal/safe-url.ts) before the fetch — rejecting anything other than relative, http:, https:, or blob:/data: as applicable — rather than passing the raw consumer-supplied string straight to fetch()/new URL().

**Why.** A naive string check (e.g. startsWith('http')) can be defeated by a smuggled character inside the scheme name; this library's own viewer family established safeFetchUrl() as the single required gate specifically to close that path, and every current fetch-driven viewer routes through it — a new src-accepting, fetch-calling component that skips this reopens the same injection surface with no automated gate to catch it.

**How to verify.** grep -rn '@property.*\bsrc\b' packages/lyra-ui/src/components --include=*.class.ts, then for every one that later calls fetch()/new URL() on that value, confirm the call site is preceded by `safeFetchUrl(this.src)` (or equivalent) and that the component's test file includes a malformed/unsafe-scheme adversarial case, not just a 404/network-failure case.

### `events-numeric-isnan-vs-isfinite` — medium

**Check.** A numeric reactive property that feeds a visible computation (trend direction, geometry, formatted display) is validated with Number.isFinite — via the shared finiteNumber/finiteRange/finiteInteger helpers in src/internal/numbers.ts — never a bare isNaN() check, since isNaN(Infinity) is false and lets +-Infinity propagate downstream.

**Why.** gauge, histogram-bin, and word-cloud were all rewritten from a bare isNaN() guard to Number.isFinite/finiteRange specifically because a literal Infinity value (a caller typo, or an attribute of 'Infinity') silently passed the old guard and produced broken geometry/labels; the exact same bare-isNaN shape still exists in a newer component.

**How to verify.** grep -rn 'isNaN(' packages/lyra-ui/src/components --include=*.ts | grep -v 'Number.isNaN\|.test.ts' — for each hit, check whether the guarded value feeds a rendered computation, and confirm it isn't already routed through internal/numbers.ts's finiteNumber/finiteRange/finiteInteger/finiteCount helpers.

**Known live violation (as of 2026-07-20).** src/components/data/stat/stat.class.ts:176 — `const hasTrend = this.trend != null && !isNaN(this.trend);` lets `trend=Infinity` through, so rawDirection becomes 'up' and the sr-only trend announcement interpolates Math.abs(Infinity), rendering a literal 'increased by Infinity' string.

### `events-host-owned-side-effect-via-request-event` — medium

**Check.** A component needing a host-owned effect (opening/downloading a file, navigating) emits a request event and lets the host perform the actual I/O — it never calls URL.createObjectURL / sets a synthetic <a download> and .click()s it / calls window.open() directly inside its own handler.

**Why.** lyra-email-viewer was deliberately fixed to emit lr-attachment-open and never open/download the attachment itself, mirroring lyra-media-card's lr-open precedent, specifically so a host can route the effect elsewhere (e.g. into a different viewer) or intercept it — the same convention is violated by a different, newer component today.

**How to verify.** grep -rn 'URL.createObjectURL(\|window.open(\|\.download\s*=' packages/lyra-ui/src/components --include=*.class.ts (excluding stories/tests); for each hit, confirm it either follows a cancelable request event whose defaultPrevented was checked false, or is explicitly documented in the class JSDoc as an intentional built-in convenience with no host-interception path — an unconditional direct I/O call with only an after-the-fact non-cancelable notification event is the violation shape.

**Known live violation (as of 2026-07-20).** src/components/agent-tools/terminal/terminal.class.ts:413-420 (`onDownload`) builds a Blob, calls URL.createObjectURL, and .click()s a synthetic `<a download>` entirely inside the component; `lr-download` (documented at line 107 as 'the download button triggered a Blob download') is only emitted afterward as a plain, non-cancelable notification — contrast with src/components/viewers/email-viewer/email-viewer.class.ts:203, which emits `lr-attachment-open` and never performs the I/O itself.

## I18N-LOCALIZATION
### `i18n-hardcoded-user-facing-string` — high

**Check.** Every user-facing string a component itself owns (visible text, aria-label/aria-description, title, placeholder, alt) routes through this.localize(key, ...) end-to-end -- not partially: not just calling localize() for one word of a compound phrase then concatenating a hardcoded literal suffix/prefix, not calling it on only one branch of a ternary, and not rendering a module-level Record<Status,string> label map directly instead of through a parallel *_KEY map + localize().

**Why.** This is the single most-cited defect shape across the mined archive (10+ independently-mined incidents: lyra-chip-group's '+N'/'Show less', lyra-poll-status's live-region text, lyra-app-rail's '${localize("open")} navigation' concatenation, lyra-attachment-chip/-trigger's aria-labels, lyra-model-select/-chat-composer/-file-input's assistive-only text). All of the specific named instances from the archive are now fixed in current source (verified: chip-group.class.ts:142-147 uses showLess/showMoreCount keys; app-rail.class.ts:581-591 uses whole-phrase closeNavigation/openNavigation/navigation keys, no concatenation; attachment-chip.class.ts:369-409 and attachment-trigger.class.ts:289 fully wire every label surface through localize(); model-select.class.ts:612, file-input.class.ts:141-254, chat-composer.class.ts:511/532 all localize their assistive text). A repo-wide sweep for remaining bare-literal aria-label/title/placeholder text, localize()+concatenation, and un-keyed status maps (source-card, diff-view, code-block-core, json-viewer, tool-result-dialog, word-cloud, chat-message, tool-call-chip) turned up zero current violations. No automated gate exists for the 'never calls localize() at all' or 'concatenates a hardcoded suffix onto a localize() call' shapes -- check-source-policy.mjs's only i18n rule (localize-fallback) requires an EXISTING this.localize() call site to even look at, so a hardcoded string that skips localize() entirely, or a `${this.localize('x')} literal text` concatenation, is invisible to it. Given how many independent audit passes over multiple months re-discovered this exact shape in different components, it is very likely to recur in the next new component or quick copy-edit.

**How to verify.** grep -rnE 'aria-label="[A-Z]|title="[A-Z]|placeholder="[A-Z]' --include=*.class.ts packages/lyra-ui/src/components (bare literal); grep -rnE '\$\{this\.localize\([^)]*\)\}[A-Za-z]' --include=*.class.ts packages/lyra-ui/src/components (concatenation glued directly onto the interpolation) and grep -rnE "this\.localize\([^)]*\)\s*\+\s*['\"\`]|['\"\`]\s*\+\s*this\.localize\(" --include=*.class.ts packages/lyra-ui/src/components (explicit + concatenation); for any component with a `Record<Status,string>` style label map, confirm it is only used to derive a matching *_KEY map that is then passed to this.localize(), never rendered directly.

### `i18n-raw-error-message-verbatim` — high

**Check.** A caught exception's raw `.message` (or `String(err)`/`err.toString()`) is never rendered directly into a user-facing role="alert"/status region -- only a stable, this.localize()-derived message is shown there; the raw underlying error is preserved solely in a component event's detail payload (this codebase's established convention: `LyraUserFacingError` from `src/internal/resource-loader.ts`, whose `.message` IS a pre-localized string and is the only case where `error.message` may reach the UI safely).

**Why.** All 11 originally-cited viewers (archive/calendar/contact/csv/dataset/docx/email/html/pdf/spreadsheet/svg-viewer) already converged on this exact pattern -- confirmed by reading every one: each catch block does `error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad')`, with the raw error only reaching the DOM if it was deliberately wrapped in `LyraUserFacingError` (itself constructed from a localize() call, e.g. svg-viewer.class.ts:95). This is a real, deliberate, load-bearing architectural convention, and it IS documented in AGENTS.md's i18n section (the "Never render a caught error's raw `.message` verbatim" bullet, which names `LyraUserFacingError` explicitly) as of a 2026-07-20 correction -- an earlier version of this entry claimed it was undocumented, which a later audit pass found to be stale; the convention's own live violation below is the actual remaining problem, not a documentation gap. A live violation of the underlying principle exists today outside the viewer family this pattern was built for: `tool-approval-dialog.class.ts:292` sets `this.draftError = err instanceof Error ? err.message : this.localize('invalidJson')` from a `JSON.parse()` catch block -- since `JSON.parse` always throws a `SyntaxError` (which `instanceof Error` is always true for), the localized `'invalidJson'` branch is dead code in practice and the raw, browser/engine-dependent native message (e.g. V8's `"Unexpected token } in JSON at position 42"`, worded completely differently in Firefox/Safari) is rendered verbatim at line 358 inside `<p part="error" role="alert">${this.draftError}</p>`.

**How to verify.** grep -rn 'instanceof Error ? ' --include=*.class.ts packages/lyra-ui/src/components -- for each hit, confirm the true-branch's `.message` only reaches the UI when the thrown value is a component-owned `LyraUserFacingError` (already pre-localized), not a bare native `Error`/`SyntaxError`/`TypeError`; open packages/lyra-ui/src/components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.ts:290-292 and :358 to see the still-live instance where a native JSON.parse SyntaxError's raw message reaches a role="alert" region unconditionally.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.ts:292 (raw JSON.parse SyntaxError.message assigned to draftError) rendered verbatim at tool-approval-dialog.class.ts:358 (`<p part="error" role="alert">${this.draftError}</p>`)

### `i18n-intl-formatter-wrong-locale-argument` — high

**Check.** Every `Intl.DateTimeFormat`/`Intl.NumberFormat`/`Intl.DisplayNames`/`Intl.RelativeTimeFormat` instance a component obtains (via the shared `getDateTimeFormat`/`getNumberFormat`/`getDisplayNames`/`getRelativeTimeFormat` caches in `src/internal/intl-cache.ts`, or via `Date.prototype.toLocaleString`-family calls) is given `this.effectiveLocale` (or a value ultimately derived from it) as its locale argument -- never a hardcoded literal locale tag (e.g. `'en'`), never an unconditional `undefined` that silently falls back to the runtime/OS default instead of the page's resolved Lyra locale, and never `document.documentElement.lang` read directly in place of the shared `effectiveLocale`/`resolveLyraLocale()` path.

**Why.** This was the second-most-cited defect shape in the archive (lyra-heatmap's weekday/month labels, lyra-calendar-viewer, lyra-conversation-item, lyra-format-bytes/-date/-number, lyra-relative-time, lyra-flag). A full sweep of every current `getDateTimeFormat(`/`getNumberFormat(`/`getDisplayNames(`/`getRelativeTimeFormat(`/`toLocaleString(` call site in `src/components` found all of them now correctly pass `this.effectiveLocale` (or `locale || undefined`/`locale || 'en'` where `locale` is itself always derived from `effectiveLocale` upstream, e.g. tool-timeline.class.ts:84, checkpoint.class.ts:40, context-meter.class.ts:39, sparkline.class.ts:105, heatmap.class.ts:1222/1828) -- the one apparent hardcoded-`undefined` hit, `calendar-core.ts:36`, is a deliberate `try/catch` fallback for a malformed locale string re-thrown by `new Intl.Locale()`, not a locale-ignoring bug (its caller at date-input.class.ts:35/date-picker.class.ts already passes the real `locale || undefined` on the primary path). No automated gate checks this at all: `check-source-policy.mjs`'s `intl-outside-cache` rule only flags a literal `new Intl.<Kind>(` construction bypassing the shared cache -- it has zero visibility into what locale value is actually passed to the cache getters, so a component that hardcodes `getDateTimeFormat('en', ...)` or `getDateTimeFormat(undefined, ...)` instead of `this.effectiveLocale` would sail through CI untouched. AGENTS.md does not mention `effectiveLocale`/`Intl` locale-argument correctness at all (only a generic 'no locale registered' test-convention line), so this is enforced purely by convention today.

**How to verify.** grep -rn 'getDateTimeFormat(\|getNumberFormat(\|getDisplayNames(\|getRelativeTimeFormat(' --include=*.class.ts packages/lyra-ui/src/components | grep -v 'effectiveLocale\|this\.locale' -- any remaining hit is a candidate; also grep -rn '\.toLocaleString(\|\.toLocaleDateString(\|\.toLocaleTimeString(' --include=*.class.ts packages/lyra-ui/src/components and confirm the locale argument traces back to `this.effectiveLocale`, not a literal tag or bare `undefined` on the primary (non-error-fallback) code path.

### `i18n-localize-dynamic-key-fallback-bypass` — medium

**Check.** A this.localize(key, fallback) call whose key argument is a computed/non-literal expression (a member access, a ternary, a lookup table index, e.g. `meta.triggerKey`, `STATUS_LABEL_KEY[status]`) must still only pass `undefined` (directly, `expr || undefined`, or a ternary whose default branch is `undefined`) as fallback once that key already has a DEFAULT_STRINGS entry -- exactly the same rule as a literal key, but the automated gate cannot verify it for a dynamic key.

**Why.** check-source-policy.mjs's `localize-fallback` rule only inspects calls whose first argument matches `/^['"]([A-Za-z0-9_]+)['"]$/` -- a computed key expression fails that regex and the whole call is skipped (`if (!keyMatch || !knownKeys.has(keyMatch[1])) continue;`), so the exact same registerLyraLocale()-defeating bug is completely invisible to CI when the key isn't a bare string literal. AGENTS.md's own i18n section explicitly warns 'watch for the bug explicitly when reviewing a localize() call site rather than assuming the gate caught everything' immediately after describing this exact fallback rule (root AGENTS.md, i18n section). Verified one real dynamic-key+fallback call site today, media/attachment-trigger/attachment-trigger.class.ts:289 (`this.localize(meta.triggerKey, this.triggerLabel)`), and confirmed it is NOT a bug here only because `triggerLabel` has no default value (`@property() triggerLabel?: string`, so it's `undefined` unless a consumer explicitly sets it) -- i.e. it happens to match AGENTS.md's one legitimate exception (a fallback conditionally derived from a property with no baked-in English default). A reviewer must verify that reasoning by hand for every such call; the gate cannot.

**How to verify.** grep -rnE "this\.localize\(\s*[a-zA-Z_]" --include=*.class.ts packages/lyra-ui/src/components to list every localize() call whose first argument is not a quoted literal; for each hit with a 2nd argument, confirm the 2nd argument is `undefined`, or a property that has NO hardcoded English default value (i.e. `@property() x?: string` with no `= 'Some English Default'`), or a ternary whose default branch is `undefined`/matches the property's own default exactly per AGENTS.md's `this.localize('previousMonth', this.previousLabel === 'Previous month' ? undefined : this.previousLabel)` pattern.

### `i18n-missing-strings-override-test` — medium

**Check.** Any component whose class calls this.localize() has a colocated test that actually exercises a `.strings` override or `registerLyraLocale()` and asserts the resulting string reaches the rendered DOM -- not merely that a matching DEFAULT_STRINGS key exists.

**Why.** This is an explicit, named AGENTS.md test-convention rule ('a key existing in the union doesn't prove the call site is wired up correctly') and is mechanically ratcheted by check-source-policy.mjs's `strings-test-coverage` rule -- but that ratchet is frozen against `scripts/source-policy-baselines.json`, which currently grandfathers 64 files (confirmed by running `node scripts/check-source-policy.mjs` today: 'baselines: 3 keyboard-test-coverage, 64 strings-test-coverage', passing clean only because those 64 pre-existing gaps are exempted). Verified a live example: `src/components/agent-tools/artifact-panel/artifact-panel.class.ts` calls `this.localize(...)` at multiple sites (e.g. line 128, 165, 173, 182, 193) but `artifact-panel.test.ts` contains zero occurrences of `.strings` or `registerLyraLocale` (confirmed via grep). A reviewer touching any of the 64 baselined files, or reviewing a brand-new component, should not assume the gate alone protects this invariant -- CI only fails for a NEW offender outside the baseline, never for one of the 64 already on it.

**How to verify.** `cd packages/lyra-ui && node scripts/check-source-policy.mjs --list-baselines` to see the current baseline counts; cross-check any file in `scripts/source-policy-baselines.json`'s `strings-test-coverage` array (e.g. `src/components/agent-tools/artifact-panel/artifact-panel.class.ts`) against its sibling `.test.ts` via `grep -c '\.strings\|registerLyraLocale' <file>.test.ts` -- 0 confirms the gap is still real, not just historically baselined-and-forgotten.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/agent-tools/artifact-panel/artifact-panel.class.ts:128 (this.localize call) has no matching .strings/registerLyraLocale assertion anywhere in artifact-panel.test.ts (grep for both terms returns zero hits); 63 further files listed in scripts/source-policy-baselines.json's strings-test-coverage array share the same gap

## DESIGN-TOKENS-THEMING
### `theming-undeclared-exact-size-sentinel` — high

**Check.** A --lr-<component>-<x>-height/-width (or similar 'exact size' escape-hatch) custom property consumed as min-block-size: var(--x-height, var(--x-min-height)) must NOT also be declared with a default value (including auto) anywhere on :host -- a declared value always wins over a var() fallback arm, permanently killing the min/max fallback it's supposed to feed.

**Why.** AGENTS.md's own 'silently-inert CSS' section cites exactly this failure mode as a real, previously-shipped bug (a --lr-x-height: auto sentinel declared on :host), and states nothing in the toolchain -- not tsc, not the style policy, not a stylesheet-text test -- catches it; only asserting the rendered computed style does.

**How to verify.** For any component exposing an exact-size escape-hatch cssprop consumed via var(--x-exact, var(--x-floor)), grep that component's *.styles.ts for a :host { ... --x-exact: ... } declaration (any value). Confirmed-correct examples to compare against: packages/lyra-ui/src/components/overlays/chip/chip.styles.ts:31-37 and packages/lyra-ui/src/components/forms/select/select.styles.ts:10-13 both carry an explicit comment that the property is deliberately left undeclared on :host for this exact reason.

### `theming-canvas-color-must-be-resolved-before-fillstyle` — high

**Check.** Any canvas 2D rendering path that derives a color from a CSS custom property, a consumer-supplied color callback, or a color-mix()/var() expression must resolve it via getComputedStyle (or an equivalent sentinel/round-trip technique) into a concrete color string BEFORE assigning it to ctx.fillStyle/ctx.strokeStyle -- never assign the raw token/expression string directly.

**Why.** Canvas 2D's fillStyle/strokeStyle setter is a spec'd silent no-op on an unparseable string (it keeps the previous value, throws nothing) -- so a consumer-themed CSS custom property or color-mix() expression fed straight through renders as whatever fillStyle was previously set (often solid black) with zero error. This recurred across multiple components before being fixed: lyra-heatmap's resolveRgb(), lyra-graph's canvas renderer (resolveCssColorValue in graph.class.ts resolves via getComputedStyle before building the scene graph graph-canvas.ts later paints from), qr-code.class.ts, av-player.class.ts's waveform, audio-visualizer.class.ts, and shiki-dark-theme.ts's syntax-highlight palette all now resolve through getComputedStyle or a sentinel-normalization round-trip first.

**How to verify.** grep -rn "fillStyle\s*=\|strokeStyle\s*=" for any new/changed .class.ts/.ts file; trace the assigned value backward to its source -- flag any path where a raw prop/callback return value or getPropertyValue('--lr-...') result reaches ctx.fillStyle without first being round-tripped through a real canvas 2D context (the ctx.fillStyle = sentinel; ... ctx.fillStyle = value; if (ctx.fillStyle === sentinelNormalized) reject pattern used in heatmap.class.ts/qr-code.class.ts/shiki-dark-theme.ts) or getComputedStyle.

### `theming-theme-css-bridge-completeness` — medium

**Check.** Every `--lr-theme-*` name that `tokens.styles.ts` bridges to (i.e. `--lr-x: var(--lr-theme-x, <default>)`) has a matching declaration in `theme.css` (both the `:root/.lr-light` block and, for color tokens with a distinct dark value, `.lr-dark`), and is added to `tokens.test.ts`'s `REQUIRED_THEME_INPUTS` array.

**Why.** theme.css's own header comment states it is 'the file a consumer copies to retheme the library, so every token it omits is a token they cannot discover.' Verified live: --lr-transition-fast/-base/-ambient, --lr-opacity-disabled, --lr-hover-brightness, --lr-popover-viewport-clamp, --lr-scroll-fade-size, --lr-color-shadow, --lr-shadow, plus all font-weight-*/line-height-*/border-width-*/border-radius-* tokens are bridged in tokens.styles.ts via --lr-theme-* but have zero occurrences anywhere in theme.css, and are absent from tokens.test.ts's REQUIRED_THEME_INPUTS allowlist -- so the one existing completeness test never flags the gap.

**How to verify.** Run: grep -oP '(?<=var\(--lr-theme-)[a-z0-9-]+' packages/lyra-ui/src/internal/tokens.styles.ts | sort -u then for each name run grep -c -- "--lr-theme-<name>:" packages/lyra-ui/src/theme.css -- any 0-count name is undocumented. Cross-check against the hardcoded REQUIRED_THEME_INPUTS array in packages/lyra-ui/src/internal/tokens.test.ts (~line 249) to confirm it's also missing there, which is why CI doesn't catch it.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/internal/tokens.styles.ts:227-229 (--lr-theme-transition-fast/-normal/-slow), :233 (--lr-theme-opacity-disabled), :238 (--lr-theme-hover-brightness), :243 (--lr-theme-popover-viewport-clamp), :77 (--lr-theme-color-shadow), :202 (--lr-theme-scroll-fade-size), :219 (--lr-theme-shadow-m) -- none appear in packages/lyra-ui/src/theme.css or in tokens.test.ts's REQUIRED_THEME_INPUTS list (packages/lyra-ui/src/internal/tokens.test.ts:249-278)

### `theming-contrast-test-tone-coverage` — medium

**Check.** Every semantic color-tone pair added to tokens.styles.ts (a --lr-color-<tone> / --lr-color-on-<tone> / --lr-color-<tone>-quiet triplet) is added to tokens.test.ts's expectPaletteContrast() tone list, not just the four original tones.

**Why.** tokens.test.ts already computes real WCAG contrast ratios for shipped color fallbacks (a strong, hand-built gate) but iterates a hardcoded ['brand','success','warning','danger'] tone array in two places -- --lr-color-neutral/--lr-color-on-neutral (added later for lr-button's appearance="accent" variant="neutral" fill) was never added to either loop, so its light/dark fallback contrast has never actually been computed by the test that exists specifically to do this.

**How to verify.** grep packages/lyra-ui/src/internal/tokens.test.ts for 'for (const tone of' (two hits) and confirm every --lr-color-<x>/--lr-color-on-<x> pair defined in tokens.styles.ts (grep '--lr-color-on-') appears in that array. Also note fallbackHex() only matches #[0-9a-f]{3,8} literals via regex -- a token whose fallback is rgb()/hsl()/color-mix() (e.g. --lr-color-overlay) would throw if added naively, so a non-hex fallback needs a different verification path, not silent omission.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/internal/tokens.test.ts:79 and :238 both hardcode ['brand','success','warning','danger'], omitting 'neutral' even though --lr-color-neutral/--lr-color-on-neutral are defined at packages/lyra-ui/src/internal/tokens.styles.ts:26,34 and consumed by packages/lyra-ui/src/components/forms/button/button.styles.ts:41-42

### `theming-state-rule-longhand-and-shared-token-completeness` — medium

**Check.** When a state/variant-conditional selector ([aria-pressed='true'], :host([tone=...]), :host([status=...]), etc.) sets multiple CSS longhands, every longhand gets its own dedicated --lr-<component>-<state>-<property> cssprop (falling back to today's exact value) -- not just the one a specific filed gap addressed while a sibling property in the same rule stays hardcoded. Separately, a shared/global --lr-color-* token consumed for two or more semantically distinct purposes within one component's shadow root should not be the sole override hook for either purpose -- decouple at least one with its own scoped cssprop, since forcing a consumer to ::part()-override a property with no cssprop can out-specificity and silently blot out the whole state rule for that part.

**Why.** Historically recurred at least 3 times independently before being fixed: lyra-chip's pressed-state rule got --lyra-chip-pressed-border but left background hardcoded to the resting --lyra-chip-bg in the same rule (fixed since -- background now separately reads var(--lr-chip-pressed-bg, var(--lr-chip-bg))); lr-segmented's checked-state background/color were hardcoded to the shared --lr-color-surface/-text tokens (also used elsewhere), so hovering an unselected segment repainted from the same hijacked token (fixed -- now --lr-segmented-selected-bg/-color); lr-chat-message's user-bubble background read the shared --lr-color-brand-quiet directly, the same token also driving [part=collapse-button]:hover elsewhere in the file (fixed -- now --lr-chat-message-user-bubble-bg, with an explicit JSDoc warning that a ::part(bubble) padding/radius override would otherwise outrank the per-status bubble tint rule).

**How to verify.** For a changed *.styles.ts: (1) list every CSS longhand set inside each state-selector block and confirm each reads a dedicated cssprop, not a bare literal or the resting-state token; (2) grep the same file for any --lr-color-*/--lr-space-* shared token appearing in 2+ different selectors serving visually distinct purposes -- if so, check whether at least one has a scoped override; (3) for any part with state-conditional styling, confirm the class JSDoc's @cssprop list covers every visual property that rule sets, not only color/background.

### `theming-ambient-animation-duration-token` — medium

**Check.** An infinite/looping ambient animation (a 'still alive'/pulse/typing/streaming indicator) must reference a dedicated slow/ambient duration token (--lr-transition-ambient), never the short interaction-speed token (--lr-transition-fast/-base) meant for one-shot hover/focus transitions.

**Why.** Recurred identically across three sibling components before being fixed: lyra-poll-status, lyra-typing-indicator, and lyra-stream-status's looping animations all read the ~180ms interaction-speed token for what's actually a ~1.8s calm ambient loop, and a stale source comment in one component even independently claimed that token was 'reserved for ambient motion.' All three now correctly reference --lr-transition-ambient (its own dedicated token, added specifically for this).

**How to verify.** grep 'animation:.*infinite' or 'animation-duration' in *.styles.ts and check the duration variable name is --lr-transition-ambient, not -fast/-base, for any animation with infinite iteration. Runtime check: getComputedStyle(el).animationDuration should be in the ~1.5-2s range, not ~120-180ms.

### `theming-visual-effect-token-no-op-default` — medium

**Check.** A custom property whose entire purpose is to visually distinguish a state from the base rendering (dimmed/muted/faded/disabled/highlighted opacity, scale, blur, filter) must not ship with a default equal to the 'no effect' identity value (opacity 1, scale 1, blur 0, filter: none) unless that's an explicit, justified additive-rollout decision stated in the doc comment.

**Why.** lr-graph's --lr-graph-dimmed-opacity shipped defaulting to 1 (fully opaque) -- the advertised node/link dimming feature was a complete visual no-op for every consumer who didn't know to override the token themselves, in both the CSS rule and the canvas draw path's JS fallback. Now fixed to default 0.35 in both places.

**How to verify.** For any newly-added token named *-dimmed-*/*-muted-*/*-inactive-*/*-faded-*, check its fallback value in the component's *.styles.ts (and any parallel JS default in the .class.ts render/draw path) against the CSS property's identity value. Confirmed-fixed reference: packages/lyra-ui/src/components/retrieval/graph/graph.styles.ts:129,132 (CSS, 0.35) and packages/lyra-ui/src/components/retrieval/graph/graph.class.ts:1063 (JS fallback, || 0.35).

## CROSS-COMPONENT-CONSISTENCY
### `xcomp-form-participation-wiring` — high

**Check.** Any component that renders a native `type="button"|"submit"|"reset"` control (or otherwise implies form participation) wires the same FormAssociated/`attachInternals()` + `closest('form')` handling that its sibling action component already implements, so `type="submit"`/`"reset"` and `form.elements` discovery actually work rather than being silently inert.

**Why.** lr-button previously shipped without this wiring (a documented prior bug: a shadow-internal native button's type=submit doesn't cross the shadow boundary into an ancestor form on its own); it was fixed by adding `static formAssociated = true`, `attachInternals()`, and explicit `closest('form')?.requestSubmit()`/`.reset()` handling. Its sibling lr-icon-button exposes the identical `type` property but never received the same fix.

**How to verify.** grep -n "type:.*'submit'" packages/lyra-ui/src/components/forms/*/*.class.ts to enumerate every component exposing a submit/reset-capable `type`, then grep -n "formAssociated\|attachInternals\|closest('form')" on each match — packages/lyra-ui/src/components/forms/icon-button/icon-button.class.ts returns nothing for the second grep (the whole file is 38 lines with no such handling), while packages/lyra-ui/src/components/forms/button/button.class.ts:94,120,166,168 has all three.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/forms/icon-button/icon-button.class.ts:29 declares `type: 'button' | 'submit' | 'reset' = 'button'` and renders `<button type=${this.type}>` (line 35) with no `formAssociated`, `attachInternals()`, or `closest('form')` anywhere in the file — a consumer setting `type="submit"` on `<lr-icon-button>` inside a `<form>` gets no submit behavior and no console warning, unlike its sibling packages/lyra-ui/src/components/forms/button/button.class.ts (lines 94, 120, 166, 168).

### `xcomp-form-control-chrome-parity` — high

**Check.** Every form-associated control (uses the `FormAssociated` mixin, or attaches `ElementInternals` directly) ships `label`/`hint`/`errorText` props plus matching named slots and `form-control-label`/`hint`/`error` CSS parts mirroring `lr-select`'s pattern, OR its class JSDoc explicitly states it's a deliberately bare primitive / genuinely incompatible with a generic frame.

**Why.** Codified in AGENTS.md as a cross-cutting guarantee ('a gap in an applicable component is a bug'), and historically violated repeatedly (lr-textarea, lr-model-select, lr-phone-input, lr-color-picker, lr-token-input, lr-checkbox-group each shipped without it before being fixed) -- worth a standing check on every new form-associated component even though the currently-shipped set is fully compliant (either full chrome, or an explicit 'Deliberately no label/hint/error chrome' carve-out sentence, as seen on lr-checkbox, lr-switch, lr-radio, lr-slider, lr-time-range).

**How to verify.** For each component using the FormAssociated mixin or calling `attachInternals()` directly (grep -rln 'attachInternals\|FormAssociated(' packages/lyra-ui/src/components/forms/*/*.class.ts), grep -n 'label\|hint\|errorText\|[Dd]eliberately' <file> and confirm either the full label/hint/errorText prop trio with matching slots/parts is present, or an explicit carve-out sentence exists in the class doc comment.

### `xcomp-sibling-prop-parity` — medium

**Check.** A component's props/slots (size scale, compact/dense variant, adornment start/end slots) match what structurally-identical siblings in the same functional family already standardized on, unless a documented reason exists for the omission.

**Why.** Multiple independent audit rounds (v8/v9/v10, the control-size-and-toolbar plan, the 5.1 audit) each found the same shape of gap for a different pair (select/toast-item size, stat/widget/empty compact, chip missing size, combobox missing size) and each got fixed piecemeal rather than by a systematic sweep, so new instances keep appearing.

**How to verify.** grep -n "@property" packages/lyra-ui/src/components/overlays/{badge,chip}/*.class.ts — chip.class.ts:94 declares `size: ChipSize = 'm'` while badge.class.ts has no size property anywhere in its 27-line file. Separately: grep -n '@slot start\|@slot end' packages/lyra-ui/src/components/forms/{select,combobox,input,date-picker}/select.class.ts combobox.class.ts input.class.ts date-input.class.ts — select.class.ts has neither slot while the other three (combobox.class.ts:68-71, date-input.class.ts:147-148) declare both.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/overlays/badge/badge.class.ts has no `size` property at all vs packages/lyra-ui/src/components/overlays/chip/chip.class.ts:94 (`size: ChipSize = 'm'`); also packages/lyra-ui/src/components/forms/select/select.class.ts declares no `start`/`end` adornment slots vs forms/combobox/combobox.class.ts:68-71 and forms/date-picker/date-input.class.ts:147-148 which both do.

### `xcomp-duplicated-structural-expression` — medium

**Check.** A repeated structural-index expression (e.g. a colspan/rowspan that must span 'every real column plus N conditional extra columns') is computed once and reused, not copy-pasted verbatim at every call site within the same render — so a future new structural column can't be added at some sites and silently missed at others.

**Why.** Flagged by name in the table pivot/heat-tint/totals plan as an existing risk in lr-table's own group-row and expanded-row full-width cells; the arithmetic is still hand-duplicated today rather than centralized.

**How to verify.** grep -n 'colspan=' packages/lyra-ui/src/components/data/table/table.class.ts — both matches read the identical expression `colspan=${this.columns.length + (hasExpand ? 1 : 0) + (hasRowTotal ? 1 : 0)}` verbatim; confirm there is no shared local variable (e.g. `const spanningColspan = ...`) computed once above render() that both sites reference instead.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/data/table/table.class.ts:1733 and :1808 both contain the identical `colspan=${this.columns.length + (hasExpand ? 1 : 0) + (hasRowTotal ? 1 : 0)}` expression, not extracted into a shared helper/variable.

### `xcomp-lean-full-split-duplication` — medium

**Check.** A component deliberately split into a bundle-size-lean variant and a full variant (`X.class.ts` / `X-core.class.ts`) keeps every private render/helper function it shares inside the pair's dedicated `*-shared.ts` module rather than re-duplicating it verbatim in both class files.

**Why.** `code-block-shared.ts` was created specifically to end exactly this kind of drift for the lr-code-block / lr-code-block-core pair (it already extracts codeBlockLineTransformer, codeBlockToggleLabel, codeBlockCopyLabel, etc.), which is itself evidence the duplication happened before -- but one more private method was never migrated in.

**How to verify.** diff <(sed -n '/private renderPlainCode/,/^  }/p' packages/lyra-ui/src/components/conversation/code-block/code-block.class.ts) <(sed -n '/private renderPlainCode/,/^  }/p' packages/lyra-ui/src/components/conversation/code-block/code-block-core.class.ts) — empty diff confirms byte-identical duplication (including comments); cross-check packages/lyra-ui/src/components/conversation/code-block/code-block-shared.ts's exports to confirm it doesn't already own this function.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/conversation/code-block/code-block.class.ts:511 and packages/lyra-ui/src/components/conversation/code-block/code-block-core.class.ts:458 both define a byte-identical private `renderPlainCode()` (comments included), despite code-block-shared.ts existing as the designated shared module for this exact pair.

### `xcomp-item-type-icon-parity` — low

**Check.** An 'item'-shaped data type (id/value + label, driving a repeated list of rows/steps) exposes the same optional fields -- at minimum a leading-icon field -- that structurally identical item-shaped types elsewhere in the library already support, unless there's a stated reason (e.g. a fixed status-driven glyph already occupies that visual slot).

**Why.** A recurring finding across two prior audit rounds for `SegmentedItem` (since fixed: it now has `icon?: unknown`); the same shape of gap persists today for `StepItem`, which structurally mirrors `PaletteItem`/`MentionItem`/`SegmentedItem` (id-or-value + label) but has no icon field, so a consumer can't give a wizard step (e.g. 'Payment') its own glyph the way a mention or node-palette entry can.

**How to verify.** sed -n '/export interface StepItem/,/^}/p' packages/lyra-ui/src/components/layout/stepper/stepper.class.ts shows only `id`/`label`/`state`/`title?` -- no `icon`. Compare against sed -n '/export interface PaletteItem/,/^}/p' packages/lyra-ui/src/components/retrieval/node-palette/node-palette.class.ts and sed -n '/export interface MentionItem/,/^}/p' packages/lyra-ui/src/components/utility/mention-popover/mention-popover.class.ts, both of which declare `icon?`.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/stepper/stepper.class.ts:17-23 (`StepItem`) has no `icon` field -- lr-stepper's render() (lines 313-341) only ever shows a checkmark glyph or a numeric index per step -- unlike packages/lyra-ui/src/components/retrieval/node-palette/node-palette.class.ts (`PaletteItem`) and packages/lyra-ui/src/components/utility/mention-popover/mention-popover.class.ts (`MentionItem`), which both carry `icon?`.

## SIZING-DENSITY-GEOMETRY
### `geometry-token-unit-assumption` — high

**Check.** A JS helper that reads a --lr-*-gap/-size/-width design token via getComputedStyle(...).getPropertyValue(...) and parses it into a pixel number for layout/canvas math must resolve the token's real used pixel value for whatever unit it carries (a live root/host font-size read for rem/em) rather than hardcoding a 16px/rem conversion or silently treating every non-rem unit as already-pixels.

**Why.** lr-mind-map's ringGapPx() special-cases only the substring 'rem' and multiplies by a hardcoded literal 16 in that case, otherwise passing the raw parseFloat() straight through -- so an app with a non-16px root font-size (a common accessibility/theming customization) gets systematically wrong ring spacing, and any em/ch/%/calc() override is silently treated as already-pixels. lr-table's minimumResizeWidth() shows the correct fix for the identical problem one file away: it multiplies by a live getComputedStyle(document.documentElement).fontSize for rem and getComputedStyle(this).fontSize for em.

**How to verify.** grep -rn "getComputedStyle(this).getPropertyValue" packages/lyra-ui/src/components --include=*.class.ts; for each hit feeding a parseFloat()/Number.parseFloat() used in layout or canvas-drawing math, check whether its rem/em branch reads a live getComputedStyle(...).fontSize call (correct) or a hardcoded literal like '* 16' (buggy).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/retrieval/mind-map/mind-map.class.ts:81-87 (`ringGapPx()`: `return raw.includes('rem') ? value * 16 : value;`); the identical hardcoded-16 pattern also appears in packages/lyra-ui/src/components/retrieval/graph/graph.class.ts:2065-2072 (`edgeLabelFontPx()`), though that instance carries an explicit code comment accepting it as a non-pixel-perfect decluttering heuristic for canvas label text rather than layout-critical geometry

### `icon-hit-target-min-size-unenforced` — high

**Check.** Every icon-sized interactive control (a <button>/role='button'/tabindex='0' element carrying a `part=`) must resolve its clickable box via `min-inline-size`/`min-block-size` (a floor letting larger slotted content grow it), not a hard `inline-size`/`block-size` alone, and must reach at least the shared `--lr-icon-button-size` minimum tappable target.

**Why.** packages/lyra-ui/scripts/check-hit-area.mjs (743 lines, with a documented 'hit-area-exempt' escape hatch) already implements exactly this static check, but is wired into no npm script and no CI workflow (confirmed by exhaustive repo-wide grep), so a future icon-only control that ships a hard, unfloored size -- or whose floor resolves under the WCAG 2.2 SC 2.5.8 24px minimum -- has zero automated gate today. The only CI-adjacent signal, contract-checklist.json's 'theme-and-target-size' entry, merely requires the literal substring 'minimum hit area' to appear somewhere in two named test files and proves nothing about any other component.

**How to verify.** run `node packages/lyra-ui/scripts/check-hit-area.mjs` directly against the working tree (it is not part of `pnpm lint` or ci.yml) for any PR touching an icon-button-shaped part; independently grep the touched styles.ts for `inline-size: var(--lr-icon-button-size)` / `block-size: var(--lr-icon-button-size)` and confirm `min-inline-size`/`min-block-size` (not a hard size alone) is what actually establishes the floor.

### `overflow-single-axis-phantom-scrollbar` — medium

**Check.** Any rule setting overflow-x (or overflow-y) to a non-'visible' value (auto/hidden/scroll/clip) must also set the other axis explicitly somewhere the same element resolves against, since per the CSS overflow spec the unset axis's used value is forced to 'auto' (never stays 'visible') once one axis is pinned non-visible -- risking a phantom/empty scrollbar from sub-pixel rounding.

**Why.** lr-tabs was already fixed for exactly this bug (overflow-x:auto with no overflow-y tripped a phantom vertical scrollbar on a 2-tab, non-overflowing tablist), but the identical single-axis overflow-x:auto pattern -- with zero overflow-y anywhere in the same stylesheet -- still ships unfixed in at least six other components, one of which (lr-timeline) explicitly cites lr-stepper's handling as its own model in a code comment, showing the fix never propagated past lr-tabs.

**How to verify.** grep -rn "overflow-x:\s*\(auto\|scroll\)" packages/lyra-ui/src/components --include=*.styles.ts; for each hit, grep the whole file for 'overflow-y' -- no hit means the axis is left implicit. Compare against packages/lyra-ui/src/components/layout/tabs/tabs.styles.ts:17-18 (overflow-x: auto; overflow-y: hidden;), the known-fixed reference.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/stepper/stepper.styles.ts:10 and :25 (overflow-x: auto, no overflow-y in the file); same pattern in data/timeline/timeline.styles.ts:44, data/tree/tree.styles.ts:12, agent-tools/trace-tree/trace-tree.styles.ts:12, utility/diff-view/diff-view.styles.ts:27, viewers/spreadsheet-viewer/spreadsheet-viewer.styles.ts:6, viewers/csv-viewer/csv-viewer.styles.ts:6, and charts/chart/lite-chart.styles.ts:44 (layout='scroll' only)

### `size-tier-height-inconsistent-across-controls` — medium

**Check.** The same `size` attribute value (unset/default, 's', 'l', 'xl', etc.) should resolve to the same control height across sibling form controls meant to sit in one row -- buttons next to inputs/selects/comboboxes -- unless the mismatch is deliberately documented.

**Why.** lr-button's own per-tier scale (2xs=1.25rem ... default m=2rem ... xl=3rem) does not match lr-input/lr-select/lr-combobox's shared min-height scale (xs=1.5rem ... default m=2.5rem ... xl=3.5rem) at any tier except 'xs' -- at the shared default size (unset/'m'), a button is 2rem (32px) tall next to a 2.5rem (40px) input/select/combobox, a 25% visible height mismatch with no cross-file comment acknowledging or justifying it in either component's stylesheet.

**How to verify.** read the :host([size='...']) custom-property blocks in packages/lyra-ui/src/components/forms/button/button.styles.ts (--lr-button-min-height / --lr-button-size-*) and compare the resolved px-equivalent at each tier against forms/input/input.styles.ts, forms/select/select.styles.ts, and forms/combobox/combobox.styles.ts (--lr-*-control-min-height / --lr-*-trigger-min-height) for the same size value.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/forms/button/button.styles.ts:25 (--lr-button-min-height resolves to var(--lr-button-size-m) = 2rem) vs packages/lyra-ui/src/components/forms/input/input.styles.ts:9 (--lr-input-control-min-height: var(--lr-size-2-5rem) = 2.5rem) at the shared default tier; same 0.5rem gap recurs at size='l' and size='xl'

### `card-chrome-missing-compact-escape-hatch` — medium

**Check.** A component whose [part='base'] (or root) unconditionally draws card chrome (border, and usually background/padding) and is documented as rendering inside a list, feed, or transcript needs a `compact` boolean and/or `appearance="plain"` variant, matching the convention already established across most of the component family.

**Why.** A prior systemic pass added this escape hatch to nine named components (lr-agent-run, lr-entity-card, lr-source-card, lr-stat, etc.), but lr-commit-card, lr-result-card, and lr-checkpoint each still draw an unconditional border with zero occurrences of 'compact' or 'appearance' anywhere in their stylesheets -- despite lr-result-card's own class doc describing it as 'a small bordered card shell for a custom tool-result' (implying list placement) and lr-checkpoint's doc describing it as an inline marker rendered 'between messages' in a transcript, the exact doubled-border/oversized-row risk contexts the rest of the family was fixed for.

**How to verify.** for every *.styles.ts with an unconditional `border:`/`background` rule on [part='base'], grep the same file for 'compact' and 'appearance'; a zero-hit result on a component whose class-doc JSDoc mentions list/feed/transcript usage is the signature. e.g. `grep -Ln 'compact\|appearance' packages/lyra-ui/src/components/agent-tools/commit-card/commit-card.styles.ts packages/lyra-ui/src/components/agent-tools/result-card/result-card.styles.ts packages/lyra-ui/src/components/conversation/checkpoint/checkpoint.styles.ts`.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/agent-tools/commit-card/commit-card.styles.ts:8 (unconditional border, 0 hits for compact/appearance in the file); packages/lyra-ui/src/components/agent-tools/result-card/result-card.styles.ts:10 (same); packages/lyra-ui/src/components/conversation/checkpoint/checkpoint.styles.ts:46,91 (same)

### `compact-variant-incomplete-dimension-override` — low

**Check.** A `:host([compact])` (or similarly named density) rule must override every layout dimension the base (non-compact) rule sets for the same part -- padding, gap, and font-size together -- not silently leave one of them at the non-compact value.

**Why.** lr-widget's `:host([compact])` rules touch only [part='header']/[part='body'] padding; the base [part='header'] rule separately sets `gap: var(--lr-space-s)` which the compact override never reduces, so a compact widget's header padding shrinks but its internal icon-to-title gap does not -- an incomplete density reduction. lr-file-input, lr-attachment-chip, and lr-conversation-item all scope padding + gap + font-size together under one `:host([compact])` selector, showing this is the established, sometimes-skipped convention rather than an unsolved problem.

**How to verify.** grep -rl ":host(\[compact\])" packages/lyra-ui/src/components --include=*.styles.ts; for each file, list every property the compact rule sets per part and diff it against every property the base (unscoped) rule sets for that same part -- `gap` and `font-size` are the properties most often left out.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/widget/widget.styles.ts:173-178 (:host([compact]) [part='header']/[part='body'] set only padding) vs widget.styles.ts:28 ([part='header'] base rule sets gap: var(--lr-space-s), never touched under [compact])

## COMPONENT-GAPS
### `component-gaps-icon-svg-namespace-clone` — high

**Check.** `<lr-icon>`'s slotted-content normalizer must not silently break a slotted custom element (a hyphenated tag name) by re-creating it via `document.createElementNS` in the SVG namespace — that produces a dead node with the same tag name that never upgrades.

**Why.** `cloneSvgNode()` unconditionally calls `createElementNS(svgNS, node.localName)` for every Element it walks with no check for a hyphenated `localName`; slotting `<lr-flag>` (or any other custom element) inside `<lr-icon>` silently produces an inert SVG-namespaced element with the same tag, and no existing test exercises this path.

**How to verify.** Open packages/lyra-ui/src/components/utility/icon/icon.class.ts:56-70 (`cloneSvgNode`); confirm there is no `node.localName.includes('-')` (or `customElements.get(...)`) guard before the `createElementNS` call. Confirm no coverage: grep -n 'custom-copy\|customElements\|localName.includes' packages/lyra-ui/src/components/utility/icon/icon.test.ts returns nothing.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/utility/icon/icon.class.ts:62-70 (cloneSvgNode, createElementNS call at line 64) — no hyphenated-tag guard, no test coverage

### `component-gaps-src-fetch-safe-and-sanitize` — high

**Check.** Any component that fetches a consumer-supplied `src` URL and injects the response as markup must gate the URL through `safeFetchUrl()` before ever calling `fetch()`, and must run the fetched text through a DOMPurify `sanitize()` call (with no conditional bypass) before it reaches `unsafeHTML()`/`unsafeSVG()`.

**Why.** Every current src-fetching viewer already follows this contract (docx, svg, pdf, archive, calendar, html, contact, csv, dataset, document-preview, ebook, include, pptx, notebook, email, geojson, spreadsheet viewers all pair `safeFetchUrl(this.src)` with a DOMPurify/sanitizer call before unsafeHTML/unsafeSVG) — the contract holds today precisely because reviewers keep enforcing it by hand; nothing in the automated gate chain checks the pairing, so a new viewer that fetches+injects without both halves would ship an SSRF or XSS hole undetected.

**How to verify.** For a new or changed component: grep -n "fetch(" <file>.class.ts and confirm a `safeFetchUrl(` call gates the URL first (import from '../../../internal/safe-url.js'); separately grep -n "unsafeHTML(\|unsafeSVG(" and confirm every reachable path is wrapped in a `DOMPurify.sanitize(`/`sanitizer.sanitize(` call with no branch that skips it.

### `component-gaps-viewer-family-search-anchor-parity` — medium

**Check.** Every component in the document/text-content 'viewer' family (pdf, markdown, json, csv, dataset, ebook, notebook, spreadsheet, svg, diff, document-preview, docx) exposes the shared search()/scrollToAnchor()/highlights contract that most siblings already carry; a new or existing sibling missing all three is a gap, not an oversight to wave through.

**Why.** Family H (2026-07-16) rolled search/anchor/highlight support out to most viewers, but nine siblings never got it: archive-viewer, calendar-viewer, contact-viewer, email-viewer, geojson-view, html-viewer, include, pptx-viewer, and xml-viewer have zero occurrences of search(/scrollToAnchor/highlights/anchor anywhere in their class files, while pdf-viewer/markdown/json-viewer etc. all implement it.

**How to verify.** Run: for f in src/components/viewers/*/*.class.ts; do grep -qE "search\(|scrollToAnchor|highlights" "$f" || echo "$f"; done — any hit is a candidate; confirm it is genuinely a text/document-shaped viewer (not e.g. a binary/media viewer) before flagging.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/viewers/html-viewer/html-viewer.class.ts (whole file — no anchor/search/highlight code at all; compare to src/components/viewers/pdf-viewer/pdf-viewer.class.ts:694 search())

### `component-gaps-list-reorder-parity` — medium

**Check.** Every list/tree component whose data model implies a meaningful, consumer-visible order (task-list, file-tree, node-palette, and similar) exposes the same `reorderable` opt-in + `lr-reorder` request event that `<lr-tree>` already ships, rather than leaving consumers to hand-roll move-up/move-down buttons.

**Why.** `<lr-tree>` added `reorderable`/`lr-reorder` (Ctrl/Cmd+ArrowUp/ArrowDown) in the 5.1 audit remediation, but the capability never propagated to its order-sensitive siblings.

**How to verify.** grep -n "reorderable\|lr-reorder" packages/lyra-ui/src/components/agent-tools/task-list/task-list.class.ts packages/lyra-ui/src/components/data/file-tree/file-tree.class.ts packages/lyra-ui/src/components/retrieval/node-palette/node-palette.class.ts — compare against packages/lyra-ui/src/components/data/tree/tree.class.ts:81 (`reorderable` property) and :326 (`emit('lr-reorder', ...)`).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/agent-tools/task-list/task-list.class.ts and packages/lyra-ui/src/components/data/file-tree/file-tree.class.ts — neither contains 'reorderable' or 'lr-reorder' anywhere, versus src/components/data/tree/tree.class.ts:81

### `component-gaps-grouped-list-fixed-taxonomy` — low

**Check.** A virtualized/grouped list component whose `grouping` option is a fixed enum of pre-built strategies (e.g. `'source' | 'none'`) should also offer a function-based escape hatch (`groupBy`/custom grouping) matching the same pattern `<lr-thread-list>` already established for arbitrary domain-key grouping.

**Why.** `<lr-thread-list>` already generalized `grouping` to include a `'custom'` mode backed by a `groupBy` callback (plus `groupLabel`/`groupOrder`), proving the fix is a known, applicable pattern — but the sibling `<lr-retrieval-results>` still only supports the fixed `'source' | 'none'` enum with zero groupBy/groupLabel/groupOrder hooks, so a consumer needing e.g. a custom bucket key must abandon its built-in virtualization/dedup pipeline.

**How to verify.** grep -n "grouping" packages/lyra-ui/src/components/retrieval/retrieval-results/retrieval-results.class.ts — confirm the type is a closed union with no `groupBy`-style property nearby; compare with packages/lyra-ui/src/components/conversation/thread-list/thread-list.class.ts:185-198 (`grouping: 'date' | 'custom' | 'none'` plus `groupBy`/`groupLabel`/`groupOrder`).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/retrieval/retrieval-results/retrieval-results.class.ts:169 (`grouping: 'source' | 'none'`, no groupBy/groupLabel/groupOrder anywhere in the file)

### `component-gaps-color-override-no-legend` — low

**Check.** Any component that lets a consumer fully override per-datum color (a `color`/`colorFor`-style field or callback driving the render, not just a fixed built-in palette) should expose a matching legend mechanism (a `legend`/`showLegend` property, slot, or CSS parts) so the consumer isn't forced to hand-roll swatch+label markup to explain the scheme they configured.

**Why.** `<lr-heatmap>` and `<lr-sequence-strip>` both closed this gap (legendStops/showLegend with legend/legend-item/legend-swatch parts), proving the fix pattern — but `<lr-word-cloud>` still lets a consumer set a fully custom `word.color` per item or a `word.group`-keyed palette assignment with zero legend property, slot, or part anywhere in the component.

**How to verify.** grep -n "legend\|Legend" packages/lyra-ui/src/components/data/word-cloud/word-cloud.class.ts (expect zero hits); compare with packages/lyra-ui/src/components/data/heatmap/heatmap.class.ts (`legendStops`) and packages/lyra-ui/src/components/data/sequence-strip/sequence-strip.class.ts:69 (`showLegend`).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/data/word-cloud/word-cloud.class.ts:302-306 (per-word `word.color` / `word.group`-keyed colorFor with no legend property, slot, or part in the file)

## DOCS-MANIFEST-TYPES
### `docs-example-root-barrel-import` — high

**Check.** A usage example in llms.txt/llms/<family>.md for a standalone helper function (toast(), confirm(), etc.) imports from the granular subpath entry point that actually registers just that function's dependency chain, never the bare `@aceshooting/lyra-ui` root barrel.

**Why.** The root barrel is an ~80+-component side-effect-import chain; a consumer who copies a barrel-import example for one helper regresses their eager bundle by nearly the whole library (a real prior incident measured +79KB gzip for confirm() alone, which is why confirm()'s own example was already fixed to `@aceshooting/lyra-ui/components/overlays/dialog/confirm.js`) -- but the sibling `toast()` helper right below it in the same file was never fixed to match.

**How to verify.** grep -n "from '@aceshooting/lyra-ui'" packages/lyra-ui/llms/*.md -- for every match, confirm the function/component being imported has no dedicated `.../components/<family>/<name>/<entry>.js` subpath shown instead; cross-check the function's own registration file (e.g. toaster.ts) to see it's independently importable.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/llms/overlays.md:73 and :88 -- `import { toast } from '@aceshooting/lyra-ui';` in the `toast()` usage example, even though `toaster.ts` (the module `toast` is actually exported from) is independently reachable via `@aceshooting/lyra-ui/components/overlays/toast/toaster.js`, exactly mirroring the pattern already fixed two sections above for `confirm()` (llms/overlays.md:369, `@aceshooting/lyra-ui/components/overlays/dialog/confirm.js`).

### `component-jsdoc-block-directly-above-export-class` — high

**Check.** A component's `@customElement`/`@csspart`/`@event`-bearing JSDoc block sits in the source file immediately above `export class Lyra*`, never above a preceding `Lyra*EventMap` interface or an intermediate `Lyra*Base` class declaration that comes between the comment and the real class.

**Why.** The custom-elements-manifest analyzer attributes a JSDoc comment to whatever declaration immediately follows it; when an EventMap interface or a FormAssociated `*Base` class sits between the doc comment and `export class`, the analyzer silently misattributes (or drops) the block, emptying that component's cssParts/events/description in custom-elements.json. This exact shape previously hit 42 of 86 classes library-wide and even recurred a second time in newly-shipped components after a first remediation pass, precisely because nothing checks placement itself -- only downstream symptoms (an empty description, a documented part that's 'not rendered') are ever caught, and often only after the manifest is regenerated.

**How to verify.** For a given `<name>.class.ts`, find the line containing `@customElement`; walk forward to that comment block's closing `*/`; the next non-blank line must match `^export (abstract )?class`. If instead an `export interface *EventMap` or a `class *Base extends LyraElement` sits in between, the block is misattributed. (Verified today: 0/249 current component class files violate this -- the last systemic occurrence was fully remediated -- but no dedicated script enforces the placement rule itself, only its downstream symptoms, so a regression in a newly-authored component would not be caught until a much later manifest-diff or description-completeness spot check.)

### `docs-prose-content-accuracy-beyond-name-presence` — medium

**Check.** A behavioral claim, numeric default, or cross-component parity statement written into a component's `llms/<family>.md` section (or its source `@cssprop`/`@csspart` JSDoc annotation, or a README row) is independently true against the current source/computed behavior -- not just that the property/event/part *name* is mentioned somewhere in the section.

**Why.** `check-llms-freshness.mjs`/`llms-gaps.mjs` only assert that a manifest member's name string occurs in the doc section's text; the surrounding prose can misstate a value, a percentage, or a claimed parity and still pass. This exact shape recurred repeatedly and independently across audits: llms-full.txt once claimed lr-entity-card's quiet-tint was 10% when shipped code used 8%; lr-date-input's docs once claimed its size tiers were height-matched with lr-input's when a floor token meant they never were; lr-segmented's `size` property shipped in source but stayed undocumented across two separate audit rounds.

**How to verify.** For any component whose review surfaces a numeric default, percentage, or 'X matches Y' claim in its llms/<family>.md prose or its class JSDoc @cssprop annotation, open the real source (.class.ts/.styles.ts) or write a quick getComputedStyle check and confirm the literal value; grep the doc for hedge words ('matches', 'height-matched', 'parity', '%', a bare numeric default) as the trigger to go verify.

### `docs-phantom-tag-reference` — medium

**Check.** Every `lr-*`/`lyra-*` custom-element tag name that appears inside a code-fence usage example in llms.txt/llms-full.txt/llms/<family>.md is an actually-registered tag in custom-elements.json -- not a name that only exists in prose.

**Why.** `check-llms-artifacts.mjs` validates that every quoted `@aceshooting/lyra-ui/components/...` *import path* resolves to a real module, but never validates bare `<tag>` mentions inside an HTML code fence against the real tag list -- a doc author can reference a plausible-sounding tag that was never shipped (a prior incident: a lyra-tool-result-dialog usage snippet showed a `<lyra-tab-panel>` element that was never registered anywhere), and a reader following the example literally hits a dead end.

**How to verify.** grep -oE '</?lr-[a-z0-9-]+' packages/lyra-ui/llms-full.txt (and llms/*.md) | sed 's/^<\/\?//' | sort -u, then diff that set against the real tag list extracted from custom-elements.json's `declarations[].tagName` entries -- any doc-only tag is the finding.

### `cross-cutting-exemption-stated-in-class-jsdoc` — low

**Check.** When a component structurally qualifies for a cross-cutting convention (label/hint/error chrome on a form-associated control, resize forwarding on a text-editing surface, etc.) but deliberately omits it, the component's own class JSDoc states the omission explicitly -- silence is treated as a bug, not an assumed exception.

**Why.** AGENTS.md's own form-control-completeness rule states this in as many words ('silence isn't an exception on its own... states it explicitly in its class doc comment'); two components (lr-slider, lr-chat-composer) were previously found lacking that sentence despite the omission itself being legitimate -- the finding is the missing sentence, independent of whether the underlying design choice is correct, and nothing except manual review can ever assess this since it requires judging design intent.

**How to verify.** For any FormAssociated (or otherwise form-control-shaped) component missing label/hint/error slots or props, grep its class JSDoc for 'deliberately'/'no label'/'bare primitive'/an equivalent explicit carve-out sentence; absence of such a sentence is the finding regardless of whether the omission itself is defensible.

## LIFECYCLE-AND-SSR
### `lifecycle-reconnect-resets-transient-open-state` — high

**Check.** A component that owns floating-ui/positioner-driven transient UI (open dropdown/listbox, hover/focus preview popover, tooltip) must reset that state (or otherwise re-arm positioning) in disconnectedCallback, so a disconnect immediately followed by a reconnect (drag-drop reparent, list virtualization/reordering) can never leave the popup rendered visually open with a torn-down positioner and no live position/dismissal.

**Why.** combobox/select/date-input/model-select/voice-picker/mention-popover all explicitly set `this.open = false` in disconnectedCallback with an inline comment explaining exactly this race, and popover/tooltip/dialog instead re-arm from connectedCallback — but four newer components in the same 'hover/focus preview' family (tool-call-chip, usage-badge, citation-badge, entity-chip) tear down their `cleanupPositioner` on disconnect without resetting the `@state() tooltipOpen`/`popoverOpen` flag driving `?hidden=`, so `updated()`'s `changed.has('...Open')`-gated re-position branch never re-fires on reconnect and the panel is left showing at a stale, frozen position with no click-through comparison.

**How to verify.** grep -rn "cleanupPositioner" packages/lyra-ui/src/components --include=*.class.ts, then for each hit open the file's disconnectedCallback and confirm it also resets whichever @state() boolean drives that positioner (`popoverOpen = false` / `tooltipOpen = false`), not just `cleanupPositioner?.()`. AGENTS.md's own testing section (`src/lifecycle-contracts.test.ts` reconnect-smoke/leak-contract) only proves reconnect doesn't throw/leak — it explicitly does NOT prove component-specific state resumes correctly, so this class of bug passes the global suite silently; write a fixture that opens the popover, calls `el.remove(); container.append(el)`, and asserts the popover is no longer visually 'open' (or is correctly repositioned) afterward.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/retrieval/citation-badge/citation-badge.class.ts:194 (also entity-chip.class.ts:81, tool-call-chip.class.ts:276, usage-badge.class.ts:106) — disconnectedCallback calls this.cleanupPositioner?.() but never resets popoverOpen/tooltipOpen

### `lifecycle-optional-peer-missing-fails-silently` — high

**Check.** A component whose entire rendered output depends on an optional peer dependency (chart.js, d3, maplibre-gl) that fails to load must fail closed into a visible, accessible error state (role="alert" with a localized message) rather than just flipping a loading flag off and returning — leaving an empty/broken canvas with no on-page signal that anything is wrong.

**Why.** docx-viewer, pptx-viewer, ebook-viewer, pdf-viewer, and qr-code all render `<div part="error" role="alert">` when their respective peer/library fails, but lr-chart, lr-box-plot (chart family), lr-graph (d3), and lr-map (maplibre-gl) all use the identical `this.loading = false; if (!mod) return;` shape in their load-then() callback with zero error state set anywhere afterward — the only observable trace is a console.warn from the loader module, and render() has no branch that would ever show role="alert" for this case.

**How to verify.** grep -n "this.loading = false;" packages/lyra-ui/src/components/charts/chart/chart.class.ts packages/lyra-ui/src/components/charts/chart/box-plot.class.ts packages/lyra-ui/src/components/retrieval/graph/graph.class.ts packages/lyra-ui/src/components/media/map/map.class.ts, then check the very next lines for `if (!mod) return;` / `if (!mods || !this.isConnected) return;` with no prior assignment to an error-state field; separately grep the same files for `role="alert"` and confirm it's absent from render(). Reproduce by stubbing the loader (chart-loader.ts's `loadChartJs`/graph-loader's `loadD3`/map's `loadMaplibre`) to resolve `null` in a test and asserting the shadow root shows a role="alert" element — currently none of the four would pass that assertion.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/charts/chart/chart.class.ts:291-292 (this.loading = false; if (!mod) return;); same shape at box-plot.class.ts:146, graph.class.ts:546, map.class.ts:269

### `lifecycle-super-call-omitted` — medium

**Check.** A component overriding a Lit/DOM lifecycle method (willUpdate, updated, connectedCallback, disconnectedCallback) must call the matching super.<method>(...) somewhere in its body, even when the immediate base class implementation is a no-op today — a mixin applied further down the prototype chain later will silently stop running that hook otherwise.

**Why.** Nearly every component in the codebase follows this correctly (e.g. csv-viewer.class.ts, docx-viewer.class.ts, pdf-viewer.class.ts all call `super.willUpdate(changed)` with a comment noting it reaches DocumentAnchorTarget's mixin logic), which is exactly the failure mode this guards against — but lr-graph's own willUpdate override has no super.willUpdate() call anywhere in its ~50-line body, so if a future mixin (e.g. a shared DocumentAnchorTarget-style behavior) is layered under LyraGraph, its willUpdate would silently never run.

**How to verify.** For each file matching `grep -rl "  willUpdate(\|  updated(changed\|  connectedCallback()\|  disconnectedCallback()" packages/lyra-ui/src/components --include=*.class.ts`, confirm `grep -c "super.<method>(" <file>` is nonzero (search the whole file body, not just the first line after the signature, since some components call super as the last statement). A file defining the method with zero occurrences of the matching super call anywhere is the defect.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/retrieval/graph/graph.class.ts:1391 — protected willUpdate(changed) has no super.willUpdate(changed) call anywhere in its body

### `lifecycle-attachinternals-unguarded-in-constructor` — medium

**Check.** A component (or shared mixin) that calls attachInternals() — or any other browser-only API — unconditionally in its constructor will throw for any consumer whose test environment lacks a real implementation of that API (e.g. jsdom/happy-dom's absent ElementInternals), hard-crashing on mere construction rather than degrading gracefully.

**Why.** Every form-associated component in the library (the shared FormAssociated mixin plus every hand-rolled ElementInternals user: combobox, select, checkbox, switch, radio, checkbox-group, time-range, model-select, voice-picker, tool-param-form, rubric-form, graph-query-builder, token-input, button) calls `this.internals = this.attachInternals();` directly in its constructor with no `typeof` feature-detection or try/catch — this repo's own suite runs on real Chromium/Firefox/WebKit so it never notices, but a downstream consumer's Vitest+happy-dom (or similar) suite has no ElementInternals implementation at all, so merely importing/constructing any of these ~14 components throws before any test assertion runs.

**How to verify.** grep -rn "attachInternals()" packages/lyra-ui/src --include=*.ts (excluding tests) and confirm each call site — check both the shared mixin's constructor and every hand-rolled one — has no preceding `typeof (window as any).ElementInternals` (or equivalent) guard and no surrounding try/catch. Reproduce by constructing `new (customElements.get('lr-checkbox'))()` (or any listed tag) in a plain Node/happy-dom context with no ElementInternals polyfill and confirming it throws.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/internal/form-associated.ts:87 (this.internals = this.attachInternals(); inside the FormAssociated mixin constructor, no guard); same unguarded shape repeated at checkbox.class.ts:242, switch.class.ts:178, select.class.ts:194, combobox.class.ts:263, radio.class.ts:116, model-select.class.ts:193, voice-picker.class.ts:160, time-range.class.ts:145, tool-param-form.class.ts:162, checkbox-group.class.ts:158, rubric-form.class.ts:128, graph-query-builder.class.ts:201, token-input.class.ts:152, button.class.ts:120

## STATES-AND-AFFORDANCE
### `states-disabled-gates-every-self-rendered-subcontrol` — high

**Check.** Every interactive sub-element a component renders itself (a nested textarea, a submit/remove/nav button inside a detail panel, etc.) is bound to `?disabled=${this.disabled}` (or `this.effectiveDisabled`), not just the component's primary control — so the whole component being disabled actually prevents every path to mutating state or submitting.

**Why.** A component's top-level disabled property is easy to wire into the main control and easy to forget on a secondary control added later in the same render tree (e.g. inside a conditionally-rendered detail panel), leaving a real functional gap: the control still reads as 'disabled' but a nested action remains fully clickable.

**How to verify.** Open the component's render() and locate every top-level `?disabled=${this.disabled}` binding, then check every other <button>/<textarea>/<input> rendered anywhere in the same template (including conditional branches) for a matching binding. `grep -n 'disabled' <file>` and manually diff against every `<button`/`<textarea` occurrence in the file.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/conversation/message-feedback/message-feedback.class.ts:255 (<textarea part="comment"> has no ?disabled binding) and :263 (<button part="submit-button"> has no ?disabled binding), even though the sibling thumb buttons at line 220 correctly bind ?disabled=${this.disabled}

### `states-hover-missing-with-focus-visible` — medium

**Check.** Every interactive part that has a :focus-visible rule (or cursor:pointer) in its *.styles.ts also has a :hover rule for the same selector, so mouse users get the same 'this is interactive' feedback keyboard users already get from the focus ring.

**Why.** This is the single most-repeated finding across the mined archive (5+ independent raw filings) and the repo's own git history shows four prior remediation commits ('add missing :hover across six ... components') for exactly this class — yet a fresh grep today still turns up ~23 more component style files with :focus-visible and zero :hover.

**How to verify.** Run: for f in $(grep -l ':focus-visible' packages/lyra-ui/src/components/*/*/*.styles.ts); do grep -q ':hover' "$f" || echo "$f"; done — any file listed is a live violation. Then open the file at the :focus-visible line to confirm it targets a real clickable part (not a decorative element).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/forms/switch/switch.styles.ts:21 ([part='base']:focus-visible with zero :hover in the file); also packages/lyra-ui/src/components/overlays/rating/rating.styles.ts:6, packages/lyra-ui/src/components/forms/textarea/textarea.styles.ts:40, packages/lyra-ui/src/components/media/file-input/file-input.styles.ts:40, plus ~19 more files (heatmap, flow-canvas, slider, code-editor, csv-viewer, virtual-list, mind-map, spreadsheet-viewer, document-compare, image-comparer, etc.)

### `states-overlay-must-use-shared-overlay-manager` — medium

**Check.** Any component that dismisses itself on Escape and/or manages focus-return for a popup/overlay-like surface registers with the shared `internal/overlay-manager.ts` (`activateOverlay()`) instead of hand-rolling its own `document.addEventListener('keydown', ...)` — so only the topmost overlay reacts to Escape and the listener is scoped to the right document.

**Why.** The repo already built a proper shared overlay-manager (topmost-stack tracking, ownerDocument-scoped, background-inert) and it IS correctly adopted by lr-dialog, lr-tool-select-dialog, lr-tool-approval-dialog, lr-tool-result-dialog, lr-responsive-panel, lr-app-rail, and lr-widget — but the popup primitives underneath lr-popover/lr-tooltip's virtual-anchor mode were never migrated onto it, so the exact stacking/hardcoded-document bug the manager was built to fix still exists one layer down.

**How to verify.** grep -rn "document.addEventListener('keydown'" packages/lyra-ui/src/components --include=*.class.ts and check each hit imports/calls `activateOverlay` from `internal/overlay-manager.js` rather than binding straight to the global `document`.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/overlays/overlay/popover.class.ts:69 (`document.addEventListener('keydown', this.onVirtualAnchorKeyDown)`) and packages/lyra-ui/src/components/overlays/overlay/tooltip.class.ts:65 (identical pattern) — neither imports overlay-manager, so two nested virtual-anchor popovers/tooltips both close on one Escape press and the listener is hardcoded to the global `document` instead of `this.ownerDocument`

### `states-empty-result-not-rendered-as-error` — medium

**Check.** A genuinely-empty-but-structurally-valid result (e.g. a well-formed calendar with zero events) is surfaced through a distinct part/role from a real fetch/parse failure — not thrown as the same user-facing error and funneled into the identical `part='error' role='alert'` DOM path.

**Why.** Conflating 'nothing to show' with 'something broke' both misleads a sighted user reading the error-styled chrome and, more importantly, announces role="alert" to screen-reader users for a state that isn't actually an error.

**How to verify.** Open the component's parse/fetch method and check whether an empty-but-valid result path calls the same error constructor / sets the same `fetchState.kind = 'error'` used for genuine failures; confirm by tracing where that state lands in render() (`grep -n "case 'error'"`).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/viewers/calendar-viewer/calendar-viewer.class.ts:87 (`if (!events.length) throw new LyraUserFacingError(this.localize('calendarViewerEmpty'))`) feeds the same `case 'error': return html`<div part="error" role="alert">...` branch at line 99 used for a genuine ICS parse failure

### `states-hover-specificity-beats-part-override` — low

**Check.** An internal :hover/:active rule on an interactive part is written with :where() around its class/attribute selectors (e.g. `:where(.foo):hover:where(:not(:disabled))`) so its specificity never exceeds a consumer's `::part(x):hover` override, which can't use !important as a house style.

**Why.** Two prior fixes (lr-attachment-trigger, lr-copy-button) show this exact bug shape was already found and patched with a documented :where() technique, but the technique was applied to only those two files — a bare class-selector + :hover/: not(:disabled) combo elsewhere still out-specificities the documented ::part() theming escape hatch.

**How to verify.** grep -rn ':hover' packages/lyra-ui/src/components/*/*.styles.ts and flag any rule whose selector combines a bare class/attribute selector with `button`/element type (not wrapped in :where()) on an element that also exposes a dynamic or static `part=`; compute specificity by hand against the equivalent `::part(x):hover` ((0,1,1)) to confirm the internal rule would win.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/conversation/code-block/code-block.styles.ts:231 ([part='pre'] button.line:hover, specificity (0,3,1) vs. a consumer's ::part(line-button):hover at (0,1,1)); also packages/lyra-ui/src/components/utility/json-viewer/json-viewer.styles.ts:48,51 (.row:hover [part='copy-button']) and packages/lyra-ui/src/components/viewers/xml-viewer/xml-viewer.styles.ts:142

### `states-state-color-needs-component-cssprop-indirection` — low

**Check.** A state-attribute selector (`[data-active]`, `[aria-selected='true']`, `:host([selected])`, etc.) that changes color/background references a per-component `--lr-<tag>-<state>-<prop>` custom property (with an inline `var(--lr-color-*, ...)` fallback), not a bare shared `--lr-color-*` token directly — so a consumer can retheme just this component's state without hijacking the global token for every other component.

**Why.** A 2026-07-20 audit already catalogued 44 instances of this shape across nearly every family as a systemic theming gap; a fresh check on two of the named example components confirms it is still live and unfixed.

**How to verify.** grep a component's *.styles.ts for a state-attribute selector (`[data-active]`, `[aria-selected='true']`, `:host([selected])`) and check whether its declaration references a bare `--lr-color-*`/`--lyra-color-*` token with no `--lr-<tag>-<state>-<prop>` indirection layer in between; cross-check with `grep -n '\-\-lr-<tag>-' <file>` to see if any such component-scoped custom property exists at all for that state.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/forms/select/select.styles.ts:171-174 ([part='option']:hover, [part='option'][data-active] { background: var(--lr-color-brand-quiet); } with no --lr-select-option-active-bg declared anywhere in the file) and packages/lyra-ui/src/components/forms/combobox/combobox.styles.ts:252-255 (identical pattern)

## PACKAGING-AND-BUNDLING
### `packaging-optional-peer-loader-module-shape-fallback` — high

**Check.** An optional-peer *-loader.ts that reads `.default` off a dynamically-imported module must fall back to the bare module namespace when `.default` is absent, the way spreadsheet-loader.ts, qr-code-loader.ts, archive-loader.ts, calendar-loader.ts, docx-loader.ts, ebook-loader.ts, and email-loader.ts all already do.

**Why.** Different bundler/interop configurations resolve a CJS-published optional peer as either `{ default: X }` or the bare module; assuming only the `.default` shape silently substitutes `undefined` for the real library under the other resolution -- for the three dompurify-loader.ts copies this means HTML sanitization silently no-ops instead of throwing, a live security-relevant path, not just a bundling nuisance.

**How to verify.** Open each and confirm the missing `?? module` / `'default' in mod` fallback: packages/lyra-ui/src/components/viewers/html-viewer/dompurify-loader.ts:10, packages/lyra-ui/src/components/viewers/notebook-viewer/dompurify-loader.ts:10, packages/lyra-ui/src/components/viewers/svg-viewer/dompurify-loader.ts:10 (all `return (await importDompurify()).default;`), packages/lyra-ui/src/components/conversation/markdown/markdown-loader.ts:50 (`DOMPurify = (await importDompurify()).default;`), and packages/lyra-ui/src/components/charts/chart/chart-loader.ts:44 (`zoomPlugin = (await importZoom()).default;`). Compare against the correct shape at packages/lyra-ui/src/components/viewers/spreadsheet-viewer/spreadsheet-loader.ts:11-12.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/viewers/html-viewer/dompurify-loader.ts:10

### `packaging-sideeffects-registration-completeness` — medium · auto-gated

**Check.** Every component's registration entry point (the file calling defineElement()) has both its ./src/ and ./dist/ forms listed in package.json#sideEffects, its *.class.ts sibling contains no defineElement() call, and its tag appears in exactly one of ROOT_BARREL_TAGS / ROOT_BARREL_OPTIONAL_PEER_TAGS in src/internal/root-registration-allowlist.ts, matching the full manifest tag set.

**Why.** This exact defect class (a tree-shaking bundler silently drops a component's registration because its sideEffects entry was missing) shipped for real in lr-swatch-picker (3.7.0, customElements.get() undefined in production) and separately for lr-sequence-strip, plus 11 more components found in one earlier audit pass.

**How to verify.** Run `node packages/lyra-ui/scripts/check-side-effects.mjs` and `node packages/lyra-ui/scripts/check-registration-architecture.mjs` (both read every *.class.ts, cross-check package.json#sideEffects, and diff ROOT_BARREL_TAGS ∪ ROOT_BARREL_OPTIONAL_PEER_TAGS against custom-elements.json's full tag list) -- both already run inside `pnpm lint`/CI's contract-policy step and exit non-zero naming the exact missing entry.

### `packaging-bundle-exclusion-claims-require-real-build-verification` — medium

**Check.** A component must not document a runtime boolean flag (e.g. `languagesOnly`) as removing a heavy optional-peer's default loader from the bundler's reachable module graph unless the flag's own module never statically imports that loader at all -- verify with an actual build/chunk-count diff, not by reading the runtime branch.

**Why.** `<lr-code-block>`'s own `languagesOnly` property doc claims that setting it means 'the bundler has no reachable path from this component to shiki's ~200-language dynamic-import table,' but code-block.class.ts imports `loadShikiHighlighter` unconditionally at module scope -- the runtime `if (this.languagesOnly) return;` guard only skips the call, not the import -- directly contradicted by its own sibling code-block-core.class.ts's doc comment stating the opposite, correct fact ('a runtime flag on that same module can't be proven always-true by a bundler'). `<lr-markdown>`'s equivalent flag has the identical shape. Only the separate `-core` entry-point modules (which never import the heavy loader) achieve real exclusion.

**How to verify.** Read packages/lyra-ui/src/components/conversation/code-block/code-block.class.ts line 9 (static `loadShikiHighlighter` import) against lines 218-224 (JSDoc claiming 'no reachable path' once `languagesOnly` is true) -- the two are in tension. For any component offering a similar bundle-reduction flag, confirm the heavy loader import is genuinely absent from the module, or run a real esbuild/Vite build and diff output chunk count with the flag on vs. off; check-bundle-size.mjs's 6 named entries and check-packed-consumer.mjs's 7 named consumer scenarios do not include code-block or markdown, so no CI canary catches a regression here.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/conversation/code-block/code-block.class.ts:218-224 (JSDoc overclaim), contradicted by the static import at line 9 of the same file

### `packaging-optional-peer-three-location-registration` — medium

**Check.** A new optional peer dependency must be registered consistently in all three of package.json's `peerDependencies` (version range), `peerDependenciesMeta.<name>.optional: true`, and `devDependencies` (so the test suite exercises the real library) -- never just one or two of the three.

**Why.** Omitting `peerDependenciesMeta` makes the peer mandatory for every consumer regardless of whether they use the feature; omitting `devDependencies` means the corresponding feature's own tests silently run against a mock or never exercise the real package at all.

**How to verify.** In packages/lyra-ui/package.json, for every key in `peerDependenciesMeta` with `optional: true`, confirm the identical key exists in both `peerDependencies` and `devDependencies`: `node -e "const p=require('./packages/lyra-ui/package.json');const opt=Object.keys(p.peerDependenciesMeta).filter(k=>p.peerDependenciesMeta[k].optional);console.log(opt.filter(k=>!(k in p.peerDependencies)||!(k in p.devDependencies)))"` must print `[]`.

### `packaging-no-workspace-protocol-in-published-tarball` — medium

**Check.** A packed or published tarball's package.json must never contain the literal `workspace:` protocol specifier in any dependency field -- pnpm's pack/publish step must rewrite every workspace: range to a real semver range before the tarball ships.

**Why.** @aceshooting/lyra-ui@3.8.0 previously shipped `"@aceshooting/lyra-flags": "workspace:^1.4.0"` verbatim in its published peerDependencies/devDependencies, which no external consumer can ever satisfy (`workspace:` isn't a resolvable range outside the monorepo), failing `pnpm peers check` regardless of what version they install.

**How to verify.** After `pnpm pack` (or via `npm view @aceshooting/lyra-ui@<version> peerDependencies devDependencies` against a real published version), grep the resulting package.json text for the literal substring `workspace:` -- any hit is a shipped-package defect. Confirmed no script does this today: `grep -rn workspace: scripts/check-packed-consumer.mjs packages/lyra-ui/scripts/*.mjs` finds no such check.

## RESPONSIVE-LAYOUT
### `responsive-container-query-missing-containment` — high

**Check.** Every component that uses an `@container (...)` query also establishes containment for it (`container-type: inline-size` on `:host` or another ancestor part in the same file) — an `@container` rule with no containment source anywhere in the component is permanently inert.

**Why.** 16 of 18 components using `@container` correctly pair it with a local `container-type: inline-size` (pagination, table, dashboard-grid, etc.), but two components ship an `@container` rule with zero containment declared anywhere in their own stylesheet, so the rule can only ever fire if a consumer's page happens to independently declare containment on some ancestor and that ancestor's box happens to cross the same threshold — effectively dead code out of the box, and undocumented as a consumer requirement.

**How to verify.** for f in $(grep -rl '@container' packages/lyra-ui/src/components/*/*/*.styles.ts); do grep -q 'container-type' "$f" || echo "$f"; done — then open each flagged file and confirm no `container-type` appears anywhere (not just near the `:host` block) and no class-doc comment documents the containment as a consumer's responsibility.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/conversation/message-actions/message-actions.styles.ts:61 (`@container (max-inline-size: 20rem)`, no `container-type` in the file) and packages/lyra-ui/src/components/data/calendar/calendar.styles.ts:42 (`@container (max-inline-size: 28rem)`, no `container-type` in the file)

### `responsive-missing-320px-narrow-story` — medium

**Check.** A component with a multi-column, label-plus-actions, toolbar, or long-translated layout ships a narrow-allocation (320px baseline) Storybook story and a long-content case, per AGENTS.md's explicit responsive-testing rule.

**Why.** This is a binding, explicitly stated AGENTS.md rule (not a blanket 'every component' requirement, only layout-nontrivial ones) with no automated gate checking story variety — check-component-coverage.mjs only verifies a tag string appears somewhere in a family's stories, not that a narrow-width variant exists. lr-command-palette's result rows (label + description + shortcut) are exactly the 'label-plus-actions' shape the rule targets, yet its stories file has zero narrow/320px coverage, unlike sibling layout components (filter-bar, table, pagination, thread-list all have one).

**How to verify.** grep -c '320px\|20rem\|Narrow' on a component's `*.stories.ts`; 0 hits on a component with a multi-column/label-plus-actions/toolbar layout is the violation. Also check its `*.test.ts` for a paired `dir="rtl"` fixture, since the rule expects both narrow-allocation and RTL coverage together.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/command-palette/command-palette.stories.ts (only 2 stories, `Default`/`ThemedActiveCommand`, neither exercises a narrow allocation); same gap in agent-tools/tool-param-form/tool-param-form.stories.ts and agent-tools/tool-approval-dialog/tool-approval-dialog.stories.ts

### `responsive-flex-row-missing-min-inline-size-zero` — medium

**Check.** A flex row's `flex: 1`-growing text child sets `min-inline-size: 0` so it can shrink below its own intrinsic content width in a narrow container, instead of forcing the whole row to overflow.

**Why.** AGENTS.md names `min-inline-size: 0` explicitly as part of the required responsive pattern (alongside container queries and intrinsic wrapping). lr-command-palette's result row (`[part='command']`, a flex row) has a `flex: 1`-growing `[part='description']` column with no `min-inline-size: 0` and no `white-space`/`overflow-wrap` handling, so a long command description will overflow the dialog's fixed max-inline-size rather than eliding or wrapping.

**How to verify.** Open command-palette.styles.ts's `[part='command']`/`[part='description']` rules and confirm the missing `min-inline-size: 0`. Render `<lr-command-palette>` with a long `description` value at the dialog's real `max-inline-size` and compare `[part='list'].scrollWidth` to its `clientWidth` — a mismatch confirms overflow.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/command-palette/command-palette.styles.ts:19 (`[part='description'] { flex: 1; ... }` with no `min-inline-size: 0`, inside the `[part='command']` row declared at line 11)

### `responsive-tile-root-part-not-stretched` — medium

**Check.** A component meant to tile inside a CSS Grid/flex stretch context (dashboard tile, grid card) sets `block-size: 100%; box-sizing: border-box;` on its root shadow part, so its visible border/background fills the host's allocated row height instead of shrink-wrapping to its own content.

**Why.** lyra-stat/word-cloud/context-meter already carry this exact fix (a past gap that recurred because the convention isn't linted anywhere). lyra-card's own class doc explicitly advertises 'clickable grid tiles' as an intended use case, but its `[part='base']` has no block-size rule, so a shorter card in a CSS Grid row (default `align-items: stretch`) leaves visible blank space below its border while a taller row-mate fills the row.

**How to verify.** Open card.styles.ts's `[part='base']` rule (`display:flex; flex-direction:column`) and confirm no `block-size:100%`/`box-sizing:border-box` is present. Render two `<lr-card>` siblings in a CSS Grid row with differing content lengths and assert both hosts' `[part='base']` `getBoundingClientRect().height` equal the host's own measured height.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/card/card.styles.ts:7-16 (`[part='base']` has no `block-size: 100%`/`box-sizing: border-box`, despite card.class.ts:47 documenting 'clickable grid tiles' as an intended use)

### `responsive-container-basis-first-paint-flash` — medium

**Check.** A ResizeObserver-driven responsive/collapse state is already correct on the very first synchronous render under the default measurement basis, not only after the observer's first async callback fires.

**Why.** lr-split/lr-stepper's `orientationBreakpoint`/collapse features default to `*BreakpointBasis='container'`, and `measuredInlineSize` is initialized to `Number.POSITIVE_INFINITY` (i.e. 'wide'/'horizontal'), so a host narrower than the breakpoint briefly renders the wide layout for one frame before the ResizeObserver's first callback lands. The component's own code comments explicitly contrast this with `'viewport'` basis, which they document as 'already correct' at first paint — confirming the default (container) basis is not.

**How to verify.** Read split.class.ts's `measuredInlineSize` initializer (`Number.POSITIVE_INFINITY`) and the `willUpdate()` comment describing container-basis as only re-mapping 'the last known measuredInlineSize (+Infinity ...) before the first measurement lands'. Fixture `<lr-split>`/`<lr-stepper>` at a narrow width with default (container) basis and assert `data-collapse-state`/`data-effective-orientation` is already narrow/collapsed on the very first render pass, with no `await` for a resize callback.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/split/split.class.ts:325 (`private measuredInlineSize = Number.POSITIVE_INFINITY;`) and the willUpdate() comment at lines ~442-448 explaining container basis only re-maps that stale value before the first measurement

### `responsive-container-query-over-viewport-media` — medium

**Check.** A reusable (non-app-shell) component's layout responds to its own allocation via a container query or its own `ResizeObserver`, never an unconditional viewport `@media`/`matchMedia` query, per AGENTS.md's explicit responsive-layout rule.

**Why.** AGENTS.md states this exactly ('a viewport media query is appropriate only for an explicit app-shell/viewport component'), and repo-wide grep confirms current compliance (pagination/table/card-grid family all use `@container`; the only `matchMedia` users in `.class.ts` files are opt-in escape hatches like lr-split/lr-stepper's `orientationBreakpointBasis='viewport'` or genuinely viewport-tied app-shell components like lr-app-rail/lr-responsive-panel). The gap is enforcement: the automated `style-policy` check explicitly skips any line containing `@media`, so a regression or a new component hard-coding viewport-width layout collapse would ship with no automated signal at all.

**How to verify.** grep -rn '@media' packages/lyra-ui/src/components/*/*/*.styles.ts | grep -v 'prefers-color-scheme\|prefers-reduced-motion\|prefers-contrast\|hover: none\|forced-colors' — any hit in a non-shell/non-viewport-scoped component is a candidate; separately, grep `.class.ts` files for unconditional `matchMedia(` calls not gated behind an opt-in property like `*BreakpointBasis`.

### `responsive-scroll-row-missing-edge-fade` — low

**Check.** A horizontally-scrolling row of controls (tabs-like) gives a mask-image edge-fade affordance signaling that more content exists beyond the visible edge.

**Why.** lyra-tabs and lyra-segmented both independently needed and now carry this exact fix (`mask-image`/`-webkit-mask-image` linear-gradient on the `overflow-x: auto` row), confirming it's an established convention for this component shape — but lyra-stepper has the identical horizontally-scrolling-row-of-steps structure (`overflow-x: auto` on `[part='base']`) and never received the same treatment.

**How to verify.** grep -n 'overflow-x: auto' across `packages/lyra-ui/src/components/*/*/*.styles.ts`, then check each hit's file for a `mask-image`/`-webkit-mask-image` rule in the same selector block (tabs.styles.ts and segmented.styles.ts both have one; compare against any hit that doesn't).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/layout/stepper/stepper.styles.ts:10 (`[part='base'] { ...; overflow-x: auto; }`, no mask-image edge-fade anywhere in the file, unlike tabs.styles.ts/segmented.styles.ts)

## NATIVE-CONTROL-THEMING
### `native-disabled-css-selector` — high

**Check.** For any form-associated component (static formAssociated = true, directly or via the FormAssociated mixin) that tracks _fieldsetDisabled/effectiveDisabled, the disabled-visual-state CSS rule must select `:host(:disabled)` (the native FACE pseudo-class, which the UA sets from BOTH the element's own disabled attribute AND an ancestor <fieldset disabled>), never `:host([disabled])` (which only reflects the component's own disabled attribute/property and misses fieldset-only inheritance).

**Why.** lr-radio, lr-code-editor, lr-date-input, lr-phone-input, lr-time-range, and lr-token-input all compute `effectiveDisabled` correctly for their internal controls' functional disabling, but their own styles.ts still gates the host's opacity/cursor dimming on `:host([disabled])`, so a control disabled purely via an ancestor `<fieldset disabled>` becomes functionally inert (inputs get `?disabled`, tabindex -1, aria-disabled) yet renders at full opacity with a normal cursor -- the exact split-fix bug already documented and avoided in lr-checkbox/lr-switch/lr-select/lr-combobox/lr-slider/lr-chat-composer (which correctly use `:host(:disabled)`, with chat-composer's styles.ts even containing an explanatory comment on why).

**How to verify.** grep -n "formAssociated = true\|extends FormAssociated(" packages/lyra-ui/src/components/*/*/*.class.ts to enumerate form-associated components, then for each check its sibling *.styles.ts with grep -n "\[disabled\]\|:host(:disabled)" -- any hit on the bracket-attribute form for a component that also uses `effectiveDisabled`/`_fieldsetDisabled` internally is the bug.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/forms/radio/radio.styles.ts:35 (`:host([disabled]) [part='base']`) alongside radio.class.ts:161's `effectiveDisabled` getter; same pattern at code-editor.styles.ts:21, date-input.styles.ts:102, phone-input.styles.ts:54, time-range.styles.ts:131/135, and token-input.styles.ts:24/30

### `shadow-part-selector-specificity` — medium

**Check.** An internal shadow-DOM interaction-state selector on a `part="x"` element must not exceed the specificity of the equivalent consumer-facing `::part(x):state` override -- i.e. avoid combining `[part='x']:hover:not(:disabled)`-shaped selectors (specificity (0,3,0)), which beats a consumer's `::part(x):hover` ((0,1,1)) and forces `!important`. Wrap the extra pseudo-classes in `:where(...)` to zero their specificity contribution, as lr-attachment-trigger now does.

**Why.** A consumer styling `::part(x):hover` on any of these components needs `!important` to win against the component's own internal `[part='x']:hover:not(:disabled)` rule, defeating the documented purpose of exposing `::part()` as a theming surface; lr-attachment-trigger hit exactly this bug and was fixed by rewriting to `:where(.trigger-button):hover:where(:not(:disabled))`, but the identical attribute-selector shape (`[part='x']:hover:not(:disabled)`) is still used unwrapped in over a dozen other components.

**How to verify.** grep -rn ":hover:not(:disabled)" packages/lyra-ui/src/components/*/*/*.styles.ts | grep -v ":where" -- every hit is an unwrapped over-specific rule; compare against attachment-trigger.styles.ts's `:where()`-wrapped fix for the established remediation pattern.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/data/flow-controls/flow-controls.styles.ts:60, conversation/branch-picker/branch-picker.styles.ts:28-29, conversation/push-to-talk/push-to-talk.styles.ts:35, agent-tools/eval-dataset/eval-dataset.styles.ts:32-33, data/pagination/pagination.styles.ts:69-70, agent-tools/tool-approval-dialog/tool-approval-dialog.styles.ts:151, conversation/message-feedback/message-feedback.styles.ts:36-37, media/playback/playback.styles.ts:54, media/animated-image/animated-image.styles.ts:90, media/lightbox/lightbox.styles.ts:90-91, forms/time-range/time-range.styles.ts:32, utility/export-button/export-button.styles.ts:20 and :98, utility/tour/tour.styles.ts:132

### `native-input-selection-api-passthrough` — medium

**Check.** A component wrapping a native <input>/<textarea> as its primary control must forward the full selection/editing surface a consumer reasonably needs for that native element: focus()/blur(), select(), selectionStart/selectionEnd getters+setters, setSelectionRange(), and setRangeText() -- not just focus/blur/select.

**Why.** lr-input exposes select(), focus(), and blur() but has no selectionStart/selectionEnd/setSelectionRange()/setRangeText() passthrough at all, unlike lr-textarea (which does implement the full set) -- a consumer needing cursor-position-aware behavior (e.g. inserting a mention/emoji at the caret) must reach into lr-input's shadow root, defeating encapsulation and violating AGENTS.md's own stated convention for text controls.

**How to verify.** Open packages/lyra-ui/src/components/forms/input/input.class.ts (class starts line 80) and grep it for "selectionStart\|selectionEnd\|setSelectionRange\|setRangeText" -- zero hits despite `select()` existing at line 155; compare against textarea.class.ts lines 116-172, which implements the identical surface as the reference pattern.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/forms/input/input.class.ts:80-155 (LyraInput has `select()` at line 155 but no selectionStart/selectionEnd/setSelectionRange/setRangeText)

### `native-input-missing-placeholder-style` — medium

**Check.** Any component with a fully-themed native <input>/<textarea> part that renders a `placeholder=` attribute must also declare an explicit `[part='x']::placeholder { color: var(--lr-color-text-quiet); }` rule -- background/color on the field itself are not inherited by the ::placeholder pseudo-element.

**Why.** Nine sibling components (combobox, eval-dataset, command-palette, table, tool-select-dialog, code-editor, message-feedback, model-select, voice-picker, token-input) were already fixed to declare ::placeholder, but the same completeness pass missed lr-thread-list's search input, lr-node-palette's search input, and lr-date-input's text field, all of which theme background/border/color on the input but leave placeholder text at the browser's UA-default gray in a dark theme.

**How to verify.** for f in $(grep -rl '<input\|<textarea' packages/lyra-ui/src/components/*/*/*.class.ts); do s=${f%.class.ts}.styles.ts; grep -q 'placeholder=' "$f" && ! grep -q '::placeholder' "$s" && echo "$s missing ::placeholder"; done

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/conversation/thread-list/thread-list.styles.ts (part='search-input', placeholder set at thread-list.class.ts:647, no ::placeholder rule), packages/lyra-ui/src/components/retrieval/node-palette/node-palette.styles.ts (part='search', placeholder at node-palette.class.ts:195), packages/lyra-ui/src/components/forms/date-picker/date-input.styles.ts (part='input' at line 106, placeholder at date-input.class.ts:843)

### `native-search-input-missing-cancel-reset` — low

**Check.** Any native `type="search"` input part must unconditionally reset `::-webkit-search-cancel-button` and `::-webkit-search-decoration` to `appearance: none` -- not gated behind an unrelated attribute like `:host([clearable])`, and not simply absent.

**Why.** lr-thread-list, lr-emoji-picker, and lr-node-palette correctly reset the raw gray UA cancel-glyph on their search inputs, and lr-input's own reset (input.styles.ts:93-95) is now unconditional, but four other components with real native `type="search"` inputs (not composing `<lr-input type="search">`, which would inherit the fix) never added the reset at all, so the browser's default cancel-x renders regardless of every other token applied to the field.

**How to verify.** grep -rn 'type="search"' packages/lyra-ui/src/components/*/*/*.class.ts, exclude hits inside an `<lr-input ...>` tag (those inherit lr-input's fix), then for each remaining native `<input type="search">` check its sibling *.styles.ts for `::-webkit-search-cancel-button` -- absence is the defect.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/agent-tools/eval-dataset/eval-dataset.class.ts:259 (native input, no reset in eval-dataset.styles.ts), packages/lyra-ui/src/components/layout/command-palette/command-palette.class.ts:160, packages/lyra-ui/src/components/agent-tools/tool-select-dialog/tool-select-dialog.class.ts:410, packages/lyra-ui/src/components/data/table/table.class.ts:1849

### `native-select-and-exotic-input-chrome-reset` — low

**Check.** A wrapped native `<select>` must pair `appearance: none` with a `[part='x'] option { background; color; }` rule (the closed-box theme never reaches the browser-painted option popup otherwise); a `type="number"` field must pair `appearance: textfield` with a `::-webkit-inner/outer-spin-button` reset; and exotic pickers (`type="color"/"time"/"range"`) must have explicit `cursor: pointer`, `:hover`, and `:focus-visible` since they're the sole interactive affordance, not a suppressible glyph.

**Why.** This exact bug class (raw UA select-popup/spinner/picker chrome left unstyled despite the closed-box control being fully themed) recurred at least three times independently (lr-phone-input, an av-player rate-select, an image-viewer fit-control) within the same audit cycle, and is included here as a regression guard for any new native-control-wrapping component even though every currently-shipping instance (phone-input, av-player, image-viewer, lr-input, lr-pagination, lr-tool-param-form, image-comparer, lr-playback, lr-color-picker) has now been verified fixed.

**How to verify.** grep -rln '<select' packages/lyra-ui/src/components/*/*/*.class.ts and pair each with its styles.ts checking for `appearance: none` + `option {` rules; grep -rln 'type="number"' and check for `appearance: textfield` + spin-button reset; grep -rln 'type="color"\|type="range"\|type="time"' and check for `cursor`/`:hover`/`:focus-visible` on that part.

## PERFORMANCE-AND-VIRTUALIZATION
### `perf-remote-content-size-ceiling-before-parse` — high

**Check.** A viewer component that fetches remote content must enforce a byte/row/entry ceiling — via the shared `readResponseArrayBuffer`/`readResponseText`/`assertTableSize`/`assertTableDimensions` helpers in `internal/resource-loader.ts` (or an equivalent local cap) — BEFORE handing the payload to a parser/decompressor. Never call a raw `response.arrayBuffer()`/`.text()`/`.json()` directly and parse first.

**Why.** Every viewer in the family (archive/csv/dataset/spreadsheet/pdf/docx/pptx/ebook/email/html/svg/geojson/notebook/calendar/contact) could otherwise fully buffer and parse (or, for archives, fully decompress) an arbitrarily large remote payload before any size check, so a huge file or a zip bomb could exhaust memory/CPU before anything renders; all listed viewers now route through the shared capped readers.

**How to verify.** grep `packages/lyra-ui/src/components/viewers/*/*.class.ts` for `response.arrayBuffer()`/`response.text()`/`response.json()` called directly (bypassing the `resource-loader.ts` wrappers) — today this returns no hits (every fetch()-based viewer imports and calls `readResponseArrayBuffer`/`readResponseText`, e.g. archive-viewer.class.ts:7,61 and csv-viewer.class.ts:5,127-128, with per-entry caps like `MAX_ARCHIVE_ENTRIES`/`MAX_ARCHIVE_UNCOMPRESSED_BYTES` at archive-viewer.class.ts:17-18). Any NEW viewer added under `src/components/viewers/` must do the same, plus its own entry/row-count cap if it can produce unbounded parsed output from a bounded byte count.

### `perf-virtualized-row-focus-within-zindex` — medium

**Check.** Absolutely-positioned virtualized-list rows (position:absolute + will-change/transform, an implicit stacking context) must lift the focused row above later siblings via a `[part='row']:focus-within { z-index: ... }` rule, so a popover/menu opened from a non-last row isn't painted underneath subsequent rows.

**Why.** will-change:transform on lr-virtual-list's `[part='row']` creates an implicit stacking context with z-index:auto, so rows paint strictly in DOM order and an open popover from an early row was visible/hit-testable but painted under every later row — invisible in a 2-3 row fixture where the last row always looks correct; the current styles fix this with a `:focus-within` z-index rule.

**How to verify.** Open packages/lyra-ui/src/components/layout/virtual-list/virtual-list.styles.ts lines 32-57 and confirm `[part='row']:focus-within { z-index: var(--lr-layer-content); }` sits alongside the `will-change: transform` rule. For any new component rendering its own absolutely-positioned/transformed repeated rows (`grep -rln "will-change: transform" --include="*.styles.ts"` — today only virtual-list.styles.ts and flow-canvas.styles.ts match), confirm the same `:focus-within` z-index rule exists, and require a regression test that hit-tests via `document.elementFromPoint()` on a popover opened from a NON-last row, not a single-row fixture.

### `perf-sticky-inert-in-virtualized-rows` — medium

**Check.** A pinned/sticky group-header feature inside a virtualized list must be built as the component's own non-scrolling absolutely-positioned overlay layer with an explicit z-index — never `position: sticky` on a row, since sticky is inert inside an absolutely-positioned, transform-offset ancestor.

**Why.** lr-virtual-list positions every row `position:absolute` with a translateY transform, and CSS sticky positioning never activates inside a transform-offset ancestor, so a consumer CSS rule requesting `position: sticky` on a group-header row silently never pins; lr-thread-list's group headers correctly work around this via a manually-positioned `[part='group']` overlay instead of sticky.

**How to verify.** grep `packages/lyra-ui/src/components/**/*.styles.ts` for `position: sticky` and confirm none of the matches sit inside a row rendered by an internal `lr-virtual-list` (today's only matches — dataset/spreadsheet/csv-viewer, table, json-viewer — are non-virtualized scrolling tables, not virtual-list rows). Confirm `virtual-list.styles.ts:58-69`'s `[part='group']` (position:absolute + z-index) is the pattern any new pinned-row feature reuses, not a bare `position: sticky` rule on a virtualized row.

### `perf-decimation-anchor-and-uniform-cap` — medium

**Check.** A client-side downsampling/decimation helper for a data series must anchor both the first AND last sample exactly (step = (length-1)/(max-1), not length/max), and any point-count cap must be applied once, upstream of every render-mode branch — never inside only one branch (e.g. only a bar path, leaving line/area unbounded).

**Why.** lyra-sparkline's original `Math.floor(i * step)` sampling could miss the true final index (silently dropping the most recent/meaningful data point) and its MAX_BARS cap applied only to the bar render branch; the current `decimate()` fixes both by dividing by `(max - 1)` and applying `MAX_POINTS` before branching on `type`.

**How to verify.** Open packages/lyra-ui/src/components/data/sparkline/sparkline.class.ts lines 16-20 (`decimate()`) and confirm `step = (arr.length - 1) / (max - 1)`, and that line 81 applies `MAX_POINTS` (via `decimate()`) before the `if (this.type === 'bar')` branch at line 117, not inside it. Apply the same read to any other chart/sparkline-like component that adds its own local downsampling routine.

### `perf-canvas-redraw-gating-and-complete-watchlist` — medium

**Check.** An imperative `<canvas>`-drawing component must (a) skip its expensive redraw while off-screen via an `IntersectionObserver`-gated visibility flag, and (b) list every reactive property that affects the drawn output in its redraw-triggering `changed.has(...)` check — a property that affects the canvas but is missing from that list silently no-ops once set after first paint.

**Why.** lyra-chart used to redraw on virtually every property change with no visibility gating, paying full Chart.js-rebuild cost for an off-screen chart; lyra-heatmap's maintained, explicit watch-list array (checked against `changed.has(name)` before calling `draw()`) is the model fix for the second half of this pattern.

**How to verify.** For lyra-chart, open packages/lyra-ui/src/components/charts/chart/chart.class.ts and confirm the `IntersectionObserver` (constructed ~line 296) gates `draw()` via `this.visible` (see `updated()` ~line 406-407: `if (!this.visible) return;`). For lyra-heatmap, open packages/lyra-ui/src/components/data/heatmap/heatmap.class.ts lines 936-967 and diff the explicit property-name array there against every `@property`/`@state` declared in lines 394-703 (note: props that only affect ARIA/tooltip text like `cellText`/`cellInteractive`/`accessibleCells` are correctly excluded since Lit's own render() already reacts to them — only props that change canvas pixels belong in the array). Apply both checks to any other canvas-wrapping component added later.

### `perf-optional-heavy-dependency-escape-hatch` — medium

**Check.** A component that dynamically imports an optional heavy third-party dependency (syntax highlighter, markdown/sanitizer pair, document-format library) from `connectedCallback()` must give consumers a way to (a) skip the default load when they've already supplied an equivalent, and (b) eagerly pre-warm the load for a high-frequency mount path (list items, chat messages) — not just an undocumented lazy-import fallback window.

**Why.** lyra-code-block used to unconditionally call `loadShikiHighlighter()` even when a consumer's `languages` map already covered every needed grammar; lyra-markdown's lazy `import('marked'/'dompurify')` had no documented fallback-window duration and no eager-preload opt-in for a chat UI mounting a fresh instance per message. Both are now fixed: `languagesOnly` skips the default Shiki load, and `loadMarkdownDeps()` is exported so a consumer can call it at startup to pre-warm the shared cache.

**How to verify.** Open packages/lyra-ui/src/components/conversation/code-block/code-block.class.ts lines 218-262 and confirm `languagesOnly` exists and `connectedCallback()` actually skips `loadShikiHighlighter()` when set. Open packages/lyra-ui/src/components/conversation/markdown/markdown-loader.ts line 80 and confirm `loadMarkdownDeps()` is exported (not module-private), and that markdown-core.class.ts lines 341-360 document the fallback window and eager-preload pattern. For any NEW component with an optional heavy peer loaded from `connectedCallback()`/constructor, confirm the same pair of properties/exports exists — note `check:packed-consumer`'s codeBlock peer-externalization budget only catches a byte-size regression in that one named scenario, not a missing escape hatch in a new component.

### `perf-resizeobserver-debounced-layout-reads` — medium

**Check.** A `ResizeObserver` callback that reads layout (`offsetWidth`/`offsetParent`/`getBoundingClientRect`) across potentially many elements must not run its full synchronous read+write pass on every single callback invocation with no batching — an animated ancestor resize fires the callback once per frame, each doing a fresh query + per-element measurement + inline-style write.

**Why.** lyra-table's `ResizeObserver` callback calls `recomputeColumnsHidden()` (reads `offsetParent` over every priority header), `applyStickyOffsets()` (re-queries `[data-col-key]` and reads `offsetWidth` per sticky column), and `syncResizeHandleValues()` unconditionally on every resize event with no `requestAnimationFrame`/debounce coalescing — exactly why a consuming project resorted to its own `table-layout: fixed` workaround during an animated ancestor resize.

**How to verify.** Open packages/lyra-ui/src/components/data/table/table.class.ts lines 810-816 — the `ResizeObserver` constructor callback calls all three methods unconditionally with no rAF-id guard or last-size comparison; `stickyOffsets()` (lines 1080-1089) reads `el.offsetWidth` in a loop, and `applyStickyOffsets()` (lines 1147-1156) re-runs `querySelectorAll('[data-col-key]')` on every single invocation. Compare against `heatmap.class.ts`'s `scheduleDraw()` rAF-batching pattern as the reference fix; confirm whether a PR adds equivalent batching before treating this as resolved.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/data/table/table.class.ts:812

### `perf-stable-ref-callback-identity` — medium

**Check.** A `ref()` directive must not be passed a fresh inline arrow-function literal on every render when the underlying DOM element is expected to persist — Lit treats a changed callback identity as an unmount (undefined) immediately followed by a remount even though the element itself hasn't changed, thrashing any mount-triggered work (canvas draw, subscription, observer) in that callback. Memoize per item key in a list, or as a stable bound method for a singleton element.

**Why.** lyra-pdf-viewer's `pageCanvasRef(pageNumber)`/`textLayerContainerRef(pageNumber)` correctly memoize a `ref()` callback per page number in a `Map`, reused across renders; lyra-av-player's waveform-timeline canvas instead binds `${ref((el) => { if (el) this.drawWaveform(); })}` — a fresh closure every render — so on every unrelated re-render while the canvas stays mounted (e.g. every `timeupdate`-driven `currentTimeState` tick during playback), the ref rebinds and calls `drawWaveform()` again, redundantly repainting every peak bar even though `updated()` already gates the intended redraw behind `changed.has('peaks')`.

**How to verify.** Open packages/lyra-ui/src/components/viewers/pdf-viewer/pdf-viewer.class.ts lines 1053-1098 for the correct per-key-memoized-Map pattern. Open packages/lyra-ui/src/components/media/av-player/av-player.class.ts lines 578-584 and confirm the `ref((el) => { if (el) this.drawWaveform(); })` callback is an inline literal recreated on every `render()` call (cross-check against `@query('[part="timeline"] canvas') canvasEl` at line 202 and the `changed.has('peaks')` gate at line 235, which already handle real redraws correctly, making the inline ref call redundant on every other update). grep `\${ref((` across `*.class.ts` to find the same anti-pattern elsewhere; for any per-item render callback wired into `lr-virtual-list`'s `.renderItem`, confirm any `ref()` inside it is looked up from a per-key `Map`, not a fresh arrow function per call.

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/media/av-player/av-player.class.ts:580

### `perf-interval-recreated-only-on-relevant-change` — low

**Check.** A component driving a `setInterval`/`setTimeout` ticker from `updated()` must gate (re)creation behind `changed.has(...)` on the specific properties that actually affect the timer — never call the scheduling function unconditionally on every `updated()` pass.

**Why.** lyra-relative-time's `updated()` used to call `schedule()` (which unconditionally cleared/recreated its 30s interval) on every update, and each tick's own `requestUpdate()` re-triggered the same teardown/recreation, churning timers on every synced instance on a page; the current code guards `schedule()` behind `changed.has('sync'|'date'|'locale'|'unit'|'numeric')`.

**How to verify.** Open packages/lyra-ui/src/components/utility/format/relative-time.class.ts lines 20-28 and confirm `schedule()` is only invoked from `updated()` inside the `if (changed.has(...))` guard. For any other timer/interval-driven component (`grep -rn "setInterval\|setTimeout" packages/lyra-ui/src/components --include="*.class.ts"`), check its `updated()` call site for the same unconditional-call anti-pattern.

### `perf-continuous-loop-exposes-coalesced-change-event` — low

**Check.** A component running a continuous internal pan/zoom/simulation-tick loop must emit a frame-coalesced public change event (at most one per animation frame) that a consumer can listen to — rather than leaving external tracking of the internal viewport/position state to a consumer-side `requestAnimationFrame` loop polling a getter every frame.

**Why.** A knowledge-graph consumer had to run its own continuous `requestAnimationFrame` loop re-reading `lr-graph`'s node rectangle every frame to keep a details popover positioned, purely because no coalesced pan/zoom/tick signal was exposed; `lr-graph` and `lr-flow-canvas` both now emit an `lr-viewport-change` event coalesced through their own internal `requestAnimationFrame`.

**How to verify.** Open packages/lyra-ui/src/components/retrieval/graph/graph.class.ts lines 580-591 and packages/lyra-ui/src/components/data/flow-canvas/flow-canvas.class.ts lines 778-787 and confirm each emits `lr-viewport-change` from inside a `requestAnimationFrame`-coalesced handler (`viewportChangeRaf`/equivalent), not on every raw pan/zoom tick. For any NEW component with an internal continuous animation/simulation loop affecting an externally-relevant position/viewport, confirm it exposes an equivalent coalesced event rather than requiring a consumer-side rAF poll.

## RTL-LOGICAL-CSS
### `rtl-arrow-key-forward-backward` — high · auto-gated

**Check.** A keydown handler that maps ArrowLeft/ArrowRight to previous/next (roving-tabindex, day-grid nav, carousel/slider-style controls, rating) must derive which arrow means 'forward' from `this.effectiveDirection`, never hardcode ArrowRight=forward/ArrowLeft=back.

**Why.** AGENTS.md (root, lines 233-235) states a hardcoded ArrowLeft===previous is 'an RTL bug, not just an LTR-only shortcut'; lyra-slider/time-range/segmented/tabs/rating already derive forward/backward from effectiveDirection (e.g. rating.class.ts:87-88: `forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight'`), which is the pattern every new directional-key handler must copy.

**How to verify.** `node packages/lyra-ui/scripts/check-source-policy.mjs` (wired into `pnpm lint` as check:source-policy) already fails the build if a `*.class.ts` file matches /keydown/i and /Arrow(Left|Right)/ without also containing `effectiveDirection`/`isRtl` somewhere in the file (rule id `rtl-arrow-keys`); currently 0 findings across 812 files. Because that rule matches file-wide rather than per-handler, a reviewing subagent should still run `grep -rln "ArrowLeft\|ArrowRight" packages/lyra-ui/src/components/*/*/*.class.ts` and for each hit open the file and confirm the SAME onKeyDown branches on `this.effectiveDirection`/`isRtl` (not some unrelated method elsewhere in the file being the only reference) before deciding forward/backward.

### `rtl-directional-glyph-mirror` — medium

**Check.** A directional glyph (chevron/arrow meaning previous/next/expand-toward) rendered as a fixed character or icon must mirror under RTL via a `:host(:dir(rtl)) [part='...-glyph'] { transform: ... }` rule on its wrapping part -- it must not point the same physical way regardless of `dir`.

**Why.** AGENTS.md (root, lines 238-239) requires rotating the wrapping part under `:dir(rtl)` rather than baking a fixed rotation into the icon; lyra-scroller, lyra-branch-picker, lyra-pagination, lyra-carousel, lyra-lightbox, lyra-calendar, lyra-ebook-viewer and lyra-pptx-viewer all already implement this correctly, but lyra-artifact-panel's version-previous/version-next buttons render raw '‹'/'›' text nodes with zero `:dir(rtl)` rule anywhere in its stylesheet, so in an RTL layout 'previous version' still visually points left instead of right.

**How to verify.** Open packages/lyra-ui/src/components/agent-tools/artifact-panel/artifact-panel.class.ts:191-212 (version-previous/version-next buttons render bare ‹ / › glyphs with no glyph-wrapping part) and confirm packages/lyra-ui/src/components/agent-tools/artifact-panel/artifact-panel.styles.ts has zero `:dir(rtl)` matches (`grep -n ":dir(rtl)"`). Compare against the correct reference pattern at packages/lyra-ui/src/components/conversation/branch-picker/branch-picker.styles.ts:54-58 or packages/lyra-ui/src/components/layout/scroller/scroller.styles.ts:103-104. General sweep for regressions/new instances: `grep -rln "‹\|›\|chevronIcon\|scaleX(-1)" packages/lyra-ui/src/components/*/*/*.class.ts`, then for each hit check the paired `*.styles.ts` for a `:host(:dir(rtl))` rule on that glyph's part -- skip components where the glyph is a disclosure/expand-collapse toggle rotating on open/closed state rather than on writing direction (those are correctly direction-agnostic, e.g. tree-node.class.ts, trace-tree.class.ts).

**Known live violation (as of 2026-07-20).** packages/lyra-ui/src/components/agent-tools/artifact-panel/artifact-panel.class.ts:191-212 renders raw ‹/› glyphs for version-previous/version-next with no matching :dir(rtl) rule in artifact-panel.styles.ts

### `rtl-directional-option-single-edge` — medium

**Check.** A directional positioning/pinning option (sticky column, pinned panel, docked toolbar, etc.) exposed as a plain boolean must not silently mean 'inset-inline-start only' -- it should accept a `'start' | 'end'` (or equivalent logical) choice so a trailing-edge use case isn't forced off-screen or unreachable.

**Why.** lyra-table's `columns[].sticky` originally only pinned to the leading edge; the type has since been widened to `boolean | 'start' | 'end'` (table.class.ts:109, normalized via the `stickyDirection()` helper) with matching inset-inline-start/inset-inline-end + :dir(rtl) CSS (table.styles.ts:265-304) -- a good reference fix, but the same boolean-only trap (the first consumer only needed one edge, so the option shipped boolean) can recur in any new directional option added later.

**How to verify.** Grep for a new boolean-typed directional/positioning prop: `grep -rn "sticky?:\s*boolean\|pinned?:\s*boolean\|docked?:\s*boolean\|fixed?:\s*boolean" packages/lyra-ui/src/components --include=*.class.ts` (excluding *.test.ts/*.stories.ts) and, for any hit, check whether the paired `*.styles.ts` only ever applies `inset-inline-start` and never offers an `-end` variant. Sanity-check lyra-table stays fixed: `grep -n "sticky?:" packages/lyra-ui/src/components/data/table/table.class.ts` should show `sticky?: boolean | 'start' | 'end'` (line 109), not a plain boolean -- narrowing it back to boolean would be a regression of this exact bug. Note: lyra-thread-list's `pinned?: boolean` (thread-list.class.ts:18) is a sort-order 'pin to top of list' flag, not a CSS logical-edge positioning option, so it is not an instance of this pattern.

