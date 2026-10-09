---
"@aceshooting/lyra-ui": patch
---

Docs: the native chrome guide now explains that an unlayered application `background` rule on an `.lr-surface-chrome` element beats Lyra's layered Glass fill, and shows where application fallback fills belong: a low-priority layer declared before Lyra's (`@layer app-base, lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;`) or the `--lr-surface-background` token.
