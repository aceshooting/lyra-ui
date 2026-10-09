---
"@aceshooting/lyra-ui": minor
---

`@aceshooting/lyra-ui/testing` adds four interaction drivers: `chooseSwatch(picker, value)` for `<lr-swatch-picker>`, `chooseCurrency(picker, code)` for `<lr-currency-picker>` (including a `searchable` picker's lazily loaded combobox), and `openPopover(popover, options?)`/`closePopover(popover, options?)` for `<lr-popover>`. They act through the components' own pointer and keyboard paths (a swatch or option click, a trigger click, Escape or `{ via: 'trigger' }`), resolve after the component's own events (`lr-change`/`lr-activate`, the picker's `input`/`lr-input`/`change`/`lr-change`, `lr-after-show`/`lr-after-hide`), and throw instead of silently doing nothing when the interaction is refused (disabled, unknown value, vetoed lifecycle, manual trigger). Like the existing drivers they use plain DOM operations, with no test-runner-only helper.
