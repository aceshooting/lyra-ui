# Lyra UI roadmap

## Roadmap index and release status

Release and publication state is established by the package changelog
([`packages/lyra-ui/CHANGELOG.md`](../packages/lyra-ui/CHANGELOG.md), older majors in
[`changelog/`](changelog/)), published package metadata and release evidence, not by this page.
This page records what shipped, the standing contracts that still govern changes, and what is
still open.

- **Native document editing:** [delivery sequence](roadmap/document-editing.md) and its
  [qualification record](roadmap/document-editing-feasibility.md). Experimental, in
  `@aceshooting/lyra-docs`; not part of lyra-ui release qualification.
- **Graph engines and WebGL 3D:** [plan](roadmap/graph.md) for moving graph engines into the
  optional `@aceshooting/lyra-graph` companion and adding a WebGL 3D engine. Planned.
- **Rationale for the style-axis, token and migration designs:** the [RFCs](rfcs/).

## Shipped

| Release | Delivered |
|---|---|
| 21.1.0 | Deprecation records for the Lyra-only aliases removed in 23.0.0; `lr-app-rail` fallback focus target; `lr-map` fit-to-bounds; script-aware regional locale fallback. |
| 22.0.0 | Independent persisted look, surface, density, mode and accent choices; Material-inspired look and glass surfaces; contrast, motion, typography, shape, elevation and chart-palette foundations; 34 additional translation catalogs with lazy loading, delta catalogs and a review-provenance manifest; agentic components (change review, questions, permissions, connectors, background runs, research progress, budget); lighter component cores; Node 22 and Popover API baseline. |
| 22.1.0 | Deprecation notices and migration coverage for package-root component-class exports. |
| 23.0.0 | Storybook theme builder (import/export, contrast diagnostics) and three optional looks (data, terminal, high contrast); removal of the eligible v21 aliases, entry points and types; `lyra-v21` and `lyra-v22` migration profiles retained. |
| 24.0.0 | Removal of the eligible v22 compatibility APIs; implementation and test consolidation; documentation refresh. |
| 25.0.0 | Shadcn, Glass, Emerald and System mode become the built-in appearance defaults; user-controlled Glass opacity. See `changelog/v25.md` for 25.x. |
| 26.0.0 | Native `input`/`change` plus typed `lr-input`/`lr-change` across form controls; shared form-control size ladder; resize and focus event alignment; pickers mount options lazily. |
| 27.0.0 | Editor data split into `@aceshooting/lyra-ide` and locale catalogs into `@aceshooting/lyra-translations`; agent skill bundled in the lyra-ui package (`npx lyra-ui init-agents`). |
| 28.0.0 | One document-level design-token layer declared once per document and re-derived only at theme scopes (RFC 0002), with `adoptLyraTokens()` and `lyra-ui-migrate --rule=theme-scopes`; see `changelog/v28.md` for 28.x. |
| 29.0.0 | Map and document editing load on demand: `lr-map` defaults to the optional `@aceshooting/lyra-map` companion, and the document editor bundles its engine internally. |
| 29.2.0 | Regional difference catalogs `en-GB`, `es-419`, `fr-CA` and `zh-HK`; `@aceshooting/lyra-map` 1.2.0 on MapLibre 6.15; code-block highlighting without `Element.part`; dialog and tooltip focus and positioning fixes; test-stability fixes. |
| 29.2.1 | Release and quality hardening: publishing fails unless npm serves the released tarball, `pnpm release:budgets` checks size budgets before the release commit, load-tolerant scale-test budgets, broader behavioural coverage with provably dead guards removed. No public API change. |

## Standing contracts

### Deprecation, rename and removal

- A deprecation has a published `since` and a replacement; it stays for one complete later major.
  An unreleased notice never starts the clock. The authoritative inventory is
  `packages/lyra-ui/scripts/fixtures/component-metadata.json`, generated from its ownership
  sources; immutable published evidence lives under `compatibility-history/` beside it. Keep no
  second removal list.
- Renames of Lyra-only names ship additively (canonical name plus working alias) with a migration
  profile rewrite. A rename onto a name another component already uses, and any event-detail
  shape change, cannot be aliased and lands in a major. See
  [RFC 0003](rfcs/0003-lyra-v21-migration-profile.md).
- Before removing an API, run the old usage through the migration tool and compile and render the
  migrated fixture. Automatic rewrites need equivalent reach and behavior; ambiguous selectors,
  slot content and event-detail changes stay manual warnings. Keep old migration profiles for
  consumers skipping a major, and remove the matching dead code, types, CSS, manifest and editor
  entries and docs in the same change.
- Theme migration needs semantic handling: old `surface` is an accent reference color, new
  `surface` a material treatment; `auto` maps to `system`; a token map becomes a look or explicit
  overrides. Never rename `setLyraTheme` calls mechanically or rewrite arbitrary persisted records,
  and keep a reader for saved preferences even after its export is removed.
- Upstream-mirrored names and defaults never change.

### Composition, size and file layout

- Optional looks, locale catalogs, fonts, icon collections, chart engines, editor integrations and
  the theme builder stay out of the default import graph; granular imports include only the selected
  components. Track JavaScript and CSS separately, including registration entries and lazy chunks.
- One canonical implementation per behavior; runtime and stylesheet presets are generated from the
  same definitions; customization never requires copying component code.
- Keep source, tests and docs independently readable by task, with small entry indexes. A split
  needs a demonstrated context or maintenance benefit (line count is not evidence), and must keep
  public entry points, contract coverage, test isolation, generated freshness and valid anchors.
  Change generators, not their outputs. Measure package bytes and task-context tokens separately.

### Style completion evidence

Typography, shape, elevation and chart choices compose through portable token presets; contrast and
motion are preferences that work with every look. Look, surface, mode, accent and density stay
independent choices. A style change is complete only with all of:

- switching and resetting leave no stale overrides, and work with persistence, pre-paint restoration,
  SSR/hydration and nested scopes, with runtime and stylesheet parity;
- glass remains usable without backdrop filtering, has a solid override, and honors reduced
  transparency, forced colors and reduced motion; text, controls and focus stay legible over varied
  backgrounds in light and dark, RTL, narrow allocations, zoom and long labels;
- Chromium, Firefox and WebKit exercise the actual combinations (visual captures reviewed);
- Storybook examples, consumer documentation, generated token/API artifacts and measured size costs.

### Performance and size release gates

Establish reproducible baselines before judging an optimization: exact released baseline,
candidate commit, locked dependencies, production build, browser version, device, viewport, dataset
and concurrency; preserve raw results and report variability.

| Budget area | Required evidence |
|---|---|
| Delivery cost | Raw, minified and gzip JavaScript/CSS for representative granular imports, compositions and optional features; tarball and installed size |
| Startup | Module parse/evaluation, registration and hydration/initial-render cost |
| Interaction | Median and tail latency for typing, selecting, opening overlays and updating data; long tasks and dropped frames |
| Large data | Virtualized table/grid/tree scrolling and update cost on fixed datasets; bounded DOM and allocation |
| Styling | Look/mode/accent/density switch cost, style recalculation and layout; nested scopes and glass on lower-powered devices |
| Lifecycle | Retained memory, listeners, observers and DOM after repeated mount/update/unmount |
| Composition | Repeated components share lazy services; unused optional functionality never initializes |

Numeric limits live in the executable budget configuration
([ci-and-gates](agents/ci-and-gates.md#package-delivery-budget)), not in prose. Do not raise a
budget merely to make a change pass. Optimizations preserve behavior, accessibility, localization
and rendering. Claim "fastest" only for the specific workload and versions measured.

### Language quality

Catalog breadth, structural completeness and linguistic review are separate claims. Inventory and
content-addressed review evidence live in `packages/lyra-ui/scripts/fixtures/translation-reviews.json`;
AI-assisted reviews are not native-speaker approvals, and English fallback is never labelled
translated. A new catalog preserves placeholders, covers the pinned CLDR plural categories and passes
key coverage before being advertised; independently qualify accessible names, RTL keyboard behavior,
mixed-direction text, text expansion at compact density, CJK/Thai line breaking and native-digit
formatting. Regional catalogs hold genuine wording differences with an explicit parent, not copies of
a base catalog. A numeric macroregion such as `es-419` has no single flag. BCP-47 handling follows
the [W3C language-tag guidance](https://www.w3.org/International/articles/language-tags/index.en)
and plural/inheritance rules follow [Unicode CLDR](https://www.unicode.org/reports/tr35/).

### Consumer rollout after a release

After each library release, upgrade `lyra-ui.com`, `lyra-admin` and every maintained consumer through
supported APIs only: update ranges and lockfiles together, replace deprecated usage and application
workarounds the library now covers, run each project's own gates, and report reusable gaps through
the request channel rather than duplicating framework behavior. Website claims (languages,
performance, capabilities) must match released, measured facts; localized pages must be genuinely
translated, with self-canonical URLs, reciprocal `hreflang`, correct `lang`/`dir` and sitemap entries.
Search, component pages and agent-facing indexes derive from the published library's metadata, never
a competing hand-written API inventory.

## Next

Unshipped work in delivery order, with target versions. Targets follow semantic versioning and the
`fixed` release group (`lyra-ui`, `lyra-ide` and `lyra-translations` share one version); companion
packages version independently. A target moves only when scope changes, never to absorb a slip.

| Target | Package versions | Scope |
|---|---|---|
| 30.0.0 | lyra-ui 30.0.0; lyra-graph 1.0.0 (new) | Graph engines move (phase 1) and immutable identity collections |
| 30.1.0 | lyra-ui 30.1.0; lyra-graph 1.1.0 | WebGL 3D graph engine (phase 2) |
| 30.2.0 | lyra-ui 30.2.0; lyra-map 1.3.0 | Map adoption gaps |
| 30.x | lyra-graph 1.2.0, 1.3.0 | Advanced graph visuals (phase 3), 100k-node scale and performance gate (phase 4) |
| independent | lyra-docs 0.7.0 to 1.0.0 | Native document editing phases 4 to 8 |
| on demand | lyra-ui minor | Fluent-informed look |
| last | lyra-ui minors | Additional full catalogs |

1. **30.0.0 with lyra-graph 1.0.0: the next major release.** It bundles the breaking changes into
   one migration:
   - **Graph engines move** (phases 0 and 1 in [graph.md](roadmap/graph.md)): specification,
     package boundary and WebGL feasibility in all three engines, then the existing graph, flow and
     mind-map engines move to `@aceshooting/lyra-graph` with no behavior change, as the map engine
     did in 29.0.0.
   - **Immutable identity collections:** reassigning the same array to an identity-preserving
     collection property (feeds, queues, transcripts, task lists, virtual lists) re-copies it today
     so in-place `push`/edits keep rendering. Make "assign a new array to publish changes" the rule
     for these properties, skip same-array re-copies by default (as `threads` already does), and ship
     a migration note plus a `lyra-ui-migrate` review entry. Not before a major: it silently stops
     in-place updates from rendering.
2. **30.1.0 with lyra-graph 1.1.0: WebGL 3D graph** (phase 2): an opt-in WebGL renderer for
   `lr-graph` with a worker force layout and instanced rendering; additive.
3. **30.2.0 with lyra-map 1.3.0: map adoption.** Find what applications still render with MapLibre
   directly instead of `lr-map` (custom layers, styling, interaction or data-update needs) and close
   those gaps, so map screens share one accessible, themed component; additive.
4. **lyra-graph 1.2.0 and 1.3.0: advanced visuals and scale** (phases 3 and 4): curved edges,
   arrows, particles, DAG layouts, dragging and labels, then 100k nodes with a performance gate.
5. **lyra-docs 0.7.0 to 1.0.0: native document editing**, released independently: 0.7.0 phase 4
   (pagination and Word fidelity), 0.8.0 phase 5 (agent-friendly document operations), 0.9.0 to
   0.11.0 phases 6 to 8 in [document-editing.md](roadmap/document-editing.md), and 1.0.0 once
   qualified, including the consolidation of document viewers and editors in `@aceshooting/lyra-docs`.
6. **A restrained Fluent-informed look,** only on consumer demand, in a minor release.
7. **Additional full catalogs (last):** `sk`, `bg`, `lt`, `lv`, `et`, `ca`, `ga`, `mt`, Serbian
   Cyrillic and Latin (script-aware coverage), about 1,600 messages each, in minor releases;
   Luxembourgish (`lb`) only when a reviewer and application demand exist.
