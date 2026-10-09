---
'@aceshooting/lyra-ui': minor
---

Add `CheckedFormAssociated`, a checked-mode variant of the `FormAssociated` mixin (value submitted only while `checked`, native `defaultChecked`/dirty semantics, reset and state restore, required means checked), and move `<lr-checkbox>`, `<lr-switch>` and `<lr-radio>` (and `<lr-radio-button>`) onto it. The mixin carries the shared form surface (`form`, `labels`, `validity`, custom validity, fieldset disablement, reset, restore), with hooks for group disablement, the veto-guard and owner bookkeeping, and the control's own validity message; behavior is unchanged. Each control gains the native `defaultValue` alias of `value` and the mixin's `setFormValue()`/`internals`. The dark `--lr-color-surface-overlay` default is now authored as a fixed `#171717` in the canonical token source, matching the runtime.
