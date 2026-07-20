---
"@aceshooting/lyra-ui": minor
---

`lr-token-input` can now edit a token in place. Set `editable` and each token becomes a roving tab
stop that opens an inline editor on click, Enter, or F2: Enter commits and emits
`lr-token-edit` with `{ value, previousValue, index }`, Escape reverts silently, and a blur commits
without stealing focus back. New `token-label` and `token-editor` CSS parts (rendered only while
`editable` is set) and a `--lr-token-input-editor-inline-size` custom property style the two states;
with `editable` unset the token row renders exactly as before and stays non-focusable.

`delimiter` now accepts `null` — as a property, or via `delimiter="none"` / `delimiter=""` — so a
token may contain commas verbatim (`Bash(git status:*)`): nothing is split and no keystroke is
treated as a commit key. Removing the attribute restores the `,` default, and an empty delimiter no
longer explodes a draft into one token per character.
