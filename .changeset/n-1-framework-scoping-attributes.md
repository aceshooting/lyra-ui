---
'@aceshooting/lyra-ui': patch
---

Dev-mode unknown-attribute diagnostics no longer warn about framework-owned scoping/debug
attributes

Angular's default emulated view encapsulation writes `_ngcontent-*`/`_nghost-*` scoping markers,
its dev builds add `ng-reflect-*` input reflections and `ng-version`, and Vue's scoped styles add
`data-v-*` — none of these are unknown attributes anymore. A genuinely misspelled or unsupported
attribute still warns.
