---
"@aceshooting/lyra-ui": minor
---

New provider-neutral shared type surface at `@aceshooting/lyra-ui/ai/types`: `AgentStatus`,
`AgentRun`, `AgentStep`, `ChatMessage`, `ToolInvocation`, `RetrievalQuery`, `RetrievalChunk`,
`Citation`, `DocumentRef`, `GroundingAssessment`, and shared run-lifecycle/retrieval-progress/
citation-select/tool-approval/cancel/retry/export event-detail types. A foundational types-only
module (no runtime code, no new custom elements) for the upcoming retrieval, agent-run,
knowledge-graph, dashboard, and evaluation component families -- structurally compatible with the
prop shapes `lr-chat-message`, `lr-citation-badge`, `lr-tool-call-chip`, `lr-tool-result-view`,
`lr-source-card`, `lr-attachment-chip`, and `lr-document-preview` already expose, so these types
assign directly onto those components' own properties with no adapters. `ToolInvocation.status`
reuses `lr-tool-call-chip`'s own `ToolCallStatus` union rather than the broader `AgentStatus`
shape, since a single tool call's terminal state is exactly what that existing vocabulary already
covers.
