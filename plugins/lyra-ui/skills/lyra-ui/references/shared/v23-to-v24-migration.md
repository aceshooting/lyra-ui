# Upgrading from v23 to v24

## Migration scope

This guide is for applications moving from Lyra UI 23 to v24. Keep the exact package version you
test pinned while you migrate, and verify its availability in the package registry before updating
production dependencies.

V24 keeps the public component tags and eight spellings needed to match current Web Awesome or
Shoelace contracts. It removes eligible deprecated Lyra compatibility surfaces and narrows module
entry points. The nested event-detail compatibility fields below are outside the 44-member
metadata-driven CLI cohort, so migrating their consumers requires event-specific review rather
than a broad property or event rewrite.

Use the generated [migration reference](../migration.md) for the exact v22 deprecation record,
replacement and warning by component. Use the focused guides below for the supported import,
styling, event and SSR contracts; this document is the project cleanup sequence, not a duplicate
member inventory.

## Migrate a project in reviewable steps

1. **Establish a clean comparison point.** Record the installed Lyra version, package manager lock,
   entry modules, custom CSS, saved style-preference shape, locale registrations and framework type
   declarations. Check `git status` and preserve unrelated edits. Use a branch or disposable
   worktree so a generated codemod diff cannot overwrite in-progress application work.
2. **Upgrade only Lyra and its lockfile.** Install the exact v24 package build being evaluated and
   confirm the resolved package version. Do not change unrelated dependencies as part of this step.
3. **Run the matching Lyra report before applying it.** From the project root, use the installed
   CLI. A project moving from v23 uses `lyra-v22`; a project skipping from v21 should run the
   historical `lyra-v21` and `lyra-v22` profiles in order. Those are separate origin profiles,
   retained for their respective major-to-major contracts:

   Set `LYRA_VERSION` to the exact v24 package version you installed. Supplying both the matching
   package to `npx` and `--lyra-version` makes the profile's removal window explicit even when the
   CLI itself is not in the project's local `node_modules`:

   ```sh
   LYRA_VERSION=24.0.0
   npx --package "@aceshooting/lyra-ui@${LYRA_VERSION}" lyra-ui-migrate \
     --lyra-version="${LYRA_VERSION}" --origin=lyra-v22 --dry-run \
     --report=lyra-v22-preview.json src
   npx --package "@aceshooting/lyra-ui@${LYRA_VERSION}" lyra-ui-migrate \
     --lyra-version="${LYRA_VERSION}" --origin=lyra-v22 --check \
     --report=lyra-v22-before.json src
   ```

   Review the report before writing. The CLI does not rewrite Lyra tags or imports, and it does not
   translate style calls or arbitrary saved data. It applies only exact, declared member mappings
   that preserve the target reach. For reports that require review, inspect the current component
   contract and make the behavior-preserving application change yourself. A reviewed rename-profile
   warning can be acknowledged with the documented `lyra-migrate-reviewed: CODE:name` comment on
   the reported line (or immediately before the reported element); an acknowledgement records your
   review, it does not perform a rewrite. Then apply the profile and check it again:

   ```sh
   npx --package "@aceshooting/lyra-ui@${LYRA_VERSION}" lyra-ui-migrate \
     --lyra-version="${LYRA_VERSION}" --origin=lyra-v22 \
     --report=lyra-v22-applied.json src
   npx --package "@aceshooting/lyra-ui@${LYRA_VERSION}" lyra-ui-migrate \
     --lyra-version="${LYRA_VERSION}" --origin=lyra-v22 --check \
     --report=lyra-v22-after.json src
   ```

   `--check` never writes source files and exits nonzero while rewrites or unacknowledged warnings
   remain. A clean second pass should report no changes. Keep the before/after reports with the
   migration review if useful; do not treat a zero exit as proof that an unscanned dynamic use is
   correct.
4. **Replace imports deliberately.** V24 no longer exports component constructors from the package
   root, and removes duplicate nested registration entries. A stable tag registration remains
   available; constructor values and constructor-owned types come from the registration-free
   `.class.js` module. For example:

   The old form was `import { LyraButton } from '@aceshooting/lyra-ui';`; the constructor is no
   longer exported there. In v24, import the constructor or its types from this registration-free
   family module instead:

   ```ts
   import { LyraButton } from '@aceshooting/lyra-ui/components/forms/button/button.class.js';

   // Browser registration: use the stable tag-shaped route.
   import '@aceshooting/lyra-ui/components/lr-button.js';
   ```

   Keep utility and shared type imports from the curated package root where documented. Replace an
   obsolete nested registration path with `components/lr-<tag>.js`; use `all.js` only when the page
   intentionally needs the complete browser registration set. Do not replace class imports with
   registration side effects when code needs a constructor, or vice versa. The [imports guide](./imports-and-registration.md)
   lists the route shapes and [events and types guide](./events-and-types.md) explains component and
   framework type paths.
5. **Split old combined SSR loading by environment.** `ssr-loader.js` is removed because it
   combined browser hydration support and all registrations. In a hydrating browser, import
   `@aceshooting/lyra-ui/hydration.js` before any module that can import Lit, then import the chosen
   `components/lr-<tag>.js` registrations (or `all.js`). On the server, use
   `@aceshooting/lyra-ui/ssr.js` for renderer helpers and diagnostics; import
   `@aceshooting/lyra-ui/ssr/all.js` only when the server should register every tag. There is no
   `server.js` replacement. Follow the [SSR guide](./frameworks-and-ssr.md#ssr-and-declarative-shadow-dom)
   for renderer order, hydration diagnostics and per-tag SSR behavior.
6. **Move theme code to the independent style axes.** The old `setLyraTheme()` / `getLyraTheme()`
   facade, preset exports and fixed Shadcn stylesheet are removed. Use `setLyraStyle()`,
   `getLyraStyle()` and `resetLyraStyle()` from `@aceshooting/lyra-ui/theme.js`. Select a look,
   surface treatment, density, color mode and accent as independent choices. Import
   `@aceshooting/lyra-ui/theme.css`; for Shadcn also import
   `@aceshooting/lyra-ui/looks/shadcn.css` and select `look: 'shadcn'`.

   Review the values, not just the property names. The old `surface` color maps to the new
   `accentBackground`; the new `surface` is the `solid` or `glass` treatment. Old `auto` mode maps
   to `system`. Convert a token map into a registered custom `LyraLook` when it defines a reusable
   complete visual identity, or into explicit `overrides` when it adjusts selected tokens. Replace
   `data-lr-theme-preset` selectors with the specific `data-lr-look`, `data-lr-surface`,
   `data-lr-density`, `data-lr-mode` or `data-lr-accent` axis they style. A color string that happens
   to match a gemstone name remains a color; choose the explicit named accent only when that is what
   the application means. Listen for `lr-style-change` and read `event.detail.style` and
   `event.detail.changed`. Existing version-1 saved preference records remain readable, but callers
   must move writes to the v24 style API. See [styles and tokens](./styles-and-tokens.md#composing-looks-surfaces-and-density)
   for scope, persistence and look registration examples.
7. **Migrate the event-detail compatibility fields by behavior.** The 44 metadata-backed v24
   member records (27 events, 15 properties and 2 attributes) are a separate cohort from these ten
   deprecated detail-field declarations. These field changes are not automatic CLI rewrites. In
   the v24 target, read canonical `expanded` instead: for old `open`, use `expanded` unchanged; for
   old `collapsed`, use `!expanded`. Keep veto/request and committed-notification timing intact.
   The host properties `open` and `collapsed` are separate APIs and are not affected by listener
   detail migration. `ThreadGroupToggleDetail.expanded` remains optional in its declaration even
   though the current runtime supplies it, so consumer typing should continue to account for
   `undefined`. Review each event listener explicitly rather than applying a broad property rename
   or event payload rewrite:

   | Detail field declaration | Component tag and event name(s) | Relationship to `expanded` |
   | --- | --- | --- |
   | `LyraDetailsToggleDetail.open` | `lr-details` / `lr-toggle` | Same |
   | `LyraMultiSplitToggleDetail.open` | `lr-multi-split` / `lr-toggle-request`, `lr-toggle` | Same |
   | `LyraNavigationMenuToggleDetail.open` | `lr-navigation-menu-item` / `lr-toggle` | Same |
   | `LyraDockPanelCollapseChangeDetail.collapsed` | `lr-dock-panel` / `lr-collapse-request`, `lr-collapse-change` | Inverse |
   | `LyraAppRailItemToggleDetail.open` | `lr-app-rail-item` / `lr-toggle-request`, `lr-toggle` | Same |
   | `LyraAppRailToggleDetail.open` | `lr-app-rail` / `lr-toggle-request`, `lr-toggle` | Same |
   | `LyraAppRailGroupToggleDetail.open` | `lr-app-rail-group` / `lr-toggle-request`, `lr-toggle` | Same |
   | `ThreadGroupToggleDetail.collapsed` | `lr-thread-list` / `lr-group-toggle-request`, `lr-group-toggle` | Inverse; `expanded?: boolean` stays optional |
   | `ChatMessageToggleDetail.collapsed` | `lr-chat-message` / `lr-toggle-request`, `lr-toggle` | Inverse |
   | `LyraCodeBlockToggleDetail.collapsed` | `lr-code-block` and `lr-code-block-core` / `lr-toggle-request`, `lr-toggle` | Inverse |

   The table describes old detail reads and their canonical replacement. The event names themselves
   remain; the compatibility detail fields are not host properties or deprecated event names. Test
   the listener against the v24 `expanded` detail and preserve its old behavior, including inverse
   handling for `collapsed` and veto/request semantics.
8. **Retire only application-owned dead compatibility work.** After the replacement behavior is
   exercised, remove project-local shims that existed solely for the retired import, theme or event
   surface; duplicated CSS declarations now provided by the selected look; obsolete preset
   attributes/stylesheets; and dependencies used only by those wrappers. Search for old imports,
   selectors, storage writers, event-detail fields and wrapper exports, then review each result in
   context. Preserve unrelated application logic and domain behavior. Keep a wrapper if it still has
   independent responsibilities.
9. **Verify the migrated application.** Run the project's typecheck and tests after importing the
   generated `LyraComponentTypeMap` from `@aceshooting/lyra-ui/framework-types` where applicable.
   Keep the React/Vue/Svelte declaration entry opt-in, and ensure registration imports are still
   present because framework type declarations do not register elements. Recheck locale
   registration and translated content, `dir="rtl"` behavior, light/dark/system mode, look and
   surface scopes, forms and keyboard operation, SSR markup and hydration, and any persisted
   preferences used by the app. Review CSS selectors and screenshots for obsolete aliases, then
   inspect the complete source and lockfile diff. Update behavior-specific tests, not just import
   snapshots.

The 44 v24 member removals and all held upstream spellings are described by the generated
per-component migration reference and metadata. Eight names remain protected for upstream parity;
keep them when migrating and do not remove them by global search-and-replace. V24 builds on the 399
v23 compatibility removals; it does not restore those older spellings. The `lyra-v21` and
`lyra-v22` profiles remain distinct historical upgrade paths, not a single new cross-major rewrite.
For current import, style, SSR, locale and framework contracts, follow the focused guides linked
above.
