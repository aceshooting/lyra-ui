---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-message-actions>`: the per-message action toolbar for `lyra-chat-message`'s `actions` slot
— opt-in built-ins (`copy` / `regenerate` / `edit` / `feedback`, in `controls`-array order) that emit
intent events (`lyra-regenerate`, `lyra-edit`, plus bubbled `lyra-copy`/`lyra-change`/`lyra-submit`
from the embedded copy button and thumbs-only feedback), and a default slot for custom controls (e.g.
a slotted `lyra-branch-picker`) that participate in the toolbar's ArrowLeft/ArrowRight/Home/End
navigation. Optional `reveal-on-hover` hides the bar until the enclosing `lyra-chat-message` is
hovered or a control inside has focus.
