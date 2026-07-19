---
"@aceshooting/lyra-ui": minor
---

New `<lr-graph-query-builder>` component: an editor for a single typed relationship/path filter
(`GraphQuery`) over a knowledge graph -- start/end entity anchors, relationship-type and
node-type "add" pickers (`<lr-select>`) with a removable active-filter chip display
(`<lr-chip>`/`<lr-chip-group>`), a traversal direction, a min/max hop range, validation
(`value`/`checkValidity()`/`reportValidity()`/`lr-validity-change`, form-associated via
`ElementInternals` the same way `<lr-rubric-form>`/`<lr-tool-param-form>` are), and a
host-persisted saved-query list (`savedQueries` + `lr-query-save`/`lr-query-load`/
`lr-query-delete`). `GraphQuery` is a serializable, provider-neutral query model suitable for
handing straight to a GraphRAG retrieval/traversal backend via `value` or the `lr-query-run`
event's payload.
