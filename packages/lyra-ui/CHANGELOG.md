# Changelog

## 24.0.0

### Major Changes

- aa25ee4: Remove the eligible v22 compatibility APIs after their supported v23 transition period. Use granular component registration and class imports, the independent style APIs, and the `lyra-v21` and `lyra-v22` migration profiles when upgrading. Upstream-mirrored aliases and saved style-preference readers remain supported.

  Consolidate component implementations and behavioral tests, refresh library documentation, and qualify styling, localization, package costs and representative compositions for the new release.

  Data grids resolve themed row heights once per measurement pass, reducing repeated layout work for large and expanded tree views while preserving live theme changes.

  Clearing a component's locale override now observes the inherited locale even when the public locale resolver was called before its next render. Time inputs reuse the active locale's native-digit map across keystrokes while continuing to accept ASCII digits. Media controls share locale-aware time formatting, and animation timing uses a shared CSS time parser; the AV player retains its whole-second rounding behavior.

  Map data layers skip unused fallback color resolution when explicit colors are valid. Command palettes project visible result rows plus the active row without filtering every group, and Lite Chart reuses the category-label width it already measured for automatic axis selection. These changes preserve the existing rendered and interaction contracts; no latency claim is implied.

  Lite Chart no longer reads the retired `accessibleLabel` property as a fallback. Streaming text documents and types its existing internal-link event, while RAG answers contain their owned markdown child's link events. Buttons share identical slot and focus handlers, and locale resolution shares one cache record per component.

  The package README, migration guides and agent skill now route to focused v24 import, styling, SSR and event-detail guidance. Historical roadmap scope remains available through stable anchors and focused pages.

  Event-detail migration diagnostics distinguish payload fields from component properties, avoiding conflicting advice for `lr-app-rail-group` listeners. The retained migration profiles continue to report manual changes for consumers upgrading across multiple major versions.

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
