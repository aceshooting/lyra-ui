# Lyra UI roadmap

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
  duplicated documentation and schema projections where a shared source can generate them.

Splits must preserve public entry points, contract coverage, test isolation, generated freshness,
archive discoverability and valid links/anchors. Change generators rather than hand-editing their
outputs. Keep build-only aggregate manifests and declaration entry points when tooling needs them;
provide indexed slices for AI access. Binary/vector assets and dependency lockfiles are referenced
by identity, not loaded as prose context. Measure package bytes and task-context tokens separately;
smaller files alone do not establish a smaller package. Define context budgets against the actual
local model tokenizer and representative tasks, retaining access to every required API detail.

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

v22.0.0 is published and provides the baseline for v23/v24 consolidation: usable replacements,
deprecation notices, migration coverage and stable extension points. The current development focus
is v23. Any API intended for removal in v24 must have entered its published deprecation window by
v22; later-only editors and application upgrades remain in their assigned releases. The v22
commitments below remain the reference for its delivered foundation and qualification limits:

- **A Material-inspired look and a Liquid Glass-inspired surface treatment.** Applications can
  choose the Lyra, shadcn or Material look and independently enable the glass surface treatment,
  without changing component markup. They are original Lyra definitions derived from public design
  principles, not copies of either platform's assets or exact native rendering. See the delivery
  order and glass scope below.
- **Lighter component cores.** Load tooltip and top-layer support only in components that use it,
  instead of in every component's base, and publish the measured bundle-size change.
- **`lr-button-group` fill default.** Stop stretching to full width in narrow containers by default,
  matching `lr-control-group`, with a migration note for consumers that relied on it.

## 21.1.0

There is no 21.0.1 release; its fixes ship in 21.1.0, together with:

- An opt-in `lr-app-rail` fallback focus target for when every built-in return target is hidden or
  inert.
- Deprecation records for the aliases listed under v22 "Cleanup and removals" item 16, so they can be
  removed in v23.
- `lr-tool-call-block`: a localized tool display name and an incomplete/cancelled status.
- `lr-map`: a fit-to-bounds API that does not fight its own `center`/`zoom` updates.

Fixes:

- Script-aware regional locale fallback, so `zh-HK`, `zh-MO` and bare `zh-Hant` resolve to
  Traditional Chinese instead of Simplified.
- `lr-knowledge-graph-explorer` and `lr-agent-trace` stop leaking their inner legend's
  `lr-visibility-change-request`.
- pt-PT: replace the remaining Brazilian "o app interativo" wording.
- `lr-table`: combining `layout="fixed"` with priority columns must not freeze the page.
- `lr-thread-list`: keep the row in its hover/focus state while its top-layer row menu is open, so a
  hover-revealed menu trigger stays visible and the menu does not close (expose a menu-open row state).

## v22 plan

The v22 foundations below shipped in v22.0.0. The additional v23 looks, design editors and
localization tooling are implemented in the v23 release candidate; final package integration and
release qualification remain open. The acceptance criteria remain applicable to later changes.

### Rename and removal policy

Renames of Lyra-only names ship additively in 21.x minor releases: the new canonical name plus a
deprecated alias that keeps working, with a `--origin=lyra-v21` profile in the migration script that
rewrites attributes, properties, events and `::part()` selectors. The unchanged one-full-major
deprecation rule permits removal of those 21.x aliases in v23. A rename introduced in 22.x must
remain through v23 and can be removed no earlier than v24, through a later `lyra-v22` profile.
A rename onto a name another component already uses widens existing code and therefore lands in
v22. Event-detail shape changes cannot be aliased: they also land in v22, and the migration script
reports affected listeners. Names mirrored from Web Awesome or Shoelace, and their defaults, never
change. See [RFC 0003](rfcs/0003-lyra-v21-migration-profile.md).

### Themes and styling

1. Implement [RFC 0001](rfcs/0001-independent-style-axes.md): look, surface (glass), density, mode
   and accent as separate persisted choices with their own attributes and cascade layer, replacing
   the single token-preset slot.
2. Additive token foundations: a radius scale with button and container radius, a fill-relative
   state-layer mix, tonal surface-container steps, a heading font input and a table row-height input.
   Every new input resolves to today's value when unset.
3. A Material-inspired look (M3 tonal direction) in stylesheet and runtime-preset forms, with its visual
   scope documented (no ripple, no shape morphing).
4. A regular glass surface on navigation, toolbar, menu, popover, toast and media-control components
   through one shared mixin, with fallbacks for missing `backdrop-filter`, reduced transparency, forced
   colors and high contrast, a nesting guard and fixed-containing-block tests; a clear variant limited
   to media controls the component owns.
5. Density presets (compact, comfortable, touch) that keep the 24px minimum hit area.
6. The preset gallery shipped in v22. The v23 candidate adds the optional documentation-site theme
   builder, with advanced design controls, import/export, diagnostics and reset flows.
7. The v23 candidate adds dense data (Carbon-inspired), terminal/monospace and high-contrast looks,
   bringing the built-in set to six. An enterprise look informed by Fluent remains demand-led.
8. Validated categorical, sequential and diverging chart-palette foundations shipped in v22. The
   v23 candidate adds the palette builder and visual diagnostics.

#### Six design-option foundations required before v22 publication

All six foundations below shipped in the initial v22 release, with usable public inputs or presets,
scoped examples, API documentation and generated package surfaces. Their advanced editors are
implemented in the v23 candidate. Defaults preserve existing behavior. The
[completion matrix](#design-completion-through-v24) assigns final consolidation and qualification.

| Foundation | v22 deliverable and acceptance criteria |
|---|---|
| Contrast | Standard/increased contrast choices compose with every built-in look; system preferences and forced colors retain usable text, boundaries and focus indicators; qualify solid and glass fallbacks |
| Motion | Shared duration/easing inputs and system/reduced-motion choices reach both CSS and JavaScript animation paths; reduced motion suppresses nonessential movement without losing state changes or completion events |
| Typography | Body/heading/monospace inputs, type scale and line-height choices reach rendered text; script-aware fallback stacks work without downloaded fonts; qualify long labels, mixed scripts, RTL and text zoom |
| Shape | Shared radius inputs and usable shape presets reach controls and containers; component overrides win; supported radii preserve hit areas, focus rings and clipping behavior |
| Elevation | Shared surface roles, shadow levels and usable elevation presets work across looks; forced colors retains visible boundaries; verify overlay stacking and glass/fixed-position interactions |
| Chart palettes | Optional categorical, sequential and diverging presets have light/dark variants and a shared canvas/SVG interpretation; validate text/mark contrast and provide labels or other non-color cues where needed |

#### Implementation gaps and release assignment

These acceptance criteria distinguish implementation from release qualification. The v22 rows
describe the published foundation; the v23 editor implementation awaits final release gates, and
v24 consolidation remains pending. Source changes alone do not close a release requirement.
README and library documentation updates ship with v23. The website and application refresh
follows v24 publication.

| Gap | Release | Acceptance criteria |
|---|---|---|
| Runtime, CSS and bootstrap agreement | v22 | Sparse/null branches, custom looks, explicit mode precedence, named versus literal accents, storage failures and old saved records resolve identically; resetting restores prior authored values and priorities without stale overrides |
| Accessible accent rendering | v22 | Named and custom accents retain their requested seed while derived text/fills, borders and focus indicators meet their respective contrast requirements across every built-in surface and mode; runtime and generated CSS agree |
| Glass rendering and scrolling | v22 | A stationary fill covers the full scrollport; blur never captures fixed descendants; nested glass avoids repeated blur; component-local controls work; every supported treatment, foreground, border, focus and state is qualified over black/white and varied backgrounds |
| Glass visual quality and fallback | v22 | Qualify chrome foregrounds and opacity together so translucency remains visible and legible; a nearly opaque text-only floor is an interim safeguard, not completion. Unsupported filtering, reduced transparency, forced colors and high contrast render usable solid surfaces; clear glass is restricted to owned media controls |
| Component token integration | v22 | Button/container shape, heading typography, tonal surface roles, state layers and table density reach their actual rendered targets; unset values preserve existing behavior and all interactive targets retain the minimum hit area |
| Language delivery and script coverage | v22 | All 34 additions have full catalogs, independent content-addressed review evidence, correct placeholders/plurals/direction and granular exports; exercise representative long labels, native digits, mixed scripts, RTL and text zoom; scaffolds are not advertised |
| Deprecation and migration enforcement | v22 | The canonical metadata validates named exports, entry points, stylesheets, global events and root attributes; migration profiles cover the records in both directions and report semantic changes rather than unsafe automatic rewrites |
| Package and consumer surfaces | v22 | Canonical generators produce imports, exports, side effects, manifests, editor/event/framework data and agent references; gallery examples include required stylesheet imports and demonstrate scoped composition |
| Complete design editors and additional presets | v23 | Builder import/export, reset, diagnostics and advanced contrast/motion/typography/shape/elevation/chart controls work together; optional code remains outside the base dependency graph |
| Eligible removals and internal consolidation | v23–v24 | Remove each cohort only when the canonical published metadata permits it; preserve mirrored upstream contracts, saved-data readers and migration profiles; remove associated dead code and qualify the resulting package size |
| Final integration and performance evidence | v24 | All preceding rows are closed; supported browser engines, SSR/hydration, accessibility and representative compositions pass; measured size, latency and lifecycle budgets hold on the release commit |

#### v22 styling delivery gates

The accepted RFCs describe the target contract. Experiments and unverified source implementations
are not release evidence. The new style runtime, Material look, glass mixin and density presets
must pass the complete delivery gates before they are advertised as supported.

- **One complete switching path.** Deliver the resolver, generated stylesheets and runtime looks,
  storage migration, no-flash bootstrap, resets and observer updates together. An id passed to
  `setLyraStyle()` selects an already-loaded stylesheet; it does not download or register a look.
  `defineLyraLook()` validates a runtime look object. Examples must show the required imports.
- **Scopes independent of the token optimization.** Define and test stylesheet adoption inside
  application shadow roots even if RFC 0002's performance gate defers the document token layer.
  Exercise the inherited look in nested roots, explicitly styled islands, iframes, top-layer popups
  and body-mounted toast/confirmation helpers; document which scope owns each surface.
- **Combination coverage.** Gate every built-in look × named accent × mode × surface combination,
  including states and glass fallbacks. Add custom-accent cases and rendered compact/touch targets.
  Independent choices may change derived geometry and contrast; the stored choices must survive.
- **Whole-interface coverage.** Include native controls styled by `native.css`, typography and code
  highlighting, charts/canvas, virtualized rows, and overlay chrome in the same gallery fixtures.
  Record deliberate visual exceptions. A control-only showcase cannot establish a coherent look.
- **Measured lengths.** Inventory JavaScript reads of theme tokens, including table/grid sizing and
  virtualized row pitch. Resolve CSS math in the owner's live theme scope so density does not paint
  one size while hit testing, scrolling or placement uses a fallback size.
- **Separate release evidence.** Keep RFC 0001's bootstrap, all-component parity and switching gates,
  RFC 0002's conditional performance gate, and glass device/legibility evidence distinct. Any work
  not yet verified remains pending. APIs first deprecated in v22 remain supported through v23 and
  cannot be removed before v24.

### Languages

9. The 34 new catalogs shipped in v22, extending the population-prioritized selection toward
    50 languages after excluding separate Arabic and Chinese varieties, and including Greek:

    | Group | Catalogs |
    |---|---|
    | First fourteen | Bengali (`bn`), Urdu (`ur`), Nigerian Pidgin (`pcm`), Marathi (`mr`), Vietnamese (`vi`), Telugu (`te`), Swahili (`sw`), Hausa (`ha`), Western Punjabi/Shahmukhi (`pnb`), Tagalog (`tl`), Tamil (`ta`), Amharic (`am`), Thai (`th`), Greek (`el`) |
    | Next nine | Javanese (`jv`), Gujarati (`gu`), Kannada (`kn`), Bhojpuri (`bho`), Yoruba (`yo`), Burmese (`my`), Lingala (`ln`), Odia (`or`), Malayalam (`ml`) |
    | Remaining eleven | Sindhi (`sd`), Eastern Punjabi/Gurmukhi (`pa`), Sundanese (`su`), Igbo (`ig`), Dari (`fa-AF`), Nepali (`ne`), Malay (`ms`), Uzbek (`uz`), Zulu (`zu`), Pashto (`ps`), Oromo (`om`) |

    Starting from a 33-option baseline, this expansion brings the available set to 67 locale
    options (including built-in English and regional catalogs). All 34 planned additions now have
    complete catalog and AI-assisted review records; no native-speaker certification is claimed.
    Locale options are not a count of distinct spoken languages. Greek and Vietnamese were
    explicitly requested; additions were prioritized by total first- and second-language speakers,
    starting with Bengali and Urdu.
10. Keep separate Arabic and Chinese varieties, including Egyptian Arabic, Yue/Cantonese and Wu
    Chinese, out of this expansion. Standard Arabic and
    standard written Chinese remain the existing UI choices; do not advertise them as dedicated
    translations of every spoken variety. Nigerian Pidgin is a separate language and stays in scope.
    Establish each new catalog's written register, script, terminology and plural forms explicitly.
    Tagalog `tl` is the requested ranking entry; do not silently count it as a separate Filipino
    `fil` translation. Western Punjabi `pnb` uses Shahmukhi and RTL; Eastern Punjabi `pa` uses
    Gurmukhi and LTR. Dari `fa-AF` requires Afghan terminology, not an unchanged Persian copy.
    Sindhi uses Arabic script; Uzbek, Hausa, Javanese, Sundanese and Oromo use Latin scripts.
11. Later regional variants and additions: `es-419`, `en-GB`, `sk`, `bg`, `lt`, `lv`, `et`,
    `fr-CA`, `zh-HK`, `ca`, `ga`, `mt`, and Serbian Cyrillic/Latin. Regional catalogs require actual
    localized wording, not copies of the base catalog. Luxembourgish (`lb`) remains demand-led.
12. The v22 localization infrastructure includes delta catalogs for regional variants, a lazy locale-loader API used by
    `lr-locale-picker`, per-script typography tokens (Thai, Urdu, Indic, CJK line breaking), native-digit
    display and parsing coverage, pinned CLDR plural categories, reviewer tiers with a native-speaker
    review channel, a generated locale manifest with coverage, pseudo-locale visual lanes, and flag-map
    fixes for numeric regions and missing languages. The v23 candidate completes regional-catalog
    deduplication and review visibility. The public inventory contains 66 optional catalogs plus
    built-in English; completeness and AI-assisted review do not establish native-speaker approval.

Population prioritization uses dated estimates, not a sum of unique people reached: multilingual
speakers appear in several totals. The [public 2026 Ethnologue-based ranking](https://en.wikipedia.org/wiki/List_of_languages_by_total_number_of_speakers#Ethnologue_(2026))
places Bengali and Urdu among the ten largest languages; both are included in the authored
catalogs published in v22.
Speaker estimates guide sequencing; they do not establish translation quality or internet audience.
The extended list is a planning selection from a
[public reproduction of the 2025 ranking](https://www.jetpunk.com/user-quizzes/2026529/top-200-languages-ethnologue-2025),
continuing below rank 50 to replace excluded varieties. It is not a verified claim of complete
coverage of the latest official top 50. Script-specific catalogs and Dari remain explicit in the
inventory rather than being hidden in a single language count.

#### Website localization and SEO — after v24 publication

Only after v24 is published, update `lyra-ui.com` to consume the released v24 library and expose
every supported locale from its locale inventory. Add all website languages missing from that
inventory comparison, including the 34 additions published in v22. Apply the same
locale coverage to `lyra-admin`. This is a separate post-v24 follow-up; no website/admin rollout is
scheduled after v22 or v23, and unpublished catalogs must not be advertised as available.

Create useful, translated language landing pages and navigation, with localized titles, descriptions,
headings, examples and accessible labels. Add stable locale URLs, self-canonical URLs, reciprocal
`hreflang` alternates (including `x-default` where appropriate), correct HTML `lang`/`dir`, and sitemap
entries for genuinely translated indexable pages. Pages containing only English fallback must not
claim to be localized. Keep language selection accessible and preserve the user's current page when
an equivalent translation exists. Do not force language redirects that prevent crawling or explicit
user choice. Check indexing and search performance after launch; language-specific pages are for
useful documentation, not duplicated keyword pages.

#### Website marketing, agent discovery and application adoption — after v24 publication

Only after v24 is published, upgrade `../lyra-ui.com` and the `lyra-admin` application to that
released version and adopt the completed v22–v24 capabilities through supported APIs. This includes
the theme selector, builders, marketing material, SEO, agent-facing discovery and missing language
coverage. These application changes are not part of v22/v23 delivery or a prerequisite for publishing
v24; execute and verify them as one coordinated post-v24 rollout.

Describe Lyra as framework-agnostic, standards-based and free under the MIT license. Demonstrate
the released theme features, granular imports, accessibility and localization through working
examples. Distinguish supported capabilities from measured performance and linguistic-review
claims; the marketing must reflect the released library.

Include every maintained project that consumes Lyra UI in this rollout. Inventory direct
dependencies and component usage, update dependency ranges and lockfiles together, migrate to
supported v24 APIs, and run each project's own verification gates. Preserve unrelated work and
application-specific behavior. Examples and integrations must use the released package rather
than copied framework code or private source imports.

Clean up frontend workarounds during migration. Replace them with supported APIs where possible,
and report reusable library gaps through the established request channel rather than duplicating
framework behavior in applications.

The post-v24 rollout establishes an ongoing policy: both applications use the latest stable
published Lyra release, with dependency ranges and lockfiles updated together, migration notes
reviewed and application gates passed for each subsequent upgrade. If a newer stable version has
shipped by the time the rollout starts, target that version rather than deliberately pinning an
older v24 release. Do not run intermediate upgrade or cleanup projects for v22 or v23.

Clean up every migrated application during that first rollout: replace deprecated Lyra usage with the
canonical APIs, remove obsolete theme switches, duplicated framework styling/localization,
unused dependencies and assets, stale examples and application workarounds superseded by the
library. Preserve application-owned domain behavior and genuine brand customization. Repeat the
relevant cleanup with later upgrades instead of accumulating another compatibility layer.

- **Comprehensive documentation refresh after v24.** Review the README files and all maintained
  documentation and Markdown files across Lyra UI, `lyra-ui.com` and `lyra-admin`. Update feature
  descriptions, setup/version instructions, imports, examples, theming/localization guides,
  migration instructions, contributor guidance and agent-facing documentation to the released
  contracts and application integrations. Remove duplicate or obsolete guidance, repair links and
  align package names, terminology and availability claims. Preserve historical changelogs and
  archived RFCs as dated history, with supersession links where necessary rather than rewriting
  what shipped. Regenerate generated Markdown, references and packaged skills from their authored
  sources; never hand-edit generated copies. This full consistency pass is post-v24; API docs and
  migration notices required to ship v22/v23 changes still land with those library changes.
- **Use the features in the products.** Add an accessible theme-selector button to the website
  navigation. Its panel previews and selects the available look, surface, mode, accent and density
  independently, with keyboard operation, localized accessible names, reset controls and persisted
  choices restored without a flash. Offer contrast and motion preferences as their published
  contracts become available, preserving system accessibility settings. Use the same supported
  style APIs in `lyra-admin`, with scoped examples for navigation, data tables, forms and charts.
  Keep optional styles and locales lazy or granular; do not load every preset on every page.
- **Demonstrate composition.** Include working shadcn-plus-glass and Material examples, solid
  fallbacks, compact and touch layouts, script-aware typography, radius/elevation customization
  and chart palettes. Test public pages and admin workflows in light/dark modes, RTL, long
  translations and reduced-motion/transparency settings. Bring builder and preset import/export
  into the relevant demo and administration flows after their library release.
- **Update marketing material.** Refresh landing-page copy, feature pages, screenshots, demos,
  comparison material, release pages and onboarding to explain the complete feature set and the
  library's small, composable architecture. Describe where glass applies and how looks combine.
  Include language coverage and review status. Performance and size claims link to reproducible,
  dated evidence; comparisons identify versions and equivalent workloads. Do not describe
  planned capabilities, fallback English or unmeasured speed advantages as shipped facts.
- **Search optimization.** Create useful indexable pages for the released capabilities, with
  clear titles, descriptions, headings, internal links and examples. Apply the locale URL,
  canonical, reciprocal `hreflang`, sitemap and translation requirements above. Add accurate
  structured metadata where appropriate; keep examples crawlable and avoid requiring client-side
  interaction to discover core documentation. Measure indexing, search queries and page performance
  after launch.
- **Agent-facing discovery.** Update the website's existing component search, documentation
  search, migration endpoints, structured indexes and MCP resources from the published library's
  canonical metadata and authored docs. Include theme composition, granular imports, localization,
  accessibility preferences, sizing and migration examples, with versioned source attribution
  and stable links. Keep `llms.txt`, API references and machine-readable descriptions consistent;
  do not maintain a competing hand-written API inventory. Evaluate retrieval using representative
  natural-language questions and localized queries, checking that answers identify the right
  components and supported APIs. Avoid claims of guaranteed ranking in agent-generated answers.
- **Completion evidence.** Verify the theme selector's persistence and bootstrap, application
  adoption without private-API workarounds, locale navigation, generated-search freshness,
  crawlability and structured data. Keep website/admin bundle and interaction budgets intact.
  Record the library version each public example and application actually uses.

### Cleanup and removals

13. Remove the overdue deprecated events: the chart, box-plot, graph-legend and graph-query-builder
    `lr-before-*` veto aliases and `lr-command-palette`'s `lr-open`.
14. Remove the Lyra 7 migration profile and the unused interactive-transition stylesheet.
15. Merge `lr-code-block` and `lr-code-block-core` onto a shared base class.
16. Deprecate in 21.1.0 for removal in v23: the `lr-geojson-view` alias tag; `lr-mutation-observer`'s
    `attributes` and `character-data` aliases; `code-block-chrome`; `lr-media-card`'s
    `lr-before-media-download`; `lr-sparkline`'s `area` part and `--lr-sparkline-stroke-width`;
    `lr-split-panel`'s `split-panel` part; `lr-stat`'s default-slot icon; `lr-icon`'s `fixed-width`;
    non-item content in `lr-menu`'s default slot; the unprefixed `DocumentFile` and
    `DocumentRendererDefinition` types; and one of the two overlapping localization entry points.

### API harmonization (Lyra-only names): renames in 21.x minors

Each rename below ships additively in a 21.x minor release with its deprecated alias and migration
profile entry. What no alias can keep compatible, such as a changed event-detail shape or default,
or a rename onto a name another component already uses, lands in v22.

17. One veto grammar: a cancelable `lr-<noun>-request` fires before a change; `-change` notifications
    are never cancelable.
18. Close events carry an object detail with `reason` everywhere; `lr-lightbox-close` becomes `lr-close`.
19. `lr-toggle` always carries `expanded`; `lr-expand`/`lr-collapse` are directional only; state
    attributes converge on `expanded`.
20. Resolve contradictory attribute pairs: `without-arrow` over `arrow`, `without-steppers` over
    `steppers`, one legend-visibility spelling, and consistent `copyable`, `show-value` and `multiple`
    defaults.
21. Drop `accessible-label` in favour of the host `aria-label`, and normalise the `aria-label` default.
22. Use "edge" consistently for graph connections (props, events, parts) and namespace graph tokens under
    `--lr-graph-*`, ending the `lr-link-click` name clash with hyperlinks.
23. Rename pointer-and-keyboard `-click` events to `-activate`.
24. Boolean attributes default to false and use `with-`/`without-`; rename `lr-table`'s string labels
    that look like booleans.
25. Fold `compact` into `size`/density and normalise size defaults to `'m'`.
26. Consistent search, filter, selection and tab event details that match their property names.
27. One meaning per name: `error-text` for messages, `zoomable` for the chart zoom switch, and consistent
    `pending` and `heading-level` types.
28. Sizing inputs accept CSS lengths; `readonly` replaces `editable`/`locked`; one `positioning-strategy`
    default; `-placement` suffixes; `heading` plus `heading-level` for section titles.
29. Hyphenated forwarded part names instead of `__`, component-namespaced custom properties, and one
    `-background`/`-color` suffix convention.

### Architecture and packaging

30. Implement [RFC 0002](rfcs/0002-tokens-once-per-document.md): declare design tokens once per
    document instead of on every element host, conditional on its performance release gate.
31. Establish class subpaths as canonical and deprecate package-root component-class exports in
    v22. Retain those exports through v23; the class-free root arrives with eligible removal in v24.
32. Establish one canonical registration import path per component in v22, with notices and
    migration coverage for duplicate routes. Retain newly deprecated routes through v23 and remove
    them no earlier than v24.
33. Deprecate the `ssr-loader.js` compatibility entry in v22 and retain it through v23; remove it
    no earlier than v24. Browser consumers import `hydration.js` before granular registrations;
    server diagnostics use `ssr.js`. The migration requires environment-specific review.
34. Raise the supported Node floor to 22.
35. Raise the browser floor to the Popover API (Firefox 125, Safari 17).
36. Shrink the published tarball: stop shipping `llms-full.txt`, trim editor hover descriptions to a
    summary plus a documentation link, and ship only the current major's changelog section. Also
    trim the metadata of the 21.x deprecated aliases (about 1.7 MB unpacked in 21.2.0): leave
    deprecated members out of `web-types.json` and `vscode-html-data.json` so editors stop suggesting
    old names, compact their entries in `custom-elements.json`, and slim the migration CLI's
    `migration-contract.json`. Published v22 returned the unpacked size below the pre-8 baseline
    and removed 21.2.0's above-baseline exception ahead of its v23 deadline. Preserve that reduction
    as eligible aliases are removed. The separate required-artifact exceptions to the 25% targets
    remain explicit in the package budget.
37. Make `LyraElement`'s collection-snapshot support opt-in, and move development-only diagnostics
    behind a `development` export condition.
38. Also: a shared decorator helper, a faster parallel lint chain, test-title-keyed quality evidence,
    budget files without narrative history, optional scoped custom-element registries, and one shared
    framework type map.

### New components for agentic, chat and RAG interfaces

39. v22 priorities: `lr-change-review` (multi-file diff with per-hunk keep or discard),
    `lr-agent-question` (structured questions and MCP elicitation), message-part and stream
    interrupt/resume extensions, `lr-permission-rules` with `lr-permission-grant`,
    `lr-connector-manager` (MCP servers and connectors), `lr-background-runs`,
    `lr-research-progress`, and `lr-budget-meter`.
40. Next: `lr-conversation-tree`, `lr-state-history`, `lr-query-plan`, `lr-web-search-results`,
    `lr-suggested-edits`, `lr-prompt-library`, `lr-agent-card` with `lr-agent-picker`,
    `lr-diagram` (Mermaid), and `lr-guardrail-notice`.
41. Later: `lr-schedule-editor`, `lr-share-dialog`, `lr-session-replay`, `lr-conversation-search`,
    `lr-image-generation`, `lr-read-aloud`, `lr-agent-team`, and reasoning-effort controls in
    `lr-model-settings-panel`.

## Switchable styling after v21

Make choosing and switching an application's visual style straightforward while keeping the same
components, markup, events, keyboard behavior, and accessibility contracts. This is planned work,
not a claim that new presets or settings are already available. It does not block v21.

The current foundation already supports the original Lyra look, the opt-in shadcn look as CSS or a
runtime token preset, light/dark/system mode, custom accents and surfaces, persistence, and a
no-flash bootstrap. Extend that foundation rather than introducing another theme engine.

### Delivery order

1. **Unified style selection and a glass surface treatment.** Offer a previewable choice of looks,
   with an optional glass treatment for app rails, docks, floating toolbars, menus, popovers, and
   media controls. Preserve independent mode and accent choices when changing the look. Support
   returning to the original look and resetting individual choices without stale token overrides.
   Ship runtime and stylesheet forms from the same authored definitions, with a clear guide to
   whole-page switching and scoped styling.
2. **Density presets.** Add compact, comfortable, and touch-oriented spacing as an independent
   choice. Cover tables, forms, navigation, and toolbars together; preserve readable type, keyboard
   focus, and minimum interactive target sizes. Prove combinations with both existing looks and
   glass surfaces rather than maintaining a separate component implementation for each setting.
3. **Visual theme builder and preset gallery.** Preview real components while choosing look,
   surface treatment, mode, accent, density, radius, typography, and elevation. Export validated
   runtime presets and CSS, explain contrast corrections, and support importing and resetting a
   saved preset. Reuse the existing token validation and interchange formats.
4. **Material-inspired look (committed for v22).** A more rounded, expressive look informed by
   Material Design, delivered as an optional preset in both runtime and stylesheet forms. Build an
   original Lyra definition from public design principles; document the supported visual scope
   rather than promising exact native-platform rendering or behavioral parity. A restrained
   enterprise look informed by Fluent remains a later option, guided by consumer demand.

### Glass design scope

Use Liquid Glass as design inspiration: translucent fill, backdrop blur, restrained edge
highlights, and clear elevation. Keep content surfaces such as tables, editors, documents, and
long conversations readable and visually stable. Start with a regular, more opaque treatment;
consider a clearer media-overlay variant only when its background and contrast can be controlled.
Do not stack glass layers indiscriminately or make pointer-driven distortion a requirement.

Look, surface treatment, color mode, accent, and density should remain separate choices. A user
should be able to combine shadcn controls with a glass navigation surface and a compact data table.
Exact new API names and scoping rules belong in an RFC before implementation; the existing
`setLyraTheme()` and preset APIs remain the starting point.

### Completion evidence

- Switching and resetting presets removes obsolete overrides, preserves unrelated choices, and
  works with persistence, pre-paint restoration, SSR/hydration, and document adoption.
- Glass remains usable without backdrop filtering, has an explicit solid-surface override, and
  responds to reduced transparency where supported, forced colors, and reduced motion.
- Text, controls, focus rings, and selected states stay legible over varied live backgrounds in
  light and dark mode. Include RTL, narrow allocations, zoom, long labels, and nested surfaces.
- Chromium, Firefox, and WebKit exercise the actual combinations. Review visual captures and
  scrolling/animation performance on representative desktop and mobile hardware; record results
  before claiming cross-browser visual parity.
- Every delivered choice includes Storybook examples, consumer documentation, generated token/API
  artifacts where applicable, and measured loading/bundle costs. Optional looks and effects remain
  optional imports.

### Research informing these priorities

Reviewed on 2026-09-26. These sources demonstrate established design approaches; they are not a
survey or ranking of Lyra users' requests. The delivery order above is a product recommendation.

- [Apple: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
  places Liquid Glass on a navigation/control layer and distinguishes regular and clear treatments.
  This supports starting with selective glass surfaces instead of making every content panel glass.
- [Material Design 3](https://m3.material.io/) documents color roles, shape scales, elevation,
  and type scales as token systems. This supports mapping a Material-inspired look onto Lyra's
  existing semantic tokens rather than adding a parallel theme engine.
- [Microsoft Fluent: Material](https://fluent2.microsoft.design/material) distinguishes opaque and
  translucent materials, including acrylic for transient surfaces. This supports a surface choice
  that can vary by role independently of the overall look.
- [Vaadin Aura: Density and sizing](https://vaadin.com/docs/latest/styling/themes/aura/other) exposes
  shared sizing and radius controls. This supports making density consistent across a whole UI.
- [Web Awesome: Customizing and theming](https://webawesome.com/docs/customizing) offers scoped
  themes and a visual builder. This supports an easy selection/export workflow for consumers.
- [shadcn/ui: Theming](https://ui.shadcn.com/docs/theming) uses semantic CSS variables and a visual
  preset workflow. This supports extending Lyra's existing validated token presets.

## Design completion through v24

v24 is the completion milestone for the styling, localization and cleanup scope below. The v22
foundation is published; v23 features are implemented and undergoing final integration and release
qualification. The v24 requirements and post-release rollout remain pending. The table records
acceptance criteria, not a claim that pending release gates have passed.

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
