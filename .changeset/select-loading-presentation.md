---
"@aceshooting/lyra-ui": minor
---

`<lr-select>` gains `loading` (default `false`, reflected). A committed value whose catalog hasn't
arrived yet -- `<lr-option>`s still being fetched/mounted asynchronously -- previously had no way to
distinguish itself from a genuinely stale value: both rendered the raw value string badged
dashed/italic `notInCatalog`. Setting `loading` while the matching option is still pending instead
renders the localized `loading` placeholder, with no `unknown-value` badge and no synthetic
`showUnknownOption` listbox row, in the trigger label or the relevant `multiple`-mode tag. Once the
matching `<lr-option>` mounts, the real label renders automatically on the next render, with or
without also flipping `loading` back to `false`. A value that already matches a live option, and
every existing `loading`-unset unknown-value/`getUnknownLabel` behavior, is unchanged.
