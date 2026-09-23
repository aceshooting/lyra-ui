---
'@aceshooting/lyra-ui': major
---

`lr-combobox` and `lr-otp-input` now declare `appearance` as a validating accessor: any value outside the documented set (including a raw attribute) is normalized to the `'outlined'` default and the reflected attribute is repaired, instead of silently rendering unstyled. Migration: TypeScript subclasses that redeclared `appearance` as a field must override the accessor (`get`/`set`) instead; reads and writes from consumer code are unchanged.
