# Lyra UI roadmap

## v22 commitments

v22 is the next major release. Beyond the switchable-styling work below, it commits to:

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
6. A preset gallery in v22 and the full theme builder in 22.x.
7. Further looks in 22.x: dense data (Carbon-inspired), terminal/monospace, and high-contrast; an
   enterprise look informed by Fluent later, guided by demand.
8. A validated categorical chart palette per look in v22; sequential and diverging palettes in 22.x.

### Languages

9. New catalogs, first tier: `es-419`, `vi`, `bn`, `th`, `ur`.
10. Second tier: `en-GB`, `el`, `sk`, `ms`, `fil`, `sw`, `bg`, `lt`, `lv`, `et`.
11. Third tier: `fr-CA`, `zh-HK`, `ca`, `ta`, `te`, `mr`, `sr` (Cyrillic and Latin), `ga`, `mt`.
12. Localization infrastructure: delta catalogs for regional variants, a lazy locale-loader API used by
    `lr-locale-picker`, per-script typography tokens (Thai, Urdu, Indic, CJK line breaking), native-digit
    display and parsing coverage, pinned CLDR plural categories, reviewer tiers with a native-speaker
    review channel, a generated locale manifest with coverage, pseudo-locale visual lanes, and flag-map
    fixes for numeric regions and missing languages.

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
31. A package root with no component classes; classes come from their own subpaths.
32. One registration import path per component.
33. Remove the `ssr-loader.js` compatibility entry.
34. Raise the supported Node floor to 22.
35. Raise the browser floor to the Popover API (Firefox 125, Safari 17).
36. Shrink the published tarball: stop shipping `llms-full.txt`, trim editor hover descriptions to a
    summary plus a documentation link, and ship only the current major's changelog section.
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
