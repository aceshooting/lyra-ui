---
"@aceshooting/lyra-ui": minor
---
`lr-empty` adds `focusHeading()` so an app can move focus to the empty state's heading after a view swap, and renders its heading wrapper as a neutral `<div>` that leaves heading semantics to a slotted `h1`–`h6` (or `role="heading"`) element instead of nesting it in a paragraph and a second heading.
