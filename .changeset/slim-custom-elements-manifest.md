---
'@aceshooting/lyra-ui': minor
---

`@aceshooting/lyra-ui` now sets its `customElements` field to a slim Custom Elements Manifest, `custom-elements.slim.json` (also the `@aceshooting/lyra-ui/custom-elements.slim.json` export), so Storybook, wc-toolkit and analyzers discover every tag without installing `@aceshooting/lyra-ide`.

- Per tag it lists attributes (name, `fieldName`, type, default), public fields and methods, events, slots, CSS parts, CSS properties and CSS states, flattened across superclasses, with module paths at the shipped `dist/` files and each tag's `components/lr-<tag>.js` definition.
- Descriptions, status, `since`, deprecation records and the companion packages' tags stay in the full manifest, which `@aceshooting/lyra-ide` keeps publishing with `web-types.json` and the VS Code data; `@aceshooting/lyra-ui/custom-elements.json` still does not resolve.
- The tarball grows by the one file (about 1.5 MB unpacked); the unpacked ceiling and the file-count derivation are raised by exactly that.
