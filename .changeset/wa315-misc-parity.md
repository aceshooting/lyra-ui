---
'@aceshooting/lyra-ui': minor
---

`lr-popover` and `lr-dropdown` gain a property-only `virtualElement` that positions the popup against
a virtual element, any object with `getBoundingClientRect()` and an optional `contextElement` (new
`LyraPopoverVirtualElement` type), ahead of `anchor`; `anchor` and element anchors behave as before.
`lr-dropdown-item` exposes the `active`, `checked`, `disabled`, `has-submenu`, `link` and
`submenu-open` custom states. `lr-page` gains a reflected `disableSticky` property for the existing
`disable-sticky` attribute, and accepts and reflects `nonce` for migrated markup.

`lr-code-block` and `lr-code-block-core` expose the `loading`, `error` and `highlighted` custom
states and a new `lr-load` event (`detail: { highlighted }`, new `LyraCodeBlockLoadDetail` type):
`true` when highlighted output is produced, `false` when no grammar exists for `language` and the
code renders as plain text. `lr-error` keeps firing only when clipboard writing fails. Thirteen syntax colour properties (`--comment-color`,
`--keyword-color`, `--operator-color`, `--string-color`, `--constant-color`, `--function-color`,
`--type-color`, `--variable-color`, `--property-color`, `--tag-color`, `--selector-color`,
`--inserted-color`, `--deleted-color`) recolour highlighted tokens, and unset keeps the theme
colour. The copy button exposes the `copy-button__button`, `copy-button__copy-icon`,
`copy-button__success-icon`, `copy-button__error-icon` and `copy-button__feedback` parts, and
`without-copy` now reflects.
