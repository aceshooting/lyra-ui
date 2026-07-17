---
description: Review a consumer project's lyra-ui usage for correctness, a11y/i18n/RTL, and performance
argument-hint: [path]
allowed-tools: Read, Grep, Glob, Bash(grep:*)
---

Review the frontend at `$1` (default to the current working directory if `$1` is empty) for how it
uses `@aceshooting/lyra-ui`. This is a read-only review — report findings, don't edit code (the
user can ask for fixes once they've seen the list).

Check, in this order:

1. **API correctness.** For every `lyra-*` tag found, cross-check the attributes/slots/events
   actually used against `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/llms-full.txt`'s section
   for that component. Flag: attributes that don't exist on that component (likely a typo or a
   stale API assumption), required attributes/slots that are missing, and event names listened for
   that the component doesn't actually fire.
2. **Accessibility.** lyra-ui components handle their own internal ARIA — flag places where the
   consumer redundantly or incorrectly adds `role`/`aria-*` attributes that duplicate or conflict
   with what the component already sets internally (per that component's documented a11y behavior
   in the reference), and places using a `lyra-*` form control without an associated `label`
   attribute or `<label>` element.
3. **i18n/RTL.** Flag hardcoded user-facing English strings passed into `lyra-*` component slots or
   attributes where the component supports localization (check the component's `.strings`/locale
   support in the reference) — these should go through the project's own i18n mechanism instead.
4. **Performance.** Flag side-effect imports of components that are never actually used in the
   file that imports them (dead imports), and cases where the same component is imported via more
   than one different specifier path in the project (signals accidental duplication in the bundle).
5. **General bugs.** Anything else that looks wrong specifically in how lyra-ui is being used —
   e.g. mutating a component's property when the reference documents it as read-only, or listening
   for a native event (`click`, `input`) where the component's reference says to use its
   `lyra-*`-prefixed custom event instead for correct behavior.

Report grouped by category above, each finding with file:line and a one-line fix suggestion
grounded in what the reference actually documents — not a generic best-practice guess.
