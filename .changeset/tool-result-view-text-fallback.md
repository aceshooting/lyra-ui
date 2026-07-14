---
"@aceshooting/lyra-ui": minor
---

`lyra-tool-result-view` gains a real `fallback="text"` mode (previously accepted as an attribute
value but silently treated identically to `"json"`): a string `result` renders as preformatted text
instead of being forced through `<lyra-json-viewer>`'s tree view, falling back to the `"json"`
behavior when `result` isn't a string. A new `copyable` property adds a copy-to-clipboard affordance
to either fallback kind. Additive — unset, both fallback kinds and every existing consumer render
byte-identical to before.
