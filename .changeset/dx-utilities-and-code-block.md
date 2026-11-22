---
'@aceshooting/lyra-ui': minor
---

Developer-experience additions. `allDefined()` also accepts an options object (`match`,
`additionalElements`, `root`, `timeout`) that warns and resolves once the timeout expires; the
`(root, options)` form is unchanged. `setDefaultIconFamily()`, `getDefaultIconFamily()` and
`getDefaultIconVariant()` give `<lr-icon>` a default family and variant, and an icon library can set
`spriteSheet: true` to render a same-origin `<use>` reference. The autoloader exports `startLoader`
and `stopLoader` aliases, and `@aceshooting/lyra-ui/utilities/form.js` adds `serialize(form)`.
`<lr-code-block>` and `<lr-code-block-core>` take their source from light-DOM text (dedented, or kept
as written with `without-dedent`), wrap long lines with `wrap`, and accept `label` and `without-copy`
aliases. The CDN recipe is in the imports guide.
