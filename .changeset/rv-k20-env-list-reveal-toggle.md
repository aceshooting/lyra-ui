---
"@aceshooting/lyra-ui": major
---
lr-env-list: the reveal button no longer carries `aria-pressed` (its "Reveal {name}"/"Hide {name}" name already states the action, and "Hide …, pressed" read as the opposite), and a masked row's button now deepens while pressed. Migration: test the button's name, not `aria-pressed`, to read the reveal state.
