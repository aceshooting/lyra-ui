---
'@aceshooting/lyra-ui': minor
---

`utilities.css` adds `lr-button` and `lr-card`, light-DOM classes that give a plain `<a href>` or
`<button>` the look of `<lr-button>` and any element the surface of `<lr-card>`, with nothing to
hydrate. They read the same `--lr-button-*` and `--lr-card-*` hooks and theme tokens as the
components. Variant comes from `lr-neutral|brand|success|warning|danger` and size from
`lr-size-2xs` … `lr-size-xl`, on the element or an ancestor. Appearance comes from `lr-accent`,
`lr-filled`, `lr-outlined`, `lr-filled-outlined` or `lr-plain` on the element. Hover, press, keyboard
focus, `:disabled` and `aria-disabled="true"` states, RTL, dark scopes and reduced motion are covered.
The variant classes also publish `--lr-variant-on-loud`. `lyra-ui-migrate` now rewrites Web Awesome's
`wa-button`, `wa-accent`, `wa-filled`, `wa-outlined`, `wa-plain` and `wa-pill` classes to these
counterparts instead of only reporting them.
