---
"@aceshooting/lyra-ui": minor
---

Each shipped translation catalog (`translations/<locale>.js`) was one side-effect module
registering every localizable string for every component in a single ~1,300-entry object. Because
the keys lived in one object literal reached only through a side effect, no bundler could drop the
ones an application never rendered — a French, Arabic, German, Spanish, Persian, Hebrew, Japanese,
Brazilian Portuguese, Russian or Simplified Chinese app paid roughly 14–19 KB gzip per locale for
components it never imported, the one axis where a non-English user paid for the whole catalog
while English defaults were already tree-shaken per component.

Every locale now also ships as twelve smaller **family slices** —
`translations/<locale>/<family>.js` for each of the 11 component families (`agent-tools`, `charts`,
`conversation`, `data`, `forms`, `layout`, `media`, `overlays`, `retrieval`, `utility`, `viewers`),
plus a `shared` slice for the messages more than one family reaches (roving-focus/overlay/a11y
strings like `collapse`, `open`, `search`) — each a side-effect module registering only its own
keys. Family membership reuses the exact per-component key-reachability data the English
default-string slices are generated from, so it can never drift from what actually ships in a
component's own bundle.

`translations/<locale>.js` is unchanged as a public entry point: it is now a thin, generated
re-export of every family slice for that locale, preserving the existing "one import gets
everything" behaviour and merge semantics (a later `registerLyraLocale()` call, or a per-instance
`.strings` override, still wins). Importing only the family slices an application actually renders
is a new, additive, opt-in way to shrink a non-English bundle:

```ts
import '@aceshooting/lyra-ui/translations/fr/forms.js';
import '@aceshooting/lyra-ui/translations/fr/data.js';
import '@aceshooting/lyra-ui/translations/fr/shared.js';
```

`scripts/check-translations.mjs`'s coverage/order/placeholder/plural-category rules now apply
per-slice as well as to the (still fully covered) aggregate; `scripts/scaffold-translation.mjs`
scaffolds a brand-new locale directly in the sliced shape.
