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
| 27.0.0 | Editor data split into `@aceshooting/lyra-ide` and locale catalogs into `@aceshooting/lyra-translations`; agent skill bundled in the lyra-ui package (`npx lyra-ui init-agents`); see the pending changesets in `.changeset/`. |

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

Only items already listed as unshipped:

- **Native document editing** phases 0 to 8 in [document-editing.md](roadmap/document-editing.md),
  including the later consolidation of document viewers and editors in `@aceshooting/lyra-docs`.
- **Regional and additional catalogs:** `es-419`, `en-GB`, `sk`, `bg`, `lt`, `lv`, `et`, `fr-CA`,
  `zh-HK`, `ca`, `ga`, `mt`, Serbian Cyrillic and Latin (script-aware coverage); Luxembourgish (`lb`)
  only when a reviewer and application demand exist.
- **A restrained Fluent-informed look,** only on consumer demand.
