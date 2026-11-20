---
'@aceshooting/lyra-ui': patch
---

Style consolidation:

- Every keyboard focus ring (including inset, inward, offset-only and coloured variants) now comes from one set of shared fragments, and `check-style-vocabulary` fails a hand-written `outline` built from the focus-ring tokens.
- Remaining hover and press fills (text-colour mixes, solid-fill buttons, translucent washes) use shared fill helpers; computed colours are unchanged.
- Interactive rows and buttons now transition through `--lr-transition-interactive` (fill, text and border colour) instead of only `background-color`, and the controls that had no pointer transition (toggles, preview buttons, clear and remove buttons, widget actions, map activation, poster play button) gained it. Tune or flatten it with the `--lr-transition-interactive` token.
- The chart data-table toggle now has hover and pressed fills like the other bordered actions.
- Pagination, clear and navigator buttons in retrieval-compare, signature-pad and flow-canvas share one bordered action recipe; a disabled signature-pad clear button now shows the `not-allowed` cursor like other disabled controls.
- Checkbox, slider, signature-pad and file-input hint and error text share the form-control tone.
- `lr-*` size tiers resolve through one shared definition for the unconditional and the contextual ladders; both read the theme-chained tier height and floor it at the coarse-pointer target minimum identically.
- Search, error, warning, plus, minus, fit and lock glyphs, and the `<lr-icon>` search and refresh paths, come from the shared icon set.
