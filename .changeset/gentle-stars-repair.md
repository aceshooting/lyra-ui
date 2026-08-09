---
'@aceshooting/lyra-ui': major
---

Improve component reliability and public contracts across the library:

- notify every same-variant Markdown instance when a shared in-flight KaTeX load settles, without
  duplicating completion work across repeated renders;
- strip authored inline CSS from sanitized Markdown while preserving only strict Shiki palette
  colors, and paint-contain the explicit unsanitized escape hatch;
- add standard error text, rich error-slot chrome, and handle descriptions to `lr-slider`;

- complete standalone theme inputs and semantic contrast coverage;
- export public component property and configuration types from the registration-free package root;
- preserve retrieval evidence locators through `lr-retrieval-trace`;
- honor slot-only answer and source content in `lr-rag-answer`;
- preserve keyboard focus when retrieval paths, chips, and source collections change;
- preserve `lr-emoji-picker` option focus by identity or nearest survivor when controlled groups
  reorder or shrink, without stealing search or external focus, and materialize off-window roving
  targets before transferring focus;
- normalize invalid `lr-knowledge-base-admin` tab state to its Sources fallback;
- remove unintended nested card chrome from generated RAG sources and evaluation metrics;
- restore `lr-export-button` to sequential keyboard navigation after loading or disablement ends;
- report and announce `lr-diff-view` clipboard failures without falsely confirming stale or failed writes;
- isolate registered renderer dialog events so inner dialogs cannot close `lr-document-viewer`;
- surface nonfatal `lr-dataset-viewer` parser diagnostics while preserving recoverable rows;
- fully suppress the visible `lr-toast-item` progress animation under reduced motion;
- harden rendered safe-area coverage for every `lr-toast` placement in LTR and RTL;
- cover `lr-spinner`'s populated, forwarded visible-label accessibility state.
- reject excessive ZIP entry and declared-expansion metadata before `lr-archive-viewer` asks JSZip
  to materialize its entry graph.
- isolate fetched `lr-svg-viewer` content from author styles, SVG animation, and external resource
  references while retaining local paint servers.
- reject XML document type declarations before browser entity expansion and preserve mixed XML
  child-node source order in `lr-xml-viewer`.
- reconcile and announce retained `lr-xml-viewer` search state after XML reloads.
- place `lr-mcp-app`'s inline CSP before every app-controlled token so head decoys cannot bypass it.
- bound streamed ANSI CSI/OSC carry and recover `lr-terminal` after overlong unterminated sequences.
- restore `lr-tool-param-form`'s cloned initial value and pristine interaction state on native form reset.
- replace English `lr-test-results` status initials with language-neutral decorative marks.
- preserve `lr-code-block` and `lr-code-block-core` roving focus when controlled code shrinks.
- validate every `lr-box-plot` canvas theme color and fall back from invalid CSS expressions.
- materialize `lr-audio-visualizer` canvas colors, including `currentColor`, in the live theme scope.
- keep disabled, hidden, and inert custom controls out of `lr-message-actions` roving navigation.
- skip unavailable `lr-thread-list` rows locally and across virtual-window keyboard boundaries.
- preserve `lr-prompt-queue` focus when a controlled removal is accepted.
- enforce `lr-push-to-talk`'s hit floor and keep custom trigger glyphs decorative.
- preserve `lr-sequence-strip` and `lr-heatmap` roving focus through controlled refreshes, and honor the strip's host name.
- preserve `lr-graph-query-builder` focus when filter chips or saved queries are removed.
- transfer `lr-realtime-session` focus when its public capture surface is hidden.
- preserve `lr-selection-toolbar` focus when its controlled action set changes.
- complete `lr-voice-picker`'s standard form-control frame and slotted-label contract.
- keep `lr-stat` slotted controls outside its whole-card link and forward its host accessible name.
- add owned error chrome and the standard form-control frame to `lr-checkbox`.
- normalize `lr-combobox`'s active descendant after local or async option-set changes.
- preserve `lr-table` row and header focus when controlled collections shrink or reorder.
- preserve author-supplied `lr-tree-item` names across data-model refreshes.
- make authored CSS-part references exact and complete, and correct `lr-model-select` accessible-name precedence prose.
- verify conversation placeholder theming through rendered pseudo-element styles.
- keep Web Test Runner failure payloads primitive-only and gate component tests against live DOM-node Chai assertions.
- verify `lr-agent-run` spinner motion through live full-motion and reduced-motion computed styles.
- preserve nested `lr-evaluation-run` approval dialogs when a host vetoes the correlated decision event.
- verify `lr-prompt-studio` native option palettes through live light- and dark-theme computed styles.
- harden agent-tool motion, native-control, placeholder, and footer layout contracts with rendered checks.
- accept canonical `start`/`end` adornment slots on `lr-chat-composer` while retaining legacy aliases.
- accept canonical `start` adornment content on `lr-conversation-item` while retaining `leading`.
- complete `lr-model-select`'s standard slotted-label and `form-control` frame contract.
- keep `lr-markdown-core` leading-tab parsing and `tab-size` behavior aligned with `lr-markdown`.
- expose the shared configurable Markdown parser and public refresh method on `lr-markdown-core`.
- verify `lr-code-block-core` Shiki token palettes through rendered light and dark computed colors.
- relay `lr-data-grid` search and filter focus transitions through its host as native events.
- clarify that `lr-prompt-input` submits its composite state through typed events, not native form data.
- theme `lr-data-grid`'s search placeholder through the shared quiet-text token.
- localize generated matrix and category counts in `lr-heatmap` and `lr-sequence-strip`.
- align `lr-code-block-core`'s reflected `copyable` states with the full code block.
- expose `lr-model-select`'s free-text input, selection, and range-editing facade.
- retain a non-color visual state and part hook for hidden chart legend series.
- separate chart legend, data-table, and reset-zoom hover/pressed theme hooks.
- expose `lr-lite-chart`'s selected-mark outline width alongside its color.
- cover every concrete typed chart controller in a shared 320px RTL long-content story fixture.
- export a total `lr-test-results` detail-slot-name helper for malformed UTF-16 ids.
- let `lr-calendar` themes independently inherit selected, outside-month, and today paint hooks.
- cover `lr-calendar` in an exact 320px RTL fixture with long localized event content.
- stop `lr-flow-canvas`'s numeric grid fallback from shadowing its public theme hook.
- keep every `lr-flow-canvas` edge tone and its referenced arrowhead independently themeable.
- wrap `lr-flow-canvas` corner companions so controls and minimaps do not overlap at 320px.
- keep obsolete `lr-code-block-core` language-map loads from clearing the current loading state.
- keep lean code-block and Markdown bundles free of Shiki's full grammar table, enforced through
  peer-inclusive dependency-graph checks.
- share full/core Markdown parsing, fallback, anchor, highlight, and rendering behavior while
  retaining their intentionally distinct Shiki grammar loaders.
- correct the documented Markdown heading-outline return type and guard its keys against the
  exported `MarkdownHeadingItem` interface.
- expose peer-neutral Markdown, message-feedback, and model-select types from the registration-free
  package root and the relevant granular Markdown entries.
- enroll standalone theme inputs in the canonical design-token artifacts and keep stripped
  internal Shiki test seams out of published declarations.
- let `lr-select` triggers and overlaid tag rows shrink so long placeholders, selected labels, and
  multi-select chips remain inside constrained LTR and RTL rows.
- forward semantic `lr-filter-bar` control parts so consumers can theme its composed select,
  combobox, text, and date fields through the bar's shadow boundary.
- honor host `aria-label` presence on `lr-filter-bar`, including an explicitly empty value, before
  falling back to the component's `label` property.
- keep the contained menu's standalone `lr-menu-select` alias inside `lr-dropdown`, leaving one
  documented cancelable `lr-select` event for direct, nested, and consumer-supplied menu shapes.
- contain composed controls' `lr-input`/`lr-change` aliases inside `lr-filter-bar` while preserving
  one bar-owned full-value `lr-input` and the controls' native-style event path.
- enforce `lr-dropdown[disabled]` as an opening invariant for initial markup, pre-upgrade property
  replay, and later imperative opening, independent of assignment order.
- preserve host `aria-label` precedence by attribute presence, including explicitly empty values,
  across archive, calendar, contact, CSV, dataset, comparison, document, and DOCX viewers and the
  nested dialog path used by `lr-document-viewer`.
- localize complete highlighted-cell names in CSV, dataset, and spreadsheet viewers with separate
  value and annotation placeholders, allowing each locale to control their order and punctuation.
- preserve `lr-select`'s keyboard-active option by identity across live reorders and rehome
  removed or disabled active rows to the nearest navigable survivor.
- expose independently inheritable progress, action, current-page, hover, and pressed color hooks
  for `lr-flow-node`, `lr-graph-query-builder`, and `lr-pagination`, preserving the existing palette
  as exact fallbacks.
- recognize constant-backed `exportparts` vocabularies in the manifest contract and document the
  chart subclasses' inherited hidden-legend and control-state theming surfaces.
- split `lr-pagination` summary, control-group, and numbered-page spacing into independent
  inheritable layout hooks that retain the existing spacing defaults.
- cover `lr-query-builder` at exactly 320px with long public and localized select labels in both
  LTR and RTL, guarding the composed `lr-select` min-content repair.
- contain 200- and 500-item `lr-sequence-strip` datasets at 320px through a documented dense-collapse
  policy while preserving every semantic cell, tooltip, and roving keyboard stop.
- keep `lr-push-to-talk` timer, level sampling, and maximum-duration deadline synchronized with
  option changes during an active recording.
- prevent a shared Markdown dependency settlement from parsing twice when `lr-markdown` or
  `lr-markdown-core` reconnects before its promise callback runs.
- let `lr-message-feedback` hosts hold a submission for async persistence, then explicitly finalize
  or revert it without premature success UI.
- forward text and reasoning part streaming state from `lr-message-parts` into its composed Markdown
  renderers so parse and highlighting work coalesces until completion.
- compute `lr-message-parts` citation ranks in one linear pass instead of rescanning every prefix.
- let `lr-table`, `lr-timeline-item`, and `lr-word-cloud` inherit their public theme hooks from
  ancestor theme wrappers while preserving direct-host precedence and existing defaults.
- expose independent `lr-stat` emphasis edge/value hooks and checked/indeterminate `lr-tree-item`
  checkbox border, background, and glyph hooks without changing their semantic-token fallbacks.
- add paired exact-320px LTR/RTL Storybook baselines for long stat, table priority/action, vertical
  and horizontal timeline, and word-cloud legend compositions.
- format compact `lr-rubric-form` score labels with the effective locale, matching its slider
  branch while preserving stable raw item and submission values.
- expose `lr-otp-input` compact-string selection and range-editing APIs, with sanitized silent
  replacements kept synchronized across visual cells, form value, and validity.
- define `lr-realtime-session.errorCode` as host-readable diagnostic metadata while retaining one
  safe localized generic failure for all provider codes.
- make `lr-thread-list` Home/End navigation resolve the complete virtual model, skipping group
  records and unavailable endpoint rows instead of stopping at the mounted window.
- namespace `lr-thread-list` group and thread identities independently so unrestricted raw thread
  ids cannot steal active ownership from or collide with virtual group headers.
- scope `lr-widget-renderer` warning dedupe to the current root/registry generation so streamed
  attacker-controlled type and prop names cannot accumulate for the instance lifetime.
- reject malformed reachable `lr-widget-renderer` nodes before dereference, clear stale content,
  and report exactly one render error instead of throwing from a streamed update.
- keep `lr-document-library` search, tag-filter, and checkbox implementation events inside the
  component while emitting one documented filter or selection event per interaction.
- roll back `lr-data-grid` pointer resize state on cancellation or lost capture without emitting a
  committed resize; retain pointerup as the commit path.
- make a live `lr-flow-canvas[locked]` transition cancel and roll back active gestures, retire
  global pointer listeners, and block imperative viewport mutation.
- retire `lr-flow-canvas` node-drag and connect gestures when the controlled node model is
  replaced so stale ids cannot move or connect after refresh.
- publish normalized effective zoom bounds in flow-canvas companion snapshots and use them for
  `lr-flow-controls` button availability.
- keep `lr-flow-minimap` click-to-center available after a canceled viewport drag while consuming
  only the browser-synthesized click after a completed drag.
- add the canonical `start` leading-icon slot to `lr-stat`, with the shipped unnamed slot retained
  as its deterministic fallback.
- add the purpose-named `marker-icon` slot to `lr-timeline-item`, retaining `icon` as its
  deterministic fallback.
- remove disabled `lr-token-input` edit triggers from focus, expose their disabled state, retire
  internal focus, and suppress enabled hover feedback until the control is re-enabled.
- keep form-control theme inputs inheritable through ancestor wrappers across size, appearance,
  and pill fallbacks for emoji picker, icon button, input subclasses, locale picker, OTP input,
  and phone input.
- retain the shared icon-button hit-area floor for every emoji-picker option while compact size
  tiers continue to scale the glyph independently.
- constrain emoji-grid and segmented-time-picker scrollports to their intended block axis under
  undersized allocations, without introducing phantom horizontal scrollbars.
- reconcile action-bearing input, number, segmented-time, and phone rows on one shared rendered
  size ladder while preserving compact plain-field tiers.
- expose inheritable component-scoped gap and radius hooks for segmented time input, preserving
  shared size and pill tokens as fallbacks.
- expose independent, inheritable state-paint hooks for input actions/focus, segmented-time
  surfaces and options, locale selection weight, and OTP active/invalid segments.
- contain long RTL input adornments and segmented-time chrome, with exact-320px stories for input,
  number, segmented-time, and OTP action/fixed-cell compositions.
- retain the shared 40px compact-target floor for circle/icon-only buttons and label-less
  checkboxes across every size tier while keeping their visible glyph and box tier-sized.
- expose independent component-scoped state paint for checkbox/group/editor invalid and
  interaction states, color-picker selection, option current/selection, and the full date-picker
  title/navigation/day/range/selection-view state family.
- integrate combobox listboxes with the shared nonmodal overlay stack so z-order, Escape,
  outside-pointer dismissal, and focus handoff remain topmost-only beside color-picker popups.
- contain button, checkbox, option, and date-input labels/adornments in narrow LTR and RTL rows
  while preserving fixed interactive and glyph geometry.
- add exact-320px RTL Storybook and rendered baselines for checkbox-group wrapping and code-editor
  form-chrome/source-overflow ownership.
- correct transcript-feed documentation for plain `scrollToBottom()` behavior and conditional
  interim-area rendering, with a focused regression for follow-state preservation.
- align thread-list documentation with the shipped conditional `row-wrapper` part and clarify its
  nesting around built-in and custom row actions.
- document and verify a genuinely lean widget-renderer manual-definition route whose real bundle
  graph excludes the eager default registry and all eight default mapped classes.
- add the shared reflected size ladder to `lr-voice-picker` in both picker modes while retaining
  the preview action's compact hit-area floor.
- keep `lr-tree-item` constructible when optional `ElementInternals` custom-state support is
  absent or only partially implemented.
- fail closed on duplicate `lr-tree` data ids so one public identity cannot own multiple focus,
  selection, expansion, or reorder targets.
- announce `lr-tree` reorder success only after the host-owned sibling order confirms the exact
  request, keeping ignored or rejected requests silent.
- realign canceled `lr-carousel` mouse drags instantly under reduced motion while preserving
  smooth full-motion recovery, including the pointer-capture-loss path.
- suspend full `lr-heatmap` canvas work while offscreen, coalesce hidden invalidations into one
  visibility-entry redraw, and repaint locale-derived canvas labels when locale changes.
- restore `lr-graph-query-builder`'s normalized initial query on form reset instead of always
  erasing it, while retaining pristine-state cleanup and native custom-validity persistence.
- normalize non-finite `lr-query-builder` number conditions at controlled-model, late-field, and
  user-input boundaries so blank number controls cannot retain JSON-null-producing infinities.
- cancel stale `lr-sequence-strip` arrow/Home/End focus continuations across controlled item
  replacement and disconnect/reconnect instead of focusing a new model by an old numeric index.
- strictly round-trip-validate `lr-filter-bar` ISO date chips, preserving impossible values raw and
  retaining literal four-digit years below 0100 instead of JavaScript's 1900 remapping.
- make `lr-token-input` overflow ownership explicit: uncapped rows grow, while exact-height rows
  clip inline overflow and scroll in the block axis so wrapped tokens and actions remain reachable.
- expose independent component-scoped hover and pressed paint hooks for `lr-time-range` presets
  and handles and for `lr-token-input` edit/remove actions, preserving the prior shared-token and
  aggregate-action hooks as backwards-compatible fallbacks.
- contain standalone `lr-radio`, `lr-radio-button`, and `lr-slider` label, adornment, reference,
  and hint content within narrow LTR and RTL allocations without shrinking fixed controls.
- expose independent component-scoped hover, pressed, checked, open, action, thumb, and field paint
  hooks across radio, radio-button, rubric-form, select, slider, switch, and textarea while
  preserving their existing shared-token fallbacks.
- expose instance-scoped content and row gap hooks for radio-button chrome, slider, and switch,
  preserving the shared spacing tokens as defaults.
- add exact-320px LTR/RTL long-content Storybook and rendered baselines for horizontal radio-button
  groups, switch labels/hints, and rubric fields/actions.
- give custom `lr-page` navigation toggles a resolvable host bridge for their private drawer and
  restore only component-owned ARIA across replacement, removal, and reconnect.
- make a vetoed `lr-combobox` close atomic, preserving its filter query, active option, async rows,
  reflected open state, and overlay ownership until a close is accepted.
- roll canceled or capture-lost `lr-color-picker` pointer previews back to their pre-gesture
  visible and submitted value without emitting a commit, while preserving authoritative consumer
  assignments.
- make `lr-button` submit/reset behavior a true post-click default action, so
  `click.preventDefault()` vetoes it while propagation control alone does not.
- rehome `lr-locale-picker`'s active option when a live locale catalog shrinks, keeping
  `aria-activedescendant` and the next keyboard command valid.
- bind `lr-otp-input` auto-submit tasks to the exact completed code generation so a stale task
  cannot submit a later full value after replacement, reset, restoration, or reconnection.
- make `lr-time-input.focus()` honor direct and fieldset disablement, matching its click and tab-stop
  contract without emitting synthetic host focus events.
- expose independently inheritable appearance, hover, and pressed paint hooks for app rail,
  app-rail item, breadcrumb item, card, and carousel states without changing their existing defaults.
- add exact-320px RTL long-content Storybook and rendered baselines for app rail, breadcrumb,
  button-group, and carousel compositions, including open mobile chrome and populated controls.
- correct the `lr-heatmap` cell-text contract to describe its localized matrix/calendar templates
  and reserve `cellText` for application-specific wording rather than ordinary translation.
- expose independently inheritable appearance, border, hover, and pressed paint hooks across
  details, accordion, and accordion-item while retaining every existing shared-token fallback.
- expose inheritable `lr-details` summary gap and surface radius hooks independently of its shared
  density ladder, preserving the existing spacing and radius tokens as defaults.
- keep `lr-filter-bar`'s reset action on the same default `m` height tier as its adjacent built-in
  fields instead of hardcoding the shorter `s` tier.
- keep short resizable dashboard-grid cells at the shared interactive-action height floor so their
  absolute resize handles cannot overlap the preceding stacked cell or gap.
- contain unbroken consumer-authored dashboard-grid cell content within narrow LTR/RTL stacks while
  preserving explicitly child-owned horizontal scrollports.
- contain unbroken active-filter chip values within narrow LTR/RTL filter bars by zeroing nested
  flex minima while retaining the chip's own ellipsis and removal behavior.
- add exact-320px RTL long-summary, expanded-content, and action Storybook/rendered baselines for
  details and the composed accordion/accordion-item family.
- preserve `lr-av-player`'s named region when an unsafe media source renders its error branch.
- commit a pending `lr-time-range` keyboard gesture exactly once when its handle loses focus before
  key release.
- invalidate active `lr-time-range` keyboard and pointer gestures on direct/fieldset disablement or
  form reset so later physical releases cannot commit stale values.
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
- announce `lr-flow-minimap` viewport changes for map clicks, wheel zoom, keyboard commands, and
  completed drags while keeping canceled drags silent.
- expose `lr-token-input`'s native draft selection and event-silent range-editing facade, keeping
  programmatic range edits synchronized with the next token commit.
- make `lr-token-input.focus()` synchronously honor direct and fieldset-cascaded disablement before
  the internal draft input has re-rendered disabled.
- remove `lr-stream-status` real-timer test races by installing stall listeners before connection
  or recovery can arm and fire their timers.
- verify `lr-streaming-text` cursor theming and reduced-motion behavior through live rendered
  geometry, animation, and opacity instead of stylesheet-source assertions.
- follow static, dynamic, side-effect, single-quoted, and double-quoted component imports when
  attributing optional peers, and document `lr-streaming-text`'s exact Markdown fallback matrix.
- expose every composed push-to-talk event through `lr-realtime-session`'s TypeScript, CEM,
  framework, Storybook, and authored-reference contracts without re-emitting the runtime events.
- add optional peer-neutral literal icons to `lr-suggestion-chips`, rendered through a stable
  decorative part while the chip button retains focus and selection ownership.
- eagerly wire the `lr-stream-status` LiveDemo so its first Connect click works, and invalidate a
  pending connection completion when the demo is stopped.
- accept Web Awesome's exact `currentSlide` carousel markup spelling after HTML normalization,
  retaining `current-slide` as the reflected canonical attribute and initial-conflict winner.
- preserve `lr-swatch-picker` keyboard focus across live palette reorders and focused-option
  removal without changing its controlled value or emitting a user-change event.
- replace source-only CSS assertions with rendered submit-color, listbox-overflow, and
  currentColor-glyph coverage for rubric form, select, and swatch picker.
- co-tokenize `lr-date-picker`'s mirrored `date-picker` part and deprecated `base` alias on
  the same visible shell so either consumer selector reaches identical chrome.
- isolate all seven `lr-video` icon slots in inert decorative sibling layers so accidentally
  interactive glyph markup cannot nest actions or add keyboard stops.
- localize `lr-callout`'s complete labeled live-announcement template so locales can reorder its
  context/content fields and choose their own punctuation.
- contain `lr-model-settings-panel`'s internal live slider event while preserving its mirrored
  temperature readout and consolidated committed-change contract.
