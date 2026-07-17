---
description: Flag hardcoded colors/spacing and native elements that have a lyra-ui token/component equivalent
argument-hint: [path]
allowed-tools: Read, Grep, Glob, Bash(grep:*)
---

Audit the project at `$1` (default to the current working directory if `$1` is empty) for styling
that bypasses lyra-ui's design tokens, and for native HTML elements that have a direct `lyra-*`
component equivalent already in use elsewhere in the project (a sign the native element is a
leftover, not a deliberate choice).

Steps:

1. Grep CSS/style blocks and inline `style=` attributes under `$1` for hardcoded hex colors
   (`#[0-9a-fA-F]{3,8}`), `rgb(`/`rgba(`/`hsl(` literals, and hardcoded `px` spacing/sizing values
   in files that also import from `@aceshooting/lyra-ui` (skip files that don't touch lyra-ui at
   all — this command is about lyra-ui adoption, not a general lint pass).
2. For each hit, check `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/llms-full.txt`'s "Shared
   foundation: internal/" section (the design-token catalog) for a `--lyra-*` token whose
   documented default is the same or a close color/size family. Only suggest a token replacement
   when there's a genuinely matching one — don't force an unrelated token onto an unrelated value.
3. Separately, grep for native `<button>`, `<input>`, `<select>`, `<dialog>`, and `<textarea>` in
   files that already import at least one `lyra-*` component — flag each as a candidate for the
   matching `lyra-button`/`lyra-input` (or `lyra-select`/`lyra-combobox`, check both)/`lyra-dialog`/
   `lyra-textarea`, since the project has already opted into lyra-ui elsewhere.
4. Report grouped by file: for each hit, the current value/tag, the suggested `--lyra-*` token or
   `lyra-*` component, and the file:line. Do not auto-edit — this command reports only, since a
   hardcoded value flagged here might be intentional (e.g. matching a third-party brand color).
