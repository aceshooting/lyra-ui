---
"@aceshooting/lyra-ui": minor
---

`registrations.json` now covers every published registration specifier, not just per-tag aliases.
The three published integration-bridge specifiers — `components/media/flag/flag-peer.js`,
`components/viewers/archive-viewer/archive-viewer-register.js` and
`components/viewers/ebook-viewer/ebook-viewer-register.js` — had no row at all, so a consumer asking
which tags importing one of them defines still had to walk `dist/`. They now appear in a new
top-level `integrations` array, each with a `registers` list derived from the module's real
transitive import closure (including the lazy `import()` a document-format registrar uses once a
matching file appears), never inferred from the file name.

Every row, in `entries` and `integrations`, also gains `distModule`: the registration module's own
published deep specifier. `registrationModule` is a `src/` path that cannot be resolved against the
tarball; `distModule` can.

The bridges live in their own array rather than as tag-less rows inside `entries`, because every
`entries` row has always carried `tag` and a reader keying by it would otherwise receive `undefined`.
All additions are additive, so `schemaVersion` stays `1`.
