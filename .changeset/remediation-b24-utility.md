---
'@aceshooting/lyra-ui': major
---

- Known date fields read errors before hints, fall back to localized names for whitespace-only field labels and preserve in-progress IME input.
- Mention suggestions respect shortcut and composition keys, skip disabled choices and contain filter failures. The overflow count is exposed as a disabled option. Use the `option` part to identify selectable suggestion rows.
- Tour navigation ignores repeated activation keys, honors synchronous request handlers and emits `lr-tour-step-activate` after the index changes. Progress indicators wrap in narrow panels.
- Diff and JSON viewers provide named keyboard stops for overflowing content and reveal search matches within the viewer.
- Diff viewers reflect `copyable` and reuse line rendering when only copy feedback changes.
- JSON viewers match keys and values without accents, distinguish repeated controls by full path and deliver search events after rendering.
- Copy buttons resolve dotted source IDs, use localized feedback for whitespace-only overrides and forward host accessibility relationships to the built-in control.
- Diff viewers and copy buttons stop reporting obsolete clipboard outcomes when a listener changes the control.
- Export buttons describe the native trigger, export only own column values and announce failures with the `exportFailed` message.
- Export, diff, JSON, poll and random-content actions support scoped hover and pressed colors. Export controls honor the interactive transition token.
- Decorative icon loading failures stay silent while labeled icons announce the failure. Remote SVG sprites retain supported local references.
- Poll status freezes the remaining countdown while inactive. Random content suspends timer-driven selection in hidden documents and omits unnamed groups.
- Resize observers recover from unavailable constructors and capability getters. Intersection observers wait for a named root and clear obsolete intersection classes.
- Dividers normalize unsupported orientations and retain a visible vertical rule in auto-height flex rows.
- Number and byte formatters isolate their output in bidirectional text.
