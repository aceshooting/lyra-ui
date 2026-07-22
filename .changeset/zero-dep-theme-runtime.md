---
"@aceshooting/lyra-ui": minor
---

Add `@aceshooting/lyra-ui/theme.js` — a zero-dependency theme runtime and no-flash bootstrap, so
applications stop rebuilding mode/accent persistence by hand.

The new subpath exports `setLyraTheme(theme)`, `getLyraTheme()`, the `LyraTheme`/`LyraThemeMode`
(`'light' | 'dark' | 'auto'`) types, and `lyraThemeBootstrap` — a string of head-script source you
inline before first paint to apply the persisted theme without a flash of the wrong mode. Theme
changes persist to `localStorage` and announce themselves with an `lr-theme-change` event.

The runtime deliberately does not include WCAG contrast math: deriving an accessible palette from a
single brand color is application product logic, not a library concern.
