---
"@aceshooting/lyra-ui": minor
---

Add `<lr-tool-call-block>`, an inline disclosure showing one tool call's status, duration, arguments, and result or error with field redaction. Add `tool-display="block"` on `<lr-message-parts>` to render each paired tool-call/tool-result through it. `ToolInvocation` gains optional `startedAt`, `endedAt` and `redactedFields`. `<lr-message-parts>` now masks `redactedFields` in both tool displays. The agent-stream runtime rejects an invocation whose values for these keys are malformed. `<lr-message-parts>` now reflects `tool-display="chip"` by default.
