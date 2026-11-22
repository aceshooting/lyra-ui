---
'@aceshooting/lyra-ui': minor
---

Add an opt-in Font Awesome preset for `<lr-icon>` at
`@aceshooting/lyra-ui/components/utility/icon/icon-library-font-awesome.js`.
`registerFontAwesomeIconLibrary({ name?, kitCode?, basePath?, version?, defaultFamily?, defaultVariant? })`
resolves the free tier (`classic` solid/regular and `brands`) from a pinned release, and every Pro and
Pro+ family (`duotone`, `sharp`, `sharp-duotone`, `jelly`, `utility`, …) through a kit code or a
self-hosted copy. It honours `setDefaultIconFamily()` and the per-icon `family`/`variant`, and
returns an unregister callback. The resolver validates names, families and variants and fails closed
with the localized icon alert before any request is made; downloads keep the existing byte cap,
sanitizing and shared cache. Importing the module registers and fetches nothing, so icons stay
offline-first until the preset is registered. `createFontAwesomeIconResolver()`,
`fontAwesomeIconFolder()`, `fontAwesomeIconMutator` and `FONT_AWESOME_DEFAULT_VERSION` are exported
for custom resolvers.
