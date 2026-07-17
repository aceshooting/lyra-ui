---
description: Emit a correct @aceshooting/lyra-ui usage snippet for one component, from the real installed API
argument-hint: <component-name>
allowed-tools: Read, Grep, Bash(grep:*)
---

Produce a working usage snippet for the lyra-ui component named `$1` (accept either the bare name,
e.g. `button`, or the full tag, e.g. `lyra-button` — normalize to the bare name for lookup).

Steps:

1. If `$1` is empty, ask the user which component they want and stop — do not guess.
2. Search `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/llms-full.txt` for that component's
   section (its heading is `## \`lyra-$1\`` or `### \`lyra-$1\`` — check both levels, since some
   components are documented as a family, e.g. `lyra-combobox` / `lyra-option`). If no matching
   section is found, say so explicitly and suggest the closest-named matches instead of inventing
   an API.
3. From that section, extract: the import path, the required/most common attributes, any default
   slot or named slots, and the primary event(s) a consumer would listen for.
4. Emit:
   - The import statement (`import '@aceshooting/lyra-ui/components/<name>/<name>.js';`).
   - A minimal but realistic HTML usage example using only attributes/slots documented in that
     section — do not add attributes that aren't in the reference, even if they'd be common on a
     similar native/other-library element.
   - If the component fires an event a consumer would typically handle (e.g. `lyra-change`), show
     a one-line `addEventListener` example for it too.
5. If the component has a documented Web Awesome or Shoelace equivalent noted in the reference,
   mention it in one line (useful context, not the main deliverable).
