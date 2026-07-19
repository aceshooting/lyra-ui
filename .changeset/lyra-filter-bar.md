---
"@aceshooting/lyra-ui": minor
---

New `<lr-filter-bar>` component: a row of composable dashboard filters, each declared by the host
(`filters: FilterBarFilterDefinition[]`) rather than invented by this component -- every filter
renders an existing Lyra input (`<lr-select>`/`<lr-combobox>` for closed choice sets,
`<lr-date-input>` in single or `mode="range"` for dates), plus a `<lr-chip-group>` of removable
`<lr-chip>`s summarizing the active filters, an `<lr-button>` reset action, and (while `loading`)
an `<lr-spinner>` status indicator. Controlled, like every other Lyra data component: `value` is a
plain, JSON-serializable `FilterBarValue` object the host reads/writes directly -- this component
never touches `location`/`history`/storage itself, so turning `value` into (and back out of) a URL
querystring or app-state store is entirely the host's own concern. `required`-flagged filters get
live `invalidFilterIds`/`checkValidity()`/`reportValidity()` and a `lr-validity-change` event, with
each filter's own inline error rendered by its already-chromed composed control rather than a
second, duplicate label/hint/error frame. `reset()` restores every filter to its own
`defaultValue` (or unset) and emits both the standard `lr-input` and a dedicated `lr-reset`,
mirroring `<lr-combobox>`'s own `clear()`/`lr-clear` pattern.
