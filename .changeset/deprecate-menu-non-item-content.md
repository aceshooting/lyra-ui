---
"@aceshooting/lyra-ui": minor
---

`lr-menu` content other than `<lr-menu-item>`/`<lr-dropdown-item>` rows, `<lr-menu-label>` captions, and `<hr>`/`<lr-divider>` separators in its default slot is deprecated, with removal no earlier than 23.0.0. Such content renders inside `role="menu"` without a menu-item role and is skipped by keyboard navigation; move filters, captions, and actions to the `header` or `footer` slot, which render outside the list with their native keyboard behavior. The default slot itself is unchanged, and the deprecated content keeps rendering until then. The deprecation logs no runtime warning, so audit against the deprecation records rather than console output. Content that `lr-dropdown` (and so `lr-context-menu`) forwards into its generated menu is not affected, because `lr-dropdown`'s default slot mirrors `sl-dropdown`'s free-form content.
