---
description: Emit a correct @aceshooting/lyra-ui usage snippet for one component, from the real installed API
argument-hint: <component-name>
allowed-tools: Read, Grep, Bash(grep:*)
---

Produce a working usage snippet for the lyra-ui component `$1` (bare name such as `button` or full
tag such as `lr-button`; normalize to the bare name).

1. If `$1` is empty, ask which component and stop; do not guess.
2. Read `node_modules/@aceshooting/lyra-ui/llms/components/lr-$1.md` (derived from the tag,
   no search needed). If it does not exist the component does not exist: say so and suggest the
   closest names from `node_modules/@aceshooting/lyra-ui/llms/index.md`; never invent an API.
3. Extract the import path, the required and most common attributes, the default and named slots,
   and the primary events.
4. Emit the **Import** line verbatim (`import '@aceshooting/lyra-ui/components/<lr-tag>.js';`), a
   minimal realistic HTML example using only documented attributes and slots, and, when a consumer
   would typically handle one, a one-line `addEventListener` for the primary event.
5. If the reference notes a Web Awesome or Shoelace counterpart, mention it in one line.
