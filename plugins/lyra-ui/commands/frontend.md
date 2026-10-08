---
description: Review a consumer project's lyra-ui usage for correctness, tokens and native-element adoption, a11y/i18n/RTL, and performance
argument-hint: [path]
allowed-tools: Read, Grep, Glob, Bash(grep:*)
---

Review the frontend at `$1` (default: the current working directory) for how it uses
`@aceshooting/lyra-ui`. Read-only: report findings and let the user ask for fixes afterwards.

Every claim is checked against `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/components/<lr-tag>.md`
(path derived from the tag), never against memory. Check, in order:

1. **API correctness.** For every `lr-*` tag, compare the attributes, slots and listened events with
   its reference. Flag nonexistent attributes (typo or stale API), missing required attributes or
   slots, and listeners for events the component never fires.
2. **Accessibility.** Components own their internal ARIA: flag consumer `role`/`aria-*` that
   duplicates or conflicts with the documented behavior, and `lr-*` form controls with no `label`
   attribute or `<label>`.
3. **i18n/RTL.** Flag hardcoded user-facing English passed into slots or attributes of components
   that support `.strings`/`registerLyraLocale()`, and physical CSS (`left`/`right`,
   `margin-left`, `text-align: left`) in rules touching `lr-*`.
4. **Performance.** Flag side-effect imports never used in the importing file, one component
   imported through several specifiers, and root-barrel or `all.js` imports where per-component
   registration is documented.
5. **General bugs.** Properties written that the reference documents as read-only, `disabled` read
   where `effectiveDisabled` is documented, native `click`/`input` listened for where the reference
   says to use the `lr-*` event, complex values passed as attributes instead of properties.
6. **Tokens and native elements.** In files that import lyra-ui, grep style blocks and `style=` for
   hex colors, `rgb(`/`rgba(`/`hsl(` and hardcoded `px` spacing. Suggest a replacement only when
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/tokens.md` has a genuinely matching token
   (documented default in the same color or size family); a brand color may be intentional, so flag
   rather than assume. Also flag native `<button>`, `<input>`, `<select>`, `<dialog>`, `<textarea>`
   in files that already import an `lr-*` component, as candidates for the matching Lyra component
   (check both `lr-select` and `lr-combobox`).

Report grouped by category, each finding with `file:line` and a one-line fix grounded in what the
reference documents.
