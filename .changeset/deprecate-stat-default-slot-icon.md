---
"@aceshooting/lyra-ui": minor
---

`lr-stat`'s unnamed default slot, the legacy leading-icon alias, is deprecated in favour of `slot="start"`, with removal no earlier than 23.0.0. This reverses the earlier description of it as a permanent fallback. It keeps rendering while `start` is empty, and `start` still wins when both are filled. The deprecation logs no runtime warning, so audit against the deprecation records rather than console output. Migrate `<lr-stat><svg>…</svg></lr-stat>` to `<lr-stat><svg slot="start">…</svg></lr-stat>`.
