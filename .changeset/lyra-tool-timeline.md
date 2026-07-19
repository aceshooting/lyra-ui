---
"@aceshooting/lyra-ui": minor
---

New `<lr-tool-timeline>` component: a chronological list of an agent run's tool calls, rendering
each entry through `<lr-tool-call-chip>` (name/status/duration) and `<lr-tool-result-view>`
(args/result) -- both already built for exactly this -- plus one shared `<lr-tool-approval-dialog>`
for entries gated behind a human decision. Its own job is strictly ordering and layout on top of
those existing primitives: `entries` (a new `ToolTimelineEntry[]`, extending `ToolInvocation` from
`@aceshooting/lyra-ui/ai/types` with `startedAt`/`endedAt`, `retryCount`, `redactedFields`,
`needsApproval`, and `approved`) sorts ascending by `startedAt`, with untimed entries trailing in
their original relative order; duration is derived from `startedAt`/`endedAt` and handed to the
chip's own `durationMs`; a retry badge renders only while `retryCount > 0`; and per-entry
`redactedFields` (dotted paths, or a bare `"args"`/`"result"`/`"error"` for a whole branch) mask
sensitive values in the read-only detail view with a "Value hidden" placeholder -- the copy of
`args` handed to the approval dialog is always the real, unredacted value, since approving a call
requires seeing what will actually run. Activating a pending entry's chip opens the shared dialog;
approving or denying it emits this component's own `lr-tool-approval-decide`
(`{ invocationId, approved, args? }`, extending the shared `ToolApprovalEventDetail`) and never
mutates `entries` itself -- a host applies the decision and re-assigns `entries`, and the dialog
closes on its own if the entry under review disappears or resolves out from under it in the
meantime.
