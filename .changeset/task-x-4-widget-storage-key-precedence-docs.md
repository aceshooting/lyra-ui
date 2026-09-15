---
"@aceshooting/lyra-ui": patch
---

`<lr-widget>`: documented that an explicit `collapsed` assignment before the first update —
an attribute, a property, or a framework binding, including one that pins the property to its own
default `false` — always wins over a `storageKey`-restored value and skips the restore for that
mount. The `storageKey` and `collapsed` doc comments (and the generated reference) no longer claim
an "identical" pattern with `<lr-app-rail>`/`<lr-table>`; instead they name the shared
explicit-beats-persisted guarantee, which `<lr-table>`'s own `storageKey` doc already states in
matching language (`<lr-app-rail>` implements the same guard but does not yet spell out the
precedence in its own public docs — that gap is unchanged by this fix). A new Known gotchas entry
covers uncontrolled persistence: don't bind `collapsed`, read the restored value back after
`updateComplete` and track further changes from `lr-collapse-change`. No behavior changed — the
guard itself already shipped.
