---
"@aceshooting/lyra-ui": minor
---

`lyra-tool-param-form`'s validation messages (required field, wrong type for a string/number/
integer/boolean, enum mismatch, const mismatch, unsupported field type, malformed schema shape,
non-serializable value) now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
