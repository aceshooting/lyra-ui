---
"@aceshooting/lyra-ui": minor
---

`<lr-thinking-panel>`'s live auto-follow can now see property-driven, shadow-DOM-rendered content.

`<lr-streaming-text>`, `<lr-markdown>`, and `<lr-markdown-core>` now emit a shared, composed,
bubbling `lr-content-settled` event (`detail: null`) at their own settle points — each time newly
coalesced/parsed content actually reaches their rendered DOM. `<lr-thinking-panel>`'s live-mode
auto-follow now listens for that event in addition to its existing light-DOM `MutationObserver`,
so composing a `<lr-streaming-text>` or `<lr-markdown>`/`<lr-markdown-core>` in its default slot —
the documented usage — correctly auto-scrolls even though those components take their content as a
property and render entirely inside their own shadow root, which the `MutationObserver` alone can
never see. A mutation and a settle event landing in the same animation frame still coalesce to a
single scroll; manual scroll-up stickiness suppression and `post-hoc` mode's no-auto-scroll
contract are both unchanged. `llms/agent-tools.md`'s `<lr-thinking-panel>` docs and
`llms/conversation.md`'s `<lr-markdown>`/`<lr-markdown-core>`/`<lr-streaming-text>` docs are updated
to describe the new mechanism and no longer contradict the documented live-mode composition
example.
