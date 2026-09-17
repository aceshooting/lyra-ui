---
"@aceshooting/lyra-ui": patch
---

Docs: state the icon-button size scopes and the derived dark overlay surface in `llms/shared.md`.

Three properties now resize icon-only controls and they differ only in how far they reach, which is
not something a consumer can infer from the names: `--lr-theme-icon-button-size` is
application-wide, `--lr-icon-button-size-scope` covers one subtree, and `--lr-icon-button-size` is
element-scoped because the shared token layer re-declares it on every host. The reference now says
so in one table, with the precedence order and the coarse-pointer floor spelled out, instead of
leaving "my wrapper rule does nothing" to be rediscovered per project.

The overlay-surface entry records that `--lr-color-surface-overlay` follows
`--lr-theme-color-surface-default` in dark mode as well as light, so a single base-surface override
re-skins every dropdown, listbox, menu, toast and drawer, and explains why dark derives the value
rather than resolving straight to the page surface the way light does.
