---
'@aceshooting/lyra-ui': major
---

`lr-branch-picker`, `lr-chat-viewport`, `lr-realtime-session`, `lr-selection-toolbar`,
`lr-message-actions`, `lr-prompt-queue`, `lr-prompt-input`, `lr-audio-visualizer`, and `lr-map` now
declare `label` as `label?: string` instead of `label: string = ''`, matching the copy-override
contract already used by `lr-transcript-feed`, `lr-thread-list`, `lr-suggestion-chips`,
`lr-agent-workspace`, and `lr-file-input`. Rendered/attribute behavior is unchanged: an omitted
`label` still renders the localized default, and `label=""` still suppresses it. Only the read
type and readback value of the unset property change.

MIGRATION: a TypeScript consumer that reads `el.label` and calls a `String` method on the result
without a guard needs a null check. Before:
```ts
const trimmed = el.label.trim();
```
After:
```ts
const trimmed = (el.label ?? '').trim();
```
No migration is needed for anyone who only sets `label`, interpolates it, or relies on the
`label=""`-suppresses-the-default behavior, which is unchanged on all nine tags.

Additionally, `lr-map`'s read-only `legendProjection` accessor now has a documented no-op setter
(matching `lr-chart`'s `chartArea`), so an accidental `.legendProjection=${x}` Lit template binding
degrades silently instead of throwing from inside lit-html's property-commit machinery. No
migration needed for this part of the change.
