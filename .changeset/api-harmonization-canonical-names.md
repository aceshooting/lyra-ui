---
'@aceshooting/lyra-ui': minor
---

Lyra-only names now follow one vocabulary across the library. Each renamed attribute, property, event, part and custom property gains its canonical name, and the old name keeps working as a deprecated alias until 23.0.0:

- Cancelable events that propose a state change are named `lr-<noun>-request` (for example `lr-nav-toggle-request`, `lr-token-add-request`, `lr-chip-toggle-request`); the old event still fires after it and can still veto.
- Boolean attributes default to false: an option that is on by default is turned off with a `without-` attribute (`without-close-button`, `without-line-numbers`, `without-wrap`, `without-copy-button`, …), and opt-in spellings use `with-` (`with-legend`, `with-value`, `with-data-table`, …).
- Pointer-and-keyboard activation events are named `-activate`, graph connections are called edges, sizes use the shared `size` scale instead of `compact`, section titles use `heading`, read-only states use `readonly`, and placements use `-placement`.
- The host `aria-label` names the component; the `accessible-label` attribute spelling is deprecated.
- Forwarded parts are hyphenated, custom properties are namespaced by component, and backgrounds use the `-bg` suffix.

Old and new names stay in step in both directions (the last write wins), an old name keeps its exact public shape and reflection, and writing an old name logs a one-time development warning. `npx lyra-ui-migrate --origin=lyra-v21` rewrites the renamed markup, properties, listeners, `::part()` selectors and custom properties, and reports the uses it cannot rewrite safely. Each rename is listed in `llms/migration.md`.
