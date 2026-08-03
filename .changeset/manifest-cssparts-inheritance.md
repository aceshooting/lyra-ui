---
"@aceshooting/lyra-ui": patch
---

Fix `custom-elements.json` under-reporting `cssParts` for components that extend another
component's class (e.g. `<lr-number-input>` extending `<lr-input>`, `<lr-dropdown>` extending
`<lr-popover>`). The manifest-compaction step pruned any inherited-and-resolvable entry — including
CSS parts — off a subclass's own declaration, on the assumption that a consumer would walk the JS
`extends` chain to see the full contract, the same way it does for members/attributes. Unlike those,
`::part()` has no such chain for its consumers (docs generators, editor tooling, `::part()` usage
checks), which read a tag's `cssParts` list directly, per tag — exactly how `cssStates` already
behaved. `<lr-number-input>` now declares `form-control`, `form-control-label`, `input-wrapper`, and
`input` (inherited from `<lr-input>`) in addition to its own parts, and `<lr-dropdown>` now declares
`trigger`, `popup`, `dialog`, `popup__popup`, `content`, `body`, `arrow`, and `popup__arrow`
(inherited from `<lr-popover>`). 15 other components with the same inheritance shape (the icon
charts, `<lr-native-time-input>`, `<lr-radio-button>`, `<lr-accordion-item>`, `<lr-dropdown-item>`,
`<lr-tag>`, `<lr-drawer>`) gained the same correction. Generated docs (`llms/components/*.md`) and
other manifest consumers were already unaffected, since they already read parts through
`expandManifestInheritance()`; only the checked-in compact manifest itself was missing them.
