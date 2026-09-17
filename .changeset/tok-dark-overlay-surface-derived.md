---
"@aceshooting/lyra-ui": patch
---

Design tokens: derive the dark-mode overlay surface from the page surface instead of pinning it.

`--lr-color-surface-overlay` is the panel colour behind every floating surface — dropdowns,
listboxes, menus, toasts, popovers, dialogs, and the `lr-app-rail` mobile drawer. In light mode it
already resolves straight to `--lr-color-surface`, so one `--lr-theme-color-surface-default`
override carries all of them with it. Dark mode pinned a literal instead, because panel and page
resolving to the same near-black makes an open dialog read as a scrim with text floating on it and
no panel at all. The cost was that re-skinning the dark base surface left every floating surface at
the stock colour — a mismatched panel rather than a themed one.

It is now derived, keeping the elevation delta the literal existed to provide:

```css
--lr-color-surface-overlay: var(
  --lr-theme-color-surface-overlay,
  color-mix(in srgb, var(--lr-color-surface) 85%, #8bade2)
);
```

At the built-in dark base the pair resolves to the same panel colour it always has, so no existing
dark theme moves. Light mode is untouched, and an explicit `--lr-theme-color-surface-overlay` still
wins outright.
