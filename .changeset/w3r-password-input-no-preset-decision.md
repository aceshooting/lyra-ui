---
"@aceshooting/lyra-ui": patch
---

`<lr-input>` documents, with its reason, the deliberate decision not to add a password-purpose
preset: the one thing such a preset would actually save — `autocomplete` — has no single correct
value for "a password field" (`new-password` on a set/change/reset flow, `current-password` on a
login one, and one is never derivable from the other), so a `purpose`/`preset` property would still
need a second parameter carrying that same distinction, in exchange for a non-standard vocabulary a
migrating `wa-`/`sl-`/native `<input type="password">` author would have to learn instead of
carrying over unchanged. Compose `type="password"`, `password-toggle`, `autocomplete="new-password"`,
and the existing `match` cross-field constraint directly for a set/change/reset confirmation pair; a
login field needs only `type="password"` and `autocomplete="current-password"`. No other component
ships a `type="password"` mode, so no sibling needed the same decision; `<lr-otp-input>` already
defaults its own `autocomplete` to `one-time-code` because it has exactly one purpose, unlike
`<lr-input>`'s many `type`s.
