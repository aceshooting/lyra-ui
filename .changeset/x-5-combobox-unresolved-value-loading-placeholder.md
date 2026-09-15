---
'@aceshooting/lyra-ui': patch
---

Fixes `<lr-combobox>` so a committed value never flashes its raw, unbadged string on the trigger
(or a `multiple`-mode tag) while an async `source` fetch has never yet resolved for it.

Previously, from mount through the debounce delay and the in-flight call itself, the "not in
catalog" badge and `getUnknownLabel` were already suppressed as "not yet known" -- but nothing
filled the gap they left, so the raw value (a machine key, a numeric id) rendered unexplained in
the meantime. That window now shows the same `loadingText` placeholder the listbox's own loading
row uses. Once the fetch settles, success or failure, the value resolves normally: its real label
if a row claims it, or the raw value with the badge if it still matches nothing.
