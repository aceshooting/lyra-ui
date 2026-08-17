---
"@aceshooting/lyra-ui": minor
---

Restore `./components/viewers/archive-viewer/archive-viewer-register.js` and
`./components/viewers/ebook-viewer/ebook-viewer-register.js` as importable package subpaths. Both
files register a `<lr-document-viewer>` renderer (`application/zip`/`.zip` and
`application/epub+zip`/`.epub` respectively) and are genuinely opt-in for a granular consumer not
using the `all.js` compatibility bundle. Neither had an entry in `package.json`'s `exports` map, so
the documented import pattern (matching `flag-peer.js`'s precedent) hit
`ERR_PACKAGE_PATH_NOT_EXPORTED` even though both files ship in `dist/` and are correctly declared in
`sideEffects` — the same defect class as the historical `flag-peer.js` `sideEffects` omission, this
time in the exports map instead.
