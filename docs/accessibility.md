# Accessibility

This page states what Lyra UI's accessibility claims actually rest on: which guarantees a machine
checks on every commit, which are conventions enforced by code review, and which are simply not
verified at all.

**Read this first.** Lyra UI has **not** been tested with a screen reader, has **not** had a
third-party or in-house human accessibility audit, and publishes **no** conformance claim, VPAT, or
accessibility conformance report. Every guarantee below is produced by an automated rule engine or a
static source check. Automated tooling detects a well-known minority of WCAG failures — it can prove
a `role` is legal and a contrast ratio clears 4.5:1; it cannot tell you whether NVDA announces a live
region usefully, whether a reading order makes sense, or whether an error message helps. Where this
page says "automated", read it as "automated only".

The design target is **WCAG 2.2 Level AA**. Target, not certification.

---

## What is enforced mechanically

Every row below fails a build. The gate named in each row is the authoritative definition of what
that row means — this table summarizes, the script decides.

| Guarantee | Gate | Runs in |
|---|---|---|
| Every component has an axe-core assertion, in its own directory's tests, in a test that mounts its own tag | `check:qualification` + the browser suite | `pnpm lint`, `pnpm test` |
| No axe-core violation in each component's qualifying populated/open state (or the complete default state for a recorded primitive exemption) | `check:qualification` + `expect(el).to.be.accessible()` in the browser suite | `pnpm lint`, `pnpm test`, CI `build-and-coverage` |
| Every pinned upstream mapping records reviewed semantic, naming, keyboard, focus, state, announcement, and motion profiles; automatic mappings may not omit a recorded upstream behavior | `check:component-inventory` + `test:component-inventory` + `test:migrate-wa` | `pnpm lint` |
| No axe-core `wcag2a`/`wcag2aa` violation on a curated set of representative story renderings in the built docs site | `storybook:check` | CI `docs-and-storybook` |
| Every `--lr-color-<variant>-on-<emphasis>` token clears 4.5:1 against the `-fill-` token it pairs with (WCAG 2.2 SC 1.4.3), and the border tokens that identify a control clear 3:1 against the page surface (SC 1.4.11) — in **both** the light and dark palettes | `check:contrast` | `pnpm lint` |
| Categorical chart series stay distinguishable after protanopia/deuteranopia/tritanopia simulation (OKLab distance ≥ 0.10) | `check:contrast` | `pnpm lint` |
| Every icon-sized interactive control resolves to at least 40px × 40px — above WCAG 2.2 SC 2.5.8's 24px minimum | `check:hit-area` | `pnpm lint` |
| Every part that reacts to `:hover` also reacts to `:active`, or carries a written `no-pressed-state:` justification | `check:interaction-states` | `pnpm lint` |
| No `::part()` selector that parses but can never match (dead focus/hover styling) | `check:part-reachability` | `pnpm lint` |
| Every built-in user-facing string — including `aria-*`, `title`, `placeholder`, `alt` — is translatable and has a default entry | `check:default-strings`, `check:translations`, `check:source-policy` | `pnpm lint` |
| No layout that overflows the document at 390px, in LTR or RTL, on any component's docs page | `storybook:check` | CI `docs-and-storybook` |
| Tracked visual baselines stay stable; pending-review axes still pass registration, nonblank, forced-colors pixel, and narrow-allocation guards without committing unreviewed PNGs | `test:visual` | CI `visual-regression` |

Current evidence:

- Every public component carries exact same-test, same-instance axe-core evidence in its component
  directory, or a narrow reviewed exemption recorded by the qualification gate. The generated
  component-quality reference is the authoritative per-tag count and evidence index.
- The Storybook sweep runs axe-core restricted to the `wcag2a` and `wcag2aa` tags over curated
  renderings — mostly interacted-with states (a dialog while open, a toast after it fires, a picker
  after a selection), plus a dark-theme rendering. It is a curated
  smoke set, not per-component coverage; per-component axe coverage comes from the browser suite
  above.
- The same sweep audits **every** component docs page for layout overflow, trapped overlays, and
  console/page errors at 980px, at 390px, and at 390px with `dir="rtl"`.
- The visual-regression manifest covers light, dark, and RTL for every enrolled story; selected
  intrinsic-color, chart, and responsive stories add real forced-colors or 320px narrow browser
  axes. `packages/lyra-ui/visual-baselines/manifest.json` is authoritative for the live story and
  capture counts, comparison policy, and every per-profile or pending-review exemption.

`check:qualification` is what keeps the first row from decaying: a component may not claim `stable`
maturity without that per-tag evidence. Components that predate the gate carry dated, reviewed
exemptions in `packages/lyra-ui/scripts/qualification-exemptions.json`, which is a ratchet — an
exemption whose evidence has landed is reported as stale and must be deleted, so the file can only
shrink, and a new component may never be added to it.

The in-suite `expect(el).to.be.accessible()` assertion runs axe-core's **default** rule set (which is
broader than `wcag2a`/`wcag2aa` alone and includes axe's best-practice rules). It runs against the
component's rendered tree, shadow roots included.

Two of these gates are static text analysis over stylesheets rather than measurements of a rendered
page, and their limits are worth knowing: `check:hit-area` cannot run a layout engine, so
runtime-sized SVG and canvas targets are covered by per-component rendered-box tests instead of by
the gate, and a small number of targets carry a recorded exemption; `check:contrast` evaluates the
shipped token grid, not a page you have themed.

### What no gate covers

- Screen-reader output. Nothing in CI drives one, and axe does not approximate one.
- Whether an accessible name is *useful*, only whether one exists.
- Consumer-supplied content: your `alt` text, your heading order, your labels on our controls.
- Cognitive load, plain language, and timing accommodations.
- Cross-shadow text selection under WebKit — the engine drops a programmatic `addRange()` into a
  shadow tree, so selection behavior there is unverified. See
  [`docs/support-policy.md`](support-policy.md).

---

## The keyboard model

These are the conventions every component follows. They are enforced by code review and by
per-component focus/activation tests, **not** by a single library-wide gate — so treat a deviation as
a bug worth reporting rather than as undocumented behavior.

| Key | Behavior |
|---|---|
| `Tab` / `Shift+Tab` | Moves between components. A composite widget (menu, tab group, tree, table, calendar, carousel, segmented control) is **one** tab stop — it uses a roving `tabindex`, not one stop per item. |
| `Arrow` keys | Move within a composite widget. The step function skips disabled, hidden, `aria-hidden` and `inert` items rather than landing on them, and never leaves the widget with zero focusable stops. |
| `Home` / `End` | Jump to the first / last item of a composite widget. |
| `Enter` / `Space` | Activate the focused control. Anything that looks like a button responds to both. |
| `Escape` | Dismisses the topmost dismissible overlay (dialog, drawer, menu, tooltip, popover) and returns focus to whatever opened it. Overlays register with a shared stack manager, so `Escape` acts on the top of the stack, not on every open overlay at once. |
| `PageUp` / `PageDown` | Paged movement in the components that have a natural page (calendar months, for example). Not every composite widget defines one. |

Two direction rules that matter more than they look:

- **`ArrowLeft` / `ArrowRight` mean "previous" / "next", not "left" / "right".** Under `dir="rtl"`
  they swap, so the arrow that visually moves forward always moves forward.
- **Focus is never moved without a user action.** Overlays move focus on open and restore it on
  close; nothing else steals it.

Modal overlays trap focus and mark the rest of the page `inert`. Non-modal popups deliberately do
not — `Tab` leaves them, which is the correct native behavior and is why the two are separate modes
rather than one setting.

---

## Right-to-left

RTL is not an opt-in per component and is not a separate stylesheet.

- Set `dir="rtl"` anywhere up the tree; every component mirrors its layout and its arrow-key
  semantics. Components never set their own `dir` — they read the inherited direction.
- Layout uses CSS logical properties (`inset-inline-*`, `margin-inline-*`, `text-align: start/end`)
  rather than physical ones, so mirroring is the browser's job, not a duplicated rule set.
- Directional glyphs (chevrons, "next" arrows) mirror through their wrapping element, so a
  consumer-supplied icon does not have to know about direction.
- `lang` selects locale data. It does **not** silently change writing direction.

Covered by: the 390px-RTL pass of the Storybook docs audit, the RTL axis of visual regression, and
component-owned `dir="rtl"` browser fixtures. The generated qualification reference is the
authoritative per-tag evidence index.

---

## Reduced motion

Every animation in the library is built from `--lr-*` motion tokens and is required to simplify or
stop under `prefers-reduced-motion: reduce`. Component stylesheets use explicit
`prefers-reduced-motion` blocks, and the shared motion helper clamps programmatic (Web Animations)
durations — including a consumer's own `--show-duration` override — to zero under the same query.
Components that animate are expected to test **both** branches, not just the reduced one.

Reduced motion is honored for decorative and infinite motion. It does not remove motion that carries
information (a progress indicator still advances).

---

## Theming and contrast

The contrast guarantees above hold for the **shipped** palettes. They are checked against the
library's own token grid, in light and dark.

If you override `--lr-color-*` tokens — which is the supported way to theme Lyra UI — you take over
the contrast obligation for the values you supply. `check:contrast` runs against this repository's
palette, not against yours. When you fork the ramp, pair each `--lr-color-<variant>-on-<emphasis>`
token with the `--lr-color-<variant>-fill-<emphasis>` it is meant to sit on, and re-measure.

Forced colors: Lyra does not ship or advertise a separate `high-contrast` theme. Selected visual
fixtures run Chromium with the real `forced-colors: active` emulation, including painted-pixel
checks for intrinsic color surfaces and non-color chart encodings. This is targeted automated
evidence, not a per-component Windows High Contrast audit or a manual assistive-technology review;
the broader platform remains unverified as recorded in the support policy.

---

## Reporting an accessibility bug

Accessibility defects are ordinary bugs here — public, not private.

1. Open an issue: <https://github.com/aceshooting/lyra-ui/issues/new/choose> (use the bug report
   template).
2. Please include, where you can:
   - the component tag (`lr-...`) and the version of `@aceshooting/lyra-ui`;
   - browser and OS, and — if you found it with one — the assistive technology and its version;
   - what you expected to be announced, focused, or reachable, and what happened instead;
   - a minimal reproduction (a StackBlitz, or the smallest markup that shows it).
3. If a report involves a security-relevant disclosure, use the private channel in
   [`SECURITY.md`](../SECURITY.md) instead.

**Screen-reader reports are especially valuable**, precisely because nothing in this project's CI can
produce one. A report of the form "JAWS 2025 with Chrome does not announce `lr-toast`" is not a
duplicate of anything an automated gate found, and will not have been found any other way.

---

## Related

- [`docs/support-policy.md`](support-policy.md) — the browser, Node, and assistive-technology
  support window, and what CI actually proves for each.
- [`docs/agents/a11y-responsive-motion.md`](agents/a11y-responsive-motion.md) — the normative
  internal contract these guarantees are implemented against.
- [`docs/agents/component-qualification.md`](agents/component-qualification.md) — what a component
  must show before it may claim `stable`.
- [`packages/lyra-ui/llms/shared.md`](../packages/lyra-ui/llms/shared.md) — the consumer-facing
  accessibility contract in the API reference.
