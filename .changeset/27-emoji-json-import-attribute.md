---
'@aceshooting/lyra-ui': patch
---

`lr-emoji-picker` loads its `emoji-picker-element-data` datasets with the `with { type: 'json' }` import attribute, so the default emoji set now loads under Node's native ESM loader (for example Vitest without inlining `@aceshooting/lyra-ui`) as well as in bundlers. Consumers can drop any `server.deps.inline` workaround for the picker. The build no longer strips the attribute from the published files, and both a source-policy rule and a build-artifact check reject JSON imports without it.
