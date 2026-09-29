# Changelog

## 22.1.0

### Minor Changes

- 7d23fd5: Complete deprecation notices, editor feedback, and migration coverage for deprecated package-root component-class exports. All APIs remain available in this release.

## 22.0.0

### Major Changes

- 5dd1d89: Add independent persisted look, surface, density, mode and accent choices, a Material-inspired look,
  glass surfaces, and contrast, motion, typography, shape, elevation and chart-palette foundations.
  Expand optional translation catalogs, add lazy locale loading, explicit locale inheritance and a
  versioned locale manifest with review provenance, and introduce components for change review, agent questions,
  permissions, connectors, background runs, research progress and budget display, with stream
  interruption and resume contracts.

  Normalize Lyra-only event details and control defaults, remove eligible legacy aliases, and make
  component class subpaths and stable tag registration paths canonical. Newly deprecated APIs remain
  available for a full subsequent major release; migration profiles identify safe rewrites and changes
  that require application review. Mirrored Web Awesome and Shoelace APIs retain their contracts.

  Require Node 22 and browsers with the Popover API. Reduce shared runtime and package overhead,
  provide optional scoped registries and a common framework type map, and reorganize contributor and
  consumer references around focused entry points.

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
