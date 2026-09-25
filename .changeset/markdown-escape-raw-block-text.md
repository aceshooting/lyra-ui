---
'@aceshooting/lyra-ui': patch
---

lr-markdown and lr-markdown-core with `html-mode="escape"` now escape all text that follows a raw `<pre>`, `<code>`, `<kbd>` or `<script>` tag, in the same paragraph and in every later block, so it displays as literal text like the rest of the raw HTML in that mode. Escape-mode output without such a tag is unchanged, and sanitize and trusted modes are unaffected. The `htmlMode` documentation now states that a consumer `renderer.text` or `renderer.html` override replaces the escape-mode escaping.
