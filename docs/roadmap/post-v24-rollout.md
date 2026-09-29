# Post-v24 website and application rollout

This application work starts after publication of the v24 library. The [roadmap](../roadmap.md) retains the library release contract.

## Website localization and SEO — after v24 publication

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

## Website marketing, agent discovery and application adoption — after v24 publication

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

- **Documentation timing.** Keep library README, API, styling/options, localization and migration
  documentation aligned with each library release, including v24, before publication. After v24
  publication, update `lyra-ui.com`, `lyra-admin` and other maintained consumer documentation for
  the released package and actual application integrations. Repair stale links and availability
  claims as those consumers migrate. Preserve changelogs and archived RFCs as dated history, with
  supersession links where needed rather than rewriting what shipped. Regenerate generated Markdown,
  references and packaged skills from their authored sources; never hand-edit generated copies.
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
  canonical metadata and authored docs. Refresh the browsable component list and each component's
  detail page from that same released inventory. Include theme composition, granular imports, localization,
  accessibility preferences, sizing and migration examples, with versioned source attribution
  and stable links. Keep `llms.txt`, API references and machine-readable descriptions consistent;
  do not maintain a competing hand-written API inventory. Evaluate retrieval using representative
  natural-language questions and localized queries, checking that answers identify the right
  components and supported APIs. Avoid claims of guaranteed ranking in agent-generated answers.
- **Completion evidence.** Verify the theme selector's persistence and bootstrap, application
  adoption without private-API workarounds, locale navigation, generated-search freshness,
  crawlability and structured data. Keep website/admin bundle and interaction budgets intact.
  Record the library version each public example and application actually uses.
