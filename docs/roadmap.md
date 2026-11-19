# Lyra UI roadmap

This roadmap plans the library and its companion packages from 31.3 through 33.0. Version targets
express delivery order and scope, not dates; conditional work remains subject to its stated demand
and qualification. What has shipped is recorded in the changelogs
([`packages/lyra-ui/CHANGELOG.md`](../packages/lyra-ui/CHANGELOG.md), older majors in
[`changelog/`](changelog/)), the GitHub releases and the published packages, not on this page.

The `fixed` release group (`lyra-ui`, `lyra-ide`, `lyra-translations`) shares one version. Companions
version independently: lyra-map 2.x, lyra-3d 1.x, lyra-gen 1.x, lyra-docs 0.x (experimental) and
lyra-flags 2.x.

## Principles for 31.3–33.0

1. **Correct behaviour first.** A correction that changes a documented or test-pinned contract is
   not avoided to keep a release minor; it is staged through the
   [deprecation contract](#deprecation-rename-and-removal).
2. **Coexist, then remove.** Where the old and the correct behaviour can coexist, the correct one
   ships in a minor and the old one is deprecated with a replacement, a development warning where
   usage is cheaply observable, and a migration rewrite or review entry. It is removed no earlier
   than the major after the next one: a deprecation published in 31.x survives all of 32.x and is
   removed in 33.0.0.
3. **Change directly only when the two cannot coexist** — when the old behaviour is itself an
   accessibility or correctness defect that no consumer can legitimately rely on. Such a change lands
   in the next major with a migration note, never silently in a minor.
4. **Corrections before features.** Open correctness, accessibility and security work is scheduled
   ahead of new capability; generative UI then takes priority over new 3D and document features.
5. **No budget raised to absorb growth.** Size is recovered by consolidation and lazy loading.

## Version plan

| Version | Kind | Scope |
|---|---|---|
| **31.3.0** | minor | Library-wide corrections and consolidation (see [below](#3130--corrections-and-consolidation)); first deprecations; core bundle back under budget. |
| **31.4.0** | minor | Delivery size, source and guide accuracy, test health targets. |
| **31.5.0** | minor | Additive library support for Lyra Gen interoperability and geospatial scenes P1; viewer consolidation deprecations if lyra-docs qualifies. |
| **32.0.0** | major | Direct contract corrections that cannot coexist; `lyra-v31` migration profile. |
| **32.x** | minors | Geospatial scenes P2, lyra-3d visuals and scale, on-demand look, additional catalogs. |
| **33.0.0** | major | Removal of everything deprecated in 31.x (and in 32.x once its window has passed). |

### 31.3.0 — corrections and consolidation

| Area | Content |
|---|---|
| Corrections | Keyboard and focus handling, accessible names and live announcements, event and state lifecycles, stale asynchronous results, numeric guards, RTL and localization gaps, forced-colors support and hover/focus parity across all eleven component families. |
| Consolidation | Shared internal helpers for list navigation, type-ahead, accessible-name resolution, focus repair, bidirectional text, scroll regions, owned observers, form-control state, validation, formatting, copy actions, pointer capture, remote viewer sources and map handlers replace duplicated per-component copies. No public API is removed. |
| Additive API | New properties, events and parts where a correction needs a public surface, each with JSDoc, tests, a story, the family guide and regenerated editor data and event types. |
| Deprecations | Contracts superseded by a correction that can coexist with it; their removal clock starts at publication. |
| Size | The core registration bundle returns under its existing budget. |
| Localization | New strings ship translated in every full catalog. |
| Companions | lyra-map, lyra-3d and lyra-docs patch releases only where a correction reaches them. |

### 31.4.0 — size, accuracy and test health

- Per-component delivery cost ranked by bytes saved: remaining duplicated code, heavy import chains,
  lazy registration and chunk candidates, each verified by size, budgets, the full suite and the
  A/B benchmark. Lands in 31.3.0 instead if it is ready without delaying the corrections.
- Source-comment tidiness (narrative and restated code removed; `dist` already strips comments) and
  an accuracy pass over the consumer guides and generated references.
- [Test health](roadmap/test-health.md): the Codecov full-hit goal of 99.80%, CI wall-clock under
  15 minutes, and the remaining WebKit and Firefox lane hot spots.

### 31.5.0 — enabling the next programs (additive)

- Library hooks required by [Lyra Gen interoperability](roadmap/generative-ui.md#delivery-sequence)
  (A2UI, MCP Apps, transport adapters, structured streaming) and persistent dashboards; Lyra Gen
  itself ships independently in 1.x minors.
- [Geospatial scenes P1](roadmap/geospatial-scenes.md#p1): typed globe and terrain configuration,
  altitude-aware geometry and models, and a shared simulation clock around `lr-sequence-playback`,
  with lyra-map 2.x minors where the engine needs them.
- Conditional: once `@aceshooting/lyra-docs` qualifies its viewer parity, lyra-ui's document viewers
  are deprecated in favour of the lyra-docs entry points (both keep working throughout 32.x).

### 32.0.0 — direct contract corrections (major)

- Corrections whose old behaviour cannot coexist with the correct one, each with a migration note
  and, where mechanical, a rewrite in a new `lyra-v31` migration profile; older profiles stay for
  consumers skipping majors.
- No 31.x deprecation is removed in 32.0.0.

### 32.x — features (minors, additive)

- [Geospatial scenes P2](roadmap/geospatial-scenes.md#p2): custom 3D layers, camera tours and
  tracking, and a network-monitoring showcase.
- [lyra-3d 1.x](roadmap/lyra-3d.md#later-lyra-3d-1x): curved edges, DAG layouts, a custom node
  renderer and optional glow, then 100k graph nodes behind a performance gate; WebXR only on demand.
- A restrained Fluent-informed look, only on consumer demand.
- Additional full catalogs, last: `sk`, `bg`, `lt`, `lv`, `et`, `ca`, `ga`, `mt` and Serbian Cyrillic
  and Latin, about 1,600 messages each; Luxembourgish only when a reviewer and application demand exist.

### 33.0.0 — deprecation removals (major)

- Removal of the APIs and behaviours deprecated in 31.x (and any 32.x deprecation whose window has
  passed). Old usage is run through the migration tool and the migrated fixture compiled and rendered
  before removal; dead code, types, CSS, manifest and editor entries and docs go in the same change.
- Conditional: removal of the deprecated lyra-ui document viewers once lyra-docs 1.0.0 has shipped.

### Independent companion programs

| Program | Plan |
|---|---|
| [Lyra Gen](roadmap/generative-ui.md) | 1.x minors: interoperability, then [persistent dashboards](roadmap/generative-ui.md#saved-document-and-sharing-contract); [evaluation campaigns](roadmap/generative-ui-evaluation.md); [website and live generation](roadmap/generative-ui-website.md) last. Advanced capabilities after feasibility ([backlog](roadmap/generative-ui-backlog.md)). |
| [lyra-docs](roadmap/document-editing.md) | Phases 4 to 8 (pagination and Word fidelity, agent operations, review and tracked changes, collaboration and history, export and final qualification) toward 1.0.0, which also consolidates document viewers and editors ([qualification record](roadmap/document-editing-feasibility.md)). |
| [lyra-map](roadmap/map-adoption.md) | 2.x minors for geospatial scenes and open map requests. |
| [lyra-3d](roadmap/lyra-3d.md) | 1.x minors as above. |

Every release, library or companion, passes its own qualification on the exact release commit, and
maintained consumers are upgraded afterwards as described in
[consumer rollout](#consumer-rollout-after-a-release).

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

After each library release, upgrade the public website and maintained consumers through
supported APIs only: update ranges and lockfiles together, replace deprecated usage and application
workarounds the library now covers, run each project's own gates, and report reusable gaps through
the request channel rather than duplicating framework behavior. Website claims (languages,
performance, capabilities) must match released, measured facts; localized pages must be genuinely
translated, with self-canonical URLs, reciprocal `hreflang`, correct `lang`/`dir` and sitemap entries.
Search, component pages and agent-facing indexes derive from the published library's metadata, never
a competing hand-written API inventory.

