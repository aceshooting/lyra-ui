---
"@aceshooting/lyra-ui": patch
---

Docs: the consumer testing reference (`llms/shared.md`) now names a happy-dom limitation that a
vitest + happy-dom suite can hit after upgrading to 16.0.0. The seven built-in controls that now
compose `<lr-icon-button>` capture its public `--lr-icon-button-*` tokens on `:host` and forward
them back through `[part]` — legal per the CSS Custom Properties spec because `:host` and `[part]`
resolve on different elements, so no cycle exists. happy-dom (through 20.14.5) flattens both onto
one element and its `CSSVariableFormatter.resolveVariables` recurses without a visited set,
throwing an unhandled `RangeError: Maximum call stack size exceeded` per affected render — every
test still passes, but the runner exits non-zero anyway. The new note names the symptom, the cause,
and the two workarounds (patch/upgrade the DOM implementation, or run the affected suites on a real
browser). No component CSS or TypeScript changed.
