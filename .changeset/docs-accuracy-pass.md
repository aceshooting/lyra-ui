---
"@aceshooting/lyra-ui": patch
---

Correct and tighten the shipped documentation and agent skills.

- The README upgrade guidance is one table covering every major release since v22, with the matching `lyra-ui-migrate` profile for each.
- The exported TypeScript contracts in `llms/shared/events-and-types.md` now print their real member, parameter and return types instead of `unknown` placeholders.
- Relative links in generated `llms/shared.md`, `llms/components/<tag>.md` and `llms-full.txt` now resolve from their published location.
- Accessible-name guidance no longer describes `accessibleLabel` compatibility properties that were already removed.
- `lyra-ui-migrate --help` describes the `lyra-v25` profile.
- The bundled agent skills drop guidance for past upgrades, list `@aceshooting/lyra-map` among independently versioned companions, name every rename profile, and prefer the installed package's `llms/` reference over the plugin copy.
