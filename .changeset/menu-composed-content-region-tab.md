---
"@aceshooting/lyra-ui": minor
---

`lr-menu`: Tab now moves focus into the `header`/`footer` regions instead of closing the menu, and
tabbing out of the popup's last focusable finally closes it.

Two halves of the same defect. `onListKeyDown` gated every key except Escape behind "is the event
target a real `<lr-menu-item>`?", so (a) Tab from an item always closed the menu — you could never
Tab *into* composed content, in either direction, since Shift+Tab is `key === 'Tab'` too — and
(b) Tab from composed content did nothing at all: focus walked out of the popup while the menu
stayed open, an untested dismissal hole.

Tab handling therefore moves from `[part='list']` to `[part='popup']`, which also sees keydowns from
the new regions, and the menu now closes only when Tab would leave the popup entirely:

- Tab from an item with a focusable `footer` (or Shift+Tab with a focusable `header`) keeps the menu
  open and lets the browser's own Tab advance carry focus into the region.
- Tab out of the last focusable in the popup — in either direction, from an item or from composed
  content — closes the menu.
- **With no header/footer content, Tab closes exactly as before**, and non-item content in the
  default slot stays deliberately Tab-unreachable from an item.
- `preventDefault()` is still never called for Tab, in any branch: native focus navigation proceeds
  untouched, only the now-stale open state is cleared.
