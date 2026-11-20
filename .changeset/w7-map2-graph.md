---
'@aceshooting/lyra-ui': patch
---

- Smaller published styles: Lit `css` templates that interpolate shared fragments now also drop the
  spaces CSS ignores around braces, semicolons, commas and declaration colons, and the last
  semicolon of each block. Strings, URLs, `calc()` operators, descendant combinators and the space
  between two interpolations are kept.
- Smaller published SVG markup: `svg` templates get the same start-tag whitespace compaction as
  `html` templates. Text and attribute values are unchanged.
