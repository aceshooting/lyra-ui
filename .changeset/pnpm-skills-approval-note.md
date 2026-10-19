---
'@aceshooting/lyra-ui': patch
---

The README and `llms.txt` now explain why pnpm 12.14 and later list `@aceshooting/lyra-ui` under "Agent skills awaiting approval" after an install: the package ships its agent skills. Nothing runs at install time and `npx lyra-ui init-agents` works either way; `pnpm approve @aceshooting/lyra-ui` (or `pnpm approve '!@aceshooting/lyra-ui'`) records the decision once.
