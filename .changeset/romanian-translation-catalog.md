---
"@aceshooting/lyra-ui": minor
---

Added a complete Romanian (`ro`) translation catalog, the twelfth full locale to ship with the
package. Like every other locale, it is split into twelve side-effect-only per-family slices
(`@aceshooting/lyra-ui/translations/ro/<family>.js`) plus the back-compat aggregate
`@aceshooting/lyra-ui/translations/ro.js`, covering all 1,291 keys in `LYRA_DEFAULT_STRINGS`
(including the 14 pluralized entries). Romanian's CLDR plural category set is `one`/`few`/`other`
rather than English's `one`/`other` — `few` covers `0` and `2`-`19` (and the `101`-`119`-per-hundred
band), while `other` is the `de`-requiring form from `20` upward (`"20 de rezultate"` vs.
`"2 rezultate"`) — so every pluralized message was authored with all three categories rather than
widening `few` to `other`.
