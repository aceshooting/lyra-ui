---
"@aceshooting/lyra-ui": patch
---
`lr-date-input` parses back every numeric date and range it displays (spaced, suffixed, year-first and collapsed-range locales) and never hands numeric text to `Date.parse()`.
