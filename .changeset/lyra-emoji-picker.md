---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-emoji-picker>`: a searchable, keyboard-navigable, form-associated emoji picker
(`value`/`lyra-change`, matching this library's other form-control conventions). `groups` is fully
consumer-suppliable — this component ships no emoji data of its own — with an optional convenience
auto-loader for a default set via the `emoji-picker-element-data` peer when `groups` is left unset.
Lets a consumer currently wrapping the third-party `emoji-picker-element` custom element (plus its
locale-data package) as a direct dependency replace it with a first-party `lyra-*` component instead.
