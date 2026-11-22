---
'@aceshooting/lyra-ui': minor
---

Additive Web Awesome 3.15 parity:

- `lr-divider`: a default-slot label with `label-placement` (`start`, `center`, `end`) and `with-label`, parts `line`, `line-start`, `line-end` and `label`, and `--label-spacing` / `--label-offset`.
- `lr-zoomable-frame`: `allow` (filtered to a short list of low-risk Permissions Policy features; it never alters the sandbox), `name` and `label` (a host `aria-label` still wins).
- `lr-video`: `--aspect-ratio` (default `16 / 9`) and the `player` and `body` parts.
- `lr-include`: `without-fragment` includes the whole sanitized remote document and ignores the hash.
- `lr-dialog` / `lr-drawer`: `--backdrop-color` alias of `--lr-dialog-overlay-color` and the `with-label` server-rendering hint.
- Component-named part aliases next to the existing names: `close-button__button` (dialog, drawer), `tooltip__popup` and `tooltip__arrow` (tooltip), `tooltip__body` (slider), `tab-panel` (tab panel), `format-button__button`, `eyedropper-button__button` and `form-control-input` (color picker), `tag__remove-button__button` (select), `button-group` (button group) and `copy-button` (copy button).
