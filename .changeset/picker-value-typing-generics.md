---
'@aceshooting/lyra-ui': minor
---

`<lr-select>` and `<lr-combobox>` are now generic on `multiple`, so TypeScript narrows their value

`LyraSelect<false>`/`LyraCombobox<false>` type `value` and `defaultValue` as `string`;
`LyraSelect<true>`/`LyraCombobox<true>` type them as `string[]`. The `lr-change`/`lr-input`/
`input`/`change` detail `value` narrows with the same parameter, and the two shapes are also
exported as `LyraPickerValue<Multiple>` and `LyraPickerDetailValue<Multiple>` for a host that wants
to name them directly.

This is types only: the runtime, the reflected attributes, and the mirrored Web Awesome / Shoelace
surface are all unchanged. The type parameter defaults to `boolean`, so an untyped `<lr-select>` —
including everything reached through `document.querySelector('lr-select')` — keeps exactly today's
`string | string[]` union and compiles unchanged.

Migration tip (not required): a project that already carried its own `as string` narrowing around a
single-select `value` can delete it, and its own linter may now flag it as unnecessary.
