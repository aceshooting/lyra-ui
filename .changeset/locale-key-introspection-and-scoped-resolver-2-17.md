---
"@aceshooting/lyra-ui": minor
---

Added `getRegisteredLyraLocaleKeys(locale)` to `@aceshooting/lyra-ui/localization.js`: a frozen
snapshot of exactly the keys a registered locale's own catalog carries, with no BCP-47
fallback-chain widening and no merge with the built-in English defaults. Diff its length against
`Object.keys(LYRA_DEFAULT_STRINGS).length` to measure a locale's own translation coverage without a
silent English-fallback merge making a partial catalog look complete.

In development builds (silent in production), resolving a message for a non-English resolved
locale that has no override, no fallback, and no registered catalog entry for that key now warns
once per (locale, key) to `console.warn` before silently falling back to the English default.

Added `resolveLyraScopedString(host, key, defaults, overrides?, fallback?, values?)` to
`@aceshooting/lyra-ui/utilities/localization.js`: a scoped variant of `resolveLyraString()` that
resolves against a caller-supplied `defaults` record instead of the complete built-in English
catalog, so an application resolving a handful of its own messages never has to pull in the whole
compatibility catalog to do it.
