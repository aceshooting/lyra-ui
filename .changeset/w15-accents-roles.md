---
'@aceshooting/lyra-ui': minor
---

Remap any semantic colour role declaratively. Import the new opt-in `accent-roles.css` and set `data-lr-accent-neutral`, `data-lr-accent-success`, `data-lr-accent-warning` or `data-lr-accent-danger` to a gemstone (`emerald`, `peridot`, `topaz`, `ruby`, `tourmaline`, `amethyst`, `aquamarine`, `sapphire`, `hematite`), or to `none` to restore the look's own colours. The role then gets the same contrast-qualified light and dark ramp that `data-lr-accent` gives brand. The attributes work on any element and nest. They are theme scopes, they follow the nearest mode and they give way to system colours under forced colours. Brand and focus stay with `data-lr-accent`, and nothing changes without the attributes. `theme.css` and `theme-core.css` gain only the four scope selectors.
