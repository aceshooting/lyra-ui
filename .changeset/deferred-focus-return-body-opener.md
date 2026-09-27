---
"@aceshooting/lyra-ui": patch
---

`lr-app-rail` and `lr-page` now finish their documented focus return when their mobile overlay was opened while nothing held focus, for example by script (`rail.open = true`, `page.showNavigation()`) or by a click that does not focus its button. Previously the close left focus where it was: on `<body>` for `lr-page`, and for `lr-app-rail` on the navigation control the overlay had focused when it opened, inside the now-closed navigation. Now `lr-app-rail` moves it to its built-in toggle, or to the rail host under `hide-toggle`, and `lr-page` moves it to its navigation toggle, or to its main region under `disable-navigation-toggle`. Because focus now actually moves, screen readers announce the new target, and the browser may scroll that target into view. `lr-dialog`, `lr-drawer`, `lr-responsive-panel` and `lr-multi-split` are unchanged.
