---
'@aceshooting/lyra-ui': minor
---

The `lyra-ui-migrate` codemod now rewrites more of a Web Awesome or Shoelace project:

- Translation imports such as `@shoelace-style/shoelace/dist/translations/de-ch.js` become the matching `@aceshooting/lyra-translations/de-CH.js` catalog. The built-in `en` import is removed. A bare `pt` or `zh` loads `pt-BR` or `zh-CN` and is reported for review. A locale Lyra does not ship is reported and left unchanged.
- Named imports of `serialize`, `registerIconLibrary`, `unregisterIconLibrary`, `setDefaultIconFamily`, `getDefaultIconFamily`, `getDefaultIconVariant`, `allDefined`, `setDefaultAnimation`, `setAnimation`, `getAnimation`, `getAnimationNames` and `getEasingNames` from the upstream `dist/utilities/*.js` modules are rewritten to their granular Lyra subpaths. A statement that also imports an unrecognized name stays in manual review, and the report names that symbol.
- Mapped tags in `css` tagged templates, in `::slotted()`, and in selector strings passed to `querySelector()`, `querySelectorAll()`, `closest()` or `matches()` on an element are now renamed instead of only reported.
- On a renamed Shoelace form control, `[data-user-invalid]`, `[data-invalid]`, `[data-user-valid]`, `[data-valid]`, `[data-required]` and `[data-optional]` selectors become the matching `:state()` selector when the Lyra control documents that state. Otherwise the codemod reports `VALIDATION_STATE_REVIEW`.
- CSS rules keyed on an author's own `.wa-*` class or `#wa-*` id are no longer renamed as if they were tags.
- `wa-rich-text-editor` (Web Awesome Pro) is now recognized and reported with its reason: Lyra UI has no rich-text editor counterpart.
