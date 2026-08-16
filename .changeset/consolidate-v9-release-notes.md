---
"@aceshooting/lyra-ui": major
---

This major version finalizes lyra-ui's 9.0 public-contract cleanup: it closes the deprecation and
rename windows opened in 8.0.0, aligns the shared vocabulary with Web Awesome and Shoelace, and adds
cross-component security, accessibility, internationalization, theming, and performance work. The
generated migration reference (`llms/migration.md`) records the exact replacement for every renamed
or removed member; sections below group every change by what it means for a consumer evaluating this
upgrade.

### Breaking changes

- make `lr-button` submit/reset behavior a true post-click default action, so
  `click.preventDefault()` vetoes it while propagation control alone does not.
- `lr-tool-call-chip` / `lr-message-parts`: `lr-tool-chip-select` → `lr-tool-call-chip-select`
  (identical detail). `lr-tool-timeline` bound both, so a host listener fired **twice** per click;
  it now fires once.
- `lr-flow-canvas`: `--lr-flow-canvas-node-current-outline-color` →
  `--lr-flow-canvas-node-selected-outline-color`
- `lr-usage-badge`: `compact` → `abbreviate`. It selected `Intl` compact *notation* while 20 other
  components use `compact` for visual density.
- `lr-chart` (and every typed subclass): `horizontal` → `index-axis="y"`
- `lr-rag-answer`, `lr-retrieval-results`: `error` → `errorText` / `error-text`
- `lr-document-preview`: `errorMessage` → `errorText` / `error-text`
- `lr-ingestion-queue`, `lr-activity-feed`: `virtualizeThreshold` → `virtualizeAt`, and the bound is
  now exclusive to match the other four components — `virtualize-threshold="N"` becomes
  `virtualize-at="N-1"` for an identical switchover point.
- `lr-knowledge-base`: `lr-kb-create`/`-sync`/`-pause`/`-delete` → `lr-source-*` (identical details;
  hosts listening on `lr-knowledge-base-admin` are unaffected).
- `lr-data-grid`: option fields `columns` → `columnIds`, `filename` → `fileName` (upstream's own
  spellings — this moves *toward* the mirror).
- `lr-test-results`: legacy `detail-{suiteId}-{testId}` and `detail-{testId}` slots → the canonical
  `testResultDetailSlotName(suiteId, testId)`.
- `lr-confirm-bar`: `compact` is density only; use `compact frame="plain"` for the old flat
  presentation. `--lr-confirm-bar-compact-{border,background,radius}` removed.
- `lr-accordion`: direct `<lr-details>` children are no longer coordinated — use
  `<lr-accordion-item>` (which still accepts `summary`/`open`/`show()`/`hide()`).
- `lr-ebook-viewer`: `accessibleLabel` is private (the property never had any effect; set the
  `aria-label` attribute), and the permanently-empty `announcer` part is gone.
- `lr-sequence-strip`: `orientation` removed — a single-member union that nothing read or styled.
- `lr-split-panel`: `SplitPanelSnapFunctionOptions` / `SplitPanelSnapFunctionParams` removed; both
  aliased `SnapFunctionParams`.
- Compatibility type aliases `ActivityEntryTone`, `ConfirmBarTone`, and `ChipTone` removed; use
  `LyraVariant`, `ConfirmBarVariant`, and `ChipVariant` respectively. The corresponding public
  properties already use `variant`, so these aliases duplicated the canonical type vocabulary.
- Ten orphaned localization keys removed — they shipped translated into all ten locales while no
  component rendered them: `trendIncreased`/`trendDecreased`/`trendGoodSuffix`/`trendBadSuffix` (use
  `statTrend*`), `subagentPanelCancel` (use `subagentPanelCancelRun`), plus
  `contactViewerOrganizationLabel`, `evaluationDashboardMetricLabel`, `heatmapCellSelectedSuffix`,
  `liteChartMarkPosition`, `spanTokens`. A generator gate now fails on any future orphan.
- `srOnly` now hides via `clip-path: inset(50%)` instead of the deprecated `clip: rect(0 0 0 0)`. If
  you reveal an `.sr-only` element on focus, replace `clip: auto` with `clip-path: none`. Note
  `clip-path` establishes a containing block for absolutely-positioned descendants.
- **Migration coverage improves measurably**: `warning-required` mappings drop from 13 to 9,
  `exact` rises 54 → 56 and `rewritten` 78 → 80. `<wa-button>`, `<sl-button>`, `<wa-breadcrumb-item>`
  and `<sl-breadcrumb-item>` now migrate mechanically — previously the codemod refused *every* one of
  them, including buttons with no `href` at all, because the warning is emitted per tag rather than
  per member.
- complete the v9 identity migrations from `lr-split`, `lr-query-builder`, `lr-playback`,
  `lr-generation-status`, and `lr-flow-run-overlay` to `lr-multi-split`,
  `lr-condition-builder`, `lr-sequence-playback`, `lr-generation-metrics`, and
  `lr-flow-run-status`, including their class, type, event, CSS-hook, storage-key, registration,
  and framework surfaces; the pre-v9 `lr-geojson-view` tag remains the documented compatibility
  alias for canonical `lr-geojson-viewer`;
- replace ambiguous generic public type aliases with the curated `Lyra*` vocabulary and remove
  superseded root and granular aliases; the generated migration reference records each exact
  replacement and every surface that now requires manual review;
- use `CustomEvent<null>` for no-payload library events, frozen named detail objects for scalar
  state, and cancelable before/invalid events only where vetoing changes the originating action;
- unify model and voice catalogs on readonly `LyraCatalog<T>` and move their shared filtering,
  popup, selection, form, and native-event behavior into one catalog-picker contract;
- treat omitted localized labels as the only request for a default string: an explicit empty
  string or the former English default is now caller-owned data and is never silently translated.
- make public collection inputs and collection-bearing event details bounded readonly snapshots,
  with clone/freeze admission for structured records and copy-on-write updates instead of retained
  mutable aliases;
- require stable, non-empty domain identifiers across collection-driven components, use
  deterministic first-valid-wins duplicate handling, and carry those identifiers through state,
  persistence, and event details rather than relying on array position or display text;

### Security

- strip authored inline CSS from sanitized Markdown while preserving only strict Shiki palette
  colors, and paint-contain the explicit unsanitized escape hatch;
- reject excessive ZIP entry and declared-expansion metadata before `lr-archive-viewer` asks JSZip
  to materialize its entry graph.
- isolate fetched `lr-svg-viewer` content from author styles, SVG animation, and external resource
  references while retaining local paint servers.
- reject XML document type declarations before browser entity expansion and preserve mixed XML
  child-node source order in `lr-xml-viewer`.
- place `lr-mcp-app`'s inline CSP before every app-controlled token so head decoys cannot bypass it.
- bound streamed ANSI CSI/OSC carry and recover `lr-terminal` after overlong unterminated sequences.
- namespace `lr-thread-list` group and thread identities independently so unrestricted raw thread
  ids cannot steal active ownership from or collide with virtual group headers.
- scope `lr-widget-renderer` warning dedupe to the current root/registry generation so streamed
  attacker-controlled type and prop names cannot accumulate for the instance lifetime.
- reject malformed reachable `lr-widget-renderer` nodes before dereference, clear stale content,
  and report exactly one render error instead of throwing from a streamed update.
- fail closed on duplicate `lr-tree` data ids so one public identity cannot own multiple focus,
  selection, expansion, or reorder targets.
- widen the CSV formula-injection guard to fullwidth sigils and leading whitespace, and share one
  definition between `lr-data-grid` and the export helper instead of two drifted copies;
- drop an `lr-mcp-app` tool result whose originating frame has been replaced, via an additive
  `frameGeneration` correlation on the event detail and an optional `postToolResult()` argument;
- reject or truncate hostile oversized string, tree, registry, schema, and traversal inputs at
  documented ceilings while keeping valid siblings usable and async generation ownership intact.

### Accessibility

- preserve keyboard focus when retrieval paths, chips, and source collections change;
- preserve `lr-emoji-picker` option focus by identity or nearest survivor when controlled groups
  reorder or shrink, without stealing search or external focus, and materialize off-window roving
  targets before transferring focus;
- move `lr-time-input` focus to a surviving segment when a controlled pattern change removes the
  focused segment, without reclaiming focus from another control;
- restore `lr-export-button` to sequential keyboard navigation after loading or disablement ends;
- report and announce `lr-diff-view` clipboard failures without falsely confirming stale or failed writes;
- fully suppress the visible `lr-toast-item` progress animation under reduced motion;
- reconcile and announce retained `lr-xml-viewer` search state after XML reloads.
- preserve `lr-code-block` and `lr-code-block-core` roving focus when controlled code shrinks.
- keep disabled, hidden, and inert custom controls out of `lr-message-actions` roving navigation.
- skip unavailable `lr-thread-list` rows locally and across virtual-window keyboard boundaries.
- preserve `lr-prompt-queue` focus when a controlled removal is accepted.
- enforce `lr-push-to-talk`'s hit floor and keep custom trigger glyphs decorative.
- preserve `lr-sequence-strip` and `lr-heatmap` roving focus through controlled refreshes, and honor the strip's host name.
- preserve `lr-graph-query-builder` focus when filter chips or saved queries are removed.
- transfer `lr-realtime-session` focus when its public capture surface is hidden.
- preserve `lr-selection-toolbar` focus when its controlled action set changes.
- keep `lr-stat` slotted controls outside its whole-card link and forward its host accessible name.
- normalize `lr-combobox`'s active descendant after local or async option-set changes.
- preserve `lr-table` row and header focus when controlled collections shrink or reorder.
- retain a non-color visual state and part hook for hidden chart legend series.
- honor host `aria-label` presence on `lr-filter-bar`, including an explicitly empty value, before
  falling back to the component's `label` property.
- preserve host `aria-label` precedence by attribute presence, including explicitly empty values,
  across archive, calendar, contact, CSV, dataset, comparison, document, and DOCX viewers and the
  nested dialog path used by `lr-document-viewer`.
- preserve `lr-select`'s keyboard-active option by identity across live reorders and rehome
  removed or disabled active rows to the nearest navigable survivor.
- make `lr-thread-list` Home/End navigation resolve the complete virtual model, skipping group
  records and unavailable endpoint rows instead of stopping at the mounted window.
- remove disabled `lr-token-input` edit triggers from focus, expose their disabled state, retire
  internal focus, and suppress enabled hover feedback until the control is re-enabled.
- retain the shared icon-button hit-area floor for every emoji-picker option while compact size
  tiers continue to scale the glyph independently.
- retain the shared 40px compact-target floor for circle/icon-only buttons and label-less
  checkboxes across every size tier while keeping their visible glyph and box tier-sized.
- integrate combobox listboxes with the shared nonmodal overlay stack so z-order, Escape,
  outside-pointer dismissal, and focus handoff remain topmost-only beside color-picker popups.
- announce `lr-tree` reorder success only after the host-owned sibling order confirms the exact
  request, keeping ignored or rejected requests silent.
- realign canceled `lr-carousel` mouse drags instantly under reduced motion while preserving
  smooth full-motion recovery, including the pointer-capture-loss path.
- cancel stale `lr-sequence-strip` arrow/Home/End focus continuations across controlled item
  replacement and disconnect/reconnect instead of focusing a new model by an old numeric index.
- give custom `lr-page` navigation toggles a resolvable host bridge for their private drawer and
  restore only component-owned ARIA across replacement, removal, and reconnect.
- rehome `lr-locale-picker`'s active option when a live locale catalog shrinks, keeping
  `aria-activedescendant` and the next keyboard command valid.
- make `lr-time-input.focus()` honor direct and fieldset disablement, matching its click and tab-stop
  contract without emitting synthetic host focus events.
- preserve `lr-av-player`'s named region when an unsafe media source renders its error branch.
- announce `lr-flow-minimap` viewport changes for map clicks, wheel zoom, keyboard commands, and
  completed drags while keeping canceled drags silent.
- make `lr-token-input.focus()` synchronously honor direct and fieldset-cascaded disablement before
  the internal draft input has re-rendered disabled.
- preserve `lr-swatch-picker` keyboard focus across live palette reorders and focused-option
  removal without changing its controlled value or emitting a user-change event.
- isolate all seven `lr-video` icon slots in inert decorative sibling layers so accidentally
  interactive glyph markup cannot nest actions or add keyboard stops.
- `lr-xml-viewer` search now scrolls the active match into view, honoring reduced motion.
- `lr-breadcrumb.accessibleLabel` is consumed instead of ignored.
- move `lr-transcript-feed` announcements out of its shadow `role="log"` and onto the shared
  light-DOM polite sink, leaving the shadow region non-live;
- give `lr-thinking-panel`'s always-tabbable scroll region a real focus ring and a distinct hover
  preview, matching `lr-code-block` and `lr-virtual-list`;
- draw `lr-mind-map`'s focus ring as soon as the widget takes focus, rather than only after the
  first arrow key;
- hand `lr-confirm-bar` focus to its status region when a host defers the decision, instead of
  dropping it to `<body>` while the just-activated button becomes `disabled`;
- name an icon-only toggleable `lr-chip`'s real control, and give `lr-phone-input` an accessible-name
  fallback;
- carry a persistent region landmark on `lr-dataset-viewer` in every fetch state;
- announce timeline and step position on `lr-video` and `lr-sequence-playback` through localized
  `aria-valuetext`;
- floor the `lr-flow-minimap` viewport rect and `lr-data-grid` hit targets to a real pointer size.
- give `lr-box-plot` and `lr-lite-chart` the chart family's forced-colors series encodings;

### New capabilities

- add standard error text, rich error-slot chrome, and handle descriptions to `lr-slider`;
- add standard error text, rich error-slot chrome, SSR presence hints, and semantic descriptions
  to `lr-file-input`;
- export public component property and configuration types from the registration-free package root;
- complete `lr-voice-picker`'s standard form-control frame and slotted-label contract.
- add owned error chrome and the standard form-control frame to `lr-checkbox`.
- accept canonical `start`/`end` adornment slots on `lr-chat-composer` while retaining legacy aliases.
- accept canonical `start`/`end` adornment slots on `lr-radio-button` while retaining Shoelace
  `prefix`/`suffix` aliases.
- accept canonical `start` adornment content on `lr-conversation-item` while retaining `leading`.
- complete `lr-model-select`'s standard slotted-label and `form-control` frame contract.
- expose the shared configurable Markdown parser and public refresh method on `lr-markdown-core`.
- relay `lr-data-grid` search and filter focus transitions through its host as native events.
- expose `lr-model-select`'s free-text input, selection, and range-editing facade.
- separate chart legend, data-table, and reset-zoom hover/pressed theme hooks.
- expose `lr-lite-chart`'s selected-mark outline width alongside its color.
- let `lr-calendar` themes independently inherit selected, outside-month, and today paint hooks.
- keep every `lr-flow-canvas` edge tone and its referenced arrowhead independently themeable.
- expose peer-neutral Markdown, message-feedback, and model-select types from the registration-free
  package root and the relevant granular Markdown entries.
- forward semantic `lr-filter-bar` control parts so consumers can theme its composed select,
  combobox, text, and date fields through the bar's shadow boundary.
- expose independently inheritable progress, action, current-page, hover, and pressed color hooks
  for `lr-flow-node`, `lr-graph-query-builder`, and `lr-pagination`, preserving the existing palette
  as exact fallbacks.
- split `lr-pagination` summary, control-group, and numbered-page spacing into independent
  inheritable layout hooks that retain the existing spacing defaults.
- let `lr-message-feedback` hosts hold a submission for async persistence, then explicitly finalize
  or revert it without premature success UI.
- let `lr-table`, `lr-timeline-item`, and `lr-word-cloud` inherit their public theme hooks from
  ancestor theme wrappers while preserving direct-host precedence and existing defaults.
- expose independent `lr-stat` emphasis edge/value hooks and checked/indeterminate `lr-tree-item`
  checkbox border, background, and glyph hooks without changing their semantic-token fallbacks.
- expose `lr-otp-input` compact-string selection and range-editing APIs, with sanitized silent
  replacements kept synchronized across visual cells, form value, and validity.
- define `lr-realtime-session.errorCode` as host-readable diagnostic metadata while retaining one
  safe localized generic failure for all provider codes.
- publish normalized effective zoom bounds in flow-canvas companion snapshots and use them for
  `lr-flow-controls` button availability.
- add the canonical `start` leading-icon slot to `lr-stat`, with the shipped unnamed slot retained
  as its deterministic fallback.
- add the purpose-named `marker-icon` slot to `lr-timeline-item`, retaining `icon` as its
  deterministic fallback.
- keep form-control theme inputs inheritable through ancestor wrappers across size, appearance,
  and pill fallbacks for emoji picker, icon button, input subclasses, locale picker, OTP input,
  and phone input.
- expose inheritable component-scoped gap and radius hooks for segmented time input, preserving
  shared size and pill tokens as fallbacks.
- expose independent, inheritable state-paint hooks for input actions/focus, segmented-time
  surfaces and options, locale selection weight, and OTP active/invalid segments.
- expose independent component-scoped state paint for checkbox/group/editor invalid and
  interaction states, color-picker selection, option current/selection, and the full date-picker
  title/navigation/day/range/selection-view state family.
- add the shared reflected size ladder to `lr-voice-picker` in both picker modes while retaining
  the preview action's compact hit-area floor.
- expose independent component-scoped hover and pressed paint hooks for `lr-time-range` presets
  and handles and for `lr-token-input` edit/remove actions, preserving the prior shared-token and
  aggregate-action hooks as backwards-compatible fallbacks.
- expose independent component-scoped hover, pressed, checked, open, action, thumb, and field paint
  hooks across radio, radio-button, rubric-form, select, slider, switch, and textarea while
  preserving their existing shared-token fallbacks.
- expose instance-scoped content and row gap hooks for radio-button chrome, slider, and switch,
  preserving the shared spacing tokens as defaults.
- expose independently inheritable appearance, hover, and pressed paint hooks for app rail,
  app-rail item, breadcrumb item, card, and carousel states without changing their existing defaults.
- expose independently inheritable appearance, border, hover, and pressed paint hooks across
  details, accordion, and accordion-item while retaining every existing shared-token fallback.
- expose inheritable `lr-details` summary gap and surface radius hooks independently of its shared
  density ladder, preserving the existing spacing and radius tokens as defaults.
- expose `lr-token-input`'s native draft selection and event-silent range-editing facade, keeping
  programmatic range edits synchronized with the next token commit.
- expose every composed push-to-talk event through `lr-realtime-session`'s TypeScript, CEM,
  framework, Storybook, and authored-reference contracts without re-emitting the runtime events.
- add optional peer-neutral literal icons to `lr-suggestion-chips`, rendered through a stable
  decorative part while the chip button retains focus and selection ownership.
- accept Web Awesome's exact `currentSlide` carousel markup spelling after HTML normalization,
  retaining `current-slide` as the reflected canonical attribute and initial-conflict winner.
- New `bridgeLyraLocale()` and `subscribeLyraLocale` (`@aceshooting/lyra-ui/utilities/localization.js`)
  mirror the active locale onto a host element's `lang`/`dir` and re-render non-`LyraElement` hosts on
  locale change.
- `lr-combobox` exposes `part="group-label"`, matching `lr-select`.
- `lr-stack-trace` gains `compact`; `lr-confirm-bar` gains `frame`.
- `rel` is now settable on `lr-button` and `lr-breadcrumb-item`. Both mirror upstream's `rel`, so
  `nofollow`, `me`, `license` and `external` survive a `wa-`/`sl-` → `lr-` rename instead of being
  silently dropped. The security guarantee is unchanged and not removable: `opener` is always
  stripped, and `noopener noreferrer` is force-added whenever `target` is set. A same-tab link (no
  `target`) renders the author's tokens verbatim, because it opens no new browsing context.
  `lr-breadcrumb-item` defaults to `'noreferrer noopener'`, matching both upstreams; `lr-button` keeps
  no default, matching `wa-button` — defaulting it would start suppressing the `Referer` header on
  every same-tab link.
- `lr-terminal` gains `compact` and `frame`, matching its agent-tools siblings;
- `lr-swatch-picker` gains `disabled`; `lr-context-meter` gains `showLegend` and legend parts;
- `lr-node-palette` gains `reorderable`; `lr-retrieval-results` gains custom grouping;
- `lr-knowledge-graph-explorer` gains a presettable `searchQuery`;
- `lr-xml-viewer` gains host-supplied highlights and attribute-path precision;
- `lr-box-plot` gains per-box keyboard and pointer interactivity;
- `lr-time-range` gains click-to-seek; `lr-filter-bar` options accept an icon;
- `lr-document-viewer` gains an immutable discriminated renderer payload and typed registry
  adapters, letting the AV renderer receive bounded cues/tracks and advertise search only when its
  retained transcript is searchable without widening legacy `DocumentFile` callbacks;
- host `focus()`/`blur()`/`click()` forwarding and re-emitted focus/blur on `lr-av-player`,
  `lr-pan-zoom`, `lr-video`, `lr-video-playlist`, and `lr-zoomable-frame`.
- export the chart, graph, map, and geojson classes from the registration-free package root.
- Expose `lr-provenance-panel`'s entity-chip row as the `entity-row` CSS part and make its line
  packing themeable through `--lr-provenance-panel-entity-justify` (default `flex-start`, so nothing
  changes when unset). The row wraps N entity chips but carried only a class, and it fills
  `::part(body)`'s inline size, so justifying the body could not move the wrapped lines — the same
  unreachable-packing gap fixed for `lr-suggestion-chips` in this release.
- Expose `lr-suggestion-chips`' chip row as the `row` CSS part and make its line packing themeable
  through `--lr-suggestion-chips-justify` (default `flex-start`, so nothing changes when unset).
  Centering the chips under centered empty-state text previously had no reachable hook: the row is
  rendered in both the wrapping and the scrolling layout, carried only a class, and styling
  `::part(base)` as a centered flex container centered the chips only while they fit a single line —
  once they wrapped, the row filled the inline size and every line, the short final one included,
  packed to the start edge.
- Add theming, accessibility, responsive-layout, and controlled-interaction improvements across the
  component library, including new component CSS hooks, prompt-input aliases, model option icons, and
  cancelable pre-commit layout events.

### Fixes

- notify every same-variant Markdown instance when a shared in-flight KaTeX load settles, without
  duplicating completion work across repeated renders;
- preserve retrieval evidence locators through `lr-retrieval-trace`;
- honor slot-only answer and source content in `lr-rag-answer`;
- normalize invalid `lr-knowledge-base-admin` tab state to its Sources fallback;
- remove unintended nested card chrome from generated RAG sources and evaluation metrics;
- isolate registered renderer dialog events so inner dialogs cannot close `lr-document-viewer`;
- surface nonfatal `lr-dataset-viewer` parser diagnostics while preserving recoverable rows;
- restore `lr-tool-param-form`'s cloned initial value and pristine interaction state on native form reset.
- validate every `lr-box-plot` canvas theme color and fall back from invalid CSS expressions.
- materialize `lr-audio-visualizer` canvas colors, including `currentColor`, in the live theme scope.
- preserve author-supplied `lr-tree-item` names across data-model refreshes.
- preserve nested `lr-evaluation-run` approval dialogs when a host vetoes the correlated decision event.
- keep `lr-markdown-core` leading-tab parsing and `tab-size` behavior aligned with `lr-markdown`.
- honor documented `lr-data-grid` copy/export/scroll option interfaces, including an explicit copy
  delimiter overriding the format default.
- theme `lr-data-grid`'s search placeholder through the shared quiet-text token.
- align `lr-code-block-core`'s reflected `copyable` states with the full code block.
- export a total `lr-test-results` detail-slot-name helper for malformed UTF-16 ids.
- stop `lr-flow-canvas`'s numeric grid fallback from shadowing its public theme hook.
- wrap `lr-flow-canvas` corner companions so controls and minimaps do not overlap at 320px.
- keep obsolete `lr-code-block-core` language-map loads from clearing the current loading state.
- share full/core Markdown parsing, fallback, anchor, highlight, and rendering behavior while
  retaining their intentionally distinct Shiki grammar loaders.
- keep the contained menu's standalone `lr-menu-select` alias inside `lr-dropdown`, leaving one
  documented cancelable `lr-select` event for direct, nested, and consumer-supplied menu shapes.
- contain composed controls' `lr-input`/`lr-change` aliases inside `lr-filter-bar` while preserving
  one bar-owned full-value `lr-input` and the controls' native-style event path.
- enforce `lr-dropdown[disabled]` as an opening invariant for initial markup, pre-upgrade property
  replay, and later imperative opening, independent of assignment order.
- contain 200- and 500-item `lr-sequence-strip` datasets at 320px through a documented dense-collapse
  policy while preserving every semantic cell, tooltip, and roving keyboard stop.
- keep `lr-push-to-talk` timer, level sampling, and maximum-duration deadline synchronized with
  option changes during an active recording.
- prevent a shared Markdown dependency settlement from parsing twice when `lr-markdown` or
  `lr-markdown-core` reconnects before its promise callback runs.
- keep `lr-document-library` search, tag-filter, and checkbox implementation events inside the
  component while emitting one documented filter or selection event per interaction.
- roll back `lr-data-grid` pointer resize state on cancellation or lost capture without emitting a
  committed resize; retain pointerup as the commit path.
- make a live `lr-flow-canvas[locked]` transition cancel and roll back active gestures, retire
  global pointer listeners, and block imperative viewport mutation.
- retire `lr-flow-canvas` node-drag and connect gestures when the controlled node model is
  replaced so stale ids cannot move or connect after refresh.
- keep `lr-flow-minimap` click-to-center available after a canceled viewport drag while consuming
  only the browser-synthesized click after a completed drag.
- constrain emoji-grid and segmented-time-picker scrollports to their intended block axis under
  undersized allocations, without introducing phantom horizontal scrollbars.
- reconcile action-bearing input, number, segmented-time, and phone rows on one shared rendered
  size ladder while preserving compact plain-field tiers.
- keep `lr-tree-item` constructible when optional `ElementInternals` custom-state support is
  absent or only partially implemented.
- restore `lr-graph-query-builder`'s normalized initial query on form reset instead of always
  erasing it, while retaining pristine-state cleanup and native custom-validity persistence.
- normalize non-finite `lr-query-builder` number conditions at controlled-model, late-field, and
  user-input boundaries so blank number controls cannot retain JSON-null-producing infinities.
- strictly round-trip-validate `lr-filter-bar` ISO date chips, preserving impossible values raw and
  retaining literal four-digit years below 0100 instead of JavaScript's 1900 remapping.
- make `lr-token-input` overflow ownership explicit: uncapped rows grow, while exact-height rows
  clip inline overflow and scroll in the block axis so wrapped tokens and actions remain reachable.
- make a vetoed `lr-combobox` close atomic, preserving its filter query, active option, async rows,
  reflected open state, and overlay ownership until a close is accepted.
- roll canceled or capture-lost `lr-color-picker` pointer previews back to their pre-gesture
  visible and submitted value without emitting a commit, while preserving authoritative consumer
  assignments.
- bind `lr-otp-input` auto-submit tasks to the exact completed code generation so a stale task
  cannot submit a later full value after replacement, reset, restoration, or reconnection.
- keep `lr-filter-bar`'s reset action on the same default `m` height tier as its adjacent built-in
  fields instead of hardcoding the shorter `s` tier.
- keep short resizable dashboard-grid cells at the shared interactive-action height floor so their
  absolute resize handles cannot overlap the preceding stacked cell or gap.
- commit a pending `lr-time-range` keyboard gesture exactly once when its handle loses focus before
  key release.
- invalidate active `lr-time-range` keyboard and pointer gestures on direct/fieldset disablement or
  form reset so later physical releases cannot commit stale values.
- co-tokenize `lr-date-picker`'s mirrored `date-picker` part and deprecated `base` alias on
  the same visible shell so either consumer selector reaches identical chrome.
- contain `lr-model-settings-panel`'s internal live slider event while preserving its mirrored
  temperature readout and consolidated committed-change contract.
- Nine form-associated components silently never published their validity custom states in
  environments without `ElementInternals`; their fallback lacked a `states` set.
- `lr-combobox.validators` and `lr-file-input.validators` type-checked and assigned but **never
  ran**. Both are now wired to the same contract `lr-date-input` uses.
- `lr-flow-node.nodeId` now reflects, so a JS property write is visible to `lr-flow-canvas`, which
  adopts children by attribute.
- `lr-spreadsheet-viewer.jumpToCell()` no longer reports a phantom `found: true` when nothing loaded.
- keep a cancelled `lr-animation` cancelled when the play state is later synced;
- report an honest failure when a concurrent `src` reassignment lands mid-anchor-resolution in the
  archive, CSV, and dataset viewers;
- guard `lr-code-block`'s async highlight continuations on `isConnected`;
- ignore a non-primary pointer button when starting an `lr-image-viewer` annotation.
- bound and cache text-quote indexing, search, DOM-range painting, and host highlight resolution;
  `lr-search-change` now includes `matchCountExact`, so capped or partially loaded viewers report
  a truthful lower bound instead of presenting it as a complete count;
- wire Shiki's dark palette through `lr-markdown` and `lr-markdown-core`;
- move documented per-component custom-property defaults to private fallback tokens and apply the
  public hook at each use site, so values inherited from an ancestor are no longer shadowed by a
  `:host` declaration.
- Forward `lr-tree-item`'s complete public CSS-part surface through recursively rendered data-model
  children. A single `::part()` selector on the outer item can now theme matching rows, labels,
  states, badges, checkboxes, and disclosure controls at every rendered depth.

### Performance

- cap explicit and page-derived `lr-table` skeleton row counts before allocating placeholder cells.
- forward text and reasoning part streaming state from `lr-message-parts` into its composed Markdown
  renderers so parse and highlighting work coalesces until completion.
- compute `lr-message-parts` citation ranks in one linear pass instead of rescanning every prefix.
- suspend full `lr-heatmap` canvas work while offscreen, coalesce hidden invalidations into one
  visibility-entry redraw, and repaint locale-derived canvas labels when locale changes.
- resolve `lr-terminal` highlight ownership and search-match state in one pass per render instead of
  rescanning per line;
- cache tree ordering in `lr-subagent-panel`, status counts in `lr-test-results`, the filter/categorize/roving chain in `lr-node-palette`, the dedupe/sort/group pipeline in
  `lr-retrieval-results`, the folded-quote transform in `lr-email-viewer`, and the text index in
  `lr-docx-viewer` (now binary-searched);
- coalesce `lr-scroller`'s `lr-scroll` to one emission per animation frame.

### Internationalization and RTL

- harden rendered safe-area coverage for every `lr-toast` placement in LTR and RTL;
- replace English `lr-test-results` status initials with language-neutral decorative marks.
- localize generated matrix and category counts in `lr-heatmap` and `lr-sequence-strip`.
- let `lr-select` triggers and overlaid tag rows shrink so long placeholders, selected labels, and
  multi-select chips remain inside constrained LTR and RTL rows.
- localize complete highlighted-cell names in CSV, dataset, and spreadsheet viewers with separate
  value and annotation placeholders, allowing each locale to control their order and punctuation.
- format compact `lr-rubric-form` score labels with the effective locale, matching its slider
  branch while preserving stable raw item and submission values.
- contain long RTL input adornments and segmented-time chrome, with exact-320px stories for input,
  number, segmented-time, and OTP action/fixed-cell compositions.
- contain button, checkbox, option, and date-input labels/adornments in narrow LTR and RTL rows
  while preserving fixed interactive and glyph geometry.
- contain standalone `lr-radio`, `lr-radio-button`, and `lr-slider` label, adornment, reference,
  and hint content within narrow LTR and RTL allocations without shrinking fixed controls.
- correct the `lr-heatmap` cell-text contract to describe its localized matrix/calendar templates
  and reserve `cellText` for application-specific wording rather than ordinary translation.
- contain unbroken consumer-authored dashboard-grid cell content within narrow LTR/RTL stacks while
  preserving explicitly child-owned horizontal scrollports.
- contain unbroken active-filter chip values within narrow LTR/RTL filter bars by zeroing nested
  flex minima while retaining the chip's own ellipsis and removal behavior.
- localize `lr-callout`'s complete labeled live-announcement template so locales can reorder its
  context/content fields and choose their own punctuation.
- `setLyraLocale()` was **inert on any page with `<html lang>`** — i.e. essentially every
  well-formed page — because the document element won the precedence walk. An explicit call now
  wins; element and ancestor `lang`/`locale` still override it, per a documented order.
- add `playbackStepPosition`, `phoneInputLabel`, and `emojiPickerLoadError`, translated into all ten
  shipped locale catalogs; `lr-phone-input` and `lr-emoji-picker` no longer borrow another
  component's message key;
- format `lr-grounding-summary` evidence offsets with the effective locale;
- fix an RTL double-mirror in `lr-chart`'s DOM legend placement by removing a redundant mirror
  rather than adding a third;
- stop re-mirroring MapLibre's physically-assigned popup anchors under `dir="rtl"`.
- `lr-data-grid` accepts `'start'`/`'end'` as spelling aliases for the existing RTL-relative
  `'left'`/`'right'` pin sides, and renders its pager glyphs as mirroring icons;

### Internal quality and coverage (informational)

- complete standalone theme inputs and semantic contrast coverage;
- publish every `lr-typing-indicator` geometry hook through CEM/editor metadata and gate its
  legacy public token namespace against future omissions;
- cover `lr-spinner`'s populated, forwarded visible-label accessibility state.
- make authored CSS-part references exact and complete, and correct `lr-model-select` accessible-name precedence prose.
- verify conversation placeholder theming, typing motion, and native search-decoration suppression
  through rendered browser behavior, including WebKit's still-clickable search cancel control.
- keep Web Test Runner failure payloads primitive-only and gate component tests against live DOM-node Chai assertions.
- verify `lr-agent-run` spinner motion through live full-motion and reduced-motion computed styles.
- verify `lr-prompt-studio` native option palettes through live light- and dark-theme computed styles.
- harden agent-tool motion, native-control, placeholder, and footer layout contracts with rendered checks.
- verify `lr-code-block-core` Shiki token palettes through rendered light and dark computed colors.
- clarify that `lr-prompt-input` submits its composite state through typed events, not native form data.
- cover every concrete typed chart controller in a shared 320px RTL long-content story fixture.
- cover `lr-calendar` in an exact 320px RTL fixture with long localized event content.
- keep lean code-block and Markdown bundles free of Shiki's full grammar table, enforced through
  peer-inclusive dependency-graph checks.
- correct the documented Markdown heading-outline return type and guard its keys against the
  exported `MarkdownHeadingItem` interface.
- enroll standalone theme inputs in the canonical design-token artifacts and keep stripped
  internal Shiki test seams out of published declarations.
- recognize constant-backed `exportparts` vocabularies in the manifest contract and document the
  chart subclasses' inherited hidden-legend and control-state theming surfaces.
- cover `lr-query-builder` at exactly 320px with long public and localized select labels in both
  LTR and RTL, guarding the composed `lr-select` min-content repair.
- add paired exact-320px LTR/RTL Storybook baselines for long stat, table priority/action, vertical
  and horizontal timeline, and word-cloud legend compositions.
- add exact-320px RTL Storybook and rendered baselines for checkbox-group wrapping and code-editor
  form-chrome/source-overflow ownership.
- correct transcript-feed documentation for plain `scrollToBottom()` behavior and conditional
  interim-area rendering, with a focused regression for follow-state preservation.
- align thread-list documentation with the shipped conditional `row-wrapper` part and clarify its
  nesting around built-in and custom row actions.
- document and verify a genuinely lean widget-renderer manual-definition route whose real bundle
  graph excludes the eager default registry and all eight default mapped classes.
- add exact-320px LTR/RTL long-content Storybook and rendered baselines for horizontal radio-button
  groups, switch labels/hints, and rubric fields/actions.
- add exact-320px RTL long-content Storybook and rendered baselines for app rail, breadcrumb,
  button-group, and carousel compositions, including open mobile chrome and populated controls.
- add exact-320px RTL long-summary, expanded-content, and action Storybook/rendered baselines for
  details and the composed accordion/accordion-item family.
- add an exact-320px RTL long-content Storybook/rendered baseline for expanded and collapsed
  `lr-dock-panel` layouts beside independently scrolling main content.
- correct the npm README and internal rationale for `lr-sequence-strip` to describe its named
  roving list/listitem inspection model instead of the retired aggregate-image model.
- publish `lr-flow-canvas` zoom controls as real prototype methods in CEM and remove them from
  generated framework assignable-prop unions.
- correct `lr-flow-canvas` running-edge documentation and metadata to use the time-only ambient
  duration token, with rendered coverage that distinguishes it from the transition shorthand.
- nest `lr-flow-controls` and `lr-flow-minimap` inside the canonical `lr-flow-canvas` example so
  their documented corner slots are actually assigned.
- remove `lr-stream-status` real-timer test races by installing stall listeners before connection
  or recovery can arm and fire their timers.
- verify `lr-streaming-text` cursor theming and reduced-motion behavior through live rendered
  geometry, animation, and opacity instead of stylesheet-source assertions.
- follow static, dynamic, side-effect, single-quoted, and double-quoted component imports when
  attributing optional peers, and document `lr-streaming-text`'s exact Markdown fallback matrix.
- eagerly wire the `lr-stream-status` LiveDemo so its first Connect click works, and invalidate a
  pending connection completion when the demo is stopped.
- replace source-only CSS assertions with rendered submit-color, listbox-overflow, and
  currentColor-glyph coverage for rubric form, select, and swatch picker.
- stop the default-string slice generator from treating an incidental string literal in a helper
  module as a reachable message key, which had been pulling unused messages into component bundles;
- forward a README mirror row's migration note into the generated migration disposition;
