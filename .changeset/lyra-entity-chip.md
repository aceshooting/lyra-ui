---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-entity-chip>`: an inline `@entity` mention for agent prose with a hover/focus preview
popover, reusing `lyra-citation-badge`'s interaction contract wholesale (200ms hover-leave grace,
independent hover/focus hold-open state, Escape dismissal, Space opens/Enter activates). The
knowledge-graph sibling of `lyra-citation-badge` — renders its `label` text rather than a `[n]`
index, and reflects `type` for host-level per-type theming.
