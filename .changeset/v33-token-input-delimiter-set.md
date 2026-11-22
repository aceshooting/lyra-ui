---
'@aceshooting/lyra-ui': major
---

`lr-token-input`'s `delimiter` is now a set of single-character delimiters, matching the upstream
tag-input semantics: each character is a delimiter on its own, so `delimiter=";,"` splits a draft
(and a string assigned to `value` or `defaultValue`) at every semicolon and every comma, and typing
either one commits the draft. Characters are code points, so an emoji delimiter stays whole.
`null`, `delimiter="none"` and `delimiter=""` still disable splitting.

## Migration

A single-character delimiter behaves as before. A delimiter longer than one character used to
match only as one whole string, and no keystroke committed it; it now splits at each of its
characters. `npx lyra-ui-migrate --origin=lyra-v32 --check` reports each `.delimiter` property
read, write and binding on an `lr-token-input`; search markup for `delimiter="` attributes longer
than one character yourself. Where a token may contain one of those characters, use a single
delimiter character that never appears in a token.
