---
"@aceshooting/lyra-ui": minor
---

Fill several gaps in the form-control surface that were pushing logic onto consumers.

- `<lr-input>` and `<lr-textarea>` gain `minlength`/`maxlength` constraints wired into the validity
  bridge, so length violations participate in constraint validation instead of being advisory.
  Length is counted in code points, so astral characters count as one.
- `<lr-select>` and `<lr-combobox>` now emit value-carrying `lr-change` events, and their `input`/
  `change` events carry a typed detail — no more `as unknown as { value }` at every call site.
- `<lr-card>` gains `target` for anchor-mode cards, with `rel="noopener noreferrer"` derived from it
  rather than settable on its own.
- `<lr-combobox>` accepts an `AbortSignal` for `source` and a configurable `source-delay`
  (default 200ms), so a fast typist no longer races stale in-flight results.
