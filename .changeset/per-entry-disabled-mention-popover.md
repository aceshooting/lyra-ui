---
"@aceshooting/lyra-ui": minor
---

`<lr-mention-popover>` items accept `disabled`, so an ineligible mention or command can stay visible
without being selectable. The row carries `aria-disabled`, activation emits nothing, and
active-descendant navigation steps over it without leaving focus stranded. An item that does not set
it renders exactly as before.
