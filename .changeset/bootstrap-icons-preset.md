---
'@aceshooting/lyra-ui': minor
---

Add an opt-in Bootstrap Icons preset for `<lr-icon>` at
`@aceshooting/lyra-ui/components/utility/icon/icon-library-bootstrap.js`.
`registerBootstrapIconLibrary({ name?, basePath?, version? })` resolves `<name>.svg` from a pinned
jsDelivr `bootstrap-icons` release, or from a self-hosted folder, and returns an unregister
callback. Registering it as `'default'` keeps the icon names of migrated Shoelace markup rendering,
since Bootstrap Icons is Shoelace's default vocabulary. The resolver validates names and fails
closed with the localized icon alert before any request; downloads keep the existing byte cap,
sanitizing and shared cache, and importing the module registers and fetches nothing.
`createBootstrapIconResolver()`, `bootstrapIconMutator` and `BOOTSTRAP_ICONS_DEFAULT_VERSION` are
exported for custom resolvers. The migration codemod's icon review now names the matching preset:
Bootstrap Icons for `sl-icon`/`sl-icon-button`, Font Awesome for `wa-icon`.
