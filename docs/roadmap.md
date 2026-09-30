# Lyra UI roadmap

## Roadmap index and release status

This page keeps the current release contract and stable historical anchors. Follow the linked
focused pages for full earlier-release decisions and the application rollout.

- **Current v24 scope:** [design completion](#design-completion-through-v24),
  [compatibility cleanup](#v24-compatibility-cleanup), and the
  [file-layout and context plan](#file-layout-and-ai-context-efficiency), including the
  [structural consolidation scope](#v24-structural-consolidation).
- **Before v24 publication:** complete and document the library's supported styling, options,
  localization, migration and cleanup behavior; qualify the exact release candidate and keep open
  device, human-review and measurement limits explicit.
- **After v24 publication:** upgrade `lyra-ui.com`, `lyra-admin` and every maintained consumer;
  add website language coverage and demonstrate the released styling and builder features. See
  the [post-v24 rollout](roadmap/post-v24-rollout.md).
- **Historical commitments:** the [v21/v22 foundations](roadmap/v21-v22-foundations.md),
  [styling foundations](roadmap/styling-foundations.md), and
  [v23 cleanup](#v23-compatibility-cleanup) retain their scope and compatibility rules.

Release and publication state is established by the package changelog, published package metadata
and release evidence, not by this planning page alone. The delivery matrix below distinguishes
implemented work from release qualification and from post-publication consumer work.

## Product objective and v24 completion contract

Build a lightweight, fast, flexible and composable library with a small default footprint and a
consistent public API. v24 is the completion checkpoint for the agreed styling, design-option,
localization and cleanup program. Completeness means the advertised features work together,
are documented and are verified; it does not require every future feature to be included.

- **Small by composition.** Granular imports include only the selected components and their
  necessary shared code. Optional looks, locale catalogs, fonts, icon collections, chart engines,
  editor integrations and the theme builder are absent from the default graph. Track JavaScript
  and CSS separately, including registration entries, transitive dependencies and lazy chunks.
- **Consistent by construction.** One canonical implementation for each behavior; shared tokens,
  vocabulary, events, accessibility and localization contracts; runtime and stylesheet presets
  generated from the same definitions. Customization must not require copying component code.
- **Deprecated compatibility code cleared.** Publish replacements and deprecation notices for the
  planned cleanup during v22 at the latest. Remove eligible older cohorts in v23 and the remaining
  eligible v22 cohort in v24, including functions, types, aliases, tokens, entry points and assets.
  The target is zero shipped deprecated APIs from those planned cohorts. The published metadata
  remains authoritative: later deprecations retain their promised window, and an unreleased notice
  does not permit immediate removal. Retain migration tooling and necessary saved-data readers.
- **Release readiness over feature count.** Every committed capability has implementation, usable
  examples, generated package/docs/editor surfaces and passing release evidence. Track outstanding
  gaps explicitly. Do not call a skeleton catalog supported or an unmeasured optimization faster.

### File layout and AI context efficiency

Keep the maintained source, tests, roadmaps and documentation independently readable by task.
Use small entry indexes that point to the relevant component, locale, token family or release;
local AI workflows should not need a full catalog or repository-wide document in context.

- **v22:** make per-component references and focused shared guides the default discovery path;
  remove the full LLM aggregate from the published default reading path; shorten generated editor
  descriptions and omit deprecated aliases from suggestions while retaining their authoritative
  compatibility and migration records. Begin cohesive source/test splits where they unblock the
  current release work. Inventory the largest files by text volume and tokenizer-specific context
  cost; a minified one-line artifact can still be large.
- **v23:** retire eligible v21 alias implementations and their redundant published metadata while
  preserving v22's removal of the 21.2 unpacked-budget exception. Partition authored component
  metadata, locale review evidence and contract fixtures by their natural ownership; generate
  aggregate forms only for tools that require them. Preserve migration support for skipped majors.
- **v24:** complete coherent module and behavioral-test splits, release-specific roadmaps and
  topical documentation with stable entry links. Keep full historical records outside default
  package and AI reading paths, and remove the eligible v22 compatibility cohort. Eliminate
  duplicated documentation and schema projections where a shared source can generate them. The
  [historical foundations](roadmap/v21-v22-foundations.md),
  [styling decisions](roadmap/styling-foundations.md), and
  [post-publication rollout](roadmap/post-v24-rollout.md) keep detailed records outside this entry page.

Splits must preserve public entry points, contract coverage, test isolation, generated freshness,
archive discoverability and valid links/anchors. Change generators rather than hand-editing their
outputs. Keep build-only aggregate manifests and declaration entry points when tooling needs them;
provide indexed slices for AI access. Binary/vector assets and dependency lockfiles are referenced
by identity, not loaded as prose context. Measure package bytes and task-context tokens separately;
smaller files alone do not establish a smaller package. Define context budgets against the actual
local model tokenizer and representative tasks, retaining access to every required API detail.

#### v24 structural consolidation

Keep the v24 source, behavioral-test and documentation splits cohesive and useful for task-level
review while preserving the public package surface. Existing component classes and tags remain the
facades; preserve focused test discovery and stable documentation anchors, and keep historical
release detail outside the default entry path. A proposed split needs a demonstrated context or
maintenance benefit; line count alone is not evidence of improvement. This roadmap remains the
public scope and acceptance contract for implementation work.

### Performance and size release gates

Establish reproducible baselines before evaluating optimizations. Use the exact released baseline,
candidate commit, locked dependencies, production build configuration, browser version, device,
viewport, dataset and concurrency settings. Preserve raw results and report repeated-run variability.
Run performance workloads separately from unrelated benchmarks.

| Budget area | Required evidence |
|---|---|
| Delivery cost | Raw, minified and gzip JavaScript/CSS for representative granular imports, app compositions and optional features; npm tarball and installed size |
| Startup | Module parse/evaluation, registration and hydration/initial-render cost; time to usable controls |
| Interaction | Median and tail latency for typing, selecting, opening overlays and updating data; long tasks and dropped frames |
| Large data | Virtualized table/grid/tree scrolling and update cost using fixed datasets; bounded DOM size and allocation |
| Styling | Look/mode/accent/density switch cost, style recalculation and layout; nested scopes and glass on representative lower-powered devices |
| Lifecycle | Retained memory, listeners, observers and DOM after repeated mount/update/unmount cycles; no growing resource counts |
| Composition | Repeated components share lazy services appropriately; optional functionality does not initialize when unused |

Keep numeric limits in the executable budget configuration, with dated baseline evidence, rather
than duplicating them in prose. Required CI size and performance regressions must be explained and
resolved; do not raise budgets merely to make a change pass. Review both absolute usability and
relative results. Optimizations preserve behavior, accessibility, localization and rendering quality.

Compare against relevant libraries using equivalent features, data and rendering conditions; publish
methodology and limitations. The ambition is leading performance in real application workloads.
Use a fastest-in-category claim only for the specific workload and versions the measurements support.

## v22 commitments

[Full section](roadmap/v21-v22-foundations.md#v22-commitments).

## 21.1.0

[Full section](roadmap/v21-v22-foundations.md#2110).

## v22 plan

[Full section](roadmap/v21-v22-foundations.md#v22-plan).

### Rename and removal policy

[Full section](roadmap/v21-v22-foundations.md#rename-and-removal-policy).

### Themes and styling

[Full section](roadmap/v21-v22-foundations.md#themes-and-styling).

#### Six design-option foundations required before v22 publication

[Full section](roadmap/v21-v22-foundations.md#six-design-option-foundations-required-before-v22-publication).

#### Implementation gaps and release assignment

[Full section](roadmap/v21-v22-foundations.md#implementation-gaps-and-release-assignment).

#### v22 styling delivery gates

[Full section](roadmap/v21-v22-foundations.md#v22-styling-delivery-gates).

### Languages

[Full section](roadmap/v21-v22-foundations.md#languages).

#### Website localization and SEO — after v24 publication

[Full section](roadmap/post-v24-rollout.md#website-localization-and-seo--after-v24-publication).

#### Website marketing, agent discovery and application adoption — after v24 publication

[Full section](roadmap/post-v24-rollout.md#website-marketing-agent-discovery-and-application-adoption--after-v24-publication).

### Cleanup and removals

[Full section](roadmap/v21-v22-foundations.md#cleanup-and-removals).

### API harmonization (Lyra-only names): renames in 21.x minors

[Full section](roadmap/v21-v22-foundations.md#api-harmonization-lyra-only-names-renames-in-21x-minors).

### Architecture and packaging

[Full section](roadmap/v21-v22-foundations.md#architecture-and-packaging).

### New components for agentic, chat and RAG interfaces

[Full section](roadmap/v21-v22-foundations.md#new-components-for-agentic-chat-and-rag-interfaces).

## Switchable styling after v21

[Full section](roadmap/styling-foundations.md#switchable-styling-after-v21).

### Delivery order

[Full section](roadmap/styling-foundations.md#delivery-order).

### Glass design scope

[Full section](roadmap/styling-foundations.md#glass-design-scope).

### Completion evidence

[Full section](roadmap/styling-foundations.md#completion-evidence).

### Research informing these priorities

[Full section](roadmap/styling-foundations.md#research-informing-these-priorities).

## Design completion through v24

v24 is the completion milestone for the styling, localization and cleanup scope below. The v22
foundation is published, and v23 delivers the additional looks, builder and localization tooling.
[V24.0.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4024.0.0) is published;
subsequent corrections follow the [release gates](agents/ci-and-gates.md#release-integrity).
Website, admin and consumer integration remains in the
[post-publication rollout](roadmap/post-v24-rollout.md).
The table records acceptance criteria; passed gates must be confirmed against the exact candidate
and release evidence.

| Capability | v22 foundation | v23 completion | v24 release requirement |
|---|---|---|---|
| Composable styling | Lyra, shadcn and Material-inspired looks; solid/glass surfaces; independent density, mode and accent; scoped and SSR forms | Complete additional looks, preset gallery and builder; import/export and reset flows | All shipped combinations qualified; compatibility facades removed only when eligible |
| Contrast | Standard/increased contrast and forced-colors behavior across looks; readable glass fallbacks | Builder contrast diagnostics for custom presets and accents | Contrast, focus and non-color cues verified across components, charts and modes |
| Motion | Consistent system/reduced-motion preferences and shared duration/easing tokens | Animation presets and builder controls that preserve reduced-motion choices | CSS and JavaScript animation paths honor preferences, including overlays and charts |
| Typography | Script-aware font stacks, type scales and line heights; long-text and mixed-script coverage | Font pairing, typography editor and portable presets | All supported scripts work across density, text zoom and RTL; no mandatory font downloads |
| Shape | Consistent radius tokens and shape presets across controls and containers | Expressive shape choices and builder controls | Component overrides and focus indicators remain correct at every supported radius |
| Elevation | Shared surface roles and shadow levels across looks, with forced-colors fallbacks | Elevation editor and optional visual effects | Overlay stacking, fixed positioning and glass nesting verified in supported engines |
| Chart palettes | Categorical, sequential and diverging presets with appropriate light/dark choices | Palette builder and visual diagnostics, with labels/patterns where color alone is insufficient | Canvas and SVG palettes match; contrast, legend meaning and non-color access verified |
| Languages | Complete and independently review the 34 catalog additions; preserve granular imports | Finish localization tooling, reviewer visibility and regional-catalog deduplication | Accurate locale inventory and review claims; all supported languages exercised in the UI |
| Website/admin and consumer follow-up | Record integration needs only | Keep the post-release scope aligned with library contracts | After v24 publication: upgrade the website, admin and all maintained consumers; add the theme selector and missing languages, refresh marketing, SEO and agent discovery, then qualify the rollout |
| Library cleanup | Inventory replacements, deprecations, duplicate paths and packaging cost | Remove eligible older aliases; finish migrations and documentation | Remove eligible v22 aliases and dead code, consolidate implementations, publish measured size evidence |

Typography, shape, elevation and chart choices compose through portable token presets. Contrast
and motion are accessibility preferences that work with every look, not additional mutually
exclusive themes. Preserve the five core style axes and keep optional looks, fonts, locales,
chart engines and builder code outside the default component graph. Compatible improvements may
ship in v22.x; they need not wait for a major release.

Completion requires implementation, authored documentation and examples, migration coverage where
applicable, generated package/editor/agent surfaces, and successful release gates. Include nested
scopes, runtime/stylesheet parity, persistence and SSR handoff, accessibility preferences, all
supported browser engines, RTL and representative long translations. Record measured entry-point
and component sizes and rendering results; do not replace measurements with estimates.

The v24 cleanup gate removes unused code, duplicate internal implementations and obsolete assets
alongside eligible public aliases. Preserve upstream-mirrored APIs, supported granular imports,
saved preferences and migration paths for version-skipping consumers. Do not force a breaking
change merely to reduce the export count. Any incomplete scope remains explicitly open; moving
an item to a later heading does not count as completion.

## v23 compatibility cleanup

Remove only APIs whose published deprecation records permit removal by `23.0.0` and whose
replacement has shipped throughout the intervening major. The authoritative inventory remains
`packages/lyra-ui/scripts/fixtures/component-metadata.json`, generated from its ownership sources.
Retired policy and surface facts remain bound to immutable published evidence under the adjacent
`compatibility-history/` directory; do not maintain a second removal list or infer publication from
an authored `since` value alone. The eligible 21.x cohort includes the GeoJSON alias routes, the
old localization utility entry, the unprefixed document registry types and the component aliases covered by the `lyra-v21` migration profile.

Before each removal, exercise the old usage through the migration tool, then compile and render the
migrated fixture against the new API. Automatic rewrites require equivalent reach and behavior;
ambiguous CSS selectors, slot content and event-detail changes remain warnings for manual migration.
Keep old migration profiles available for consumers skipping a major, independently of removing
runtime aliases. Remove corresponding dead code, deprecated event/type declarations, unused CSS,
manifest/editor entries and docs in the same change. Do not remove upstream-mirrored names.

All styling compatibility APIs first deprecated in v22 continue working through v23, including
`setLyraTheme`, fixed-look CSS and the old theme preset facade. They must share state and render
consistently with the new style API throughout that compatibility period.

## v24 compatibility cleanup

The earliest removal window for APIs first deprecated in v22 is v24. Actual removal still requires
published `since` metadata, a complete intervening major, replacement documentation and executable
migration coverage. Unreleased declarations do not start the clock.

Retain the published `lyra-v22` migration profile and qualify it against the removal candidate.
Theme migration requires semantic handling: old `surface` means an accent reference color, while
new `surface` means a material treatment; `auto` maps to `system`; a token map becomes a look or
explicit overrides. An old CSS color such as `aquamarine` must not silently become a named gemstone.
Do not mechanically rename `setLyraTheme` calls or rewrite arbitrary persisted records.

Remove the compatibility facades and fixed-look assets only after those migrations are qualified.
Keep the persisted v1 record reader where it remains necessary to restore a consumer's saved
preferences; removing a JavaScript export does not imply that saved user data may be discarded.
Report measured entry-point and component bundle reductions rather than predicting savings from
source-line counts. The default component graph must not import optional looks, locale catalogs,
chart engines or a theme builder.

## Language quality and expansion

Catalog breadth, structural completeness and linguistic review are separate claims. The current
catalog inventory and content-addressed review evidence live in `scripts/fixtures/translation-reviews.json`
inside the library package. Its AI-assisted reviews are not native-speaker approvals. Publish those
states separately when adding a locale manifest, and never label English fallback as translated.

Greek, Vietnamese, Bengali, Urdu, Marathi and Telugu are among the 34 additions published in v22.
All 34 have complete catalogs and explicit AI-assisted review evidence. The excluded Arabic and
Chinese varieties are not part of this expansion. Luxembourgish (`lb`) is a useful optional addition for
applications serving Luxembourg; promote it when there is a reviewer and application demand.
Regional catalogs should contain genuine wording differences, with explicit parent relationships,
rather than copies of an entire base catalog. Serbian Latin/Cyrillic and Chinese script variants
need separate script-aware coverage.

Every new catalog must preserve message placeholders, cover the runtime's pinned CLDR plural
categories, and pass key coverage before being advertised. Independently qualify accessible names,
RTL keyboard behavior and overlays, mixed-direction text, text expansion at compact density,
CJK/Thai line breaking, and native-digit formatting and parsing. Language, direction and typography
remain independent of look, surface and accent. Optional locale imports must stay outside the
default component graph. A numeric macroregion such as `es-419` has no single country flag; use a
language label or an explicit application-owned country choice.

BCP-47 language/script/region handling follows the
[W3C language-tag guidance](https://www.w3.org/International/articles/language-tags/index.en);
plural categories and regional inheritance follow
[Unicode CLDR](https://www.unicode.org/reports/tr35/). These sources define mechanics, not the
linguistic quality of Lyra's translations.
