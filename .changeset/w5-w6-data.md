---
'@aceshooting/lyra-ui': major
---

- **Breaking:** `lr-funnel` now owns `stages` and `comparison` like other data components. Each
  assignment is detached into a frozen snapshot of at most the first 10,000 source positions. The
  getters return that snapshot, mutating the caller's array has no effect, and calling
  `requestUpdate()` no longer refreshes a mutated array. Validation runs synchronously, so the
  chunked million-position scan and its `aria-busy` state are gone.
  - Migration: assign a new array to publish a change (`funnel.stages = [...stages]`).
  - A source longer than 10,000 positions shows a localized `limit` notice with the admitted and
    source counts.
- **Breaking:** `lr-rubric-form` admits at most the first 500 valid keys.
  - `keys` reads back the admitted schema.
  - Values for discarded fields are dropped like any undeclared field.
  - A localized `[part="limit"]` notice follows the fields.
  - Migration: split a larger rubric across several forms.
- **Breaking:** file sizes are now formatted by the shared Intl byte formatter on binary (1024)
  steps, the same one `<lr-format-bytes unit-step="1024">` uses. This affects `lr-attachment-chip`,
  `lr-file-input`, `lr-file-icon`, `lr-archive-viewer` and `lr-email-viewer`.
  - Units are worded by `Intl.NumberFormat` in the component's locale (`512 byte`, `1.5 kB`, `2 MB`
    in English). Sizes now reach PB instead of stopping at TB.
  - Whole amounts no longer print a trailing `.0`.
  - The `fileSizeUnitB`, `fileSizeUnitKb`, `fileSizeUnitMb`, `fileSizeUnitGb` and `fileSizeUnitTb`
    strings are retired. Remove them from custom catalogs and `.strings` overrides.
  - The public `formatFileSize(bytes, locale?)` is now a thin wrapper over that formatter. Its
    `unitLabel` and `numberLabel` callbacks are removed; pass a locale instead.
  - `FILE_SIZE_UNIT_KEYS` and `localizedNumberLabel` are no longer exported. `formatFileSize` is
    still available from the package root and from `components/media/attachment-chip/file-size.js`.
- `lr-retrieval-trace`, `lr-chunk-inspector`, `lr-claim-evidence`, `lr-community-card` and
  `lr-rag-eval-dashboard` key their interactive rows by record id. Keyboard focus now stays on the
  same record when an earlier record is removed.
- Provider-backed components now share one normalization of `sourcePage`, `sourcePageSize` and the
  return to page one after a query change. The pagination control's displayed page is capped at the
  largest safe page in every component.
- Sparkline, funnel and histogram labels now share one fraction-digit rule for small values. Output
  is unchanged.
