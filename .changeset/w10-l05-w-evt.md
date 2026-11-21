---
'@aceshooting/lyra-ui': minor
---

- Lazily registered child components now load through one shared loader: a failed chunk no longer leaves `updateComplete` rejected or the child permanently unloaded, it is retried on a later render and reported as a development warning, and `updateComplete` settles only after the upgraded children have rendered (`lr-rubric-form`, `lr-stream-status`, `lr-message-feedback`, `lr-thread-list`, `lr-data-grid` columns menu, `lr-confirm-bar`, `lr-drilldown-panel`, `lr-tool-timeline`, `lr-message-parts`, `lr-dashboard-grid` default cells).
- `lr-agent-question` renders its question and actions even when its response form cannot load, shows a localized notice (`agentQuestionLoadError`), keeps Submit disabled until the form loads, and retries on a later render.
- `lr-message-parts` retries a renderer whose registration failed when the message reconnects; `lr-skeleton` no longer raises an unhandled rejection when its announcer chunk fails.
- Wheel zoom on `lr-flow-canvas`, `lr-flow-minimap` and the 3D `lr-graph` view follows the wheel delta magnitude (normalized across line and page modes) instead of a fixed step per event, and a horizontal swipe no longer zooms out or blocks page scrolling.
- New cancelable `lr-change-request` on `lr-radio-group` (`{ value, previousValue, option, radio }`) and `lr-radio-select-request` on `lr-radio` and `lr-radio-button` (`{ checked, value }`) let a listener veto or resolve a radio selection before it commits, like the other choice controls.
- `lr-model-select` and `lr-voice-picker` gain `top-layer`, and their listbox follows the overlay stack index like `lr-select`.
