---
"@aceshooting/lyra-ui": minor
---

`@aceshooting/lyra-ui/testing` gains four interaction drivers — `chooseOption()`,
`submitConfirmDecision()`, `toggleSwitch()`, and `activateStep()` — that go through a component's
own real activation path (its own shadow-part lookup and `.click()`, the same as its own tests)
instead of a downstream suite reverse-engineering internal detail shapes or shadow-part selectors.
`chooseOption()` covers every component sharing the same `[part="option"]`/`data-value` listbox
pattern (`lr-combobox`, `lr-select`, `lr-model-select`, `lr-locale-picker`, `lr-voice-picker`), and
`submitConfirmDecision()` covers both components sharing the same
`[part="approve-button"]`/`[part="deny-button"]` `lr-approve`/`lr-deny` contract (`lr-confirm-bar`,
`lr-tool-approval-dialog`). Each driver is `async`, resolves after `updateComplete`, and throws a
plain `Error` rather than silently doing
nothing when the requested interaction cannot happen (disabled, read-only, or no matching
row/step currently rendered) — the same class of silent miss `createLyraEvent()` already closes
for hand-built events. Pure DOM operations only, so these also run under a downstream suite's own
happy-dom/jsdom environment, not only a real browser.
