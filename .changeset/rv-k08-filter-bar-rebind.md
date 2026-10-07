---
"@aceshooting/lyra-ui": major
---
lr-filter-bar: assigning the same `filters` array or `value` record again — which a parent template does on every render — is now a no-op, so it no longer cancels a pending debounced edit, erases the typed text or aborts custom renderers' signals. Migration: after changing a schema or value, assign a new array or record (for example `bar.filters = [...filters]`); mutating the assigned one in place and re-assigning it does nothing.
