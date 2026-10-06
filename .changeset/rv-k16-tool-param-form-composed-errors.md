---
"@aceshooting/lyra-ui": major
---
lr-tool-param-form: boolean fields no longer repeat their description and error below the composed select, and number, enum and boolean errors are announced like text-field errors. Migration: `::part(description)`/`::part(error)` no longer match boolean fields; style the composed select instead.
