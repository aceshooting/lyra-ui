---
'@aceshooting/lyra-ui': patch
---

- Model, voice and prompt pickers now match search text accent-insensitively, consistent with the other searchable lists.
- `lr-icon-button` and a custom `lr-copy-button` trigger keep a consumer's `tabindex` takeover when an enclosing toolbar releases its lease, matching `lr-toggle` and the message toolbars.
- Shared internal helpers now back several duplicated descriptor, guard, clipboard and disabled-state checks; behaviour is otherwise unchanged.
