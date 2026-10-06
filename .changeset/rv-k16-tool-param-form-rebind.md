---
"@aceshooting/lyra-ui": major
---
lr-tool-param-form: re-assigning the same `schema` or `value` object is no longer a change, so a parent re-render keeps the user's unsaved edits. Migration: assign a new object (for example `{ ...args }`) to discard edits.
