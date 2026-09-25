---
"@aceshooting/lyra-ui": patch
---

With `math` enabled, `lr-markdown` and `lr-markdown-core` no longer read a line holding two dollar amounts, such as "$500 and $200", as inline TeX. Inline math now follows pandoc's delimiter rule: the opening `$` must be followed by a non-space, and the closing `$` must follow a non-space and must not be followed by a digit. Ordinary spans such as `$x^2$` and escaped `\$` are unchanged.
