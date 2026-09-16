---
"@aceshooting/lyra-ui": patch
---

`formatNumber`, `formatDate`, `formatRelativeTime`, `formatBytes` and the exported `binValues()` now
treat an omitted `locale` as the app's active locale instead of hardcoding English. They passed the
argument straight to the Intl cache, whose resolver starts at `'en'`, so an app that called
`setLyraLocale('fr')` saw every component render French while these standalone helpers silently stayed
English — and it looked correct in any English-locale test run.

An explicit `locale` argument still wins, and an app that never calls `setLyraLocale()` gets
byte-identical output: the resolution consults only the pinned active locale and deliberately does
not fall through to `<html lang>` or `navigator.language`, since a bare function call has no host
element to resolve against.
