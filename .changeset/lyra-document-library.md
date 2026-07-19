---
"@aceshooting/lyra-ui": minor
---

New `<lr-document-library>`: a searchable, filterable document inventory with versions, tags,
owners, freshness, and bulk selection. Consumes the shared `DocumentRef` type from
`@aceshooting/lyra-ui/ai/types` (`id`/`name`/`mimeType`/`uri`/`version`) as its base row shape,
extended locally (`LibraryDocument`) with `tags`/`owner`/`updatedAt`/`freshness` -- the fields an
inventory view needs that a provider-neutral document reference deliberately doesn't carry.
Composes `<lr-table>` for the grid itself (`<lr-data-grid>` was evaluated and ruled out: it only
supports a single `selectedKey` and stringifies every cell value, so it cannot host the checkbox/
chip/icon content bulk selection, tags, and per-row type icons need; `<lr-table>` supports
arbitrary cell content and `priority`-driven responsive column hiding), `<lr-chip>`/`<lr-chip-
group>` for tags and the freshness badge, `<lr-file-icon>` for per-document type icons, `<lr-
input type="search">` for free-text search, and `<lr-combobox multiple>` for a tag facet filter
(AND semantics -- a document must carry every selected tag). Bulk selection renders a `<lr-
checkbox>` per row plus a header select-all checkbox (indeterminate when some but not all visible
rows are selected) independently of `<lr-table>`'s own built-in `selectionMode`, since that mode's
click-anywhere-on-the-row toggle would conflict with the row's own name button opening the
document. A controlled data view like this package's other orchestration-level list surfaces: no
upload/sync/mutation logic of its own, only `lr-filter-change` / `lr-sort` / `lr-selection-change`
/ `lr-open` request-and-notification events. `selectedIds` referencing a document no longer present
in `documents` is silently pruned (no event fires for that pruning, mirroring `<lr-chip-group>`'s
identical silent-resync convention) rather than left dangling.
