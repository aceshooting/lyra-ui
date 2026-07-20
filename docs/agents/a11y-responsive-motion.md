# Accessibility, native control contracts, responsive layout, motion, and docs sync — lyra-ui agent reference

> Detail behind the "Accessibility, native contracts, responsive layout, motion, docs" digest in
> [AGENTS.md](../../AGENTS.md).

Cross-cutting in the same way as i18n, RTL, and theming: treat a gap as a bug in an existing
component and a release blocker for a new one.

## Shadow-DOM semantics — name the element that owns the role

- `aria-label` on a custom-element host does not name a textbox, radiogroup, listbox, dialog, or
  other semantic element rendered inside its shadow root. If the role lives on an internal
  element, expose an explicit naming property and deliberately forward a host `aria-label` when
  that is part of the public contract — apply the final name to the element that actually owns
  the role.
- `aria-labelledby`/`aria-describedby` idrefs do not become valid merely because the same string
  is copied across a shadow boundary. Generated visible labels, hints, and errors live in the
  same shadow tree as the control they describe, with stable generated ids. If external
  labelling elements are supported, implement that deliberately (e.g. through the appropriate
  `ElementInternals` element-reference API) — never forward an unresolved idref.
- Once a semantic role opts into a state, render both values explicitly: `aria-pressed`,
  `aria-selected`, `aria-expanded` as `"true"` or `"false"` (while the control is in that mode) —
  removing the attribute for the false case changes the exposed control contract. Lit's
  boolean-*directive* bindings (`?aria-pressed=`, `?aria-selected=`, `?aria-expanded=`,
  `?aria-checked=`) are therefore never correct for a stateful role — the directive only toggles
  attribute presence, so it can render `"true"` but never the literal string `"false"`. Use a
  plain attribute binding: `aria-pressed=${pressed ? 'true' : 'false'}`. `nothing` is legitimate
  only for "this control isn't in stateful/toggle mode at all", never for "currently false".
- A decorative icon is `aria-hidden="true"`; an icon-only action needs a localized accessible
  name. Visible labels and richer spoken labels are separate public concerns — expose an
  `accessibleLabel`-style override when forcing detailed assistive text into the visible label
  would be wrong.
- **A live-region announcement driven from `updated()`/`willUpdate()` guards its own first
  update.** A bare `changed.has('propName')` check is `true` on the very first update whenever
  that property has a non-empty default — announcing the initial state as a live change the
  instant the component mounts, with no user action behind it. Use an `isMounting`-style flag
  (cleared after the first pass) or a comparison that is provably false pre-mount, matching
  `lr-chat-message`/`lr-branch-picker`.
- **Roving-tabindex / arrow-key grid navigation steps past disabled targets, never onto one.**
  The step function consults a disabled/excluded predicate before committing to the next position
  — not a raw arithmetic offset onto whatever cell is N steps away — and the "nothing
  selected/focused yet" `tabindex="0"` fallback must degrade gracefully rather than being able to
  evaluate false for every candidate and leave the whole widget with zero focusable stops.
  `lr-date-picker`'s `nearestEnabledDate`/`firstEnabledFrom` (stepping past disabled cells up to
  a bounded cap) is the pattern to match.

## Native-control wrappers — preserve the useful native contract

- A component wrapping an `<input>`, `<textarea>`, `<select>`, or similar forwards the native
  attributes meaningful for its advertised use: e.g. `autocomplete`, `inputmode`, `enterkeyhint`,
  `spellcheck`, `autocapitalize`, `autocorrect`, `wrap`. Don't add every platform attribute
  blindly, but don't make a common native behavior impossible through encapsulation either.
- Expose the focus, selection, and editing surface consumers reasonably need from the wrapped
  control — for text controls that normally includes `focus()`/`blur()`, `select()`, selection
  getters, `setSelectionRange()`, `setRangeText()`, or a documented public getter for the native
  element. Public methods keep the component's reactive `value`, form value, and validity in
  sync.
- Specify event names, detail, timing, cancelability, and programmatic-update behavior before
  implementation. User edits remain observable outside the shadow root; if a native event does
  not bubble or compose (`blur` is the common trap), bridge it intentionally when the mirrored
  public contract promises host-level observation. Programmatic property assignments remain
  silent unless the component explicitly documents otherwise.
- Form-associated wrappers project `name`, disabled state, reset/default behavior, and constraint
  validity through `ElementInternals`; rendering `required` on a private native control alone is
  not sufficient.

## Interaction affordance — every reachable state is styled

- **Hover mirrors focus-visible.** Any part with a `:focus-visible` rule, or `cursor: pointer`,
  needs a matching `:hover` rule for the same part — mouse users otherwise get no "this is
  interactive" signal at all while keyboard users get a focus ring. The single most-repeated
  defect in this library's history — four separate remediation commits
  (`git log --oneline --grep 'missing :hover'`) and it still recurs, because new components copy
  an existing `:focus-visible` block and never add the hover companion. Before shipping any
  interactive part, run
  `for f in $(grep -l ':focus-visible' src/components/*/*/*.styles.ts); do grep -q ':hover' "$f" || echo "$f"; done`
  and treat a hit on your own component as a blocker.
- **Keep internal state rules low-specificity so consumers can still override them.** Wrap class
  and attribute qualifiers in `:where(...)` — `:where(.trigger):hover:where(:not(:disabled))` —
  so the internal rule never out-specifies a consumer's `::part(x):hover`. A bare
  `[part='x']:hover:not(:disabled)` is specificity (0,3,0) and beats `::part(x):hover` at
  (0,1,1), forcing consumers to reach for `!important`, which is not this library's house style.
- **A pseudo-class rule must target the node that actually receives the state.** A
  `th:focus-visible` rule is dead if focus always lands on a nested `<button>`; a
  `[part='nav'] button` selector matches only one of a prev/next pair if `part="nav"` sits on the
  button for one and on a wrapping `<span>` for the other. For sibling controls meant to behave
  identically, diff `getComputedStyle` between them rather than eyeballing the selector.

## Responsive components — respond to allocation, not page assumptions

- Reusable primitives must work in a narrow panel, split pane, dialog, and full page. Prefer
  logical sizes, `min-inline-size: 0`, intrinsic wrapping/overflow, and container queries tied to
  the component's own allocation. A viewport media query is appropriate only for an explicit
  app-shell/viewport component — and nothing enforces that, because the style-policy script skips
  every line containing `@media` outright, so hand-review any new `@media` other than
  `prefers-color-scheme`/`prefers-reduced-motion`/`prefers-contrast`/`hover: none`/
  `forced-colors`.
- **An `@container` rule is dead code unless the same stylesheet establishes containment.**
  Declare `container-type: inline-size` (usually on `:host`) in the same file, or the query never
  fires and the component silently keeps its wide layout at every size. Check with
  `for f in $(grep -l '@container' src/components/*/*/*.styles.ts); do grep -q 'container-type' "$f" || echo "$f"; done`
  — this currently returns real hits, so do not assume an existing `@container` rule is proof of
  a working pattern to copy.
- **A component-owned dark-mode override keyed only on `prefers-color-scheme` bypasses the
  library's theming.** Dark mode here is token/attribute-driven (`--lr-theme-*`), so a consumer
  who sets an explicit dark theme without touching OS color-scheme gets every part re-themed
  *except* whatever hid behind the media query. Key the override off the same signal the rest of
  the system uses (a `data-*` attribute or `--lr-theme-*`), and demote
  `@media (prefers-color-scheme: dark)` to a fallback.
- Any component with a multi-column, label-plus-actions, toolbar, or potentially long translated
  layout gets a narrow-allocation story/test (320px is a useful baseline) and a long-content
  case. A wide desktop canvas is not sufficient responsive evidence.

## Motion — durations and phases form one themeable system

- Animation durations, delays, stagger phases, and transition timing use shared tokens or
  component custom properties that can be overridden coherently. If a compound token cannot be
  divided with `calc()`, expose the dependent delay/phase values instead of leaving magic
  literals.
- Decorative, ambient, and infinite animation must stop or simplify under
  `prefers-reduced-motion: reduce`. User-controlled spatial feedback may remain when removing it
  would obscure the interaction, but it should not add nonessential easing or repeated motion.
- Test the reduced-motion branch for animation-heavy components, and that documented motion
  custom properties actually reach the rendered animation declarations.

## Public API documentation — one change, one synchronized surface

- A public property, type, method, getter, event, slot, CSS part, or custom property is
  incomplete until the class JSDoc, behavior tests, an illustrative Storybook story, the
  component's section in `packages/lyra-ui/llms/<family>.md`, and the generated
  `custom-elements.json` agree. Run `pnpm --filter @aceshooting/lyra-ui run llms` to regenerate
  `llms-full.txt`/`llms/components/` afterwards;
  `pnpm --filter @aceshooting/lyra-ui exec node scripts/llms-gap-report.mjs <family>` lists
  exactly which names are still undocumented, and CI fails on any that remain. **That gate only
  checks a member's name appears somewhere in its doc section — not that any stated default,
  number, or "matches sibling X" claim is true.** Those have drifted silently before (a
  documented 10% quiet-tint that shipped as 8%; a size-tier height parity a floor token made
  untrue) — verify every numeric default and cross-component parity claim you write into
  `llms/<family>.md` or a `@cssprop` against the real source or a `getComputedStyle` check.
  Update the package/root component catalog when the component count or summary changes, and
  update exports for new public types/helpers.
- Run `pnpm manifest` after JSDoc/API changes and inspect the generated diff. A passing
  TypeScript build does not catch stale stories, prose, CSS-part lists, or a missing manifest
  entry.
- **A standalone helper function's usage example in `llms/<family>.md` imports from its own
  granular subpath, never the bare `@aceshooting/lyra-ui` root barrel.** The root barrel is an
  eager side-effect chain registering 80+ components; importing it just to call one helper (e.g.
  `confirm()`/`toast()`) drags the whole thing into a consumer's example code, and into anyone
  who copies it verbatim — a real prior incident measured +79 KB gzip for `confirm()` alone from
  exactly this mistake. When fixing one helper, check every sibling helper in the same file; the
  fix does not automatically propagate to neighbors.
