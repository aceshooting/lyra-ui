---
"@aceshooting/lyra-ui": minor
---

Added a "Conversation & Agent UI" family: chat/tool-call/agent-config building blocks for
streaming AI interfaces, plus the general-purpose primitives (dialog, tabs, checkbox, switch,
menu, chip, JSON viewer, live region, markdown, code block) they're built from. No breaking
changes to any existing component.

New tags: `lyra-dialog`/`confirm()`, `lyra-tabs`, `lyra-checkbox`, `lyra-switch`,
`lyra-json-viewer`, `lyra-live-region` (+ `internal/announcer.ts`'s throttled `Announcer`),
`lyra-markdown` (needs the optional peers `marked`/`dompurify`), `lyra-chat-message`,
`lyra-typing-indicator`, `lyra-tool-call-chip`, `lyra-tool-result-view` (+ its
`registerToolRenderer()` renderer registry), `lyra-tool-result-dialog`, `lyra-chat-composer`
(form-associated), `lyra-attachment-chip`, `lyra-stream-status`, `lyra-virtual-list`,
`lyra-conversation-item`, `lyra-model-select`, `lyra-slider` (form-associated),
`lyra-tool-select-dialog`, `lyra-citation-badge`, `lyra-source-list`/`lyra-source-card`,
`lyra-app-rail`, `lyra-responsive-panel`, `lyra-mention-popover`, `lyra-streaming-text`,
`lyra-thinking-panel`, `lyra-generation-status`, `lyra-code-block` (needs the optional peer
`shiki`), `lyra-tool-approval-dialog`, `lyra-tool-param-form`, `lyra-menu`/`lyra-menu-item`,
`lyra-chip`/`lyra-chip-group`, `lyra-model-settings-panel`, `lyra-context-meter`,
`lyra-dock-panel`, `lyra-document-preview`, `lyra-media-card`, `lyra-attachment-trigger`,
`lyra-kbd`, `lyra-result-card`/`lyra-result-field`.

Also extends `internal/rtl.ts` with `rtlAwareSide()`/`rtlAwarePlacement()` (mirrors a physical
`left`/`right` value, or the `left`/`right` component of a Floating UI `Placement`, under RTL) —
used by `lyra-menu`'s `placement` property so an explicit `placement="left-start"` still anchors
to the trailing edge instead of the physical left when the page is RTL.
