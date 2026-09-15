---
"@aceshooting/lyra-ui": minor
---

`@aceshooting/lyra-ui/testing` gains `createLyraEvent(tag, name, detail?)`, a typed factory for
building one specific `lr-*` component's documented `CustomEvent` — the same `bubbles: true`,
`composed: true`, and per-event `cancelable` flags the real component's own event map declares —
without hand-rolling one and guessing its shape. An unknown tag, an event name that tag does not
document, or a `detail` of the wrong shape are compile errors. `detail` is always optional (an
omitted value normalizes to `null`, matching `LyraElement.emit()`), so a test that only cares about
the dispatched event's flags does not need a realistic one.
