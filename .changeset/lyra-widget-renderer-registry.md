---
"@aceshooting/lyra-ui": minor
---

Adds `lyra-widget-renderer`'s internal type registry (`registerWidgetType()`,
`getDefaultWidgetTypeRegistry()`) and its security-critical, DOM-free allowlist resolver
(`resolveTree()`): unknown widget types and disallowed/mistyped props are skipped, never rendered;
`forcedProps` always win; a child's `slot` outside its parent's allowlist renders unslotted; depth
(32) and node-count (5000) caps are enforced. No public API surface change on its own — groundwork
for the `<lyra-widget-renderer>` element, landing in the same release.
