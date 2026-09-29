---
"@aceshooting/lyra-ui": major
---

The Storybook gallery adds a theme builder for previewing and customizing looks, with validated JSON import and export, reset controls, contrast diagnostics, and options for typography, motion, shape, elevation, and palettes. Three optional looks—data, terminal, and high contrast—join the existing choices without changing Lyra's default appearance or coupling look selection to density, contrast, mode, accent, or motion preferences.

This major removes v21 compatibility aliases, entry points, and types whose published migration notices permit removal. The `lyra-v21` and `lyra-v22` migration profiles remain available for consumers upgrading across versions; exact aliases are rewritten, while semantic or ambiguous changes still require review. The `lr-geojson-view` element tag, its registration and event-map alias, and its direct compatibility package routes are removed. The deprecated `LyraGeojsonView` remains available through the root and viewers family exports as a distinct class through v23; removing the old tag does not remove this class.

Compatibility APIs first deprecated in v22 remain available throughout v23 and are not eligible for removal before v24. Upstream-mirrored APIs remain available while their upstreams publish them.

The Swiss German catalog now reuses German messages where their resolved content is identical and retains Swiss-specific wording overrides. Locale loading and resolution behavior are unchanged.
