---
"@aceshooting/lyra-ui": minor
---

`<lr-export-button>` gains an explicit lazy row source, and its late-read contract is now
documented rather than merely true.

- New **`getRows?: () => readonly Record<string, unknown>[]`** is consulted only when a built-in
  CSV/JSON download is actually about to be built: after the cancelable `lr-export` event was not
  prevented, and never for a custom format this component does not serialize itself. When set it
  replaces `rows` for that download, so a consumer can export a collection it already holds — an
  `<lr-table>`'s `viewRows`, for instance — without copying it into the element and keeping a second
  live copy there. The column fallback (used when `columns` is unset) derives its header row from
  the lazily supplied rows rather than a stale eager property. A non-array return is treated as no
  rows, matching how `rows` normalizes one; a callback that throws is reported through
  `lr-export-error` and the shared failure announcement, since an export whose data could not be
  collected has failed and a silent empty file would hide that.
- The **eager `rows` property is read after the `lr-export` dispatch**, not at assignment time, so
  a listener that lets the built-in download proceed may assign `.rows` from inside its own handler
  and that data is what gets downloaded. That was already the behavior; it is now a stated contract
  with a test, so it cannot regress silently.

Nothing changes for an export that sets neither: with `getRows` unset the download serializes
`rows` exactly as before.
