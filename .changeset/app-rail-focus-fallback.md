---
"@aceshooting/lyra-ui": minor
---

`lr-app-rail` gains an opt-in `focusFallback` property (attribute `focus-fallback`): a last-resort target for the mobile overlay's deferred focus return, tried only after every built-in target (the `trigger`/`for` association, the element that held focus at open, the built-in toggle, and the rail host) is unavailable. Set it to the application's main region when closing the overlay also takes the navigation out of the layout, so keyboard focus lands there instead of on `<body>`. It accepts an element or an id resolved in the rail's own root, like `for`; the target needs `tabindex="-1"`, and the rail never adds one. Unset (the default), behavior is unchanged.
