---
"@aceshooting/lyra-ui": minor
---

`lr-menu`: Escape from `header`/`footer` content closes the menu and refocuses the trigger
unconditionally, with no opt-in required.

That matches `<lr-popover>`, which already dismisses on Escape from arbitrary popup content, and it
is the only sensible contract for a region the component now positively invites you to fill: a
filter field you can Tab into but not Escape out of is a trap.

- `closeOnEscapeAnywhere` is **unchanged** — not deprecated, still `false` by default, and still
  governing exactly one thing: Escape from non-item content slotted into the **default** slot.
  Escape bubbling up from inside `[part='list']` is left entirely to the list's own handler.
- Arrow/ArrowUp/Home/End/Enter/Space from header/footer content keep their full native behavior;
  the item-target gate that guarantees that is untouched, and nothing in the new region handler
  calls `preventDefault()` for those keys.
