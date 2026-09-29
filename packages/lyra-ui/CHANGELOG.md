# Changelog

## 23.0.0

### Major Changes

- f9415f2: The Storybook gallery adds a theme builder for previewing and customizing looks, with validated JSON import and export, reset controls, contrast diagnostics, and options for typography, motion, shape, elevation, and palettes. Three optional looks—data, terminal, and high contrast—join the existing choices without changing Lyra's default appearance or coupling look selection to density, contrast, mode, accent, or motion preferences.

  This major removes v21 compatibility aliases, entry points, and types whose published migration notices permit removal. The `lyra-v21` and `lyra-v22` migration profiles remain available for consumers upgrading across versions; exact aliases are rewritten, while semantic or ambiguous changes still require review. The `lr-geojson-view` element tag, its registration and event-map alias, and its direct compatibility package routes are removed. The deprecated `LyraGeojsonView` remains available through the root and viewers family exports as a distinct class through v23; removing the old tag does not remove this class.

  Compatibility APIs first deprecated in v22 remain available throughout v23 and are not eligible for removal before v24. Upstream-mirrored APIs remain available while their upstreams publish them.

  Replace the removed `utilities/localization.js` import with `localization.js`. Replace `LyraGraphLink` with `LyraGraphEdge`, and the document registry types `DocumentFile` and `DocumentRendererDefinition` with `LyraDocumentFile` and `LyraDocumentRendererDefinition`. The [migration reference](./llms/migration.md) covers retired properties, events, parts and CSS aliases, including cases that require manual review.

  The deprecated `accessible-label` attribute is removed from attachment-trigger, callout, carousel, dialog, drawer, file-input, lite-chart, progress-bar, progress-ring and reorder-item. Use the native host `aria-label`; their programmatic `accessibleLabel` properties remain available through v23. Table and sequence-strip retain both forms through v23.

  `LyraNativeTimeInput` now shares input behavior without extending `LyraInput`, so use its own class for typed references and `instanceof` checks. Its deprecated `noSpinButtons` property is removed. `LyraNumberInput` still extends `LyraInput`; both retain the mirrored `noSpinButtons` contract alongside `withoutSpinButtons`.

  The Swiss German catalog now reuses German messages where their resolved content is identical and retains Swiss-specific wording overrides. Locale loading and resolution behavior are unchanged.

### Patch Changes

- Virtual lists remeasure rendered rows after their key callback or indexed source changes, and group markers after their labels change, even when their DOM boxes keep the same size. This prevents estimated heights from replacing measured heights and overlapping rows or group headers.
- Navigation-menu indicators stay aligned with the open trigger when a sibling item resizes, in both left-to-right and right-to-left layouts.

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
