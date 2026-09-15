---
'@aceshooting/lyra-ui': minor
---

`<lr-combobox>`'s `lr-source-error` event now carries the query that failed

`detail: { error, query }` — `query` is the exact text the rejected `source` call was made with,
not necessarily the live filter text, which may have moved on (or been cleared, for example by
closing the listbox) by the time the rejection settles. `error` keeps carrying the raw rejection
as before, so existing listeners are unaffected.
