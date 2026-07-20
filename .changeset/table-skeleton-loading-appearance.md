---
"@aceshooting/lyra-ui": minor
---

`lr-table`: add a skeleton loading mode. A new `loadingAppearance: 'spinner' | 'skeleton'`
property (attribute `loading-appearance`, default `'spinner'` — unchanged output) controls how
`loading` renders. `'skeleton'` keeps the real `<colgroup>`, `<thead>`, filter field and
pagination footer in place and fills the table body with placeholder `<lr-skeleton>` rows, so a
cold load sketches the grid's shape and holds its column geometry instead of collapsing to a
spinner and reflowing when the rows arrive. The placeholder row count comes from the new
`skeletonRows` property (attribute `skeleton-rows`, default `0` = derive from the normalized
`pageSize`, capped at 20, else 3). Exactly one `role="status"` live region announces the load —
each placeholder opts out of its own announcement, so there is no per-cell live-region storm. A
`priority`-hidden column is given no visible placeholder cell. New `skeleton` CSS part targets the
placeholders.
