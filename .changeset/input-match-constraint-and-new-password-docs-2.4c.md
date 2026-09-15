---
"@aceshooting/lyra-ui": minor
---

`<lr-input>` gains a declarative `match` constraint for confirm-value pairs (password confirm,
change-email, and similar), plus documentation for the correct `autocomplete="new-password"` recipe
on a set/change/reset flow.

Setting `match` to a sibling field's id (resolved in this element's own root, the same
never-crosses-a-shadow-boundary rule every other idref in the library follows) or to a direct
element reference makes this field additionally fail validity — a localized `customError`
(new `matchMismatch` `DEFAULT_STRINGS` key, translated in all ten shipped catalogs) — whenever its
own value disagrees with the referenced field's, once every other constraint (`required`,
`pattern`, length, type-specific format) already reports valid. It revalidates automatically on
either field's own edits, including the referenced field's, through a listener on its own
`input`/`change` events, so retyping the first half of a pair revalidates the second immediately. A
`match` that does not resolve to a live element (most commonly a dangling id) is inert rather than
a permanent block on submission.

There is no dedicated password-purpose preset or component: `llms/forms.md` documents composing
`type="password"`, `password-toggle`, `autocomplete="new-password"`, and `match` directly for a
confirm pair, and why `new-password` (never a bare `password`, and never `current-password`) is the
correct token on a set/change/reset flow.
