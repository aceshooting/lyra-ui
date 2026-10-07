# v21 and v22 foundations

Historical delivery scope and acceptance criteria retained from the main [roadmap](../roadmap.md). The current v24 release contract remains there.

## v22 commitments

v22.0.0 is published and provides the baseline for v23/v24 consolidation: usable replacements,
deprecation notices, migration coverage and stable extension points. V24 is the completion checkpoint
for this program. Confirm the exact npm package version from the registry before upgrading, since a
workflow result alone does not establish publication. Any API intended for removal in v24 must have
entered its published deprecation window by v22; later-only editors and application upgrades
remain in their assigned releases. The v22
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

The v22 foundations below shipped in v22.0.0. The v23 look, design-editor and localization work is
described in the release sections and completion matrix below; release status is determined by the
published package and its release evidence. These acceptance criteria remain applicable to later
changes.

### Rename and removal policy

Renames of Lyra-only names ship additively in 21.x minor releases: the new canonical name plus a
deprecated alias that keeps working, with a `--origin=lyra-v21` profile in the migration script that
rewrites attributes, properties, events and `::part()` selectors. The unchanged one-full-major
deprecation rule permits removal of those 21.x aliases in v23. A rename introduced in 22.x must
remain through v23 and can be removed no earlier than v24, through a later `lyra-v22` profile.
A rename onto a name another component already uses widens existing code and therefore lands in
v22. Event-detail shape changes cannot be aliased: they also land in v22, and the migration script
reports affected listeners. Names mirrored from Web Awesome or Shoelace, and their defaults, never
change. See [RFC 0003](../rfcs/0003-lyra-v21-migration-profile.md).

### Themes and styling

1. Implement [RFC 0001](../rfcs/0001-independent-style-axes.md): look, surface (glass), density, mode
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
6. The preset gallery shipped in v22. The v23 delivery adds the optional documentation-site theme
   builder, with advanced design controls, import/export, diagnostics and reset flows. Its browser
   integration and release evidence are tracked in the completion matrix.
7. The v23 delivery adds dense data (Carbon-inspired), terminal/monospace and high-contrast looks,
   bringing the built-in set to six. An enterprise look informed by Fluent remains demand-led.
8. Validated categorical, sequential and diverging chart-palette foundations shipped in v22. The
   v23 delivery adds the palette builder and visual diagnostics.

#### Six design-option foundations required before v22 publication

All six foundations below shipped in the initial v22 release, with usable public inputs or presets,
scoped examples, API documentation and generated package surfaces. Their advanced editors are part
of the v23 delivery. Defaults preserve existing behavior. The
[completion matrix](../roadmap.md#design-completion-through-v24) assigns final consolidation and qualification.

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
describe the published foundation; the v23 rows describe delivered features, subject to the exact
published package and its release evidence. V24 consolidation and qualification remain pending.
Library README, API and migration documentation required by a release must be complete before that
release is published. The website and application refresh follows v24 publication.

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
    fixes for numeric regions and missing languages. The v23 delivery completes regional-catalog
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

30. Implement [RFC 0002](../rfcs/0002-tokens-once-per-document.md): declare design tokens once per
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
    as eligible aliases are removed. The unpacked required-artifact exception remains explicit in
    the package budget; compressed downloads have a separate strict ceiling below 10 MB decimal.
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
