---
"@aceshooting/lyra-ui": minor
---

Themeable code tab width, chat bubble geometry, and the code-block active-line outline color.

- `--lr-code-block-tab-size` (default `2`) sets the tab width of rendered code. It is honoured by
  `lr-code-block`, `lr-code-block-core`, `lr-markdown`, and `lr-markdown-core`, and shares the
  default of the existing `--lr-code-editor-tab-size`, so the editable and read-only code surfaces
  agree. The markdown viewers declare it themselves because they are sibling elements of
  `lr-code-block`, not descendants — one declaration could not have reached them. `lr-code-block`
  reads the token rather than writing `tab-size` inline, so the override survives shiki's own
  inline `style` on the highlighted `<pre>`. Note that a markdown code block wraps
  (`white-space: pre-wrap`) while `lr-code-block` does not, so the same value can render
  differently on a wrapped line, where tab stops restart.
- `--lr-chat-message-bubble-padding` (default `var(--lr-space-m)`) and
  `--lr-chat-message-bubble-radius` (default `var(--lr-radius)`) reshape `lr-chat-message`'s
  bubble. Use these instead of a `::part(bubble)` padding/radius override: an outer-tree `::part`
  declaration outranks every rule inside the component's shadow tree, which silently suppressed
  the per-`status` (`failed`, `streaming`) and per-role bubble treatments. The radius prop is
  bubble-only — `collapse-button` and `retry-button` keep reading the shared `--lr-radius`.
- `--lr-code-block-active-line-outline-color` (default `var(--lr-color-brand)`) retints only the
  outline of the line marked active by `active-highlight-id`, leaving the language pill, hover,
  and focus surfaces on `--lr-color-brand`.

All three default to exactly today's rendering, so a consumer who overrides none of them sees no
visual change.
