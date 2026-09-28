# AGENTS.md — contributor guide for AI coding agents working ON this repo

> **Scope:** agents modifying lyra-ui's own source; apps that only *depend on*
> `@aceshooting/lyra-ui` read `packages/lyra-ui/llms.txt` and `llms/` instead.
>
> Each section links a `docs/agents/` file with the full normative detail (patterns, incidents,
> rationale). **Read it before working in that area**; these one-liners are reminders only.

## What this is

`@aceshooting/lyra-ui` (version: `packages/lyra-ui/package.json`) is a free, clean-room Lit 3
web-component library: an open-source companion to Web Awesome reimplementing several WA **Pro**
components plus original extras. Non-negotiable:

- **Clean-room.** No WA Pro source was ever available or copied; behavior is original, seeded only
  from this org's own pre-existing hand-rolled components.
- **API-mirroring.** A component with a WA counterpart mirrors its public surface 1:1 under `lr-`,
  so migration is a mechanical `wa-` → `lr-` rename; others follow this library's conventions.
  `pnpm run migrate-wa` (`packages/lyra-ui/scripts/migrate-wa.mjs`, `test:migrate-wa`) is a
  best-effort consumer codemod, not a guaranteed 1:1 match.
- **Non-goals:** no WA fork, `wa-` prefix or WA branding; no React wrappers (the stack is unifying
  on Lit; React 19 runs custom elements).

## Workspace hygiene

- Create temporary Git worktrees only under `../lyra-ui_worktrees/<name>` (for example,
  `git worktree add --detach ../lyra-ui_worktrees/<name>`) — never inside this checkout, as any
  other sibling of it, or under `/tmp/`. `/tmp` is RAM-backed on the author's workstation, and a
  worktree's `node_modules`, `dist` and browser runs have exhausted memory there and lost
  uncommitted work on the forced reboot. Keep the primary checkout cleanly identifiable and remove
  each worktree as soon as its work has been integrated.

After remote verification and a successful commit/push, clean up task-owned Lyra checkouts,
build outputs, logs, toolchains, and caches under `~/work` on `ssh cygnus`. Preserve uncommitted
source locally first and leave active tasks alone; see
[remote test workspace hygiene](docs/agents/ci-and-gates.md#remote-test-workspace-hygiene).

## Author's Cygnus / Solarleb workspace goal

| Repository | Role | Local checkout |
|---|---|---|
| `cygnus` | Backend language, runtime, storage, services and generated contracts | `../cygnus` |
| `lyra-ui` | Reusable frontend components and frontend development experience | `.` |
| `solarleb_cygnus` | Full-stack Solarleb application built with both | `../solarleb_cygnus` |

The author authorizes fixes, modifications and commits across all three
repositories. Iterate between them to make application development seamless:
repair reusable backend, contract and tooling gaps in Cygnus, and reusable UI
component or frontend tooling gaps in Lyra UI; then consume those fixes in
`solarleb_cygnus`. Keep application-specific domain logic and composition in the
application. Do not hide framework defects behind application monkey patches,
duplicated framework code, manual copies of generated contracts or bypasses of
supported APIs. Follow each repository's own instructions and verification gates.
These paths locate checkouts relative to this repository; package resolution still uses declared
dependencies.

GreyCat runtime source is available for read-only inspection at
`../../greycat/greycat`.
The author explicitly forbids modifying that repository. It is a reference for
understanding the comparison control, not another implementation target.

The saved goal is to fully migrate Solarleb from GreyCat to Cygnus, completing
the backend before frontend migration to Lyra UI. Resume from the Cygnus
[current checkpoint](../cygnus/docs/IMPLEMENTATION_PROGRESS.md#current-checkpoint)
and [canonical queue](../cygnus/docs/REMAINING_WORK.md), with application
integration under `APP-SOLARLEB-BACKEND`. The delivery contract is
[Solarleb backend roadmap](../cygnus/docs/ROADMAP.md#28-solarleb-backend-migration-and-greycat-comparison).
Use this as a workspace coordination route; it does not replace Lyra's public API
contracts or create a second implementation plan here. All builds, tests and
benchmarks for this work run on `ssh cygnus`, never on the workstation. Use
`CI_JOBS=58` where supported and verify each runner's actual concurrency budget.
Application milestones follow the author's regular commit-and-push instruction
in `solarleb_cygnus/AGENTS.md`.

## Monorepo layout

pnpm workspace (`pnpm-workspace.yaml`: `packages/*`), Node ≥ 20, `pnpm@12.6.0`.
The published package supports Node ≥ 20; contributor generation, measured-quality, release, and
primary CI work use the exact Node `22.23.2` recorded in [`.nvmrc`](.nvmrc). Run `nvm use` before
those commands rather than relying on an arbitrary Node 22 patch.

```
packages/lyra-ui/                 @aceshooting/lyra-ui, the library
  src/internal/                   LyraElement, FormAssociated, positioner, tokens, prefix, a11y
  src/components/<family>/<name>/ 11 family dirs (agent-tools, charts, conversation, data, forms,
                                  layout, media, overlays, retrieval, utility, viewers); not flat
  src/lyra.ts | src/all.ts        pure curated root barrel | generated registration side effects
  llms.txt                        consumer entry index
  llms/<family>.md                AUTHORED, one per src/components/<family>/; edit these
  llms/{shared,00-*}.md           AUTHORED cross-cutting reference + intro prose
  llms-full.txt, llms/{index,tokens,peers,migration}.md, llms/components/<tag>.md
                                  GENERATED; never edit, CI diffs them
packages/lyra-flags/              optional <lr-flag> SVG companion (Noto Emoji, Public Domain)
docs/agents/                      detail behind this file's digests
.storybook/ | .agents/            Storybook docs site | Codex skill links + marketplace metadata
plugins/lyra-ui/                  shared Codex/Claude plugin; skills/lyra-ui/references/ GENERATED
skills/*.skill                    packaged skill bundles, GENERATED (both by ./package.sh)
```

After a doc change run `./package.sh` directly (it regenerates `llms/` first); `pnpm lint` misses
the packaged copy, CI's `static-checks` diffs it ([detail](docs/agents/ci-and-gates.md)).

## Dev commands and gates

From repo root; package-local forms in `packages/lyra-ui/`. Annotated commands, gate lists,
ordering, incidents: **[docs/agents/ci-and-gates.md](docs/agents/ci-and-gates.md)**.

```bash
pnpm install        # workspace install
pnpm build          # -r; lyra-ui's build chains check:build-artifacts
pnpm test           # -r; builds lyra-ui first, then wtr
pnpm lint           # -r; full contract-policy chain + every tsc contract
pnpm manifest       # custom-elements.json
pnpm registrations  # all.ts imports, tag aliases, allowlist, sideEffects, subpath exports
pnpm plugin:sync    # lyra-ui version -> agent manifests + Claude marketplace entry
pnpm release:prepare # consume changesets, regenerate version-derived files; no commit/tag/push
pnpm docs           # Storybook on localhost:6006
pnpm create:component --family utility --name status-panel  # validated scaffold
./scripts/test.sh   # complete 3-engine + SSR/visual sweep; before publishing, not per commit
```

The scaffold takes an unprefixed name, enrolls every authored inventory/docs surface, and runs a
three-engine baseline: **[docs/agents/component-scaffold.md](docs/agents/component-scaffold.md)**.

- `packages/lyra-ui/package.json#scripts.contract-policy` and `.github/workflows/ci.yml` are the
  authoritative gate lists; reproduce CI failures in that order, never from a prose copy.
- Release flow: `pnpm release:prepare`, review, commit `chore(release): <pkg>@<version>`, push to
  main; push CI, all Test All Browsers aggregates and all full-engine shards must pass on that exact
  commit; then `gh workflow run release.yml --ref main` tags, releases and dispatches `publish.yml`
  (approve `npm-publish`). Nothing is tagged or published locally
  ([release integrity](docs/agents/ci-and-gates.md#release-integrity)).
- `./scripts/test.sh` mirrors full-engine's split via `TEST_SH_ENGINE_SHARDS` (a count, default
  `1`), so a failing CI shard reproduces as the same-numbered local shard.
- `prepack` stamps version metadata and regenerates editor data; CI freshness-checks it too.
- `check:hit-area` and `check:numeric-guards` block `pnpm lint`;
  `ls packages/lyra-ui/scripts/check-*.mjs` is the real inventory.
- Outside `contract-policy`: `check:build-artifacts` (in `build`; no maps in `dist`) and
  `check:coverage-floors` (after `test:coverage`; regenerate with `--write-floors`).

## Coding conventions — digest

Full rules: **[docs/agents/coding-conventions.md](docs/agents/coding-conventions.md)**.

- Extend `LyraElement` (`src/internal/lyra-element.ts`), never `LitElement`.
- Never hard-code `"lr-"`: `tag()` / `defineElement()` (`src/internal/prefix.ts`).
- Style values are `--lr-*` tokens (`internal/tokens.styles.ts`); raw hex/px only for
  algorithm literals, tokenized when data-driven.
- A `true`-defaulting boolean `@property` uses `trueDefaultBooleanConverter`.
- Numeric props reaching layout/`Intl`/canvas/timers use the `finiteNumber` family
  (`src/internal/numbers.ts`), never bare `isNaN()`.
- Closed string sets are colocated exported literal unions, never a TS `enum`; name a repeated
  union.
- Single-quoted literals outside templates (`check:source-policy`); printed types feed
  `check:pinned-upstream-manifests` verbatim.
- An interactive element with `part=` gets a `--lr-icon-button-size` min hit area.
- `rel` is settable, but the `target`-derived guard is not removable: merge author tokens, always
  strip `opener`, and force-add `noopener noreferrer` whenever `target` is set (reverse-tabnabbing
  vector otherwise). Never let `target` alone produce an anchor with no guard. Call
  `resolveGuardedRel()` (`src/internal/link-rel.ts`); never re-type the merge.
- Resolve canvas colors via `getComputedStyle` first; resolve token units live (`rem` → root,
  `em` → own `fontSize`), never `* 16`.
- Never `createElementNS` a custom element when cloning; check `localName.includes('-')`.
- Template nodes: `parentNode`, never `parentElement` (null under a `ShadowRoot`);
  `insertBefore()` in place still drops focus, so check position first.
- Reset transient open `@state` in `disconnectedCallback`.
- Escape/focus-return overlays use `activateOverlay()` (`src/internal/overlay-manager.ts`),
  never a raw `document` keydown listener.
- `this.emit()` (bubbles + composed); `{ cancelable: true }` only where code branches on
  `defaultPrevented`; library events are `lr-`-prefixed.
- Sibling `*.styles.ts`; `static styles = [LyraElement.styles, styles]`.
- `css`/`html` template comments are template text: no backtick, `${` or prose `*/`.
- Bind flush (`>${x}</tag>`) inside any element whose computed `white-space` preserves breaks;
  assert with `renderedTemplateWhitespace()` (`test/rendered-whitespace.ts`), never template text.
- Composed-child `exportparts` is on-demand: only the primary surface a consumer must style, with a
  collision-resistant prefix; never speculatively.
- A state paints from its own private var (public token folded in), never through the resting
  public token, and mixes hover/press from its own fill; an unqualified pointer token applies in
  every state, a state-named one owns its state (`check-interaction-states` rule 4,
  `state-fallback-ok:`).
- Assert rendered CSS (`getComputedStyle`/hit test), never stylesheet text; only pseudo-classes
  follow `::part(x)`, so encode state in the part name; recursive self-rendering forwards every
  documented part via `exportparts`.
- Class modules stay side-effect-free, registration entries side-effectful; `pnpm registrations`
  generates root imports, both `sideEffects` forms and subpath exports; named root exports stay
  hand-curated.
- `FormAssociated` mixin for string values, else `ElementInternals` plus your own `setValidity()`.
- JSDoc sits DIRECTLY above `export class Lyra*` or `cem` empties the entry; check
  `custom-elements.json`.
- Lean/full pairs (`x.class.ts`/`x-core.class.ts`) share logic via `x-shared.ts`.
- Never reference internal process (audits, codenames, severity ratings, client names, local
  paths) in comments or shipped docs; the npm tarball publishes them.
- License: MIT. TypeScript strict.

## Upstream parity and the shared vocabulary — digest

Binds components whose README `Mirrors` cell names a `wa-*`/`sl-*` tag, plus the shared
vocabulary. Full rules: **[docs/agents/upstream-parity.md](docs/agents/upstream-parity.md)**.

- Mirroring obliges the whole documented surface; each omission states a reason (class JSDoc, or
  `noCounterpart` in `scripts/fixtures/upstream-tags.json`).
- Never rename a mirrored member; add the upstream name as a second token/alias.
- Where upstreams disagree (`with-clear`/`clearable`), accept both, deprecate neither, test both.
- Never invert polarity (gated by `check-migration-coverage.mjs`) or change a default (ungated).
- README `Mirrors` cells are executable rewrite rules (`buildMirrorMap`), gated by
  `check-migration-coverage.mjs`.
- A Lyra-only deprecation record removed in 23.0.0 lands with its
  `scripts/fixtures/lyra-renames.json` entry — `renames` only for an exact alias whose rewrite
  keeps a site's reach, otherwise `reviews` (`slotContent` for slot content) — or
  `check-migration-coverage.mjs` fails `pnpm lint` ([RFC 0003](docs/rfcs/0003-lyra-v21-migration-profile.md)).
- A capability an upstream exposes publicly never lives only in `src/internal/`.
- Refresh `upstream-tags.json` from upstream's published manifest with the pin bump; only names,
  versions and behavior prose cross over.
- `src/internal/variants.ts` owns `variant`/`appearance`/`frame`/`size`; never re-declare a
  shared member set locally (`check-style-vocabulary.mjs`).
- Slots `start`/`end`, form chrome `label`/`hint`, glyphs `<purpose>-icon`, everywhere.
- A surface change lands JSDoc + test + story + `llms/<family>.md` + manifest/editor data together;
  `check-component-coverage.mjs` covers only the tag.
- Documented `llms/<family>.md` defaults must match the manifest (`check:llms-defaults`,
  `llms-default-exempt:`).

## i18n, RTL, and theming — digest

A gap is a bug. Full rules: **[docs/agents/i18n-rtl-theming.md](docs/agents/i18n-rtl-theming.md)**.

- User-facing strings (incl. `aria-*`, `title`, `placeholder`, `alt`) go through
  `this.localize()`; caller data does not.
- Reuse `DEFAULT_STRINGS` keys; a component-prefixed key beats bending a generic one.
- Never a literal/unconditional 2nd-arg fallback for a `DEFAULT_STRINGS` key; it defeats
  `registerLyraLocale()` and the grep misses conditional-looking variants.
- Never show a raw caught `error.message` in an alert/status region (`LyraUserFacingError` aside).
- Interpolate via the 3rd `values` arg; never concatenate translated text.
- `Intl.*`/`toLocaleString` get `this.effectiveLocale`, never `'en'` or bare `undefined` (ungated).
- Never set `dir`; use `this.effectiveDirection` and logical CSS (`:host(:dir(rtl))` as escape).
- ArrowLeft/ArrowRight swap under RTL; glyphs mirror via the wrapping part, not the icon.
- Test the unregistered English fallback and that a `.strings` override reaches the DOM.

## Form-control completeness and native passthrough — digest

Full rules: **[docs/agents/form-controls.md](docs/agents/form-controls.md)**.

- Form-associated controls ship `label`/`hint`/`errorText` props + slots + parts like `lr-select`,
  unless documented as a bare primitive.
- A host `aria-label` wins over any computed internal accessible name.
- Native resizable text wrappers expose the resize vocabulary (incl. auto-grow) or document why not.
- Forward `spellcheck`/`autocapitalize`/`autocorrect`/`wrap`; re-emit internal `blur`/`focus`.
- Style `:host(:disabled)`, never `:host([disabled])`.
- Overriding `focus()`/`blur()` means also forwarding host `click()`.
- `disabled` gates every self-rendered sub-control.
- The required asterisk is `formControlRequiredMarker` (`src/internal/form-control.styles.ts`),
  never a re-typed `::after` or literal `<span>`.
- `formResetCallback()` restores the default, clears dirty flags, re-syncs validity; never blanks;
  `setCustomValidity()` survives it.
- `type="submit"|"reset"` needs `static formAssociated`, `attachInternals()`, and
  `closest('form')?.requestSubmit()`/`.reset()`.

## Optional peers and remote content — digest

Security-sensitive; ungated. Full rules:
**[docs/agents/peers-and-remote-content.md](docs/agents/peers-and-remote-content.md)**.

- Consumer `src`: `safeFetchUrl()` → `readResponseArrayBuffer`/`readResponseText` byte ceilings
  and entry/row caps → unconditional `DOMPurify.sanitize()` → generation-token guard after every
  `await`.
- Peer loaders validate the needed capability (named API, then default; `mod.default ?? mod`); a
  wrong sanitizer normalization silently no-ops.
- Load failure fails closed with a visible localized fallback and a separate light-DOM
  announcement; empty-but-valid is its own state, never the error path.
- New optional peer: `peerDependencies` + `peerDependenciesMeta.optional` + `devDependencies`.

## Accessibility, native contracts, responsive layout, motion, docs — digest

Release blockers for new components, bugs in existing ones. Full rules:
**[docs/agents/a11y-responsive-motion.md](docs/agents/a11y-responsive-motion.md)**.

- Name the element that owns the role; host `aria-label` and idrefs don't cross shadow roots.
- Stateful ARIA renders `"true"` and `"false"`; never Lit `?aria-*=` for it.
- Decorative icons `aria-hidden`; icon-only actions get localized names.
- Live-region announcements from `updated()`/`willUpdate()` guard the first update (`isMounting`).
- Roving tabindex skips disabled and inert (`closest('[inert]')`) targets, never zero tab stops.
- Tooltip-class disclosures open on keyboard focus only (`isKeyboardFocusEvent()`), described on
  any focus; editing popups, self-reveals, value feedback exempt.
- Announce via `acquireAnnouncementSink()` (`src/internal/announcer.ts`), never a shadow-root
  live region.
- Native wrappers forward meaningful native attributes, expose focus/selection/editing methods
  that keep value/validity in sync, and specify the event contract before implementation.
- Every `:focus-visible`/`cursor: pointer` part has a `:hover` rule (the most-repeated defect in
  this library's history).
- Internal state qualifiers go in `:where()`; target the node that receives the state.
- Respond to allocation: container queries (with `container-type` + tokenized
  `contain-intrinsic-inline-size`), 320px/long-content/shrink-to-fit coverage; dark mode keys off
  tokens/`data-*`, `prefers-color-scheme` only as fallback.
- Motion uses tokens and stops under `prefers-reduced-motion`; test both branches.
- API changes: JSDoc + tests + story + `llms/<family>.md` + `pnpm manifest`, editor data,
  `./package.sh`; verify numbers by hand; helper examples import granular subpaths, never the root
  barrel.
- New or changed events: `pnpm run events` + `pnpm run framework-types` (`check:event-types`,
  `check:framework-types`).
- New `@deprecated`: a `component-metadata.json#deprecations` record (`kind: 'slot-content'` for
  deprecated content in a surviving slot, whose description must not start with "Deprecated"); a
  deprecated entry point or exported type goes in `#exportDeprecations`. A record after the current
  release tag uses `since: 'unreleased'` (stamped on the version bump; otherwise `since` ≤ current
  version); `removalNotBefore` clears one whole later major; no doc, JSDoc or message names the
  pending version.
- Cheaply observable deprecated usage (property/attribute set, tag connect, alias veto — never
  slotted content or styling hooks, which would ship in every bundle) calls `warnDeprecatedUsage()`
  (`src/internal/dev-mode-attribute-warning.ts`); tests seed or capture it with
  `test/expected-deprecations.ts` ([testing.md](docs/agents/testing.md)).

## Testing conventions — digest

Full rules and incidents: **[docs/agents/testing.md](docs/agents/testing.md)**.

- `wtr` + Playwright Chromium + `@open-wc/testing`; TDD failing-test-first; colocated
  `<name>.test.ts`.
- Local `pnpm test` is Chromium-only: use `WTR_BROWSER=firefox|webkit` for iframes, re-emitted
  events, pointer/`:active` state.
- Pointer state after `sendMouse` is racy per engine: `hoverUntilMatched()`
  (`packages/lyra-ui/test/wtr-mouse.ts`), then `waitUntil`; never read `:state(x)` synchronously
  after a press.
- After ANY `src/` change, tests included: rebuild, then
  `node scripts/generate-component-quality.mjs --write --measure-gzip`.
- Set up `oneEvent()` BEFORE the dispatch, or the test hangs.
- Move focus via `test/wtr-focus.ts` (`focusByKeyboard`/`focusAfterPointer`), never bare
  `.focus()` or synthetic focus events; window spies pre-arm `trackInputModality(document)`.
- Axe-check each component on its own tag AND populated/open states.
- Adversarial fixtures: focused keyboard activation, `dir="rtl"`, unsorted, dangling refs,
  shrinking data, pointercancel, reconnect.
- A reported failure already failed twice: fix or quarantine, never re-run and shrug.
- Never let a failing assertion carry a DOM node (the file hangs); compare ids/lengths.
- `?attr=${false}` can't reset a `true` default; use `.prop=${false}`.
- No `@sinonjs/fake-timers` under wtr; real timers with margins.
- Save and restore any stubbed browser global.
- A new opt-in property gets an explicit unset-regression test.

## Process for multi-step work

Non-trivial work goes spec → plan → tasks: an approved spec (goals, non-goals, naming, success
criteria) precedes the plan; the plan has numbered tasks with checkbox steps, file lists and
interfaces; each task is implemented, then reviewed for spec compliance and quality until clean.
Specs, plans and ledgers stay out of version control.
