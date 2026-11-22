---
'@aceshooting/lyra-ui': patch
---

Fix a server-rendered `lr-copy-button` losing its `role="group"` markup fallback during hydration. Development builds also no longer warn about Lit SSR's `defer-hydration` and `hydrate-internals-*` attributes as unknown attributes.
