---
"@aceshooting/lyra-ui": minor
---

New `localeNativeName(tag)` helper next to `languageToCountry()` / `LANGUAGE_TO_COUNTRY`: it returns
a locale's endonym — its name written in that locale itself (`'fr'` → `français`, `'pt-BR'` →
`português (Brasil)`) — which is what a language switcher should list. It reads through the shared
memoized `Intl.DisplayNames` cache, so no name table ships and repeat lookups are free, and it
degrades to the tag itself for an unknown or structurally invalid tag instead of throwing. Paired
with `languageToCountry()` and `lr-popover`, it composes the locale-picker recipe shown in the new
Flag story.
